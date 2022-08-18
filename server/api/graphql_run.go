package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type RunResolver struct {
	app.PlaybookRun
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

// RunMutationCollection hold all mutation functions for a playbookRun
type RunMutationCollection struct {
}

func (r *RunMutationCollection) UpdateRun(ctx context.Context, args struct {
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

func (r *RunMutationCollection) AddRunParticipants(ctx context.Context, args struct {
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

	if err := c.playbookRunService.AddRunParticipants(args.RunID, args.UserIDs); err != nil {
		return "", errors.Wrap(err, "failed to add participant from run")
	}

	return "", nil
}

func (r *RunMutationCollection) RemoveRunParticipants(ctx context.Context, args struct {
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

	for _, userID := range args.UserIDs {
		if err := c.playbookRunService.RemoveRunParticipant(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to remove participant from run")
		}

		// Don't worry if the user could not be previously a follower
		// Unfollow implementation is defensive about this.
		if err := c.playbookRunService.Unfollow(args.RunID, userID); err != nil {
			return "", errors.Wrap(err, "failed to make participant to unfollow run")
		}
	}

	return "", nil
}
