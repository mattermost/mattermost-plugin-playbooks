// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"cmp"
	"encoding/json"
	"strings"
)

// TimelineIcon names the icon shown next to a timeline event; the icons
// are the ones the run page shows for each event type.
type TimelineIcon string

const (
	IconLifecycle TimelineIcon = "lifecycle" // shield
	IconStatus    TimelineIcon = "status"    // flag
	IconRequested TimelineIcon = "update"    // circular arrow
	IconTasks     TimelineIcon = "tasks"     // bulleted list
	IconEdit      TimelineIcon = "edit"      // pencil
	IconPeople    TimelineIcon = "people"    // person
	IconCanceled  TimelineIcon = "cancel"    // crossed-out circle
	IconSettings  TimelineIcon = "clock"     // clock
)

// taskStateDetails is the parsed shape of TaskStateModified's Details JSON.
// The server records the task's title as "task"; Item reads the older
// "item" key.
type taskStateDetails struct {
	Task   string `json:"task"`
	Item   string `json:"item"`
	Action string `json:"action"` // "check" | "uncheck" | "skip" | "restore" | "requirements_updated"
}

// participantsDetails is the parsed shape of the Details JSON of
// ParticipantsChanged and UserJoinedLeft events. Title is set on older
// UserJoinedLeft events instead of the rest.
type participantsDetails struct {
	Action    string   `json:"action"` // "joined" | "left"
	Requester string   `json:"requester"`
	Users     []string `json:"users"`
	Title     string   `json:"title"`
}

// propertyDetails is the parsed shape of PropertyChanged's Details JSON. A
// nil display value means the property had no value.
type propertyDetails struct {
	Name     string  `json:"property_field_name"`
	OldValue *string `json:"old_value_display"`
	NewValue *string `json:"new_value_display"`
}

// parseTaskStateDetails parses a TaskStateModified details payload. Bad or
// empty JSON yields the zero value.
func parseTaskStateDetails(detailsJSON string) taskStateDetails {
	var d taskStateDetails
	_ = json.Unmarshal([]byte(detailsJSON), &d)
	d.Item = cmp.Or(d.Task, d.Item)
	return d
}

// pickActorID returns the user an event is about, falling back to its
// creator.
func pickActorID(ev RenderTimelineEvent) string {
	if ev.SubjectID != "" {
		return ev.SubjectID
	}
	return ev.CreatorID
}

// timelineEvent words an event as the run page does. Events the report
// cannot word show their stored summary, or a generic headline.
func (b *builder) timelineEvent(ev RenderTimelineEvent) TimelineEvent {
	T := b.T
	summary := strings.TrimSpace(ev.Summary)
	name := b.userName(pickActorID(ev))
	args := map[string]any{"Name": name, "Summary": summary}
	f := TimelineEvent{Date: b.date(ev.CreateAt)}

	switch ev.EventType {
	case "incident_created":
		f.Icon, f.Headline = IconLifecycle, T("app.report.timeline.run_started", args)
	case "run_finished":
		f.Icon, f.Headline = IconLifecycle, T("app.report.timeline.run_finished", args)
	case "run_restored":
		f.Icon, f.Headline = IconLifecycle, T("app.report.timeline.run_restored", args)
	case "status_updated":
		f.Icon, f.Headline = IconStatus, T("app.report.timeline.status_posted", args)
		if summary != "" {
			f.Headline = T("app.report.timeline.status_changed", args)
		}
	case "status_update_snoozed":
		f.Icon, f.Headline = IconStatus, T("app.report.timeline.status_snoozed", args)
	case "status_update_requested":
		f.Icon, f.Headline = IconRequested, T("app.report.timeline.status_requested", args)
	case "owner_changed":
		f.Icon, f.Headline = IconEdit, T("app.report.timeline.owner_changed", args)
	case "task_state_modified":
		f.Icon, f.Headline = IconTasks, b.taskHeadline(parseTaskStateDetails(ev.Details), name, summary)
	case "assignee_changed":
		f.Icon, f.Headline = IconEdit, T("app.report.timeline.assignee_changed")
		f.DetailPlain, f.Detail = name, summary
	case "ran_slash_command":
		f.Icon, f.Headline = IconEdit, T("app.report.timeline.ran_slash_command")
		f.DetailPlain, f.Detail = name, summary
	case "event_from_post":
		f.Icon, f.Headline = IconEdit, summary
	case "user_joined_left":
		f.Icon, f.Headline = IconPeople, b.joinedLeftHeadline(ev.Details)
		if f.Headline != "" {
			f.Detail = summary
		}
	case "participants_changed":
		f.Icon = IconPeople
		f.Headline, f.DetailPlain = b.participantsHeadline(ev.Details)
	case "published_retrospective":
		f.Icon, f.Headline = IconEdit, T("app.report.timeline.retrospective_published", args)
	case "canceled_retrospective":
		f.Icon, f.Headline = IconCanceled, T("app.report.timeline.retrospective_canceled", args)
	case "status_updates_enabled":
		f.Icon, f.Headline = IconSettings, T("app.report.timeline.status_updates_enabled", args)
	case "status_updates_disabled":
		f.Icon, f.Headline = IconSettings, T("app.report.timeline.status_updates_disabled", args)
	case "retrospective_enabled":
		f.Icon, f.Headline = IconSettings, T("app.report.timeline.retrospective_enabled", args)
	case "retrospective_disabled":
		f.Icon, f.Headline = IconSettings, T("app.report.timeline.retrospective_disabled", args)
	case "property_changed":
		f.Icon, f.Headline = IconEdit, b.propertyHeadline(ev.Details, name)
	}

	f.Headline = cmp.Or(strings.TrimSpace(f.Headline), summary, T("app.report.timeline.event"))
	return f
}

