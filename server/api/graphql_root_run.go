package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
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
		c.logger.WithError(err).Warn("Not authorized")
		return nil, errors.New("Not authorized")
	}

	run, err := c.playbookRunService.GetPlaybookRun(args.ID)
	if err != nil {
		return nil, err
	}

	return &RunResolver{*run}, nil
}

func (r *RunRootResolver) Runs(ctx context.Context, args struct {
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

func (r *RunRootResolver) UpdateRun(ctx context.Context, args struct {
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

	// Enough permissions to do a fav/unfav, check if future ops need RunManageProperties
	if err := c.permissions.RunView(userID, playbookRun.ID); err != nil {
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

func (r *RunRootResolver) AddRunParticipants(ctx context.Context, args struct {
	RunID   string
	UserIDs []string
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

	if err := c.playbookRunService.AddParticipants(args.RunID, args.UserIDs, userID); err != nil {
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

	if err := c.permissions.RunManageProperties(args.OwnerID, args.RunID); err != nil {
		return "", errors.Wrap(err, "new owner doesn't have permissions to the run")
	}

	if err := c.playbookRunService.ChangeOwner(args.RunID, requesterID, args.OwnerID); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	return "", nil
}
