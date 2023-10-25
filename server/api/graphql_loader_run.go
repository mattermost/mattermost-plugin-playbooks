package api

import (
	"context"

	"github.com/graph-gophers/dataloader/v7"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func graphQLStatusPostsLoader[V []app.StatusPost](ctx context.Context, keys []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(keys))
	if len(keys) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	statusPostsByRunID, err := c.runStore.GetStatusPostsByIDs(keys)
	if err != nil {
		return populateResultWithError(err, result)
	}

	for i, runID := range keys {
		statusPosts, ok := statusPostsByRunID[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(statusPosts),
		}
	}

	return result
}

func graphQLTimelineEventsLoader[V []app.TimelineEvent](ctx context.Context, keys []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(keys))
	if len(keys) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	timelineEvents, err := c.runStore.GetTimelineEventsByIDs(keys)
	if err != nil {
		return populateResultWithError(err, result)
	}

	timelineEventsByRunID := make(map[string][]app.TimelineEvent)
	for _, timelineEvent := range timelineEvents {
		timelineEventsByRunID[timelineEvent.PlaybookRunID] = append(timelineEventsByRunID[timelineEvent.PlaybookRunID], timelineEvent)
	}

	for i, runID := range keys {
		timelineEvents, ok := timelineEventsByRunID[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(timelineEvents),
		}
	}

	return result
}

func graphQLRunMetricsLoader[V []app.RunMetricData](ctx context.Context, keys []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(keys))
	if len(keys) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	metrics, err := c.runStore.GetMetricsByIDs(keys)
	if err != nil {
		return populateResultWithError(err, result)
	}

	for i, runID := range keys {
		metrics, ok := metrics[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(metrics),
		}
	}

	return result
}
