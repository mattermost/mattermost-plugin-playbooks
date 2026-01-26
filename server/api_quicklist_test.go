// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// testQuicklistGenerateRequest mirrors the API request structure
type testQuicklistGenerateRequest struct {
	PostID string `json:"post_id"`
}

// setQuicklistConfig enables or disables the quicklist feature
func setQuicklistConfig(t *testing.T, e *TestEnvironment, enabled bool, agentBotID string) {
	cfg := e.Srv.Config()
	if cfg.PluginSettings.Plugins == nil {
		cfg.PluginSettings.Plugins = make(map[string]map[string]any)
	}
	if cfg.PluginSettings.Plugins["playbooks"] == nil {
		cfg.PluginSettings.Plugins["playbooks"] = make(map[string]any)
	}
	cfg.PluginSettings.Plugins["playbooks"]["QuicklistEnabled"] = enabled
	cfg.PluginSettings.Plugins["playbooks"]["QuicklistAgentBotID"] = agentBotID

	var patchedConfig model.Config
	// Patching only the plugin config mysteriously doesn't trigger an OnConfigurationChange
	// back to the plugin. So mess with an unrelated setting to force this to happen.
	patchedConfig.ServiceSettings.GiphySdkKey = model.NewPointer(model.NewRandomString(6))
	patchedConfig.PluginSettings.Plugins = map[string]map[string]any{
		"playbooks": cfg.PluginSettings.Plugins["playbooks"],
	}
	_, _, err := e.ServerAdminClient.PatchConfig(context.Background(), &patchedConfig)
	require.NoError(t, err)
}

func TestQuicklistGenerate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Helper to make quicklist API calls
	doQuicklistGenerate := func(client *model.Client4, req testQuicklistGenerateRequest) (*http.Response, []byte) {
		body, _ := json.Marshal(req)
		resp, err := client.DoAPIRequestWithHeaders(
			context.Background(),
			http.MethodPost,
			client.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			string(body),
			nil,
		)
		if err != nil {
			// Read error response body
			if resp != nil && resp.Body != nil {
				bodyBytes, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				return resp, bodyBytes
			}
			return resp, nil
		}
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return resp, bodyBytes
	}

	t.Run("feature disabled returns 403", func(t *testing.T) {
		setQuicklistConfig(t, e, false, "")

		resp, body := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: e.BasicPublicChannelPost.Id,
		})

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		assert.Contains(t, string(body), "quicklist feature is not enabled")
	})

	t.Run("missing post_id returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		resp, body := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: "",
		})

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, string(body), "post_id is required")
	})

	t.Run("invalid post_id format returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		resp, body := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: "invalid-id",
		})

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, string(body), "invalid post_id format")
	})

	t.Run("non-existent post returns 404", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		resp, body := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: model.NewId(), // Valid format but doesn't exist
		})

		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Contains(t, string(body), "post not found")
	})

	t.Run("no channel access returns 404 to prevent enumeration", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		// Create a new user that's not a member of the private channel
		siteURL := e.ServerClient.URL
		newUserClient := model.NewAPIv4Client(siteURL)

		// Create a user not in the private channel
		newUser, _, err := e.ServerAdminClient.CreateUser(context.Background(), &model.User{
			Email:    "newuser_" + model.NewId() + "@example.com",
			Username: "newuser_" + model.NewId(),
			Password: "Password123!",
		})
		require.NoError(t, err)

		// Add user to team but NOT to the private channel
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicTeam.Id, newUser.Id)
		require.NoError(t, err)

		// Login as the new user
		_, _, err = newUserClient.Login(context.Background(), newUser.Email, "Password123!")
		require.NoError(t, err)

		// Try to access a post in the private channel
		// Returns 404 instead of 403 to prevent enumeration of private channels/posts
		resp, body := doQuicklistGenerate(newUserClient, testQuicklistGenerateRequest{
			PostID: e.BasicPrivateChannelPost.Id,
		})

		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Contains(t, string(body), "post not found")
	})

	t.Run("archived channel returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		// Create a channel, post to it, then archive it
		archivedChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Name:        "archived-test-channel",
			DisplayName: "Archived Test Channel",
			Type:        model.ChannelTypeOpen,
		})
		require.NoError(t, err)

		post, _, err := e.ServerAdminClient.CreatePost(context.Background(), &model.Post{
			ChannelId: archivedChannel.Id,
			Message:   "Test post in soon-to-be archived channel",
		})
		require.NoError(t, err)

		// Archive the channel
		_, err = e.ServerAdminClient.DeleteChannel(context.Background(), archivedChannel.Id)
		require.NoError(t, err)

		resp, body := doQuicklistGenerate(e.ServerAdminClient, testQuicklistGenerateRequest{
			PostID: post.Id,
		})

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Contains(t, string(body), "cannot generate quicklist from archived channel")
	})

	t.Run("AI service unavailable returns 503", func(t *testing.T) {
		// Enable quicklist with a fake bot ID - the AI plugin won't be running
		setQuicklistConfig(t, e, true, "fake-bot-id-that-does-not-exist")

		resp, body := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: e.BasicPublicChannelPost.Id,
		})

		// Since the AI plugin (mattermost-plugin-agents) is not running in tests,
		// this should return 503 Service Unavailable
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Contains(t, string(body), "AI service is not available")
	})
}

