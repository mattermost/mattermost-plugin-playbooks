// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package report renders Playbook Runs and Playbooks as PDF documents.
//
// The package is intentionally pure: it depends on no other plugin package
// (no server/app, no pluginapi, no net/http). All dynamic input arrives as
// sanitized DTOs from a caller that owns permission scoping, batched lookups,
// and external I/O.
//
// Architecture:
//
//	*MarotoRenderer (concrete; no interface in v1 per plan §4.3)
//	  RenderRun(ctx, RenderContext, RenderOptions) (*bytes.Buffer, error)
//	  RenderPlaybook(ctx, PlaybookRenderContext, RenderOptions) (*bytes.Buffer, error)
//
// The renderer returns a complete *bytes.Buffer or an error. It never writes
// to the caller's response writer; the caller copies the buffer atomically on
// success (plan §3.7, MF-7).
//
// Markdown rendering uses yuin/goldmark augmented by a Mattermost-flavored
// extension at sub-package markdown/mattermost (foundational tokens:
// mentions, channel links, file embeds, shortcode-as-styled-text emoji;
// enriched tokens — color emoji, permalinks, inline images — deferred to
// MM-68723 / v1.1).
//
// Extension contract: to add a new section to a future report kind, add a
// function to sections_run.go or sections_playbook.go (or, if the section is
// materially more complex than its peers, give it its own file like
// transcript.go). Functions take *MarotoRenderer + the relevant RenderContext
// piece + RenderOptions, and call into maroto primitives. Tests are
// per-function subtests inside sections_run_test.go / sections_playbook_test.go.
//
// Foundational scope (this Story — MM-68720): package skeleton, fonts, i18n,
// markdown extension scaffold. The full section renderers and the API
// handlers land in MM-68716 / MM-68717.
package report
