// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package report holds the sanitized DTOs (RenderContext,
// PlaybookRenderContext, RenderUser, RenderChannel, etc.) that the report
// writers consume. The package is intentionally pure: it depends on no
// other plugin package (no server/app, no pluginapi, no net/http).
//
// Concrete output formats live in sibling packages:
//
//	report/markdown_writer  — canonical Mattermost-flavored markdown
//	report/html_writer      — self-contained HTML document (input to PDF)
//	report/renderer/html2pdf — HTML→PDF renderer interface + adapters
//
// All dynamic input arrives as sanitized DTOs from a caller (server/app's
// ReportService) that owns permission scoping, batched lookups, and
// external I/O.
//
// Markdown rendering uses yuin/goldmark augmented by a Mattermost-flavored
// extension at sub-package markdown/mattermost (mentions, channel links,
// file embeds, shortcode-as-styled-text emoji).
package report
