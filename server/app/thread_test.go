// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

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

func TestSortPostsByTime(t *testing.T) {
	t.Run("empty map returns empty slice", func(t *testing.T) {
		posts := sortPostsByTime(map[string]*model.Post{})
		assert.Empty(t, posts)
	})

	t.Run("single post returns that post", func(t *testing.T) {
		postsMap := map[string]*model.Post{
			"post1": {Id: "post1", CreateAt: 1000},
		}
		posts := sortPostsByTime(postsMap)
		require.Len(t, posts, 1)
		assert.Equal(t, "post1", posts[0].Id)
	})

	t.Run("posts are sorted ascending by CreateAt", func(t *testing.T) {
		postsMap := map[string]*model.Post{
			"post3": {Id: "post3", CreateAt: 3000},
			"post1": {Id: "post1", CreateAt: 1000},
			"post2": {Id: "post2", CreateAt: 2000},
		}
		posts := sortPostsByTime(postsMap)
		require.Len(t, posts, 3)
		assert.Equal(t, "post1", posts[0].Id)
		assert.Equal(t, "post2", posts[1].Id)
		assert.Equal(t, "post3", posts[2].Id)
	})

	t.Run("posts with same CreateAt are stable", func(t *testing.T) {
		postsMap := map[string]*model.Post{
			"post1": {Id: "post1", CreateAt: 1000},
			"post2": {Id: "post2", CreateAt: 1000},
		}
		posts := sortPostsByTime(postsMap)
		require.Len(t, posts, 2)
		// Both should be present, order may vary since same time
		ids := []string{posts[0].Id, posts[1].Id}
		assert.Contains(t, ids, "post1")
		assert.Contains(t, ids, "post2")
	})
}

func TestKeepRecentWithRoot(t *testing.T) {
	t.Run("returns all posts when under limit", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "root", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
			{Id: "post3", CreateAt: 3000},
		}
		result := keepRecentWithRoot(posts, "root", 5)
		assert.Len(t, result, 3)
	})

	t.Run("returns all posts when exactly at limit", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "root", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
			{Id: "post3", CreateAt: 3000},
		}
		result := keepRecentWithRoot(posts, "root", 3)
		assert.Len(t, result, 3)
	})

	t.Run("keeps root and most recent when over limit", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "root", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
			{Id: "post3", CreateAt: 3000},
			{Id: "post4", CreateAt: 4000},
			{Id: "post5", CreateAt: 5000},
		}
		result := keepRecentWithRoot(posts, "root", 3)
		require.Len(t, result, 3)

		// Should have root
		ids := make([]string, len(result))
		for i, p := range result {
			ids[i] = p.Id
		}
		assert.Contains(t, ids, "root")
		// Should have most recent 2 (post4 and post5)
		assert.Contains(t, ids, "post4")
		assert.Contains(t, ids, "post5")
		// Should not have middle posts
		assert.NotContains(t, ids, "post2")
		assert.NotContains(t, ids, "post3")
	})

	t.Run("result is sorted by time ascending", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "root", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
			{Id: "post3", CreateAt: 3000},
			{Id: "post4", CreateAt: 4000},
			{Id: "post5", CreateAt: 5000},
		}
		result := keepRecentWithRoot(posts, "root", 3)
		require.Len(t, result, 3)

		// Should be sorted ascending
		assert.True(t, result[0].CreateAt <= result[1].CreateAt)
		assert.True(t, result[1].CreateAt <= result[2].CreateAt)
	})

	t.Run("handles root not being the oldest post", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", CreateAt: 1000},
			{Id: "root", CreateAt: 2000}, // root is not the oldest
			{Id: "post3", CreateAt: 3000},
			{Id: "post4", CreateAt: 4000},
		}
		result := keepRecentWithRoot(posts, "root", 2)
		require.Len(t, result, 2)

		ids := make([]string, len(result))
		for i, p := range result {
			ids[i] = p.Id
		}
		assert.Contains(t, ids, "root")
		assert.Contains(t, ids, "post4") // most recent other post
	})

	t.Run("handles missing root gracefully", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
			{Id: "post3", CreateAt: 3000},
		}
		result := keepRecentWithRoot(posts, "nonexistent", 2)
		require.Len(t, result, 2)
		// Should have most recent 2
		assert.Equal(t, "post2", result[0].Id)
		assert.Equal(t, "post3", result[1].Id)
	})

	t.Run("handles limit of 1 with root", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "root", CreateAt: 1000},
			{Id: "post2", CreateAt: 2000},
		}
		result := keepRecentWithRoot(posts, "root", 1)
		require.Len(t, result, 1)
		// With limit 1, should only have root
		assert.Equal(t, "root", result[0].Id)
	})
}

