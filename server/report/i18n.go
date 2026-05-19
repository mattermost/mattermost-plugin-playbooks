// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"fmt"
	"strings"
	"time"
)

// Labels resolves user-facing strings for a single render invocation.
//
// v1 ships English only; the value object is structured so a later
// translation catalog can be wired in without changing call sites.
type Labels struct {
	locale string
}

// NewLabels returns a Labels for the given locale. Unknown locales fall back
// to English.
func NewLabels(locale string) *Labels {
	if locale == "" {
		locale = "en"
	}
	return &Labels{locale: locale}
}

// Locale returns the locale code resolved at construction time.
func (l *Labels) Locale() string {
	return l.locale
}

// ReportTitleRun is the document title for a run export.
func (l *Labels) ReportTitleRun() string {
	return "Playbook Run Report"
}

// ReportTitlePlaybook is the document title for a playbook export.
func (l *Labels) ReportTitlePlaybook() string {
	return "Playbook Report"
}

// SectionCover etc. are section titles.
func (l *Labels) SectionCover() string             { return "Overview" }
func (l *Labels) SectionExecutiveSummary() string  { return "Executive summary" }
func (l *Labels) SectionTimeline() string          { return "Timeline" }
func (l *Labels) SectionStatusUpdates() string     { return "Status updates" }
func (l *Labels) SectionChecklists() string        { return "Checklists" }
func (l *Labels) SectionRetrospective() string     { return "Retrospective" }
func (l *Labels) SectionTranscript() string        { return "Channel transcript" }
func (l *Labels) SectionPlaybookOverview() string  { return "Playbook overview" }
func (l *Labels) SectionPlaybookTemplates() string { return "Checklist templates" }
func (l *Labels) SectionPlaybookSettings() string  { return "Settings" }

// Owner is the label for the run owner field.
func (l *Labels) Owner() string { return "Owner" }

// UnknownUser is the placeholder for a missing / deleted user.
func (l *Labels) UnknownUser() string { return "Unknown user" }

// Status is the label for the status field.
func (l *Labels) Status() string { return "Status" }

// Started / Ended / Duration are headline timing field labels.
func (l *Labels) Started() string  { return "Started" }
func (l *Labels) Ended() string    { return "Ended" }
func (l *Labels) Duration() string { return "Duration" }

// GeneratedAt is the footer/cover label for the generation timestamp.
func (l *Labels) GeneratedAt() string { return "Generated" }

// StatusInProgress / StatusFinished map run status codes to display text.
func (l *Labels) StatusInProgress() string { return "In progress" }
func (l *Labels) StatusFinished() string   { return "Finished" }

// Status formats a run status code for display.
func (l *Labels) StatusDisplay(code string) string {
	switch code {
	case "InProgress":
		return l.StatusInProgress()
	case "Finished":
		return l.StatusFinished()
	default:
		return code
	}
}

// TaskState maps a checklist item state code to display text.
func (l *Labels) TaskState(state string) string {
	switch state {
	case "Closed":
		return "Done"
	case "Skipped":
		return "Skipped"
	case "InProgress":
		return "In progress"
	case "":
		return "Open"
	default:
		return state
	}
}

// Page formats a page-number footer line.
func (l *Labels) Page(n, total int) string {
	return fmt.Sprintf("Page %d of %d", n, total)
}

// TranscriptTruncated formats the truncation footer message.
//
// reason is one of "posts" or "bytes"; n is the count actually included.
func (l *Labels) TranscriptTruncated(reason string, n int) string {
	switch reason {
	case "posts":
		return fmt.Sprintf("Transcript truncated to the first %d posts.", n)
	case "bytes":
		return fmt.Sprintf("Transcript truncated — byte limit reached (%d posts included).", n)
	default:
		return "Transcript truncated."
	}
}

// TranscriptOmittedNonMember is the sentinel page text for non-member runs.
func (l *Labels) TranscriptOmittedNonMember() string {
	return "Transcript omitted — you are not a member of the run's channel."
}

// NotSet is the placeholder for unset fields.
func (l *Labels) NotSet() string { return "Not set" }

// Description is the field label for a description.
func (l *Labels) Description() string { return "Description" }

// Members is the label for a member list.
func (l *Labels) Members() string { return "Members" }

// Roles is the label for a role list.
func (l *Labels) Roles() string { return "Roles" }

// Assignee / DueDate / Command are checklist item labels.
func (l *Labels) Assignee() string  { return "Assignee" }
func (l *Labels) DueDate() string   { return "Due" }
func (l *Labels) Command() string   { return "Command" }
func (l *Labels) Unassigned() string { return "Unassigned" }

// StatusUpdateSettings / RetrospectiveSettings / BroadcastChannels /
// SignalKeywords / Webhooks are playbook-settings sub-labels.
func (l *Labels) StatusUpdateSettings() string  { return "Status updates" }
func (l *Labels) RetrospectiveSettings() string { return "Retrospective" }
func (l *Labels) BroadcastChannels() string     { return "Broadcast channels" }
func (l *Labels) SignalKeywords() string        { return "Signal keywords" }
func (l *Labels) Webhooks() string              { return "Webhooks" }
func (l *Labels) Enabled() string               { return "Enabled" }
func (l *Labels) Disabled() string              { return "Disabled" }
func (l *Labels) Template() string              { return "Template" }
func (l *Labels) Cadence() string               { return "Cadence" }
func (l *Labels) Metrics() string               { return "Metrics" }

// FormatDate formats a Unix-millis timestamp as a human-readable date+time.
// Zero or negative values render as NotSet.
func (l *Labels) FormatDate(ms int64) string {
	if ms <= 0 {
		return l.NotSet()
	}
	t := time.UnixMilli(ms).UTC()
	return t.Format("2006-01-02 15:04 MST")
}

// FormatDuration formats a millisecond duration as a compact human string.
func (l *Labels) FormatDuration(ms int64) string {
	if ms <= 0 {
		return l.NotSet()
	}
	d := time.Duration(ms) * time.Millisecond

	days := int64(d / (24 * time.Hour))
	d -= time.Duration(days) * 24 * time.Hour
	hours := int64(d / time.Hour)
	d -= time.Duration(hours) * time.Hour
	mins := int64(d / time.Minute)

	parts := make([]string, 0, 3)
	if days > 0 {
		parts = append(parts, fmt.Sprintf("%dd", days))
	}
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%dh", hours))
	}
	if mins > 0 || len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("%dm", mins))
	}
	return strings.Join(parts, " ")
}
