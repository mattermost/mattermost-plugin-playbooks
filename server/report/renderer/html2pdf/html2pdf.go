// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html2pdf

import "context"

// HTMLPdfRenderer turns a pre-rendered HTML document into a PDF via some
// out-of-process engine. The HTML is produced by the report/html_writer
// package and is also served verbatim from the .html endpoint — single
// source of truth. The interface is HTML-shaped by design: non-HTML
// engines (Typst, LaTeX) are not pluggable here; they'd be wired at the
// API handler layer with their own writer packages.
//
// Held in atomic.Pointer[HTMLPdfRenderer] in the plugin; rebuilt on
// OnConfigurationChange; HealthCheck probed every 60 s in a background
// goroutine started in OnActivate.
type HTMLPdfRenderer interface {
	// Name returns a short label for audit + diagnostics.
	Name() string
	// Capabilities reports what this renderer supports.
	Capabilities() Capabilities
	// Render converts already-sanitized, already-styled HTML into a PDF.
	// Returns the complete PDF bytes atomically (no partial writes on error).
	Render(ctx context.Context, html []byte, opts Options) ([]byte, error)
	// HealthCheck probes the upstream engine and returns a non-nil error
	// if it is unreachable or misconfigured.
	HealthCheck(ctx context.Context) error
}

// Options is the per-request configuration for Render.
// Fields are minimal: speculative fields are added only when a real
// consumer exists in this Epic.
type Options struct {
	// Title is used as the PDF document title metadata.
	Title string
	// Filename is the Content-Disposition base name (already sanitized per RFC 6266).
	Filename string
	// PdfAFlavor selects a PDF/A conformance level. Empty string means
	// standard PDF (no PDF/A). Validated against Capabilities.SupportsPDFA.
	PdfAFlavor string
	// EnableLinks controls whether hyperlinks in the HTML are preserved in
	// the PDF. Defaults to true.
	EnableLinks bool
	// PageSize selects the page size. "A4" or "Letter".
	PageSize string
}

// Capabilities reports what a particular HTMLPdfRenderer implementation
// supports. Used by the API layer to pre-flight Options and return 422
// instead of letting the engine fail opaquely mid-render.
type Capabilities struct {
	// SupportsPDFA lists the PDF/A conformance levels the renderer can produce.
	// Empty means PDF/A is not supported.
	SupportsPDFA []string
	// SupportsLinks indicates whether the renderer preserves hyperlinks.
	SupportsLinks bool
	// MaxPageCount is the maximum number of pages the renderer will produce.
	// 0 means unlimited.
	MaxPageCount int
}
