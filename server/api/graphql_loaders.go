package api

import (
	"context"

	dataloader "github.com/graph-gophers/dataloader/v7"
	"github.com/mattermost/mattermost-server/v6/model"
)

func postsBatchLoader(ctx context.Context, ids []string) []*dataloader.Result[*model.Post] {
	result := make([]*dataloader.Result[*model.Post], len(ids))

	c, err := getContext(ctx)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result[*model.Post]{Error: err}
		}
		return result
	}

	for i, key := range ids {
		post, err := c.pluginAPI.Post.GetPost(key)
		if err != nil {
			result[i] = &dataloader.Result[*model.Post]{Error: err}
		}
		result[i] = &dataloader.Result[*model.Post]{Data: post}
	}

	return result
}
