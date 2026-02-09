// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// QuicklistGenerateRequest is the request body for the generate endpoint.
type QuicklistGenerateRequest struct {
	PostID string `json:"post_id"`
}

// QuicklistRefineRequest is the request body for the refine endpoint.
type QuicklistRefineRequest struct {
	PostID            string          `json:"post_id"`
	CurrentChecklists []app.Checklist `json:"current_checklists"`
	Feedback          string          `json:"feedback"`
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
	quicklistRouter.HandleFunc("/refine", withContext(handler.refine)).Methods(http.MethodPost)

	return handler
}

func (h *QuicklistHandler) validateQuicklistPostID(c *Context, w http.ResponseWriter, userID, postID string) (logrus.FieldLogger, bool) {
	logger := c.logger.WithField("user_id", userID).WithField("post_id", postID)

	// Validate required fields
	if postID == "" {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "post_id is required", nil)
		return logger, false
	}

	// Validate post ID format before making API calls
	if !model.IsValidId(postID) {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "invalid post_id format", nil)
		return logger, false
	}

	return logger, true
}

func (h *QuicklistHandler) validateQuicklistAccess(logger logrus.FieldLogger, w http.ResponseWriter, userID, postID, archivedErr string) (logrus.FieldLogger, string, bool) {
	// Check if post exists
	post, appErr := h.api.GetPost(postID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			h.HandleErrorWithCode(w, logger, http.StatusNotFound, "post not found", appErr)
			return logger, "", false
		}
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "failed to get post", appErr)
		return logger, "", false
	}

	// Use post's channel ID
	channelID := post.ChannelId
	logger = logger.WithField("channel_id", channelID)

	// Check user has permission to read the channel
	// Return 404 instead of 403 to prevent enumeration of private channels/posts
	if !h.api.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		logger.Warn("user lacks permission to channel")
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "post not found", nil)
		return logger, "", false
	}

	// Check if channel is archived
	channel, appErr := h.api.GetChannel(channelID)
	if appErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "failed to get channel", appErr)
		return logger, "", false
	}
	if channel.DeleteAt > 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, archivedErr, nil)
		return logger, "", false
	}

	return logger, channelID, true
}

// generate handles POST /api/v0/quicklist/generate
func (h *QuicklistHandler) generate(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	// Create logger with request context for all logging in this handler
	logger := c.logger.WithField("user_id", userID)

	// Check feature flag
	if !h.config.IsQuicklistEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "quicklist feature is not enabled", nil)
		return
	}

	// Check if AI service is available
	if err := h.aiService.IsAvailable(); err != nil {
		logger.WithError(err).Warn("AI service unavailable during quicklist generation")
		h.HandleErrorWithCode(w, logger, http.StatusServiceUnavailable, "AI service is not available", err)
		return
	}

	// Decode request body
	var req QuicklistGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	logger, ok := h.validateQuicklistPostID(c, w, userID, req.PostID)
	if !ok {
		return
	}

	logger, channelID, ok := h.validateQuicklistAccess(
		logger,
		w,
		userID,
		req.PostID,
		"cannot generate quicklist from archived channel",
	)
	if !ok {
		return
	}

	// Fetch and format thread
	threadContent, err := h.threadService.FetchAndFormatThread(req.PostID)
	if err != nil {
		h.HandleErrorWithCode(w, logger.WithField("operation", "fetch_thread"), http.StatusInternalServerError, "failed to fetch thread", err)
		return
	}

	logger.WithFields(map[string]any{
		"message_count":     threadContent.MessageCount,
		"participant_count": threadContent.ParticipantCount,
		"truncated":         threadContent.Truncated,
	}).Debug("thread fetched for quicklist generation")

	// Generate checklist using AI
	generated, err := h.aiService.GenerateChecklist(app.QuicklistGenerateRequest{
		ThreadContent: threadContent.FormattedContent,
		ChannelID:     channelID,
		UserID:        userID,
	})
	if err != nil {
		h.HandleErrorWithCode(w, logger.WithField("operation", "ai_generate"), http.StatusInternalServerError, "failed to generate checklist", err)
		return
	}

	logger.WithFields(map[string]any{
		"title":         generated.Title,
		"section_count": len(generated.Sections),
		"operation":     "generate_complete",
	}).Info("quicklist generated successfully")

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

// refine handles POST /api/v0/quicklist/refine
func (h *QuicklistHandler) refine(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	// Create logger with request context for all logging in this handler
	logger := c.logger.WithField("user_id", userID)

	// Check feature flag
	if !h.config.IsQuicklistEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "quicklist feature is not enabled", nil)
		return
	}

	// Check if AI service is available
	if err := h.aiService.IsAvailable(); err != nil {
		logger.WithError(err).Warn("AI service unavailable during quicklist refinement")
		h.HandleErrorWithCode(w, logger, http.StatusServiceUnavailable, "AI service is not available", err)
		return
	}

	// Decode request body
	var req QuicklistRefineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	logger, ok := h.validateQuicklistPostID(c, w, userID, req.PostID)
	if !ok {
		return
	}

	// Validate required fields
	if req.Feedback == "" {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "feedback is required", nil)
		return
	}

	if len(req.CurrentChecklists) == 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "current_checklists is required", nil)
		return
	}

	logger, channelID, ok := h.validateQuicklistAccess(
		logger,
		w,
		userID,
		req.PostID,
		"cannot refine quicklist from archived channel",
	)
	if !ok {
		return
	}

	// Fetch and format thread (for context)
	threadContent, err := h.threadService.FetchAndFormatThread(req.PostID)
	if err != nil {
		h.HandleErrorWithCode(w, logger.WithField("operation", "fetch_thread"), http.StatusInternalServerError, "failed to fetch thread", err)
		return
	}

	logger.WithFields(map[string]any{
		"feedback_length": len(req.Feedback),
		"checklist_count": len(req.CurrentChecklists),
		"operation":       "refine_start",
	}).Debug("starting quicklist refinement")

	// Refine checklist using AI
	generated, err := h.aiService.RefineChecklist(app.QuicklistRefineRequest{
		ThreadContent:     threadContent.FormattedContent,
		ChannelID:         channelID,
		UserID:            userID,
		CurrentChecklists: req.CurrentChecklists,
		Feedback:          req.Feedback,
	})
	if err != nil {
		h.HandleErrorWithCode(w, logger.WithField("operation", "ai_refine"), http.StatusInternalServerError, "failed to refine checklist", err)
		return
	}

	logger.WithFields(map[string]any{
		"title":         generated.Title,
		"section_count": len(generated.Sections),
		"operation":     "refine_complete",
	}).Info("quicklist refined successfully")

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
