// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

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

// RenderUser carries only the display fields needed for the PDF — never
// emails, never auth fields, never anything raw from model.User.
type RenderUser struct {
	UserID      string // included so the markdown extension can match mentions
	DisplayName string
	Username    string // fallback when no display name is configured
}

// RenderChannel carries only display information for a channel.
type RenderChannel struct {
	ChannelID   string
	Name        string // url-safe slug, e.g., "ops-room"
	DisplayName string
	Type        string // "O" | "P" | "D" | "G"
}

// RenderTeam carries only display information for a team.
type RenderTeam struct {
	TeamID      string
	Name        string
	DisplayName string
}

// RenderFile is a sanitized reference to a file attachment.
//
// Renderer note: file names can carry sensitive context ("Q3-confidential.pdf").
// The caller has already authorized the requester to see the file via the
// containing post's permissions — the renderer trusts that and emits Name as
// shown in the UI.
type RenderFile struct {
	FileID string
	Name   string
	Size   int64
	Kind   string // "image" | "doc" | "audio" | "video" | "other"
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
	PostID    string
	AuthorID  string
	CreateAt  int64
	Message   string // markdown body
}

// RenderTimelineEvent is one entry in the run's audit timeline.
type RenderTimelineEvent struct {
	EventType    string // "incident_created" | "task_state_modified" | ...
	CreateAt     int64
	Summary      string
	Details      string
	SubjectID    string // user / channel / etc. — depends on EventType
	CreatorID    string
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

// RenderPostPreview is a permalink-to-post preview card. Populated by the
// pre-resolution table when permalinks are enabled (MM-68723 / v1.1);
// zero-value in v1.
type RenderPostPreview struct {
	PostID      string
	Author      RenderUser
	Channel     RenderChannel
	CreateAt    int64
	Excerpt     string // first N chars of message, no markdown re-render
}

// ResolverTable is the pre-built lookup the markdown extension consumes.
// All map values are zero-initialized when the requester cannot see the
// target (deny path byte-identical to "not found") — see plan §3.6.6.
type ResolverTable struct {
	Users      map[string]RenderUser
	Channels   map[string]RenderChannel
	Files      map[string]RenderFile
	Permalinks map[string]RenderPostPreview // populated only in MM-68723
}

// Truncation records whether a section was truncated by a cap.
type Truncation struct {
	Hit    bool
	Reason string // "posts" | "bytes" | ""
	Posts  int    // posts actually included
	Bytes  int64  // bytes written before truncation (if Reason == "bytes")
}
