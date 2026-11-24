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

// runTemplate is the run report template with the shared _styles partial.
var runTemplate = template.Must(template.Must(template.New("run_report").Funcs(template.FuncMap{
	"markdown":       markdownToHTML,
	"markdownInline": markdownInlineToHTML,
}).Parse(stylesTmpl)).Parse(runReportTmpl))

// RenderRunHTML renders r to a complete self-contained HTML document.
//
// The output embeds a strict Content-Security-Policy that forbids all
// scripts and disallows network fetches; styles, images and fonts are
// limited to what the document embeds. Fonts come from the OS, so no font
// files are bundled. The client downloads the document or browser-prints it
// to PDF.
func RenderRunHTML(r *report.RunReport) ([]byte, error) {
	var buf bytes.Buffer
	if err := runTemplate.Execute(&buf, r); err != nil {
		return nil, fmt.Errorf("html_writer: execute run report template: %w", err)
	}
	return buf.Bytes(), nil
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
