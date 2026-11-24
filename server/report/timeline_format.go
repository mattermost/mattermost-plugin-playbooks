// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"cmp"
	"encoding/json"
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

// taskStateDetails is the parsed shape of TaskStateModified's Details JSON.
// The server records the task's title as "task"; Item reads the older
// "item" key.
type taskStateDetails struct {
	Task   string `json:"task"`
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
	d.Item = cmp.Or(d.Task, d.Item)
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

// timelineEvent turns a raw RenderTimelineEvent into a timeline line. The
// event's Summary is its headline when set; otherwise a headline naming the
// actor is synthesized. JSON Details are parsed for task events and dropped
// for the rest, so raw payloads never reach the report.
func (b *builder) timelineEvent(ev RenderTimelineEvent) TimelineEvent {
	T := b.T
	summary := strings.TrimSpace(ev.Summary)
	details := strings.TrimSpace(ev.Details)
	args := map[string]any{"Actor": b.userName(pickActorID(ev))}

	f := TimelineEvent{
		Date:      b.date(ev.CreateAt),
		Category:  CategoryOther,
		TypeLabel: T("app.report.timeline.event.label"),
		Headline:  summary,
	}
	if !looksLikeJSON(details) {
		f.Detail = details
	}

	// fallback is the headline when the event has no summary.
	var fallback string
	switch ev.EventType {
	case "incident_created":
		f.Category = CategoryLifecycle
		f.TypeLabel = T("app.report.timeline.incident_created.label")
		fallback = T("app.report.timeline.incident_created.headline", args)
	case "task_state_modified":
		f.Category = CategoryTasks
		f.TypeLabel = T("app.report.timeline.task_state_modified.label")
		fallback = T("app.report.timeline.task_state_modified.headline", args)
		if td := parseTaskStateDetails(details); td.Item != "" || td.Action != "" {
			args["Item"] = td.Item
			f.Headline = b.taskHeadline(td, args)
			f.Detail = ""
		}
	case "status_updated":
		f.Category = CategoryStatus
		f.TypeLabel = T("app.report.timeline.status_updated.label")
		fallback = T("app.report.timeline.status_updated.headline", args)
	case "status_update_requested":
		f.Category = CategoryStatus
		f.TypeLabel = T("app.report.timeline.status_update_requested.label")
		fallback = T("app.report.timeline.status_update_requested.headline", args)
	case "owner_changed":
		f.Category = CategoryPeople
		f.TypeLabel = T("app.report.timeline.owner_changed.label")
		fallback = T("app.report.timeline.owner_changed.headline", args)
	case "assignee_changed":
		f.Category = CategoryPeople
		f.TypeLabel = T("app.report.timeline.assignee_changed.label")
		fallback = T("app.report.timeline.assignee_changed.headline", args)
	case "ran_slash_command":
		f.Category = CategoryCommand
		f.TypeLabel = T("app.report.timeline.ran_slash_command.label")
		fallback = T("app.report.timeline.ran_slash_command.headline", args)
	case "event_from_post":
		f.TypeLabel = T("app.report.timeline.event_from_post.label")
		fallback = T("app.report.timeline.event_from_post.headline", args)
	case "user_joined_left":
		f.Category = CategoryPeople
		f.TypeLabel = T("app.report.timeline.user_joined_left.label")
		fallback = T("app.report.timeline.user_joined_left.headline", args)
	case "participants_changed":
		f.Category = CategoryPeople
		f.TypeLabel = T("app.report.timeline.participants_changed.label")
		fallback = T("app.report.timeline.participants_changed.headline", args)
	case "published_retrospective":
		f.Category = CategoryRetrospective
		f.TypeLabel = T("app.report.timeline.published_retrospective.label")
		fallback = T("app.report.timeline.published_retrospective.headline", args)
	case "canceled_retrospective":
		f.Category = CategoryRetrospective
		f.TypeLabel = T("app.report.timeline.canceled_retrospective.label")
		fallback = T("app.report.timeline.canceled_retrospective.headline", args)
	case "run_finished":
		f.Category = CategoryLifecycle
		f.TypeLabel = T("app.report.timeline.run_finished.label")
		fallback = T("app.report.timeline.run_finished.headline", args)
	case "run_restored":
		f.Category = CategoryLifecycle
		f.TypeLabel = T("app.report.timeline.run_restored.label")
		fallback = T("app.report.timeline.run_restored.headline", args)
	case "status_update_snoozed":
		f.Category = CategoryStatus
		f.TypeLabel = T("app.report.timeline.status_update_snoozed.label")
		fallback = T("app.report.timeline.status_update_snoozed.headline", args)
	case "status_updates_enabled":
		f.Category = CategoryStatus
		f.TypeLabel = T("app.report.timeline.status_updates_enabled.label")
		fallback = T("app.report.timeline.status_updates_enabled.headline", args)
	case "status_updates_disabled":
		f.Category = CategoryStatus
		f.TypeLabel = T("app.report.timeline.status_updates_disabled.label")
		fallback = T("app.report.timeline.status_updates_disabled.headline", args)
	case "property_changed":
		f.TypeLabel = T("app.report.timeline.property_changed.label")
		fallback = T("app.report.timeline.property_changed.headline", args)
	}

	if f.Headline == "" {
		f.Headline = fallback
	}
	if strings.TrimSpace(f.Headline) == "" {
		f.Headline = T("app.report.timeline.event.headline")
	}
	return f
}

// taskHeadline is the headline of a task event whose details say what
// happened to which task.
func (b *builder) taskHeadline(td taskStateDetails, args map[string]any) string {
	T := b.T
	if td.Item == "" {
		switch td.Action {
		case "check":
			return T("app.report.timeline.task.checked_a_task", args)
		case "uncheck":
			return T("app.report.timeline.task.unchecked_a_task", args)
		case "skip":
			return T("app.report.timeline.task.skipped_a_task", args)
		case "restore":
			return T("app.report.timeline.task.restored_a_task", args)
		default:
			return T("app.report.timeline.task.updated_a_task", args)
		}
	}
	switch td.Action {
	case "check":
		return T("app.report.timeline.task.checked", args)
	case "uncheck":
		return T("app.report.timeline.task.unchecked", args)
	case "skip":
		return T("app.report.timeline.task.skipped", args)
	case "restore":
		return T("app.report.timeline.task.restored", args)
	default:
		return T("app.report.timeline.task.updated", args)
	}
}
