// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import "github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"

// Render* DTOs live in the coretypes sub-package so the markdown extension
// can reference them without forming an import cycle with this package.
// Callers continue to use report.RenderUser / report.ResolverTable / etc.
type (
	RenderUser        = coretypes.RenderUser
	RenderChannel     = coretypes.RenderChannel
	RenderFile        = coretypes.RenderFile
	RenderPostPreview = coretypes.RenderPostPreview
	ResolverTable     = coretypes.ResolverTable
)

// RenderContext is the sanitized input to RenderRun. All fields are
// internal DTOs — never raw model.User / model.Post / model.Channel.
//
// The caller (ReportService) is responsible for building this from the
// underlying data sources and applying all permission scoping. The
// renderer trusts every field as already-authorized for the requesting
// user.
type RenderContext struct {
	// Run identifies the run being rendered.
	Run RenderRun

	// Owner is the run's owner. Zero value if the owner cannot be resolved
	// (e.g., deleted user); rendered as "Unknown user" by the renderer.
	Owner RenderUser

	// Participants are users participating in the run, in stable order.
	Participants []RenderUser

	// Channel is the run's channel (display only — name, header, purpose).
	Channel RenderChannel

	// Team is the run's team (display only — name, display name).
	Team RenderTeam

	// StatusUpdates are the run's status posts, in chronological order.
	StatusUpdates []RenderStatusUpdate

	// TimelineEvents are the run's audit timeline, in chronological order.
	TimelineEvents []RenderTimelineEvent

	// Checklists are the run's checklists, in stable order.
	Checklists []RenderChecklist

	// Retrospective is the run's retrospective body and metrics.
	Retrospective RenderRetrospective

	// Transcript is the time-filtered channel transcript when requested AND
	// the requester is a member of the run's channel; empty otherwise.
	Transcript []RenderPost

	// TranscriptTruncation records whether the transcript was truncated by
	// the post cap or the byte cap (set during rendering).
	TranscriptTruncation Truncation

	// TranscriptMode controls how transcript posts are collated when the
	// section is rendered. Empty defaults to threaded.
	TranscriptMode coretypes.TranscriptMode

	// TranscriptOmittedReason carries the data-layer's explanation when
	// rc.Transcript is empty AND the caller requested the transcript
	// section. See coretypes for the constants. Empty string means either
	// the section was not requested OR posts were fetched normally (the
	// renderer distinguishes those by looking at len(Transcript) and the
	// caller's section flags as appropriate).
	TranscriptOmittedReason string

	// Resolvers is the pre-built lookup table populated by ReportService
	// for the markdown extension. Targets the requester cannot see are
	// represented as zero-value entries (deny path byte-identical to
	// "not found") per plan §3.6.6.
	Resolvers ResolverTable

	// GeneratedAtMillis is the wall-clock time when assembly completed
	// (injected for deterministic golden tests).
	GeneratedAtMillis int64
}

// PlaybookRenderContext is the sanitized input to RenderPlaybook.
type PlaybookRenderContext struct {
	Playbook            RenderPlaybook
	Members             []RenderPlaybookMember
	ChecklistTemplates  []RenderChecklist
	StatusUpdateConfig  RenderStatusUpdateConfig
	RetrospectiveConfig RenderRetrospectiveConfig
	BroadcastChannels   []RenderChannel
	WebhooksOnCreation  []RenderWebhook
	WebhooksOnStatus    []RenderWebhook
	SignalKeywords      []string
	Resolvers           ResolverTable
	GeneratedAtMillis   int64
}

// RenderRun is the run's identity and headline state.
type RenderRun struct {
	ID            string
	Name          string
	Summary       string // markdown body
	Status        string // "InProgress" | "Finished"
	StartTimeMs   int64
	EndTimeMs     int64 // 0 if still in progress
	PlaybookID    string
	PlaybookTitle string
}

// RenderPlaybook is the playbook template's identity and configuration.
type RenderPlaybook struct {
	ID          string
	Title       string
	Description string // markdown body
	Public      bool
	TeamID      string
}

// RenderTeam carries only display information for a team.
type RenderTeam struct {
	TeamID      string
	Name        string
	DisplayName string
}

// RenderWebhook is the credentials-aware representation of a webhook URL.
//
// HostMasked is always populated (e.g., "https://hooks.slack.com/****").
// Full is populated only when the requester has PlaybookManage permission;
// otherwise empty. The playbook section renderer reads Full first, falling
// back to HostMasked, never reconstructing or guessing.
//
// See plan §3.6.5 (MF-1 closure).
type RenderWebhook struct {
	HostMasked string
	Full       string
}

// RenderStatusUpdate is one status post in a run's update stream.
type RenderStatusUpdate struct {
	PostID   string
	AuthorID string
	CreateAt int64
	Message  string // markdown body
}

// RenderTimelineEvent is one entry in the run's audit timeline.
type RenderTimelineEvent struct {
	EventType string // "incident_created" | "task_state_modified" | ...
	CreateAt  int64
	Summary   string
	Details   string
	SubjectID string // user / channel / etc. — depends on EventType
	CreatorID string
}

// RenderChecklist is one checklist (run instance or playbook template).
type RenderChecklist struct {
	Title string
	Items []RenderChecklistItem
}

// RenderChecklistItem is one task in a checklist.
type RenderChecklistItem struct {
	Title       string
	State       string // "Closed" | "Skipped" | "" (open)
	StateMs     int64
	AssigneeID  string // empty if unassigned
	DueAtMs     int64
	Description string // markdown body
	Command     string // empty if no slash command
}

// RenderRetrospective is the run's retrospective text + metrics.
type RenderRetrospective struct {
	Body        string // markdown body
	PublishedMs int64
	Metrics     []RenderMetric
}

// RenderStatusUpdateConfig is a playbook's status-update template + cadence.
type RenderStatusUpdateConfig struct {
	Enabled  bool
	Template string // markdown body
	Cadence  string // human-readable, e.g., "Every 30 minutes"
}

// RenderRetrospectiveConfig is a playbook's retrospective template + metrics.
type RenderRetrospectiveConfig struct {
	Enabled         bool
	Template        string // markdown body
	ReminderCadence string // human-readable
	Metrics         []RenderMetric
}

// RenderMetric is one configured metric (with optional measured value).
type RenderMetric struct {
	ID          string
	Title       string
	Description string // markdown body
	Type        string // "duration" | "currency" | "integer"
	Target      int64  // type-dependent units
	Value       int64  // for run instances; zero for playbook templates
	HasValue    bool   // distinguishes "0" from "not set"
}

// RenderPlaybookMember is a playbook member with their role.
type RenderPlaybookMember struct {
	UserID      string
	DisplayName string
	Roles       []string // "playbook_admin" | "playbook_member"
}

// RenderPost is one chat message in a transcript.
type RenderPost struct {
	PostID   string
	AuthorID string
	CreateAt int64
	Message  string // markdown body (passes through the MM markdown extension)
	RootID   string // empty if not a reply
	Type     string // post type — used to filter system noise
	Files    []RenderFile
}

// Truncation records whether a section was truncated by a cap.
type Truncation struct {
	Hit    bool
	Reason string // "posts" | "bytes" | ""
	Posts  int    // posts actually included
	Bytes  int64  // bytes written before truncation (if Reason == "bytes")
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
