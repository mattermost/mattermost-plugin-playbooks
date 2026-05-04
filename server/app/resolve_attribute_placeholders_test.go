// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
)

func TestResolveAttributePlaceholders_SEQStripping(t *testing.T) {
	t.Run("SEQ token stripped when run has no sequential ID", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{SequentialID: ""}
		result := svc.resolveAttributePlaceholders("{SEQ} - Incident Report", run)
		assert.Equal(t, " - Incident Report", result)
	})

	t.Run("SEQ token resolved when run has a sequential ID", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{SequentialID: "INC-00001"}
		result := svc.resolveAttributePlaceholders("{SEQ} - Incident Report", run)
		assert.Equal(t, "INC-00001 - Incident Report", result)
	})

	t.Run("empty message returned unchanged", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{SequentialID: "INC-00001"}
		result := svc.resolveAttributePlaceholders("", run)
		assert.Equal(t, "", result)
	})
}

func newResolveUserTestService(t *testing.T, user *model.User, showFullName *bool) *PlaybookRunServiceImpl {
	t.Helper()
	mockAPI := &plugintest.API{}
	mockAPI.On("GetUser", user.Id).Return(user, nil)
	cfg := &model.Config{}
	cfg.PrivacySettings.ShowFullName = showFullName
	mockAPI.On("GetConfig").Return(cfg)
	t.Cleanup(func() { mockAPI.AssertExpectations(t) })
	return &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(mockAPI, nil)}
}

func TestResolveUserDisplayName(t *testing.T) {
	t.Run("returns full name when ShowFullName is true", func(t *testing.T) {
		user := &model.User{Id: "u1", Username: "jsmith", FirstName: "John", LastName: "Smith"}
		svc := newResolveUserTestService(t, user, model.NewPointer(true))
		assert.Equal(t, "John Smith", svc.resolveUserDisplayName("u1"))
	})

	t.Run("returns username when ShowFullName is false", func(t *testing.T) {
		user := &model.User{Id: "u1", Username: "jsmith", FirstName: "John", LastName: "Smith"}
		svc := newResolveUserTestService(t, user, model.NewPointer(false))
		assert.Equal(t, "jsmith", svc.resolveUserDisplayName("u1"))
	})

	t.Run("falls back to userID when user lookup fails", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "missing-user").Return(nil, model.NewAppError("GetUser", "not_found", nil, "", 404))
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(mockAPI, nil)}
		assert.Equal(t, "missing-user", svc.resolveUserDisplayName("missing-user"))
	})
}
