// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"bytes"
	"context"
	"time"

	"github.com/johnfercher/maroto/v2"
	"github.com/pkg/errors"
)

// PageSize selects the PDF page geometry.
type PageSize int

const (
	PageSizeA4 PageSize = iota
	PageSizeLetter
)

// RenderOptions controls a single render invocation.
//
// Locale is resolved by the caller from the requester's Mattermost profile
// and passed in; the renderer does not reach into any session state.
//
// Clock returns Unix milliseconds. Defaults to time.Now().UnixMilli() when nil.
// Injected for deterministic golden tests.
type RenderOptions struct {
	Sections SectionFlags
	Locale   string
	MaxPosts int
	MaxBytes int64
	PageSize PageSize
	Clock    func() int64
}

// now is RenderOptions.Clock with the default wall-clock fallback.
func (o RenderOptions) now() int64 {
	if o.Clock != nil {
		return o.Clock()
	}
	return time.Now().UnixMilli()
}

// SectionFlags selects which sections are included in a render.
//
// Run sections: Cover, ExecutiveSummary, Timeline, StatusUpdates, Checklists,
// Retrospective, Transcript.
//
// Playbook sections: PlaybookOverview, PlaybookChecklistTemplates,
// PlaybookSettings.
type SectionFlags struct {
	Cover            bool
	ExecutiveSummary bool
	Timeline         bool
	StatusUpdates    bool
	Checklists       bool
	Retrospective    bool
	Transcript       bool

	PlaybookOverview           bool
	PlaybookChecklistTemplates bool
	PlaybookSettings           bool
}

// DefaultRunSections returns the default section set for a run export:
// everything except the transcript.
func DefaultRunSections() SectionFlags {
	return SectionFlags{
		Cover:            true,
		ExecutiveSummary: true,
		Timeline:         true,
		StatusUpdates:    true,
		Checklists:       true,
		Retrospective:    true,
		Transcript:       false,
	}
}

// DefaultPlaybookSections returns the default section set for a playbook
// export: all playbook-specific sections enabled.
func DefaultPlaybookSections() SectionFlags {
	return SectionFlags{
		PlaybookOverview:           true,
		PlaybookChecklistTemplates: true,
		PlaybookSettings:           true,
	}
}

// MarotoRenderer is the concrete PDF renderer.
//
// One instance is constructed at plugin startup (fonts loaded once, styles
// initialized once) and shared across requests. The Render methods are
// safe for concurrent use; per-request state lives in the RenderContext +
// RenderOptions, never on the struct.
//
// No interface is exposed — see plan §4.3 (MF-9). A future second
// implementation will define an interface shaped by its real needs.
type MarotoRenderer struct {
	fonts FontPack
}

// NewMarotoRenderer constructs a MarotoRenderer with embedded assets.
// It is intended to be called once at plugin startup.
func NewMarotoRenderer() (*MarotoRenderer, error) {
	fonts, err := loadEmbeddedFonts()
	if err != nil {
		return nil, err
	}
	return &MarotoRenderer{
		fonts: fonts,
	}, nil
}

// RenderRun renders a Playbook Run as a PDF.
//
// The caller has already permission-scoped every field in rc and pre-built
// rc.Resolvers; this renderer makes no external calls.
//
// On success returns a buffer containing the full PDF; the caller is
// responsible for atomic emission (Content-Length + single Write). The
// buffer's underlying capacity is bounded by opts.MaxBytes.
//
// On in-flight error, the returned buffer is nil and the caller emits a
// canonical JSON error via HandleErrorWithCode (no partial PDF is ever sent).
//
// Truncation (transcript cap hit) is signaled in the returned buffer's
// footer page AND in rc.TranscriptTruncation, which the caller surfaces via
// the X-Playbooks-Report-Truncated[-Reason] response header.
func (r *MarotoRenderer) RenderRun(ctx context.Context, rc RenderContext, opts RenderOptions) (*bytes.Buffer, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	labels := NewLabels(opts.Locale)
	cfg, styles := buildMarotoConfig(r.fonts, opts.PageSize, labels, labels.ReportTitleRun())
	m := maroto.New(cfg)

	if err := registerHeaderFooter(m, styles, labels.ReportTitleRun()); err != nil {
		return nil, errors.Wrap(err, "register run header/footer")
	}

	sections := opts.Sections

	if sections.Cover {
		addCover(m, styles, rc, labels, opts)
	}
	if sections.ExecutiveSummary {
		addExecutiveSummary(m, styles, rc, labels, opts)
	}
	if sections.Timeline {
		addTimeline(m, styles, rc, labels, opts)
	}
	if sections.StatusUpdates {
		addStatusUpdates(m, styles, rc, labels, opts)
	}
	if sections.Checklists {
		addChecklists(m, styles, rc, labels, opts)
	}
	if sections.Retrospective {
		addRetrospective(m, styles, rc, labels, opts)
	}
	if sections.Transcript {
		t := addTranscript(m, styles, rc, labels, opts)
		rc.TranscriptTruncation = t
	}

	doc, err := m.Generate()
	if err != nil {
		return nil, errors.Wrap(err, "generate run PDF")
	}

	raw := doc.GetBytes()
	if opts.MaxBytes > 0 && int64(len(raw)) > opts.MaxBytes {
		raw, rc.TranscriptTruncation = runByteCappedFallback(r, labels, opts, "bytes")
	}

	return bytes.NewBuffer(raw), nil
}

