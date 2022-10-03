package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type RunResolver struct {
	app.PlaybookRun
}

func (r *RunResolver) CreateAt() float64 {
	return float64(r.PlaybookRun.CreateAt)
}

func (r *RunResolver) EndAt() float64 {
	return float64(r.PlaybookRun.EndAt)
}

func (r *RunResolver) SummaryModifiedAt() float64 {
	return float64(r.PlaybookRun.SummaryModifiedAt)
}
func (r *RunResolver) LastStatusUpdateAt() float64 {
	return float64(r.PlaybookRun.LastStatusUpdateAt)
}

func (r *RunResolver) RetrospectivePublishedAt() float64 {
	return float64(r.PlaybookRun.RetrospectivePublishedAt)
}

func (r *RunResolver) ReminderTimerDefaultSeconds() float64 {
	return float64(r.PlaybookRun.ReminderTimerDefaultSeconds)
}

func (r *RunResolver) PreviousReminder() float64 {
	return float64(r.PlaybookRun.PreviousReminder)
}

func (r *RunResolver) RetrospectiveReminderIntervalSeconds() float64 {
	return float64(r.PlaybookRun.RetrospectiveReminderIntervalSeconds)
}

func (r *RunResolver) Checklists() []*ChecklistResolver {
	checklistResolvers := make([]*ChecklistResolver, 0, len(r.PlaybookRun.Checklists))
	for _, checklist := range r.PlaybookRun.Checklists {
		checklistResolvers = append(checklistResolvers, &ChecklistResolver{checklist})
	}

	return checklistResolvers
}

func (r *RunResolver) StatusPosts() []*StatusPostResolver {
	statusPostResolvers := make([]*StatusPostResolver, 0, len(r.PlaybookRun.StatusPosts))
	for _, statusPost := range r.PlaybookRun.StatusPosts {
		statusPostResolvers = append(statusPostResolvers, &StatusPostResolver{statusPost})
	}

	return statusPostResolvers
}

func (r *RunResolver) TimelineEvents() []*TimelineEventResolver {
	timelineEventResolvers := make([]*TimelineEventResolver, 0, len(r.PlaybookRun.StatusPosts))
	for _, event := range r.PlaybookRun.TimelineEvents {
		timelineEventResolvers = append(timelineEventResolvers, &TimelineEventResolver{event})
	}

	return timelineEventResolvers
}

func (r *RunResolver) IsFavorite(ctx context.Context) (bool, error) {
	c, err := getContext(ctx)
	if err != nil {
		return false, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	isFavorite, err := c.categoryService.IsItemFavorite(
		app.CategoryItem{
			ItemID: r.ID,
			Type:   app.RunItemType,
		},
		r.TeamID,
		userID,
	)
	if err != nil {
		return false, errors.Wrap(err, "can't determine if item is favorite or not")
	}

	return isFavorite, nil
}

type StatusPostResolver struct {
	app.StatusPost
}

func (r *StatusPostResolver) CreateAt() float64 {
	return float64(r.StatusPost.CreateAt)
}

func (r *StatusPostResolver) DeleteAt() float64 {
	return float64(r.StatusPost.DeleteAt)
}

type TimelineEventResolver struct {
	app.TimelineEvent
}

func (r *TimelineEventResolver) CreateAt() float64 {
	return float64(r.TimelineEvent.CreateAt)
}

func (r *TimelineEventResolver) EventType() string {
	return string(r.TimelineEvent.EventType)
}

func (r *TimelineEventResolver) DeleteAt() float64 {
	return float64(r.TimelineEvent.DeleteAt)
}

func (r *RunResolver) Metadata(ctx context.Context) (*MetadataResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}

	metadata, err := c.playbookRunService.GetPlaybookRunMetadata(r.ID)
	if err != nil {
		return nil, errors.Wrap(err, "can't get metadata")
	}

	return &MetadataResolver{*metadata}, nil
}

type MetadataResolver struct {
	app.Metadata
}
