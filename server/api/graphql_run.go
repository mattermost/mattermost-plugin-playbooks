package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
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

// RunGQLHandler hold all queries and mutations for a playbookRun
type RunGQLHandler struct {
}

func (r *RunGQLHandler) Runs(ctx context.Context, args struct {
	TeamID                  string `url:"team_id,omitempty"`
	Sort                    string
	Statuses                []string
	ParticipantOrFollowerID string `url:"participant_or_follower,omitempty"`
}) ([]*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.pluginAPI),
	}

	if args.ParticipantOrFollowerID == client.Me {
		args.ParticipantOrFollowerID = userID
	}

	filterOptions := app.PlaybookRunFilterOptions{
		Sort:                    app.SortField(args.Sort),
		TeamID:                  args.TeamID,
		Statuses:                args.Statuses,
		ParticipantOrFollowerID: args.ParticipantOrFollowerID,
		Page:                    0,
		PerPage:                 10000,
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		return nil, err
	}

	ret := make([]*RunResolver, 0, len(runResults.Items))
	for _, run := range runResults.Items {
		ret = append(ret, &RunResolver{run})
	}

	return ret, nil
}

func (r *RunGQLHandler) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates struct {
		IsFavorite *bool
	}
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.RunManageProperties(userID, playbookRun.ID); err != nil {
		return "", err
	}

	if args.Updates.IsFavorite != nil {
		if *args.Updates.IsFavorite {
			if err := c.categoryService.AddFavorite(
				app.CategoryItem{
					ItemID: playbookRun.ID,
					Type:   app.RunItemType,
				},
				playbookRun.TeamID,
				userID,
			); err != nil {
				return "", err
			}
		} else {
			if err := c.categoryService.DeleteFavorite(
				app.CategoryItem{
					ItemID: playbookRun.ID,
					Type:   app.RunItemType,
				},
				playbookRun.TeamID,
				userID,
			); err != nil {
				return "", err
			}
		}
	}

	return playbookRun.ID, nil
}

func (r *RunGQLHandler) AddRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify participants without permissions")
	}

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Follow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}

func (r *RunGQLHandler) RemoveRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify participants without permissions")
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}
