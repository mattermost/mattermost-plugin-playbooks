// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// testQuicklistGenerateRequest mirrors the API request structure
type testQuicklistGenerateRequest struct {
	PostID string `json:"post_id"`
}

// testErrorResponse is the error response structure returned by the plugin API
type testErrorResponse struct {
	Error string `json:"error"`
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

	// Helper to make quicklist API calls using raw HTTP requests
	// Returns status code, response body, and error message (if any)
	doQuicklistGenerate := func(mmClient *model.Client4, req testQuicklistGenerateRequest) (int, string, string) {
		body, _ := json.Marshal(req)

		httpReq, err := http.NewRequest(
			http.MethodPost,
			mmClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			strings.NewReader(string(body)),
		)
		require.NoError(t, err)

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+mmClient.AuthToken)

		resp, err := http.DefaultClient.Do(httpReq)
		require.NoError(t, err)
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)

		// Extract error message from JSON response if present
		var errResp testErrorResponse
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error != "" {
			return resp.StatusCode, string(bodyBytes), errResp.Error
		}

		return resp.StatusCode, string(bodyBytes), ""
	}

	t.Run("feature disabled returns 403", func(t *testing.T) {
		setQuicklistConfig(t, e, false, "")

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: e.BasicPublicChannelPost.Id,
		})

		assert.Equal(t, http.StatusForbidden, statusCode)
		assert.Contains(t, errMsg, "quicklist feature is not enabled")
	})

	t.Run("missing post_id returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: "",
		})

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Contains(t, errMsg, "post_id is required")
	})

	t.Run("invalid post_id format returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: "invalid-id",
		})

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Contains(t, errMsg, "invalid post_id format")
	})

	t.Run("non-existent post returns 404", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: model.NewId(), // Valid format but doesn't exist
		})

		assert.Equal(t, http.StatusNotFound, statusCode)
		assert.Contains(t, errMsg, "post not found")
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
		statusCode, _, errMsg := doQuicklistGenerate(newUserClient, testQuicklistGenerateRequest{
			PostID: e.BasicPrivateChannelPost.Id,
		})

		assert.Equal(t, http.StatusNotFound, statusCode)
		assert.Contains(t, errMsg, "post not found")
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

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerAdminClient, testQuicklistGenerateRequest{
			PostID: post.Id,
		})

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Contains(t, errMsg, "cannot generate quicklist from archived channel")
	})

	t.Run("AI service unavailable returns 503", func(t *testing.T) {
		// Enable quicklist with a fake bot ID - the AI plugin won't be running
		setQuicklistConfig(t, e, true, "fake-bot-id-that-does-not-exist")

		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: e.BasicPublicChannelPost.Id,
		})

		// Since the AI plugin (mattermost-plugin-agents) is not running in tests,
		// this should return 503 Service Unavailable
		assert.Equal(t, http.StatusServiceUnavailable, statusCode)
		assert.Contains(t, errMsg, "AI service is not available")
	})
}

func TestQuicklistGenerateWithThread(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Helper to make quicklist API calls using raw HTTP requests
	doQuicklistGenerate := func(mmClient *model.Client4, req testQuicklistGenerateRequest) (int, string, string) {
		body, _ := json.Marshal(req)

		httpReq, err := http.NewRequest(
			http.MethodPost,
			mmClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			strings.NewReader(string(body)),
		)
		require.NoError(t, err)

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+mmClient.AuthToken)

		resp, err := http.DefaultClient.Do(httpReq)
		require.NoError(t, err)
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)

		var errResp testErrorResponse
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error != "" {
			return resp.StatusCode, string(bodyBytes), errResp.Error
		}

		return resp.StatusCode, string(bodyBytes), ""
	}

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

		// Since AI plugin is not running, we expect 503
		// But this test validates that the thread fetching works correctly
		// before reaching the AI service
		statusCode, _, errMsg := doQuicklistGenerate(e.ServerClient, testQuicklistGenerateRequest{
			PostID: rootPost.Id,
		})

		// We expect 503 because AI plugin isn't running
		// In a real environment with AI plugin, this would return 200
		assert.Equal(t, http.StatusServiceUnavailable, statusCode)
		assert.Contains(t, errMsg, "AI service is not available")
	})
}

func TestQuicklistGenerateRequestBody(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Helper to make raw API request with custom body
	doQuicklistGenerateRaw := func(mmClient *model.Client4, body string) (int, string) {
		httpReq, err := http.NewRequest(
			http.MethodPost,
			mmClient.URL+"/plugins/playbooks/api/v0/quicklist/generate",
			strings.NewReader(body),
		)
		require.NoError(t, err)

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+mmClient.AuthToken)

		resp, err := http.DefaultClient.Do(httpReq)
		require.NoError(t, err)
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)

		var errResp testErrorResponse
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error != "" {
			return resp.StatusCode, errResp.Error
		}

		return resp.StatusCode, string(bodyBytes)
	}

	t.Run("malformed JSON returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		statusCode, errMsg := doQuicklistGenerateRaw(e.ServerClient, `{invalid json`)

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Contains(t, errMsg, "unable to decode request body")
	})

	t.Run("empty body returns 400", func(t *testing.T) {
		setQuicklistConfig(t, e, true, "fake-bot-id")

		statusCode, errMsg := doQuicklistGenerateRaw(e.ServerClient, ``)

		// Empty body will either fail to decode or have empty post_id
		assert.Equal(t, http.StatusBadRequest, statusCode)
		// Either "unable to decode" or "post_id is required"
		assert.True(t,
			bytes.Contains([]byte(errMsg), []byte("unable to decode")) ||
				bytes.Contains([]byte(errMsg), []byte("post_id is required")))
	})
}
