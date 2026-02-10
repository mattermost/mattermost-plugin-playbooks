// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// mockConfigService is a mock implementation of config.Service for testing.
type mockConfigService struct {
	config *config.Configuration
}

func (m *mockConfigService) GetConfiguration() *config.Configuration {
	return m.config
}

func (m *mockConfigService) UpdateConfiguration(f func(*config.Configuration)) error {
	return nil
}

func (m *mockConfigService) RegisterConfigChangeListener(listener func()) string {
	return ""
}

func (m *mockConfigService) UnregisterConfigChangeListener(id string) {}

func (m *mockConfigService) GetManifest() *model.Manifest {
	return nil
}

func (m *mockConfigService) IsConfiguredForDevelopmentAndTesting() bool {
	return false
}

func (m *mockConfigService) IsCloud() bool {
	return false
}

func (m *mockConfigService) SupportsGivingFeedback() error {
	return nil
}

func (m *mockConfigService) IsIncrementalUpdatesEnabled() bool {
	return false
}

func (m *mockConfigService) IsExperimentalFeaturesEnabled() bool {
	return false
}

func (m *mockConfigService) IsQuicklistEnabled() bool {
	return m.config.QuicklistEnabled
}

func TestActionQuicklist_FeatureDisabled(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: false,
		},
	}

	// Expect ephemeral post about feature being disabled
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "not enabled")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{"some_post_id"})
}

func TestActionQuicklist_MissingPostID(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	// Expect ephemeral post about missing post ID
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "post ID")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{})
}

func TestActionQuicklist_InvalidPostIDFormat(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	// Expect ephemeral post about invalid post ID
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "Invalid post ID")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		poster:        mockPoster,
		configService: mockConfig,
	}

	// Post ID that's too short to be valid
	runner.actionQuicklist([]string{"short"})
}

func TestActionQuicklist_PostNotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	// Use a valid 26-character Mattermost ID format
	postID := model.NewId()

	// Create a mock pluginAPI that returns error for GetPost
	api := &plugintest.API{}
	api.On("GetPost", postID).Return(nil, model.NewAppError("GetPost", "post.not_found", nil, "", 404))

	pluginAPIClient := pluginapi.NewClient(api, nil)

	// Expect ephemeral post about post not found
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "Could not find")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		pluginAPI:     pluginAPIClient,
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{postID})

	api.AssertExpectations(t)
}

func TestActionQuicklist_NoChannelPermission(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	postID := model.NewId()
	channelID := model.NewId()
	post := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    "user2",
		Message:   "Test message",
	}

	api := &plugintest.API{}
	api.On("GetPost", postID).Return(post, nil)
	api.On("HasPermissionToChannel", "user1", channelID, model.PermissionReadChannel).Return(false)

	pluginAPIClient := pluginapi.NewClient(api, nil)

	// Expect generic not found to avoid leaking private channel/post existence
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "Could not find")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		pluginAPI:     pluginAPIClient,
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{postID})

	api.AssertExpectations(t)
}

func TestActionQuicklist_ArchivedChannel(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	postID := model.NewId()
	channelID := model.NewId()
	post := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    "user2",
		Message:   "Test message",
	}

	// Channel is archived (DeleteAt > 0)
	channel := &model.Channel{
		Id:       channelID,
		Name:     "test-channel",
		DeleteAt: 1234567890, // Non-zero means archived
	}

	api := &plugintest.API{}
	api.On("GetPost", postID).Return(post, nil)
	api.On("HasPermissionToChannel", "user1", channelID, model.PermissionReadChannel).Return(true)
	api.On("GetChannel", channelID).Return(channel, nil)

	pluginAPIClient := pluginapi.NewClient(api, nil)

	// Expect ephemeral post about archived channel
	mockPoster.EXPECT().
		EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(userID, channelID string, post *model.Post) {
			assert.Contains(t, post.Message, "archived")
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		pluginAPI:     pluginAPIClient,
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{postID})

	api.AssertExpectations(t)
}

func TestActionQuicklist_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockConfig := &mockConfigService{
		config: &config.Configuration{
			QuicklistEnabled: true,
		},
	}

	postID := model.NewId()
	channelID := model.NewId()
	post := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    "user2",
		Message:   "Test message",
	}

	channel := &model.Channel{
		Id:       channelID,
		Name:     "test-channel",
		DeleteAt: 0, // Not archived
	}

	api := &plugintest.API{}
	api.On("GetPost", postID).Return(post, nil)
	api.On("HasPermissionToChannel", "user1", channelID, model.PermissionReadChannel).Return(true)
	api.On("GetChannel", channelID).Return(channel, nil)

	pluginAPIClient := pluginapi.NewClient(api, nil)

	// First: expect ephemeral post confirmation
	mockPoster.EXPECT().
		EphemeralPost("user1", "channel1", gomock.Any()).
		Do(func(userID, channelIDArg string, post *model.Post) {
			assert.Contains(t, post.Message, "Opening quicklist")
		})

	// Second: expect WebSocket event
	var capturedPayload map[string]any
	mockPoster.EXPECT().
		PublishWebsocketEventToUser(quicklistOpenModalEvent, gomock.Any(), "user1").
		Do(func(event string, payload any, userID string) {
			capturedPayload = payload.(map[string]any)
		})

	runner := &Runner{
		context: &plugin.Context{},
		args: &model.CommandArgs{
			UserId:    "user1",
			ChannelId: "channel1",
		},
		pluginAPI:     pluginAPIClient,
		poster:        mockPoster,
		configService: mockConfig,
	}

	runner.actionQuicklist([]string{postID})

	// Verify WebSocket payload
	require.NotNil(t, capturedPayload)
	assert.Equal(t, postID, capturedPayload["post_id"])
	assert.Equal(t, channelID, capturedPayload["channel_id"])

	api.AssertExpectations(t)
}