// runByteCappedFallback emits a minimal one-page truncation notice when the
// assembled run PDF exceeds opts.MaxBytes. The caller surfaces the truncation
// state via the response header; the body remains a valid PDF.
func runByteCappedFallback(r *MarotoRenderer, labels *Labels, opts RenderOptions, reason string) ([]byte, Truncation) {
	cfg, styles := buildMarotoConfig(r.fonts, opts.PageSize, labels, labels.ReportTitleRun())
	m := maroto.New(cfg)
	_ = registerHeaderFooter(m, styles, labels.ReportTitleRun())

	addSectionHeading(m, styles, labels.ReportTitleRun())
	addBodyText(m, styles, labels.TranscriptTruncated(reason, 0))

	doc, err := m.Generate()
	if err != nil {
		return []byte{}, Truncation{Hit: true, Reason: reason}
	}
	return doc.GetBytes(), Truncation{Hit: true, Reason: reason}
}

// RenderPlaybook renders a Playbook (template) as a PDF.
//
// Webhook URLs in pc are already redaction-aware (RenderWebhook.Full
// populated only for PlaybookManage requesters). The renderer reads Full
// first, falling back to HostMasked.
//
// On success returns a complete buffer; on error returns nil and an error.
func (r *MarotoRenderer) RenderPlaybook(ctx context.Context, pc PlaybookRenderContext, opts RenderOptions) (*bytes.Buffer, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	labels := NewLabels(opts.Locale)
	cfg, styles := buildMarotoConfig(r.fonts, opts.PageSize, labels, labels.ReportTitlePlaybook())
	m := maroto.New(cfg)

	if err := registerHeaderFooter(m, styles, labels.ReportTitlePlaybook()); err != nil {
		return nil, errors.Wrap(err, "register playbook header/footer")
	}

	sections := opts.Sections
	if sections.PlaybookOverview {
		addPlaybookOverview(m, styles, pc, labels, opts)
	}
	if sections.PlaybookChecklistTemplates {
		addPlaybookChecklistTemplates(m, styles, pc, labels, opts)
	}
	if sections.PlaybookSettings {
		addPlaybookSettings(m, styles, pc, labels, opts)
	}

	doc, err := m.Generate()
	if err != nil {
		return nil, errors.Wrap(err, "generate playbook PDF")
	}

	raw := doc.GetBytes()
	if opts.MaxBytes > 0 && int64(len(raw)) > opts.MaxBytes {
		raw = playbookByteCappedFallback(r, labels, opts)
	}

	return bytes.NewBuffer(raw), nil
}

// playbookByteCappedFallback emits a one-page truncation notice when the
// assembled playbook PDF exceeds opts.MaxBytes.
func playbookByteCappedFallback(r *MarotoRenderer, labels *Labels, opts RenderOptions) []byte {
	cfg, styles := buildMarotoConfig(r.fonts, opts.PageSize, labels, labels.ReportTitlePlaybook())
	m := maroto.New(cfg)
	_ = registerHeaderFooter(m, styles, labels.ReportTitlePlaybook())

	addSectionHeading(m, styles, labels.ReportTitlePlaybook())
	addBodyText(m, styles, labels.TranscriptTruncated("bytes", 0))

	doc, err := m.Generate()
	if err != nil {
		return []byte{}
	}
	return doc.GetBytes()
}
