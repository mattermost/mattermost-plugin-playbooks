package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// RunRootResolver hold all queries and mutations for a playbookRun
type RunRootResolver struct {
}

func (r *RunRootResolver) Run(ctx context.Context, args struct {
	ID string `url:"id,omitempty"`
}) (*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.ID); err != nil {
		return nil, err
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return nil, err
	}

	return &RunResolver{*run}, nil
}

func (r *RunRootResolver) Runs(ctx context.Context, args struct {
	TeamID                  string
	Sort                    string
	Statuses                []string
	ParticipantOrFollowerID string
	ChannelID               string
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
		ChannelID:               args.ChannelID,
		IncludeFavorites:        true,
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

type RunUpdates struct {
	Name                                    *string
	Summary                                 *string
	IsFavorite                              *bool
	CreateChannelMemberOnNewParticipant     *bool
	RemoveChannelMemberOnRemovedParticipant *bool
	StatusUpdateBroadcastChannelsEnabled    *bool
	StatusUpdateBroadcastWebhooksEnabled    *bool
	BroadcastChannelIDs                     *[]string
	WebhookOnStatusUpdateURLs               *[]string
}

func (r *RunRootResolver) UpdateRun(ctx context.Context, args struct {
	ID      string
	Updates RunUpdates
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunManageProperties(userID, args.ID); err != nil {
		return "", err
	}

	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return "", err
	}

	now := model.GetMillis()

	// scalar updates
	setmap := map[string]interface{}{}
	addToSetmap(setmap, "Name", args.Updates.Name)
	addToSetmap(setmap, "Description", args.Updates.Summary)
	addToSetmap(setmap, "CreateChannelMemberOnNewParticipant", args.Updates.CreateChannelMemberOnNewParticipant)
	addToSetmap(setmap, "RemoveChannelMemberOnRemovedParticipant", args.Updates.RemoveChannelMemberOnRemovedParticipant)
	addToSetmap(setmap, "StatusUpdateBroadcastChannelsEnabled", args.Updates.StatusUpdateBroadcastChannelsEnabled)
	addToSetmap(setmap, "StatusUpdateBroadcastWebhooksEnabled", args.Updates.StatusUpdateBroadcastWebhooksEnabled)

	if args.Updates.Summary != nil {
		addToSetmap(setmap, "SummaryModifiedAt", &now)
	}

	if args.Updates.BroadcastChannelIDs != nil {
		if err := c.permissions.NoAddedBroadcastChannelsWithoutPermission(userID, *args.Updates.BroadcastChannelIDs, playbookRun.BroadcastChannelIDs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedBroadcastChannelIDs", args.Updates.BroadcastChannelIDs)
	}

	if args.Updates.WebhookOnStatusUpdateURLs != nil {
		if err := app.ValidateWebhookURLs(*args.Updates.WebhookOnStatusUpdateURLs); err != nil {
			return "", err
		}
		addConcatToSetmap(setmap, "ConcatenatedWebhookOnStatusUpdateURLs", args.Updates.WebhookOnStatusUpdateURLs)
	}

	// Auth level required: runManageProperties if non empty
	if len(setmap) > 0 {
		if err := c.permissions.RunManageProperties(userID, args.ID); err != nil {
			return "", err
		}

		if err := c.playbookRunService.GraphqlUpdate(args.ID, setmap); err != nil {
			return "", err
		}
	}

	// fav / unfav (auth level required: runView)
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

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID             string
	UserIDs           []string
	ForceAddToChannel bool
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	// When user is joining run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to join run without permissions")
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	}

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID, args.ForceAddToChannel); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Follow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}

func (r *RunRootResolver) RemoveRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	// When user is leaving run RunView permission is enough, otherwise user need manage permissions
	if updatesOnlyRequesterMembership(userID, args.UserIDs) {
		if err := c.permissions.RunView(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	} else {
		if err := c.permissions.RunManageProperties(userID, args.RunID); err != nil {
			return "", errors.Wrap(err, "attempted to modify participants without permissions")
		}
	}

	if err := c.playbookRunService.RemoveParticipants(args.RunID, args.UserIDs, userID); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}

func updatesOnlyRequesterMembership(requesterUserID string, userIDs []string) bool {
	return len(userIDs) == 1 && userIDs[0] == requesterUserID
}

func (r *RunRootResolver) ChangeRunOwner(ctx context.Context, args struct {
	RunID   string
	OwnerID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	requesterID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunManageProperties(requesterID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify the run owner without permissions")
	}

	if err := c.playbookRunService.ChangeOwner(args.RunID, requesterID, args.OwnerID); err != nil {
		return "", errors.Wrap(err, "failed to change the run owner")
	}

	return "", nil
}
