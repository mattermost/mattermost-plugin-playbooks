// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import "github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"

// RenderUser and ResolverTable live in the coretypes sub-package; callers
// use them as report.RenderUser and report.ResolverTable.
type (
	RenderUser    = coretypes.RenderUser
	ResolverTable = coretypes.ResolverTable
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

	// Sections are the sections the requester selected; the others are
	// left out of the report.
	Sections SectionFlags

	// Owner is the run's owner. Zero value if the owner cannot be resolved
	// (e.g., deleted user); rendered as "Unknown user" by the renderer.
	Owner RenderUser

	// Participants are users participating in the run, in stable order.
	Participants []RenderUser

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

	// Resolvers holds the users the report names.
	Resolvers ResolverTable

	// GeneratedAtMillis is the wall-clock time when assembly completed
	// (injected for deterministic golden tests).
	GeneratedAtMillis int64
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

// RenderChecklist is one of the run's checklists.
type RenderChecklist struct {
	Title string
	Items []RenderChecklistItem
}

// RenderChecklistItem is one task in a checklist.
type RenderChecklistItem struct {
	Title   string
	State   string // "Closed" | "Skipped" | "" (open)
	StateMs int64
	// StateUserID is the user who closed or skipped the task; empty when the
	// task is open or the run's timeline does not say who changed it.
	StateUserID string
	AssigneeID  string // empty if unassigned
	DueAtMs     int64
	Description string // markdown body
	Command     string // empty if no slash command
}

// RenderRetrospective is the run's retrospective text + metrics.
type RenderRetrospective struct {
	Body    string // markdown body
	Metrics []RenderMetric
}

// RenderMetric is one configured metric (with optional measured value).
type RenderMetric struct {
	ID          string
	Title       string
	Description string // markdown body
	Type        string // "duration" | "currency" | "integer"
	Value       int64
	HasValue    bool // distinguishes "0" from "not set"
}

// RenderPost is one chat message in a transcript.
type RenderPost struct {
	PostID   string
	AuthorID string
	CreateAt int64
	Message  string // markdown body
	RootID   string // empty if not a reply
	Type     string // post type — used to filter system noise
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
// Run sections: ExecutiveSummary, Timeline, StatusUpdates, Checklists,
// Retrospective, Transcript. The executive summary and status updates are
// always included.
type SectionFlags struct {
	ExecutiveSummary bool
	Timeline         bool
	StatusUpdates    bool
	Checklists       bool
	Retrospective    bool
	Transcript       bool
}

// DefaultRunSections returns the default section set for a run export:
// everything except the transcript.
func DefaultRunSections() SectionFlags {
	return SectionFlags{
		ExecutiveSummary: true,
		Timeline:         true,
		StatusUpdates:    true,
		Checklists:       true,
		Retrospective:    true,
		Transcript:       false,
	}
}