func TestCountParticipants(t *testing.T) {
	t.Run("empty posts returns 0", func(t *testing.T) {
		count := countParticipants([]*model.Post{})
		assert.Equal(t, 0, count)
	})

	t.Run("single post returns 1", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1"},
		}
		count := countParticipants(posts)
		assert.Equal(t, 1, count)
	})

	t.Run("multiple posts same user returns 1", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1"},
			{Id: "post2", UserId: "user1"},
			{Id: "post3", UserId: "user1"},
		}
		count := countParticipants(posts)
		assert.Equal(t, 1, count)
	})

	t.Run("multiple posts different users returns correct count", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1"},
			{Id: "post2", UserId: "user2"},
			{Id: "post3", UserId: "user1"},
			{Id: "post4", UserId: "user3"},
			{Id: "post5", UserId: "user2"},
		}
		count := countParticipants(posts)
		assert.Equal(t, 3, count)
	})
}

func TestThreadService_FormatThreadContent(t *testing.T) {
	api := &plugintest.API{}
	service := &ThreadService{api: api}

	t.Run("formats basic thread correctly", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1", CreateAt: 1704067200000, Message: "Hello world"},
			{Id: "post2", UserId: "user2", CreateAt: 1704067260000, Message: "Hi there"},
		}
		channel := &model.Channel{Name: "test-channel", DisplayName: "Test Channel"}
		userCache := map[string]string{"user1": "alice", "user2": "bob"}

		content := service.formatThreadContent(posts, channel, userCache, false, 0)

		assert.Contains(t, content, "Thread from channel: #Test Channel")
		assert.Contains(t, content, "[@alice]")
		assert.Contains(t, content, "[@bob]")
		assert.Contains(t, content, "Hello world")
		assert.Contains(t, content, "Hi there")
		assert.NotContains(t, content, "truncated")
	})

	t.Run("includes truncation notice when truncated", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1", CreateAt: 1704067200000, Message: "Hello"},
		}
		channel := &model.Channel{Name: "test-channel"}
		userCache := map[string]string{"user1": "alice"}

		content := service.formatThreadContent(posts, channel, userCache, true, 45)

		assert.Contains(t, content, "[Thread truncated: 45 more messages not included]")
	})

	t.Run("handles nil channel gracefully", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1", CreateAt: 1704067200000, Message: "Hello"},
		}
		userCache := map[string]string{"user1": "alice"}

		content := service.formatThreadContent(posts, nil, userCache, false, 0)

		assert.Contains(t, content, "Thread from channel: #unknown")
	})

	t.Run("uses channel name when display name is empty", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1", CreateAt: 1704067200000, Message: "Hello"},
		}
		channel := &model.Channel{Name: "my-channel", DisplayName: ""}
		userCache := map[string]string{"user1": "alice"}

		content := service.formatThreadContent(posts, channel, userCache, false, 0)

		assert.Contains(t, content, "Thread from channel: #my-channel")
	})

	t.Run("lists participants alphabetically", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "post1", UserId: "user1", CreateAt: 1704067200000, Message: "Hello"},
		}
		channel := &model.Channel{Name: "test"}
		userCache := map[string]string{"user1": "zoe", "user2": "alice", "user3": "bob"}

		content := service.formatThreadContent(posts, channel, userCache, false, 0)

		// Find the participants line
		lines := strings.Split(content, "\n")
		var participantsLine string
		for _, line := range lines {
			if strings.HasPrefix(line, "Participants:") {
				participantsLine = line
				break
			}
		}

		// Check that participants are in order
		aliceIdx := strings.Index(participantsLine, "@alice")
		bobIdx := strings.Index(participantsLine, "@bob")
		zoeIdx := strings.Index(participantsLine, "@zoe")

		assert.True(t, aliceIdx < bobIdx, "alice should come before bob")
		assert.True(t, bobIdx < zoeIdx, "bob should come before zoe")
	})
}

