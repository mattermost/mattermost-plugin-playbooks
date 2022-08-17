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

// -----------------------------------------------------------------------------
// Run mutations
// -----------------------------------------------------------------------------

func (r *RootResolver) AddRunParticipants(ctx context.Context, args struct {
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
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	return "", nil
}

func (r *RootResolver) RemoveRunParticipant(ctx context.Context, args struct {
	RunID  string
	UserID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", errors.Wrap(err, "attempted to modify participants without permissions")
	}

	if err := c.playbookRunService.RemoveRunParticipant(args.RunID, args.UserID); err != nil {
		return "", errors.Wrap(err, "failed to remove participant from run")
	}

	// Don't worry if the user could not be previously a follower
	// Unfollow implementation is defensive about this.
	if err := c.playbookRunService.Unfollow(args.RunID, args.UserID); err != nil {
		return "", errors.Wrap(err, "failed to make participant to unfollow run")
	}

	if err := c.permissions.RunView(userID, args.RunID); err != nil {
		return "", nil
	}

	return "", nil
}
