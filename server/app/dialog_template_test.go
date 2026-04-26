// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newDialogTestService creates a minimal PlaybookRunServiceImpl with a mocked
// pluginAPI that returns a test user for any GetUser call. Only the fields
// needed by newPlaybookRunDialog are populated.
func newDialogTestService(t *testing.T) *PlaybookRunServiceImpl {
	t.Helper()
	mockAPI := &plugintest.API{}
	mockAPI.On("GetUser", "user-1").Return(&model.User{
		Id:       "user-1",
		Username: "testuser",
		Locale:   "en",
	}, nil)
	t.Cleanup(func() { mockAPI.AssertExpectations(t) })
	return &PlaybookRunServiceImpl{
		pluginAPI: pluginapi.NewClient(mockAPI, nil),
	}
}

// findNameElement returns the dialog element with Name == DialogFieldNameKey.
func findNameElement(dialog *model.Dialog) *model.DialogElement {
	for i := range dialog.Elements {
		if dialog.Elements[i].Name == DialogFieldNameKey {
			return &dialog.Elements[i]
		}
	}
	return nil
}

func TestNewPlaybookRunDialog_NameFieldOptional(t *testing.T) {
	t.Run("no templates — name is required", func(t *testing.T) {
		svc := newDialogTestService(t)
		playbooks := []Playbook{
			{ID: "pb-1", Title: "Plain Playbook"},
			{ID: "pb-2", Title: "Another Playbook"},
		}

		dialog, err := svc.newPlaybookRunDialog("team-1", "user-1", "", "client-1", playbooks)
		require.NoError(t, err)

		nameEl := findNameElement(dialog)
		require.NotNil(t, nameEl)
		assert.False(t, nameEl.Optional, "name should be required when no playbook has templates")
		assert.Equal(t, 1, nameEl.MinLength, "MinLength should be 1 when no templates")
	})

	t.Run("mixed playbooks — name is required because user may pick a playbook without a template", func(t *testing.T) {
		svc := newDialogTestService(t)
		playbooks := []Playbook{
			{ID: "pb-1", Title: "Plain Playbook"},
			{ID: "pb-2", Title: "Template Playbook", ChannelNameTemplate: "{SEQ}"},
		}

		dialog, err := svc.newPlaybookRunDialog("team-1", "user-1", "", "client-1", playbooks)
		require.NoError(t, err)

		nameEl := findNameElement(dialog)
		require.NotNil(t, nameEl)
		assert.False(t, nameEl.Optional, "name should be required when multiple playbooks and user may select one without a template")
		assert.Equal(t, 1, nameEl.MinLength)
	})

	t.Run("single playbook with template — default from ChannelNameTemplate", func(t *testing.T) {
		svc := newDialogTestService(t)
		playbooks := []Playbook{
			{ID: "pb-1", Title: "Single PB", ChannelNameTemplate: "{SEQ}-ops"},
		}

		dialog, err := svc.newPlaybookRunDialog("team-1", "user-1", "", "client-1", playbooks)
		require.NoError(t, err)

		nameEl := findNameElement(dialog)
		require.NotNil(t, nameEl)
		assert.True(t, nameEl.Optional)
		assert.Equal(t, 0, nameEl.MinLength)
		assert.Equal(t, "{SEQ}-ops", nameEl.Default, "default should be ChannelNameTemplate for single playbook")
	})
}
