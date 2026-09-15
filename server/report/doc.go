// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package report holds the sanitized DTOs (RenderContext,
// PlaybookRenderContext, RenderUser, RenderChannel, etc.) that the report
// writers consume. The package is intentionally pure: it depends on no
// other plugin package (no server/app, no pluginapi, no net/http).
//
// The report output lives in a sibling package:
//
//	report/html_writer — self-contained HTML document (downloaded directly,
//	                     or browser-printed to PDF by the client)
//
// All dynamic input arrives as sanitized DTOs from a caller (server/app's
// ReportService) that owns permission scoping, batched lookups, and
// external I/O.
//
// html_writer renders Mattermost-flavored markdown bodies to HTML with
// yuin/goldmark (GFM), scrubbed by bluemonday.
package report
