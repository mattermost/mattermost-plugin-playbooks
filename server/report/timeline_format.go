// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"encoding/json"
	"fmt"
	"strings"
)

// TimelineEventCategory groups event types into a small set of categories
// that the renderers can use for visual styling (color, icon column, etc).
type TimelineEventCategory string

const (
	CategoryLifecycle     TimelineEventCategory = "lifecycle"
	CategoryTasks         TimelineEventCategory = "tasks"
	CategoryStatus        TimelineEventCategory = "status"
	CategoryPeople        TimelineEventCategory = "people"
	CategoryRetrospective TimelineEventCategory = "retrospective"
	CategoryCommand       TimelineEventCategory = "command"
	CategoryOther         TimelineEventCategory = "other"
)

// FormattedTimelineEvent is the renderer-friendly shape produced from a
// raw RenderTimelineEvent. Fields are pre-formatted strings ready to flow
// into a markdown or HTML template without further interpretation.
type FormattedTimelineEvent struct {
	EventType string                // raw type (for debugging / CSS hooks)
	Category  TimelineEventCategory // grouping bucket
	TypeLabel string                // short human label, e.g. "Owner changed"
	Headline  string                // primary line, markdown allowed. Always non-empty.
	Detail    string                // secondary line if useful, markdown allowed. May be empty.
}

// unknownActor is the deny sentinel used when SubjectID / CreatorID cannot
// be resolved against the resolver table. Matches the markdown_writer and
// html_writer conventions of failing closed rather than leaking IDs.
const unknownActorLabel = "Unknown user"

// fallbackHeadline is the generic placeholder when an unknown event type
// has no summary text to display.
const fallbackHeadline = "Timeline event"

// resolveActorMention returns "@username" from a user ID using the resolver
// table, falling back to "Unknown user" if the user is not visible. Matches
// the same deny-by-default pattern as the markdown emitter's resolveUser.
func resolveActorMention(rt ResolverTable, userID string) string {
	if userID == "" {
		return unknownActorLabel
	}
	if u, ok := rt.Users[userID]; ok && u.Username != "" {
		return "@" + u.Username
	}
	return unknownActorLabel
}

// taskStateDetails is the parsed shape of TaskStateModified's Details JSON.
type taskStateDetails struct {
	Item   string `json:"item"`
	Action string `json:"action"` // "check" | "uncheck" | "skip" | "restore"
}

// parseTaskStateDetails interprets the Details JSON for TaskStateModified
// events. Returns zero-value struct on parse failure (no panic).
func parseTaskStateDetails(detailsJSON string) taskStateDetails {
	var d taskStateDetails
	s := strings.TrimSpace(detailsJSON)
	if s == "" {
		return d
	}
	if err := json.Unmarshal([]byte(s), &d); err != nil {
		return taskStateDetails{}
	}
	return d
}

// looksLikeJSON returns true when s, ignoring leading whitespace, opens with
// a JSON container token. Cheap structural sniff used to avoid dumping raw
// JSON payloads into the rendered Detail field.
func looksLikeJSON(s string) bool {
	t := strings.TrimSpace(s)
	if t == "" {
		return false
	}
	c := t[0]
	return c == '{' || c == '['
}

// pickActorID prefers SubjectID when set, otherwise CreatorID. Most event
// emitters set SubjectID to the user who triggered the event; a few only
// populate CreatorID. Both being empty falls through to "Unknown user".
func pickActorID(ev RenderTimelineEvent) string {
	if ev.SubjectID != "" {
		return ev.SubjectID
	}
	return ev.CreatorID
}

// taskActionVerb translates the JSON "action" token to a past-tense verb
// for headline composition.
func taskActionVerb(action string) string {
	switch action {
	case "check":
		return "checked"
	case "uncheck":
		return "unchecked"
	case "skip":
		return "skipped"
	case "restore":
		return "restored"
	default:
		return "updated"
	}
}

