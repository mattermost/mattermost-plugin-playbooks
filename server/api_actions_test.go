package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mitchellh/mapstructure"
	"github.com/stretchr/testify/assert"
)

func TestActionCreation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("create valid action", func(t *testing.T) {
		// Create a valid action
		actionID, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeWelcomeMessage,
			TriggerType: client.TriggerTypeNewMemberJoins,
			Payload: client.WelcomeMessagePayload{
				Message: "Hello!",
			},
		})

		// Verify that the API succeeds
		assert.NoError(t, err)
		assert.NotEmpty(t, actionID)
	})

	t.Run("create invalid action - duplicate action and trigger types", func(t *testing.T) {
		// Define an action
		action := client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeCategorizeChannel,
			TriggerType: client.TriggerTypeNewMemberJoins,
			Payload: client.CategorizeChannelPayload{
				CategoryName: "category",
			},
		}

		// Create a valid action
		actionID, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, action)

		// Verify that the API succeeds
		assert.NoError(t, err)
		assert.NotEmpty(t, actionID)

		// Try to create the same action again
		_, err = e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, action)

		// Verify that the API fails with a 500 error
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("create invalid action - wrong action type", func(t *testing.T) {
		// Create an action with a wrong action type
		_, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  "wrong action type",
			TriggerType: client.TriggerTypeNewMemberJoins,
			Payload: client.WelcomeMessagePayload{
				Message: "Hello!",
			},
		})

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("create invalid action - wrong trigger type", func(t *testing.T) {
		// Create an action with a wrong trigger type
		_, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeWelcomeMessage,
			TriggerType: "wrong trigger type",
			Payload: client.WelcomeMessagePayload{
				Message: "Hello!",
			},
		})

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("create invalid action - wrong payload for action", func(t *testing.T) {
		// Create an action with a wrong payload
		_, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeWelcomeMessage,
			TriggerType: client.TriggerTypeNewMemberJoins,
			Payload: struct{ WrongField int }{
				WrongField: 42,
			},
		})

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("create action forbidden - not channel admin", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		// Tweak the permissions so that the user is no longer channel admin
		e.Permissions.RemovePermissionFromRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Attempt to create the action without those permissions
		_, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeWelcomeMessage,
			TriggerType: client.TriggerTypeNewMemberJoins,
			Payload: client.WelcomeMessagePayload{
				Message: "Hello!",
			},
		})

		// Verify that the API fails with a 403 error
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("create action allowed - not channel admin, but system admin", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		// Tweak the permissions so that the user is no longer channel admin
		e.Permissions.RemovePermissionFromRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Attempt to create the action as a sysadmin without being a channel admin
		actionID, err := e.PlaybooksAdminClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypePromptRunPlaybook,
			TriggerType: client.TriggerTypeKeywordsPosted,
			Payload: client.PromptRunPlaybookFromKeywordsPayload{
				Keywords:   []string{"one", "two"},
				PlaybookID: model.NewId(),
			},
		})

		// Verify that the API succeeds
		assert.NoError(t, err)
		assert.NotEmpty(t, actionID)
	})
}

