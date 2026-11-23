// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// Options controls how BuildRun and BuildPlaybook translate and localize a
// report.
type Options struct {
	// T translates every label, title and sentence in the report.
	T i18n.TranslateFunc
	// Locale is the language T translates into; empty means English.
	Locale string
	// Location is the time zone every time is shown in; nil means UTC.
	Location *time.Location
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

// PlaybookReport is a playbook report ready to print. See RunReport.
type PlaybookReport struct {
	Lang  string
	Title string
	// Visibility is "Public" or "Private", translated.
	Visibility string
	Stats      []Stat
	Meta       []Field

	Description   BodySection
	Members       MemberSection
	Checklists    ChecklistSection
	StatusUpdates SettingsSection
	Retrospective SettingsSection
	Automations   AutomationsSection

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
// to show.
type Section struct {
	Title string
	Empty string
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
	// Progress is "2/4 · 50%" for a run, or "4 tasks" for a playbook.
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
	// Assignee is the assignee, or "Unassigned", shown only on run tasks
	// that have an assignee, a due date or a command.
	Assignee string
	// Due is "Due: <date>" or empty.
	Due     string
	Command string
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

// Metric is a retrospective metric. For a run Value is the measured value;
// for a playbook it describes the metric's type and target.
type Metric struct {
	Title       string
	Value       string
	Description string
}

// MemberSection lists a playbook's members.
type MemberSection struct {
	Section
	Members []Member
}

// Member is a playbook member and their roles.
type Member struct {
	Name  string
	Roles string
}

// SettingsSection is a playbook's status update or retrospective settings.
// When Configured is false only Empty is shown.
type SettingsSection struct {
	Section
	Configured bool
	Meta       []Field
	// Template is Markdown.
	Template     string
	MetricsTitle string
	Metrics      []Metric
}

// AutomationsSection lists a playbook's automations. When Configured is false
// only Empty is shown.
type AutomationsSection struct {
	Section
	Configured         bool
	BroadcastChannels  List
	WebhooksOnCreation List
	WebhooksOnStatus   List
	SignalKeywords     List
}

// List is a titled list of plain-text items.
type List struct {
	Section
	Items []string
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

// Settings lists the playbook's status update and retrospective settings, in
// display order.
func (r *PlaybookReport) Settings() []SettingsSection {
	return []SettingsSection{r.StatusUpdates, r.Retrospective}
}

// CodeLists lists the automations shown as code: webhooks and signal
// keywords, in display order.
func (s AutomationsSection) CodeLists() []List {
	return []List{s.WebhooksOnCreation, s.WebhooksOnStatus, s.SignalKeywords}
}
