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
