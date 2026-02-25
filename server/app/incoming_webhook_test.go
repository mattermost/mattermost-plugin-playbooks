// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIncomingWebhook_PreSave(t *testing.T) {
	t.Run("sets ID and timestamps", func(t *testing.T) {
		w := IncomingWebhook{
			Name:      "test",
			CreatorID: "creator1",
			TeamID:    "team1",
		}
		w.PreSave()

		assert.NotEmpty(t, w.ID)
		assert.Len(t, w.ID, 26)
		assert.NotZero(t, w.CreateAt)
		assert.NotZero(t, w.UpdateAt)
		assert.Equal(t, w.CreateAt, w.UpdateAt)
	})

	t.Run("does not overwrite existing ID", func(t *testing.T) {
		w := IncomingWebhook{
			ID:        "existing-id",
			Name:      "test",
			CreatorID: "creator1",
			TeamID:    "team1",
		}
		w.PreSave()

		assert.Equal(t, "existing-id", w.ID)
	})
}

func TestIncomingWebhook_IsValid(t *testing.T) {
	validPlaybookScoped := IncomingWebhook{
		Name:       "test webhook",
		CreatorID:  "creator1",
		TeamID:     "team1",
		PlaybookID: "playbook1",
	}

	validRunScoped := IncomingWebhook{
		Name:          "test webhook",
		CreatorID:     "creator1",
		TeamID:        "team1",
		PlaybookRunID: "run1",
	}

	t.Run("valid playbook-scoped webhook", func(t *testing.T) {
		require.NoError(t, validPlaybookScoped.IsValid())
	})

	t.Run("valid run-scoped webhook", func(t *testing.T) {
		require.NoError(t, validRunScoped.IsValid())
	})

	t.Run("missing name", func(t *testing.T) {
		w := validRunScoped
		w.Name = ""
		assert.Error(t, w.IsValid())
	})

	t.Run("name too long", func(t *testing.T) {
		w := validRunScoped
		w.Name = strings.Repeat("a", 129)
		assert.Error(t, w.IsValid())
	})

	t.Run("name at max length is valid", func(t *testing.T) {
		w := validRunScoped
		w.Name = strings.Repeat("a", 128)
		require.NoError(t, w.IsValid())
	})

	t.Run("missing creator_id", func(t *testing.T) {
		w := validRunScoped
		w.CreatorID = ""
		assert.Error(t, w.IsValid())
	})

	t.Run("missing team_id", func(t *testing.T) {
		w := validRunScoped
		w.TeamID = ""
		assert.Error(t, w.IsValid())
	})

	t.Run("both scopes set", func(t *testing.T) {
		w := validPlaybookScoped
		w.PlaybookRunID = "run1"
		assert.Error(t, w.IsValid())
	})

	t.Run("neither scope set", func(t *testing.T) {
		w := IncomingWebhook{
			Name:      "test webhook",
			CreatorID: "creator1",
			TeamID:    "team1",
		}
		assert.Error(t, w.IsValid())
	})
}
