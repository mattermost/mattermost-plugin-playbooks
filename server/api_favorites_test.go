// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunFavoriteREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func(t *testing.T) *client.PlaybookRun {
		t.Helper()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Favorite run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	isFavorite := func(t *testing.T, c *client.Client, runID string) bool {
		t.Helper()
		fav, err := c.Categories.IsFavorite(context.Background(), client.CategoriesIsFavoriteOptions{
			TeamId:   e.BasicTeam.Id,
			ItemId:   runID,
			ItemType: string(app.RunItemType),
		})
		require.NoError(t, err)
		return fav
	}

	t.Run("favorite then unfavorite", func(t *testing.T) {
		run := createRun(t)

		require.False(t, isFavorite(t, e.PlaybooksClient, run.ID))

		err := e.PlaybooksClient.PlaybookRuns.AddFavorite(context.Background(), run.ID)
		require.NoError(t, err)
		require.True(t, isFavorite(t, e.PlaybooksClient, run.ID))

		err = e.PlaybooksClient.PlaybookRuns.RemoveFavorite(context.Background(), run.ID)
		require.NoError(t, err)
		require.False(t, isFavorite(t, e.PlaybooksClient, run.ID))
	})

	t.Run("favoriting twice is rejected", func(t *testing.T) {
		run := createRun(t)

		err := e.PlaybooksClient.PlaybookRuns.AddFavorite(context.Background(), run.ID)
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.AddFavorite(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("unfavoriting when not favorite is rejected", func(t *testing.T) {
		run := createRun(t)

		err := e.PlaybooksClient.PlaybookRuns.RemoveFavorite(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("user not on the team cannot favorite", func(t *testing.T) {
		run := createRun(t)

		err := e.PlaybooksClientNotInTeam.PlaybookRuns.AddFavorite(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})
}

func TestPlaybookFavoriteREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	isFavorite := func(t *testing.T, c *client.Client, playbookID string) bool {
		t.Helper()
		fav, err := c.Categories.IsFavorite(context.Background(), client.CategoriesIsFavoriteOptions{
			TeamId:   e.BasicTeam.Id,
			ItemId:   playbookID,
			ItemType: string(app.PlaybookItemType),
		})
		require.NoError(t, err)
		return fav
	}

	t.Run("favorite then unfavorite", func(t *testing.T) {
		require.False(t, isFavorite(t, e.PlaybooksClient, e.BasicPlaybook.ID))

		err := e.PlaybooksClient.Playbooks.AddFavorite(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite(t, e.PlaybooksClient, e.BasicPlaybook.ID))

		err = e.PlaybooksClient.Playbooks.RemoveFavorite(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.False(t, isFavorite(t, e.PlaybooksClient, e.BasicPlaybook.ID))
	})

	t.Run("favorite playbook with read access", func(t *testing.T) {
		err := e.PlaybooksClient2.Playbooks.AddFavorite(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite(t, e.PlaybooksClient2, e.BasicPlaybook.ID))
	})

	t.Run("favorite private playbook without access is rejected", func(t *testing.T) {
		err := e.PlaybooksClient.Playbooks.AddFavorite(context.Background(), e.PrivatePlaybookNoMembers.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})
}
