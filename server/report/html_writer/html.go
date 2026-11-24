// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html_writer //nolint:staticcheck

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

//go:embed templates/run_report.html.tmpl
var runReportTmpl string

//go:embed templates/_styles.html.tmpl
var stylesTmpl string

var runTemplate = parseTemplate("run_report", runReportTmpl)

// Options controls per-document presentation knobs that are independent of
// the report content.
type Options struct {
	// PageSize controls the @page CSS size. "A4" and "Letter" are
	// recognized; any other value passes through verbatim. Empty defaults
	// to "Letter".
	PageSize string
}

// document is the template data: the report plus presentation knobs.
type document struct {
	Report   *report.RunReport
	PageSize string
	FontCSS  template.CSS
}

// RenderRunHTML renders r to a complete self-contained HTML document.
//
// The output embeds a strict Content-Security-Policy that forbids all
// scripts and disallows network fetches; styles, images and fonts are
// limited to what the document embeds. The client downloads the document or
// browser-prints it to PDF.
func RenderRunHTML(r *report.RunReport, opts Options) ([]byte, error) {
	return execute(runTemplate, newDocument(r, opts))
}

func newDocument(r *report.RunReport, opts Options) document {
	return document{
		Report:   r,
		PageSize: pageSize(opts.PageSize),
		FontCSS:  template.CSS(systemFontCSS()), //nolint:gosec
	}
}

func execute(tmpl *template.Template, data any) ([]byte, error) {
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("html_writer: execute %s template: %w", tmpl.Name(), err)
	}
	return buf.Bytes(), nil
}

// parseTemplate parses the main template plus the shared _styles partial.
func parseTemplate(name, body string) *template.Template {
	t := template.New(name).Funcs(template.FuncMap{
		"markdown":       markdownToHTML,
		"markdownInline": markdownInlineToHTML,
	})
	template.Must(t.Parse(stylesTmpl))
	return template.Must(t.Parse(body))
}

// pageSize normalizes the @page size hint.
func pageSize(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "a4":
		return "A4"
	case "letter", "":
		return "Letter"
	default:
		return s
	}
}

// markdownInlineToHTML renders a single-line title via the same sanitizer
// as the block path. goldmark wraps single-paragraph input in <p>…</p>; we
// strip that wrapper so the result inlines cleanly into headings and task
// titles.
func markdownInlineToHTML(md string) template.HTML {
	full := string(markdownToHTML(strings.TrimSpace(md)))
	full = strings.TrimSpace(full)
	full = strings.TrimPrefix(full, "<p>")
	full = strings.TrimSuffix(full, "</p>")
	return template.HTML(full) //nolint:gosec
}
