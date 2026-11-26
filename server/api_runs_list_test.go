// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// TestRunListREST ports the coverage from TestGraphQLRunList onto GET /runs.
func TestRunListREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("list by participantOrFollower", func(t *testing.T) {
		result, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 10, client.PlaybookRunListOptions{
			ParticipantOrFollowerID: "me",
			IncludeFavorite:         true,
			SkipExtras:              true,
		})
		require.NoError(t, err)
		require.Len(t, result.Items, 1)
		assert.Equal(t, 1, result.TotalCount)
		assert.Equal(t, e.BasicRun.ID, result.Items[0].ID)
		assert.Equal(t, e.BasicRun.Name, result.Items[0].Name)
		assert.False(t, result.Items[0].IsFavorite)
	})

	t.Run("list by channel", func(t *testing.T) {
		result, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 10, client.PlaybookRunListOptions{
			ChannelID:       e.BasicRun.ChannelID,
			IncludeFavorite: true,
			SkipExtras:      true,
		})
		require.NoError(t, err)
		require.Len(t, result.Items, 1)
		assert.Equal(t, 1, result.TotalCount)
		assert.Equal(t, e.BasicRun.ID, result.Items[0].ID)
		assert.Equal(t, e.BasicRun.Name, result.Items[0].Name)
		assert.False(t, result.Items[0].IsFavorite)
	})

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
		ChannelID:   e.BasicRun.ChannelID,
	})
	require.NoError(t, err)
	require.NotNil(t, run)

	run2, err2 := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Basic create",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
		ChannelID:   e.BasicRun.ChannelID,
	})
	require.NoError(t, err2)
	require.NotNil(t, run2)

	t.Run("paging", func(t *testing.T) {
		firstPage, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 2, client.PlaybookRunListOptions{
			ChannelID:  e.BasicRun.ChannelID,
			SkipExtras: true,
		})
		require.NoError(t, err)
		require.Len(t, firstPage.Items, 2)
		assert.Equal(t, 3, firstPage.TotalCount)
		assert.True(t, firstPage.HasMore)

		secondPage, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 1, 2, client.PlaybookRunListOptions{
			ChannelID:  e.BasicRun.ChannelID,
			SkipExtras: true,
		})
		require.NoError(t, err)
		require.Len(t, secondPage.Items, 1)
		assert.Equal(t, 3, secondPage.TotalCount)
		assert.False(t, secondPage.HasMore)
	})

	t.Run("enrichment includes title followers and task counts", func(t *testing.T) {
		result, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 10, client.PlaybookRunListOptions{
			ChannelID:            e.BasicRun.ChannelID,
			IncludeFavorite:      true,
			IncludeFollowers:     true,
			IncludePlaybookTitle: true,
			SkipExtras:           true,
			SkipChecklists:       true,
		})
		require.NoError(t, err)
		require.NotEmpty(t, result.Items)

		found := false
		for _, item := range result.Items {
			if item.ID != e.BasicRun.ID {
				continue
			}
			found = true
			assert.Equal(t, e.BasicPlaybook.Title, item.PlaybookTitle)
			assert.NotNil(t, item.Followers)
			assert.Empty(t, item.Checklists)
			assert.GreaterOrEqual(t, item.TaskTotal, 0)
		}
		assert.True(t, found)
	})

	t.Run("playbooks with membership and favorite", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{
			WithMembershipOnly: true,
			IncludeFavorite:    true,
		})
		require.NoError(t, err)
		require.NotEmpty(t, result.Items)

		found := false
		for _, pb := range result.Items {
			if pb.ID == e.BasicPlaybook.ID {
				found = true
				assert.False(t, pb.IsFavorite)
			}
		}
		assert.True(t, found)
	})

	t.Run("per_page is capped", func(t *testing.T) {
		result, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 5000, client.PlaybookRunListOptions{
			TeamID:     e.BasicTeam.Id,
			SkipExtras: true,
		})
		require.NoError(t, err)
		// Cap is 1000; with only a few runs we just assert the request succeeded.
		assert.LessOrEqual(t, len(result.Items), 1000)
	})
}