func TestThreadContent_EmptyThread(t *testing.T) {
	t.Run("empty posts slice produces valid output", func(t *testing.T) {
		api := &plugintest.API{}
		service := &ThreadService{api: api}
		posts := []*model.Post{}
		channel := &model.Channel{Name: "test"}
		userCache := map[string]string{}

		content := service.formatThreadContent(posts, channel, userCache, false, 0)

		assert.Contains(t, content, "Thread from channel: #test")
		assert.Contains(t, content, "Participants: ")
	})
}

func TestThreadContent_SinglePost(t *testing.T) {
	t.Run("single post thread formats correctly", func(t *testing.T) {
		api := &plugintest.API{}
		service := &ThreadService{api: api}
		posts := []*model.Post{
			{Id: "root", UserId: "user1", CreateAt: 1704067200000, Message: "This is a single post thread"},
		}
		channel := &model.Channel{Name: "general", DisplayName: "General"}
		userCache := map[string]string{"user1": "alice"}

		content := service.formatThreadContent(posts, channel, userCache, false, 0)

		assert.Contains(t, content, "Thread from channel: #General")
		assert.Contains(t, content, "Participants: @alice")
		assert.Contains(t, content, "This is a single post thread")
		// Should only have one message separator block
		assert.Equal(t, 1, strings.Count(content, "[@alice]"))
	})
}

