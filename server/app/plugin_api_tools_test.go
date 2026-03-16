// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestResolveGroupMembers(t *testing.T) {
	newGroup := func(id string, allowRef bool) *model.Group {
		name := "group-" + id
		return &model.Group{
			Id:             id,
			Name:           &name,
			DisplayName:    "Group " + id,
			Source:         model.GroupSourceCustom,
			AllowReference: allowRef,
		}
	}

	newUser := func(id string) *model.User {
		return &model.User{Id: id}
	}

	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel) // suppress log noise in tests

	t.Run("empty group IDs returns nil", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		result := ResolveGroupMembers(nil, client, logger)
		assert.Nil(t, result)

		result = ResolveGroupMembers([]string{}, client, logger)
		assert.Nil(t, result)
	})

	t.Run("single group with members", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return([]*model.User{
			newUser("u1"),
			newUser("u2"),
		}, nil)

		result := ResolveGroupMembers([]string{"g1"}, client, logger)
		assert.Equal(t, []string{"u1", "u2"}, result)
		api.AssertExpectations(t)
	})

	t.Run("group not found is skipped", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		api.On("GetGroup", "bad").Return(nil, model.NewAppError("", "", nil, "", 404))

		result := ResolveGroupMembers([]string{"bad"}, client, logger)
		assert.Nil(t, result)
		api.AssertExpectations(t)
	})

	t.Run("group with AllowReference=false is skipped", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		api.On("GetGroup", "g1").Return(newGroup("g1", false), nil)

		result := ResolveGroupMembers([]string{"g1"}, client, logger)
		assert.Nil(t, result)
		api.AssertExpectations(t)
	})

	t.Run("multiple groups with mixed results", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		// g1: valid, has members
		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return([]*model.User{
			newUser("u1"),
		}, nil)

		// g2: not found
		api.On("GetGroup", "g2").Return(nil, model.NewAppError("", "", nil, "", 404))

		// g3: allow_reference=false
		api.On("GetGroup", "g3").Return(newGroup("g3", false), nil)

		// g4: valid, has members
		api.On("GetGroup", "g4").Return(newGroup("g4", true), nil)
		api.On("GetGroupMemberUsers", "g4", 0, 1000).Return([]*model.User{
			newUser("u2"),
			newUser("u3"),
		}, nil)

		result := ResolveGroupMembers([]string{"g1", "g2", "g3", "g4"}, client, logger)
		assert.Equal(t, []string{"u1", "u2", "u3"}, result)
		api.AssertExpectations(t)
	})

	t.Run("pagination fetches all pages", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)

		// First page: full (1000 users)
		page0Users := make([]*model.User, 1000)
		for i := range page0Users {
			page0Users[i] = newUser("u" + string(rune('a'+i%26)))
		}
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return(page0Users, nil)

		// Second page: partial (2 users)
		api.On("GetGroupMemberUsers", "g1", 1, 1000).Return([]*model.User{
			newUser("extra1"),
			newUser("extra2"),
		}, nil)

		result := ResolveGroupMembers([]string{"g1"}, client, logger)
		assert.Len(t, result, 1002)
		api.AssertExpectations(t)
	})

	t.Run("error fetching members breaks pagination but continues to next group", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		// g1: GetMemberUsers fails
		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return(nil, model.NewAppError("", "", nil, "", 500))

		// g2: succeeds
		api.On("GetGroup", "g2").Return(newGroup("g2", true), nil)
		api.On("GetGroupMemberUsers", "g2", 0, 1000).Return([]*model.User{
			newUser("u1"),
		}, nil)

		result := ResolveGroupMembers([]string{"g1", "g2"}, client, logger)
		assert.Equal(t, []string{"u1"}, result)
		api.AssertExpectations(t)
	})

	t.Run("error on later page discards partial members for that group", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)
		page0Users := make([]*model.User, 1000)
		for i := range page0Users {
			page0Users[i] = newUser("u1")
		}

		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return(page0Users, nil)
		api.On("GetGroupMemberUsers", "g1", 1, 1000).Return(nil, model.NewAppError("", "", nil, "", 500))

		result := ResolveGroupMembers([]string{"g1"}, client, logger)
		assert.Nil(t, result)
		api.AssertExpectations(t)
	})

	t.Run("empty group returns no users", func(t *testing.T) {
		api := &plugintest.API{}
		client := pluginapi.NewClient(api, nil)

		api.On("GetGroup", "g1").Return(newGroup("g1", true), nil)
		api.On("GetGroupMemberUsers", "g1", 0, 1000).Return([]*model.User{}, nil)

		result := ResolveGroupMembers([]string{"g1"}, client, logger)
		assert.Nil(t, result)
		api.AssertExpectations(t)
	})
}