func TestActionList(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create three valid actions

	welcomeActionID, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
		ChannelID:   e.BasicPublicChannel.Id,
		Enabled:     true,
		ActionType:  client.ActionTypeWelcomeMessage,
		TriggerType: client.TriggerTypeNewMemberJoins,
		Payload: client.WelcomeMessagePayload{
			Message: "msg",
		},
	})
	assert.NoError(t, err)

	categorizeActionID, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
		ChannelID:   e.BasicPublicChannel.Id,
		Enabled:     true,
		ActionType:  client.ActionTypeCategorizeChannel,
		TriggerType: client.TriggerTypeNewMemberJoins,
		Payload: client.CategorizeChannelPayload{
			CategoryName: "category",
		},
	})
	assert.NoError(t, err)

	playbookID := model.NewId()
	promptActionID, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
		ChannelID:   e.BasicPublicChannel.Id,
		Enabled:     true,
		ActionType:  client.ActionTypePromptRunPlaybook,
		TriggerType: client.TriggerTypeKeywordsPosted,
		Payload: client.PromptRunPlaybookFromKeywordsPayload{
			Keywords:   []string{"one", "two"},
			PlaybookID: playbookID,
		},
	})
	assert.NoError(t, err)

	t.Run("view list allowed", func(t *testing.T) {
		// List the actions with the default options
		actions, err := e.PlaybooksClient.Actions.List(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionListOptions{})

		// Verify that the API succeeds and that it returns the correct number of actions
		assert.NoError(t, err)
		assert.Len(t, actions, 3)

		// Verify that the returned actions contain the correct payloads
		for _, action := range actions {
			switch action.ID {
			case welcomeActionID:
				var payload client.WelcomeMessagePayload
				err = mapstructure.Decode(action.Payload, &payload)
				assert.NoError(t, err)
				assert.Equal(t, "msg", payload.Message)

			case categorizeActionID:
				var payload client.CategorizeChannelPayload
				err = mapstructure.Decode(action.Payload, &payload)
				assert.NoError(t, err)
				assert.Equal(t, "category", payload.CategoryName)

			case promptActionID:
				var payload client.PromptRunPlaybookFromKeywordsPayload
				err = mapstructure.Decode(action.Payload, &payload)
				assert.NoError(t, err)
				assert.EqualValues(t, []string{"one", "two"}, payload.Keywords)
				assert.Equal(t, playbookID, payload.PlaybookID)

			}
		}
	})

	t.Run("view list forbidden", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		// Tweak the permissions so that the user is no longer channel admin
		e.Permissions.RemovePermissionFromRole(model.PermissionReadChannel.Id, model.ChannelUserRoleId)

		// Attempt to list the actions
		_, err := e.PlaybooksClient.Actions.List(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionListOptions{})

		// Verify that the API fails with a 403 error
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})
}

func TestActionUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create a valid action
	action := client.GenericChannelAction{
		GenericChannelActionWithoutPayload: client.GenericChannelActionWithoutPayload{
			ChannelID:   e.BasicPublicChannel.Id,
			Enabled:     true,
			ActionType:  client.ActionTypeWelcomeMessage,
			TriggerType: client.TriggerTypeNewMemberJoins,
		},
		Payload: client.WelcomeMessagePayload{
			Message: "msg",
		},
	}

	id, err := e.PlaybooksClient.Actions.Create(context.Background(), e.BasicPublicChannel.Id, client.ChannelActionCreateOptions{
		ChannelID:   e.BasicPublicChannel.Id,
		Enabled:     action.Enabled,
		ActionType:  action.ActionType,
		TriggerType: action.TriggerType,
		Payload:     action.Payload,
	})
	assert.NoError(t, err)
	assert.NotEmpty(t, id)

	action.ID = id

	t.Run("valid update", func(t *testing.T) {
		// Make a valid modification
		action.Enabled = false

		// Make the Update request
		err := e.PlaybooksClient.Actions.Update(context.Background(), action)

		// Verify that the API succeeds
		assert.NoError(t, err)
	})

	t.Run("invalid update - wrong action type", func(t *testing.T) {
		// Make an invalid modification
		action.ActionType = "wrong"

		// Make the Update request
		err := e.PlaybooksClient.Actions.Update(context.Background(), action)

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("invalid update - wrong trigger type", func(t *testing.T) {
		// Make an invalid modification
		action.TriggerType = "wrong"

		// Make the Update request
		err := e.PlaybooksClient.Actions.Update(context.Background(), action)

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("invalid update - wrong payload type", func(t *testing.T) {
		// Make an invalid modification
		action.Payload = client.WelcomeMessagePayload{Message: ""}

		// Make the Update request
		err := e.PlaybooksClient.Actions.Update(context.Background(), action)

		// Verify that the API fails with a 400 error
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update action forbidden - not channel admin", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		// Tweak the permissions so that the user is no longer channel admin
		e.Permissions.RemovePermissionFromRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Make a valid modification
		action.Enabled = false

		// Make the Update request
		err := e.PlaybooksClient.Actions.Update(context.Background(), action)

		// Verify that the API fails with a 403 error
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

}