// FormatTimelineEvent transforms a raw RenderTimelineEvent into a rendered
// shape. Synthesizes a sensible Headline when ev.Summary is empty, parses
// JSON Details for known event types, and resolves SubjectID/CreatorID
// against the resolver table for inline names.
func FormatTimelineEvent(ev RenderTimelineEvent, rt ResolverTable) FormattedTimelineEvent {
	summary := strings.TrimSpace(ev.Summary)
	details := strings.TrimSpace(ev.Details)
	actor := resolveActorMention(rt, pickActorID(ev))

	// Default detail handling: drop unrecognized JSON blobs (rather than
	// rendering noise) and pass plain text through unchanged. Per-type
	// branches below override this when they have specific extraction
	// rules (e.g., TaskStateModified pulls fields into the headline).
	defaultDetail := details
	if looksLikeJSON(details) {
		defaultDetail = ""
	}

	f := FormattedTimelineEvent{
		EventType: ev.EventType,
		Category:  CategoryOther,
		TypeLabel: "Event",
		Headline:  summary,
		Detail:    defaultDetail,
	}

	switch ev.EventType {
	case "incident_created":
		f.TypeLabel = "Run created"
		f.Category = CategoryLifecycle
		if summary == "" {
			f.Headline = fmt.Sprintf("%s created this run", actor)
		}

	case "task_state_modified":
		f.TypeLabel = "Task updated"
		f.Category = CategoryTasks
		td := parseTaskStateDetails(details)
		if td.Item != "" || td.Action != "" {
			// Successfully parsed structured details. Compose a clean
			// headline and drop the raw JSON from the detail field.
			verb := taskActionVerb(td.Action)
			item := td.Item
			if item == "" {
				item = "a task"
			} else {
				item = "'" + item + "'"
			}
			f.Headline = fmt.Sprintf("%s %s task %s", actor, verb, item)
			f.Detail = ""
		} else if summary == "" {
			f.Headline = fmt.Sprintf("%s updated a task", actor)
		}

	case "status_updated":
		f.TypeLabel = "Status update posted"
		f.Category = CategoryStatus
		if summary == "" {
			f.Headline = fmt.Sprintf("%s posted a status update", actor)
		}

	case "status_update_requested":
		f.TypeLabel = "Status update requested"
		f.Category = CategoryStatus
		if summary == "" {
			f.Headline = fmt.Sprintf("%s requested a status update", actor)
		}

	case "owner_changed":
		f.TypeLabel = "Owner changed"
		f.Category = CategoryPeople
		if summary == "" {
			f.Headline = fmt.Sprintf("%s changed owner", actor)
		}

	case "assignee_changed":
		f.TypeLabel = "Task reassigned"
		f.Category = CategoryPeople
		if summary == "" {
			f.Headline = fmt.Sprintf("%s reassigned a task", actor)
		}

	case "ran_slash_command":
		f.TypeLabel = "Slash command"
		f.Category = CategoryCommand
		if summary == "" {
			f.Headline = fmt.Sprintf("%s ran a slash command", actor)
		}

	case "event_from_post":
		f.TypeLabel = "Channel post"
		f.Category = CategoryOther
		if summary == "" {
			f.Headline = fmt.Sprintf("%s posted in the channel", actor)
		}

	case "user_joined_left":
		f.TypeLabel = "Channel membership"
		f.Category = CategoryPeople
		if summary == "" {
			f.Headline = fmt.Sprintf("%s joined or left", actor)
		}

	case "participants_changed":
		f.TypeLabel = "Participants changed"
		f.Category = CategoryPeople
		if summary == "" {
			f.Headline = fmt.Sprintf("%s changed participants", actor)
		}

	case "published_retrospective":
		f.TypeLabel = "Retrospective published"
		f.Category = CategoryRetrospective
		if summary == "" {
			f.Headline = fmt.Sprintf("%s published the retrospective", actor)
		}

	case "canceled_retrospective":
		f.TypeLabel = "Retrospective canceled"
		f.Category = CategoryRetrospective
		if summary == "" {
			f.Headline = fmt.Sprintf("%s canceled the retrospective", actor)
		}

	case "run_finished":
		f.TypeLabel = "Run finished"
		f.Category = CategoryLifecycle
		if summary == "" {
			f.Headline = fmt.Sprintf("%s marked this run finished", actor)
		}

	case "run_restored":
		f.TypeLabel = "Run restored"
		f.Category = CategoryLifecycle
		if summary == "" {
			f.Headline = fmt.Sprintf("%s restored this run", actor)
		}

	case "status_update_snoozed":
		f.TypeLabel = "Status updates snoozed"
		f.Category = CategoryStatus
		if summary == "" {
			f.Headline = fmt.Sprintf("%s snoozed status updates", actor)
		}

	case "status_updates_enabled":
		f.TypeLabel = "Status updates enabled"
		f.Category = CategoryStatus
		if summary == "" {
			f.Headline = fmt.Sprintf("%s enabled status updates", actor)
		}

	case "status_updates_disabled":
		f.TypeLabel = "Status updates disabled"
		f.Category = CategoryStatus
		if summary == "" {
			f.Headline = fmt.Sprintf("%s disabled status updates", actor)
		}

	case "property_changed":
		f.TypeLabel = "Property changed"
		f.Category = CategoryOther
		if summary == "" {
			f.Headline = fmt.Sprintf("%s changed a property", actor)
		}

	default:
		// Unknown event type: keep generic label and synthesize a fallback
		// headline when even the Summary is empty.
		if f.Headline == "" {
			f.Headline = fallbackHeadline
		}
	}

	// Final safety net: a known event type with an empty branch (shouldn't
	// happen given the rules above, but be defensive) still gets a non-empty
	// headline so renderers never emit a blank line.
	if strings.TrimSpace(f.Headline) == "" {
		f.Headline = fallbackHeadline
	}

	return f
}
