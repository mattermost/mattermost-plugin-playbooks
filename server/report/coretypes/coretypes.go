// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package coretypes carries the small set of DTOs that both server/report
// and server/report/markdown reference. Hosting them here avoids an import
// cycle between the renderer (which consumes the markdown extension) and
// the markdown extension (which consumes the resolver table).
//
// server/report re-exports each type via a type alias so existing callers
// continue to write report.RenderUser, report.ResolverTable, etc.
package coretypes

// RenderUser carries only the display fields the PDF renderer needs —
// never emails, never auth fields, never anything raw from model.User.
type RenderUser struct {
	UserID      string
	DisplayName string
	Username    string
}

// RenderChannel carries only display information for a channel.
type RenderChannel struct {
	ChannelID   string
	Name        string
	DisplayName string
	Type        string
}

// RenderFile is a sanitized reference to a file attachment.
type RenderFile struct {
	FileID string
	Name   string
	Size   int64
	Kind   string
}

// RenderPostPreview is a permalink-to-post preview card. Populated only in
// the MM-68723 / v1.1 enriched markdown story; zero-value in v1.
type RenderPostPreview struct {
	PostID   string
	Author   RenderUser
	Channel  RenderChannel
	CreateAt int64
	Excerpt  string
}

// Checklist item state values. Mirror the canonical constants in
// server/app/playbook.go (ChecklistItemStateOpen / InProgress / Closed /
// Skipped). Re-declared here so the report packages — which cannot import
// server/app without creating an import cycle — have a single source of
// truth to reference from templates and writer code. A test in this
// package asserts byte-equality against the app-layer values.
const (
	ChecklistItemStateOpen       = ""
	ChecklistItemStateInProgress = "in_progress"
	ChecklistItemStateClosed     = "closed"
	ChecklistItemStateSkipped    = "skipped"
)

// Run status values. Mirror server/app/playbook_run.go's
// StatusInProgress / StatusFinished for the same reason as the
// checklist-item-state block above.
const (
	RunStatusInProgress = "InProgress"
	RunStatusFinished   = "Finished"
)

// TranscriptMode controls how transcript posts are collated when rendered.
//
// Threaded (default): roots are emitted in root-CreateAt order; every reply
// is rendered directly under its root regardless of the original wall-clock
// gap between them. This is the Mattermost UI's "threaded replies" model.
// Orphan replies (whose root is outside this transcript window) collect
// under a dedicated "Orphan replies" subsection so existence of the missing
// root is signaled honestly.
//
// Chronological: posts emit in strict CreateAt order with no grouping. Each
// reply post carries a "↳ @user" indicator naming the parent author and
// time, or "↳ (parent not in transcript)" for orphans.
type TranscriptMode string

const (
	TranscriptModeThreaded      TranscriptMode = "threaded"
	TranscriptModeChronological TranscriptMode = "chronological"
)

// TranscriptOmittedReason explains why a transcript section ended up empty.
// Empty string means the section either wasn't requested or was rendered
// normally. Specific values let the renderer pick honest, accurate copy
// instead of always blaming channel membership.
const (
	// TranscriptOmittedNotMember — section was requested but the requester
	// is not a member of the run's channel, so the data layer refused to
	// fetch any posts. This is the only case where the "you are not a
	// member of the run's channel" message is appropriate.
	TranscriptOmittedNotMember = "not-member"
	// TranscriptOmittedNoChannel — run has no associated channel (rare,
	// historical data). Nothing to fetch.
	TranscriptOmittedNoChannel = "no-channel"
)

// ResolverTable is the pre-built lookup the markdown extension consumes.
// All map values are zero-initialized when the requester cannot see the
// target (deny path byte-identical to "not found").
type ResolverTable struct {
	Users      map[string]RenderUser
	Channels   map[string]RenderChannel
	Files      map[string]RenderFile
	Permalinks map[string]RenderPostPreview
}