func TestFetchAndFormatThread(t *testing.T) {
	t.Run("fetches and formats thread successfully", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 10000,
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{
			Id:        "root123",
			UserId:    "user1",
			ChannelId: "channel1",
			CreateAt:  1704067200000,
			Message:   "Root message",
		}
		replyPost := &model.Post{
			Id:        "reply123",
			UserId:    "user2",
			ChannelId: "channel1",
			CreateAt:  1704067260000,
			Message:   "Reply message",
			RootId:    "root123",
		}

		thread := &model.PostList{
			Order: []string{"root123", "reply123"},
			Posts: map[string]*model.Post{
				"root123":  rootPost,
				"reply123": replyPost,
			},
		}

		channel := &model.Channel{
			Id:          "channel1",
			Name:        "test-channel",
			DisplayName: "Test Channel",
		}

		user1 := &model.User{Id: "user1", Username: "alice"}
		user2 := &model.User{Id: "user2", Username: "bob"}

		api.On("GetPost", "root123").Return(rootPost, nil)
		api.On("GetPostThread", "root123").Return(thread, nil)
		api.On("GetChannel", "channel1").Return(channel, nil)
		api.On("GetUser", "user1").Return(user1, nil)
		api.On("GetUser", "user2").Return(user2, nil)

		result, err := service.FetchAndFormatThread("root123")

		require.NoError(t, err)
		assert.Equal(t, 2, result.MessageCount)
		assert.Equal(t, 2, result.ParticipantCount)
		assert.False(t, result.Truncated)
		assert.Equal(t, 0, result.TruncatedCount)
		assert.Contains(t, result.FormattedContent, "Test Channel")
		assert.Contains(t, result.FormattedContent, "@alice")
		assert.Contains(t, result.FormattedContent, "@bob")
		assert.Contains(t, result.FormattedContent, "Root message")
		assert.Contains(t, result.FormattedContent, "Reply message")

		api.AssertExpectations(t)
	})

	t.Run("returns error when post not found", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 10000,
			},
		}
		service := NewThreadService(api, cfg)

		api.On("GetPost", "nonexistent").Return(nil, model.NewAppError("GetPost", "post.not_found", nil, "", 404))

		result, err := service.FetchAndFormatThread("nonexistent")

		assert.Nil(t, result)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get post")

		api.AssertExpectations(t)
	})

	t.Run("returns error when thread fetch fails", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 10000,
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{
			Id:        "root123",
			UserId:    "user1",
			ChannelId: "channel1",
		}

		api.On("GetPost", "root123").Return(rootPost, nil)
		api.On("GetPostThread", "root123").Return(nil, model.NewAppError("GetPostThread", "thread.not_found", nil, "", 500))

		result, err := service.FetchAndFormatThread("root123")

		assert.Nil(t, result)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get thread")

		api.AssertExpectations(t)
	})

	t.Run("truncates by message count", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   3,
				QuicklistMaxCharacters: 100000,
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{Id: "root", UserId: "user1", ChannelId: "ch1", CreateAt: 1000, Message: "Root"}

		// Create 5 posts but limit is 3
		posts := map[string]*model.Post{
			"root":  rootPost,
			"post2": {Id: "post2", UserId: "user1", ChannelId: "ch1", CreateAt: 2000, Message: "Post 2", RootId: "root"},
			"post3": {Id: "post3", UserId: "user1", ChannelId: "ch1", CreateAt: 3000, Message: "Post 3", RootId: "root"},
			"post4": {Id: "post4", UserId: "user1", ChannelId: "ch1", CreateAt: 4000, Message: "Post 4", RootId: "root"},
			"post5": {Id: "post5", UserId: "user1", ChannelId: "ch1", CreateAt: 5000, Message: "Post 5", RootId: "root"},
		}
		thread := &model.PostList{Posts: posts}

		channel := &model.Channel{Id: "ch1", Name: "test"}
		user := &model.User{Id: "user1", Username: "alice"}

		api.On("GetPost", "root").Return(rootPost, nil)
		api.On("GetPostThread", "root").Return(thread, nil)
		api.On("GetChannel", "ch1").Return(channel, nil)
		api.On("GetUser", "user1").Return(user, nil)

		result, err := service.FetchAndFormatThread("root")

		require.NoError(t, err)
		assert.Equal(t, 3, result.MessageCount)
		assert.True(t, result.Truncated)
		assert.Equal(t, 2, result.TruncatedCount) // 5 - 3 = 2

		api.AssertExpectations(t)
	})

	t.Run("truncates by character limit", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 100, // Very low limit
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{
			Id:        "root",
			UserId:    "user1",
			ChannelId: "ch1",
			CreateAt:  1000,
			Message:   "This is a very long message that should cause the character limit to be exceeded",
		}

		thread := &model.PostList{
			Posts: map[string]*model.Post{"root": rootPost},
		}

		channel := &model.Channel{Id: "ch1", Name: "test"}
		user := &model.User{Id: "user1", Username: "alice"}

		api.On("GetPost", "root").Return(rootPost, nil)
		api.On("GetPostThread", "root").Return(thread, nil)
		api.On("GetChannel", "ch1").Return(channel, nil)
		api.On("GetUser", "user1").Return(user, nil)

		result, err := service.FetchAndFormatThread("root")

		require.NoError(t, err)
		assert.True(t, result.Truncated)
		assert.Contains(t, result.FormattedContent, "[Content truncated due to length]")
		// Content should be truncated to maxChars + truncation message
		assert.True(t, len(result.FormattedContent) < 200)

		api.AssertExpectations(t)
	})

	t.Run("handles unknown user gracefully", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 10000,
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{
			Id:        "root",
			UserId:    "unknown_user",
			ChannelId: "ch1",
			CreateAt:  1000,
			Message:   "Message from unknown user",
		}

		thread := &model.PostList{
			Posts: map[string]*model.Post{"root": rootPost},
		}

		channel := &model.Channel{Id: "ch1", Name: "test"}

		api.On("GetPost", "root").Return(rootPost, nil)
		api.On("GetPostThread", "root").Return(thread, nil)
		api.On("GetChannel", "ch1").Return(channel, nil)
		api.On("GetUser", "unknown_user").Return(nil, model.NewAppError("GetUser", "user.not_found", nil, "", 404))

		result, err := service.FetchAndFormatThread("root")

		require.NoError(t, err)
		assert.Contains(t, result.FormattedContent, "@unknown")

		api.AssertExpectations(t)
	})

	t.Run("handles channel fetch error gracefully", func(t *testing.T) {
		api := &plugintest.API{}
		cfg := &mockConfigService{
			config: &config.Configuration{
				QuicklistMaxMessages:   50,
				QuicklistMaxCharacters: 10000,
			},
		}
		service := NewThreadService(api, cfg)

		rootPost := &model.Post{
			Id:        "root",
			UserId:    "user1",
			ChannelId: "ch1",
			CreateAt:  1000,
			Message:   "Message",
		}

		thread := &model.PostList{
			Posts: map[string]*model.Post{"root": rootPost},
		}

		user := &model.User{Id: "user1", Username: "alice"}

		api.On("GetPost", "root").Return(rootPost, nil)
		api.On("GetPostThread", "root").Return(thread, nil)
		api.On("GetChannel", "ch1").Return(nil, model.NewAppError("GetChannel", "channel.not_found", nil, "", 404))
		api.On("GetUser", mock.Anything).Return(user, nil)

		result, err := service.FetchAndFormatThread("root")

		require.NoError(t, err)
		// Should use "unknown" for channel name
		assert.Contains(t, result.FormattedContent, "Thread from channel: #unknown")

		api.AssertExpectations(t)
	})
}
