// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/ai"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// AIHandler handles AI-related API requests
type AIHandler struct {
	*ErrorHandler
	aiService   *ai.Service
	pluginAPI   *pluginapi.Client
	config      config.Service
	permissions *app.PermissionsService
}

// NewAIHandler creates a new AI handler
func NewAIHandler(
	router *mux.Router,
	aiService *ai.Service,
	pluginAPI *pluginapi.Client,
	configService config.Service,
	permissions *app.PermissionsService,
) *AIHandler {
	handler := &AIHandler{
		ErrorHandler: &ErrorHandler{},
		aiService:    aiService,
		pluginAPI:    pluginAPI,
		config:       configService,
		permissions:  permissions,
	}

	aiRouter := router.PathPrefix("/ai").Subrouter()
	aiRouter.HandleFunc("/playbook/completion", withContext(handler.playbookCompletion)).Methods(http.MethodPost)

	return handler
}

// playbookCompletion handles AI completion requests for playbook creation
func (h *AIHandler) playbookCompletion(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Decode the request
	var request ai.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if len(request.Posts) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Posts cannot be empty", nil)
		return
	}

	// TODO: Add permission check to verify user can create playbooks
	// For now, we assume authenticated users can use this feature

	// Get completion from AI service
	response, err := h.aiService.GetCompletion(request.Posts)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "Failed to get AI completion", err)
		return
	}

	// Return the response
	completionResponse := ai.CompletionResponse{
		Message: response,
	}

	ReturnJSON(w, &completionResponse, http.StatusOK)
}
