// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// Options controls how BuildRun translates and localizes a report.
type Options struct {
	// T translates every label, title and sentence in the report.
	T i18n.TranslateFunc
	// Locale is the language T translates into; empty means English.
	Locale string
	// Location is the time zone every time is shown in; nil means UTC.
	Location *time.Location
	// NameFormat is the server's teammate name display setting, one of
	// model.ShowUsername, model.ShowNicknameFullName and model.ShowFullName;
	// empty means model.ShowUsername.
	NameFormat string
}

// RunReport is a run report ready to print: every string is translated and
// every time and number formatted. The writers only lay it out.
//
// Fields documented as Markdown hold user-written Markdown bodies, which the
// HTML writer converts and sanitizes and the Markdown writer emits as they
// are. Every other string is plain text.
type RunReport struct {
	// Lang is the report's language, as a BCP 47 tag.
	Lang  string
	Title string
	// Kind ("Run report") and Generated, when the report was generated,
	// are shown on the cover page under the title.
	Kind      string
	Generated string
	// Status is the run's status, with Kind one of StatusInProgress,
	// StatusFinished or StatusOther. It is empty when the run has none.
	Status     Field
	StatusKind StatusKind
	Stats      []Stat
	// Meta lists the owner, then the start and end times and the playbook
	// when known.
	Meta              []Field
	ParticipantsLabel string
	Participants      []string

	Summary       BodySection
	Timeline      TimelineSection
	StatusUpdates StatusUpdateSection
	Tasks         ChecklistSection
	Retrospective RetrospectiveSection
	Transcript    TranscriptSection

	// Footer says when the report was generated, with the time zone.
	Footer string
}

// StatusKind styles a run's status.
type StatusKind string

const (
	StatusInProgress StatusKind = "inprogress"
	StatusFinished   StatusKind = "finished"
	StatusOther      StatusKind = "neutral"
)

// Field is a labelled value.
type Field struct {
	Label string
	Value string
}

// Stat is a headline figure, with an optional hint under it.
type Stat struct {
	Label string
	Value string
	Hint  string
}

// Section is a titled part of a report. Empty is shown when it has nothing
// to show. An omitted section was not selected and is left out entirely.
type Section struct {
	Title   string
	Empty   string
	Omitted bool
}

// BodySection is a section holding one Markdown body.
type BodySection struct {
	Section
	// Body is Markdown; empty when there is none.
	Body string
}

// TimelineSection lists a run's timeline events.
type TimelineSection struct {
	Section
	Events []TimelineEvent
}

// TimelineEvent is one line of a run's timeline.
type TimelineEvent struct {
	Date      string
	Category  TimelineEventCategory
	TypeLabel string
	// Headline is Markdown and never empty.
	Headline string
	// Detail is Markdown; it may be empty.
	Detail string
}

// StatusUpdateSection lists a run's status updates.
type StatusUpdateSection struct {
	Section
	// NoMessage stands in for an update without a message.
	NoMessage string
	Updates   []Post
}

// Post is a status update or a transcript message.
type Post struct {
	Author string
	Date   string
	// Body is Markdown; empty when there is none.
	Body string
	// IsReply and ParentLabel are only set in the chronological transcript.
	IsReply     bool
	ParentLabel string
}

// ChecklistSection lists checklists.
type ChecklistSection struct {
	Section
	Checklists []Checklist
}

// Checklist is one checklist with its progress.
type Checklist struct {
	Title string
	// Progress is "2/4 · 50%".
	Progress string
	// Empty is set when the checklist has no tasks.
	Empty string
	Items []ChecklistItem
}

// ChecklistItem is one task.
type ChecklistItem struct {
	Done    bool
	Skipped bool
	// Title is Markdown.
	Title string
	// Assignee is the assignee, or "Unassigned", shown only on tasks that
	// have an assignee, a due date or a command.
	Assignee string
	// Due is "Due: <date>" or empty.
	Due     string
	Command string
	// Completed says who checked off or skipped the task and when; it is
	// empty for open tasks and when that is unknown.
	Completed string
	// Description is Markdown.
	Description string
}

// RetrospectiveSection is a run's retrospective.
type RetrospectiveSection struct {
	Section
	// Body is Markdown.
	Body         string
	MetricsTitle string
	Metrics      []Metric
}

// Metric is a retrospective metric and its measured value.
type Metric struct {
	Title       string
	Value       string
	Description string
}

// TranscriptSection is a run's channel transcript, threaded or in
// chronological order.
type TranscriptSection struct {
	Section
	// Chronological selects Posts; otherwise Threads and Orphans are set.
	Chronological bool
	Threads       []Thread
	Posts         []Post
	OrphansTitle  string
	OrphansNote   string
	Orphans       []Post
	// Truncated says how many posts are shown when the transcript was cut
	// short; it is empty otherwise.
	Truncated string
}

// Thread is a root post and its replies.
type Thread struct {
	Post
	Replies []Post
}

// HasPosts reports whether the transcript has any post to show.
func (s TranscriptSection) HasPosts() bool {
	return len(s.Threads) > 0 || len(s.Posts) > 0 || len(s.Orphans) > 0
}
