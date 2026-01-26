// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// QuicklistGenerateRequest is the request body for the generate endpoint.
type QuicklistGenerateRequest struct {
	PostID string `json:"post_id"`
}

// QuicklistGenerateResponse is the response body for the generate endpoint.
type QuicklistGenerateResponse struct {
	Title      string          `json:"title"`
	Checklists []app.Checklist `json:"checklists"`
	ThreadInfo ThreadInfo      `json:"thread_info"`
}

// ThreadInfo contains metadata about the analyzed thread.
type ThreadInfo struct {
	Truncated        bool `json:"truncated"`
	TruncatedCount   int  `json:"truncated_count"`
	MessageCount     int  `json:"message_count"`
	ParticipantCount int  `json:"participant_count"`
}

// QuicklistHandler handles quicklist-related API endpoints.
type QuicklistHandler struct {
	*ErrorHandler
	api           plugin.API
	threadService *app.ThreadService
	aiService     *app.AIService
	config        config.Service
}

// NewQuicklistHandler creates a new QuicklistHandler and registers routes.
func NewQuicklistHandler(
	router *mux.Router,
	api plugin.API,
	threadService *app.ThreadService,
	aiService *app.AIService,
	config config.Service,
) *QuicklistHandler {
	handler := &QuicklistHandler{
		ErrorHandler:  &ErrorHandler{},
		api:           api,
		threadService: threadService,
		aiService:     aiService,
		config:        config,
	}

	quicklistRouter := router.PathPrefix("/quicklist").Subrouter()
	quicklistRouter.HandleFunc("/generate", withContext(handler.generate)).Methods(http.MethodPost)

	return handler
}

// generate handles POST /api/v0/quicklist/generate
func (h *QuicklistHandler) generate(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	// Check feature flag
	if !h.config.IsQuicklistEnabled() {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "quicklist feature is not enabled", nil)
		return
	}

	// Decode request body
	var req QuicklistGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	// Validate required fields
	if req.PostID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "post_id is required", nil)
		return
	}

	// Validate post ID format before making API calls
	if !model.IsValidId(req.PostID) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid post_id format", nil)
		return
	}

	// Check if post exists
	post, appErr := h.api.GetPost(req.PostID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "post not found", appErr)
			return
		}
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to get post", appErr)
		return
	}

	// Use post's channel ID
	channelID := post.ChannelId

	// Check user has permission to read the channel
	// Return 404 instead of 403 to prevent enumeration of private channels/posts
	if !h.api.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "post not found", nil)
		return
	}

	// Check if channel is archived
	channel, appErr := h.api.GetChannel(channelID)
	if appErr != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to get channel", appErr)
		return
	}
	if channel.DeleteAt > 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "cannot generate quicklist from archived channel", nil)
		return
	}

	// Check if AI service is available
	if err := h.aiService.IsAvailable(); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusServiceUnavailable, "AI service is not available", err)
		return
	}

	// Fetch and format thread
	threadContent, err := h.threadService.FetchAndFormatThread(req.PostID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to fetch thread", err)
		return
	}

	// Generate checklist using AI
	generated, err := h.aiService.GenerateChecklist(app.QuicklistGenerateRequest{
		ThreadContent: threadContent.FormattedContent,
		ChannelID:     channelID,
		UserID:        userID,
	})
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to generate checklist", err)
		return
	}

	// Convert AI response to Playbooks format
	checklists := generated.ToChecklists()

	// Build response
	response := QuicklistGenerateResponse{
		Title:      generated.Title,
		Checklists: checklists,
		ThreadInfo: ThreadInfo{
			Truncated:        threadContent.Truncated,
			TruncatedCount:   threadContent.TruncatedCount,
			MessageCount:     threadContent.MessageCount,
			ParticipantCount: threadContent.ParticipantCount,
		},
	}

	ReturnJSON(w, &response, http.StatusOK)
}
