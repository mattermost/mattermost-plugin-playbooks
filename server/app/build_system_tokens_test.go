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

// newSystemTokenTestService creates a minimal PlaybookRunServiceImpl backed by the
// supplied mock API. Only pluginAPI is populated — sufficient for buildSystemTokens
// and resolveUserDisplayName.
func newSystemTokenTestService(t *testing.T, mockAPI *plugintest.API) *PlaybookRunServiceImpl {
	t.Helper()
	t.Cleanup(func() { mockAPI.AssertExpectations(t) })
	return &PlaybookRunServiceImpl{
		pluginAPI: pluginapi.NewClient(mockAPI, nil),
	}
}

func TestBuildSystemTokens(t *testing.T) {
	t.Run("OWNER resolves to full display name", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "owner-1").Return(&model.User{
			Id:        "owner-1",
			Username:  "jsmith",
			FirstName: "Jane",
			LastName:  "Smith",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{OwnerUserID: "owner-1"}, "INC-1")

		assert.Equal(t, "Jane Smith", tokens["OWNER"])
	})

	t.Run("CREATOR resolves to full display name", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "creator-1").Return(&model.User{
			Id:        "creator-1",
			Username:  "jdoe",
			FirstName: "John",
			LastName:  "Doe",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{ReporterUserID: "creator-1"}, "INC-1")

		assert.Equal(t, "John Doe", tokens["CREATOR"])
	})

	t.Run("empty OwnerUserID leaves OWNER empty without calling user API", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		// No GetUser call expected — mock will fail the test if one occurs
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{OwnerUserID: ""}, "INC-1")

		assert.Equal(t, "", tokens["OWNER"])
	})

	t.Run("empty ReporterUserID leaves CREATOR empty without calling user API", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{ReporterUserID: ""}, "INC-1")

		assert.Equal(t, "", tokens["CREATOR"])
	})

	t.Run("user lookup failure falls back to raw user ID", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "ghost-user").Return(nil, &model.AppError{Message: "not found"})
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{OwnerUserID: "ghost-user"}, "INC-1")

		assert.Equal(t, "ghost-user", tokens["OWNER"])
	})

	t.Run("empty display name falls back to username", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "no-name-user").Return(&model.User{
			Id:       "no-name-user",
			Username: "fallback_username",
			// FirstName and LastName intentionally empty
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{OwnerUserID: "no-name-user"}, "INC-1")

		assert.Equal(t, "fallback_username", tokens["OWNER"])
	})

	t.Run("SEQ token is passed through unchanged", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{}, "INC-42")

		assert.Equal(t, "INC-42", tokens["SEQ"])
	})

	t.Run("all three tokens resolved together", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "owner-1").Return(&model.User{
			Id:        "owner-1",
			FirstName: "Alice",
			LastName:  "Jones",
		}, nil)
		mockAPI.On("GetUser", "creator-1").Return(&model.User{
			Id:        "creator-1",
			FirstName: "Bob",
			LastName:  "Brown",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{
			OwnerUserID:    "owner-1",
			ReporterUserID: "creator-1",
		}, "REL-5")

		assert.Equal(t, "REL-5", tokens["SEQ"])
		assert.Equal(t, "Alice Jones", tokens["OWNER"])
		assert.Equal(t, "Bob Brown", tokens["CREATOR"])
	})

	t.Run("OWNER and CREATOR are independent after owner reassignment", func(t *testing.T) {
		// Simulates the run state after owner was changed: OwnerUserID updated,
		// ReporterUserID (creator) stays fixed. Both tokens must resolve independently.
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "new-owner").Return(&model.User{
			Id:        "new-owner",
			FirstName: "New",
			LastName:  "Owner",
		}, nil)
		mockAPI.On("GetUser", "original-creator").Return(&model.User{
			Id:        "original-creator",
			FirstName: "Original",
			LastName:  "Creator",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		tokens := svc.buildSystemTokens(&PlaybookRun{
			OwnerUserID:    "new-owner",
			ReporterUserID: "original-creator",
		}, "INC-3")

		assert.Equal(t, "New Owner", tokens["OWNER"])
		assert.Equal(t, "Original Creator", tokens["CREATOR"])
		assert.NotEqual(t, tokens["OWNER"], tokens["CREATOR"])
	})

	t.Run("nickname preferred over full name when set", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "nick-user").Return(&model.User{
			Id:        "nick-user",
			Username:  "jdoe",
			Nickname:  "JD",
			FirstName: "John",
			LastName:  "Doe",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		// GetDisplayName(ShowNicknameFullName) returns Nickname when set
		tokens := svc.buildSystemTokens(&PlaybookRun{OwnerUserID: "nick-user"}, "INC-1")

		assert.Equal(t, "JD", tokens["OWNER"])
	})
}

func TestResolveUserDisplayName(t *testing.T) {
	t.Run("full name returned when first and last are set", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "u1").Return(&model.User{
			Id:        "u1",
			Username:  "jsmith",
			FirstName: "Jane",
			LastName:  "Smith",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		assert.Equal(t, "Jane Smith", svc.resolveUserDisplayName("u1"))
	})

	t.Run("username returned when display name is empty", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "u2").Return(&model.User{
			Id:       "u2",
			Username: "only_username",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		assert.Equal(t, "only_username", svc.resolveUserDisplayName("u2"))
	})

	t.Run("raw user ID returned when user.Get fails", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "missing-id").Return(nil, &model.AppError{Message: "not found"})
		svc := newSystemTokenTestService(t, mockAPI)

		assert.Equal(t, "missing-id", svc.resolveUserDisplayName("missing-id"))
	})

	t.Run("nickname preferred over full name", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("GetUser", "u3").Return(&model.User{
			Id:        "u3",
			Username:  "jdoe",
			Nickname:  "JD",
			FirstName: "John",
			LastName:  "Doe",
		}, nil)
		svc := newSystemTokenTestService(t, mockAPI)

		assert.Equal(t, "JD", svc.resolveUserDisplayName("u3"))
	})
}