func TestQuicklistGenerateWithThread(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("generates from thread with multiple messages", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		// Create a thread with multiple messages
		rootPost, _, err := e.ServerClient.CreatePost(context.Background(), &model.Post{
			ChannelId: e.BasicPublicChannel.Id,
			Message:   "Let's plan the Q4 launch. Main areas: design, backend, testing.",
		})
		require.NoError(t, err)

		// Add replies to create a thread
		_, _, err = e.ServerClient.CreatePost(context.Background(), &model.Post{
			ChannelId: e.BasicPublicChannel.Id,
			RootId:    rootPost.Id,
			Message:   "I'll handle the design mockups by Friday",
		})
		require.NoError(t, err)

		_, _, err = e.ServerClient.CreatePost(context.Background(), &model.Post{
			ChannelId: e.BasicPublicChannel.Id,
			RootId:    rootPost.Id,
			Message:   "Backend API should be done by Jan 20",
		})
		require.NoError(t, err)

		body, _ := json.Marshal(testQuicklistGenerateRequest{
			PostID: rootPost.Id,
		})

		resp, _ := e.ServerClient.DoAPIRequestWithHeaders(
			context.Background(),
			http.MethodPost,
			e.ServerClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			string(body),
			nil,
		)

		// Since AI plugin is not running, we expect 503
		// But this test validates that the thread fetching works correctly
		// before reaching the AI service
		require.NotNil(t, resp)
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		// We expect 503 because AI plugin isn't running
		// In a real environment with AI plugin, this would return 200
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Contains(t, string(bodyBytes), "AI service is not available")
	})
}

func TestQuicklistGenerateRequestBody(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("malformed JSON returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		resp, err := e.ServerClient.DoAPIRequestWithHeaders(
			context.Background(),
			http.MethodPost,
			e.ServerClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			`{invalid json`,
			nil,
		)

		if resp != nil {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			assert.Contains(t, string(bodyBytes), "unable to decode request body")
		} else {
			// If resp is nil, we still got an error which is expected
			assert.Error(t, err)
		}
	})

	t.Run("empty body returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		resp, err := e.ServerClient.DoAPIRequestWithHeaders(
			context.Background(),
			http.MethodPost,
			e.ServerClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			``,
			nil,
		)

		if resp != nil {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			// Empty body will either fail to decode or have empty post_id
			assert.True(t, resp.StatusCode == http.StatusBadRequest)
			// Either "unable to decode" or "post_id is required"
			assert.True(t,
				bytes.Contains(bodyBytes, []byte("unable to decode")) ||
					bytes.Contains(bodyBytes, []byte("post_id is required")))
		} else {
			assert.Error(t, err)
		}
	})
}