// taskHeadline words a task's check, skip and other changes. Without a
// known action it shows the stored summary, its bold marks turned into
// quotes.
func (b *builder) taskHeadline(td taskStateDetails, name, summary string) string {
	args := map[string]any{"Name": name, "Item": td.Item}
	key := map[string]string{
		"check":                "checked",
		"uncheck":              "unchecked",
		"skip":                 "skipped",
		"restore":              "restored",
		"requirements_updated": "requirements_updated",
	}[td.Action]
	switch {
	case key == "" && summary != "":
		return name + " " + strings.ReplaceAll(summary, "**", `"`)
	case key == "":
		return b.T("app.report.timeline.task.updated", args)
	case td.Item == "":
		return b.T("app.report.timeline.task."+key+"_a_task", args)
	default:
		return b.T("app.report.timeline.task."+key, args)
	}
}

// joinedLeftHeadline says who joined or left the run.
func (b *builder) joinedLeftHeadline(detailsJSON string) string {
	var d participantsDetails
	if json.Unmarshal([]byte(detailsJSON), &d) != nil {
		return ""
	}
	if d.Title != "" || len(d.Users) == 0 {
		return d.Title
	}
	args := map[string]any{"User": d.Users[0]}
	if d.Action == "joined" {
		return b.T("app.report.timeline.user_joined", args)
	}
	return b.T("app.report.timeline.user_left", args)
}

// participantsHeadline says who added or removed whom. When several users
// changed, the headline counts them and the detail names them.
func (b *builder) participantsHeadline(detailsJSON string) (headline, detail string) {
	var d participantsDetails
	if json.Unmarshal([]byte(detailsJSON), &d) != nil || len(d.Users) == 0 {
		return "", ""
	}
	action := "removed"
	if d.Action == "joined" {
		action = "added"
	}
	mentions := make([]string, len(d.Users))
	for i, u := range d.Users {
		mentions[i] = "@" + u
	}
	args := map[string]any{"Name": d.Requester, "User": d.Users[0], "Count": len(d.Users), "Users": strings.Join(mentions, ", ")}
	if len(d.Users) == 1 {
		return b.T("app.report.timeline.participants."+action+"_one", args), ""
	}
	return b.T("app.report.timeline.participants."+action+"_many", args),
		b.T("app.report.timeline.participants."+action+"_list", args)
}

// propertyHeadline says how an attribute changed.
func (b *builder) propertyHeadline(detailsJSON, name string) string {
	var d propertyDetails
	if json.Unmarshal([]byte(detailsJSON), &d) != nil || d.Name == "" {
		return ""
	}
	args := map[string]any{"Name": name, "Property": d.Name}
	switch {
	case d.NewValue == nil:
		return b.T("app.report.timeline.property_cleared", args)
	case d.OldValue == nil:
		args["Value"] = *d.NewValue
		return b.T("app.report.timeline.property_set", args)
	default:
		args["Old"], args["New"] = *d.OldValue, *d.NewValue
		return b.T("app.report.timeline.property_updated", args)
	}
}
