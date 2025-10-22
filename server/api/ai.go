// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/base64"
	"encoding/json"
	"io"
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

	const maxUploadSize = 10 << 20 // 10 MB per file
	const maxFiles = 5

	// Check if this is a multipart form (with files) or JSON
	contentType := r.Header.Get("Content-Type")
	var request ai.CompletionRequest

	if len(contentType) > 19 && contentType[:19] == "multipart/form-data" {
		// Parse multipart form with files
		if err := r.ParseMultipartForm(maxUploadSize * maxFiles); err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Failed to parse multipart form", err)
			return
		}

		// Get the posts JSON from form data
		postsJSON := r.FormValue("posts")
		if postsJSON == "" {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Missing posts data", nil)
			return
		}

		if err := json.Unmarshal([]byte(postsJSON), &request.Posts); err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Invalid posts JSON", err)
			return
		}

		// Process uploaded files
		if r.MultipartForm != nil && r.MultipartForm.File != nil {
			files := r.MultipartForm.File["files"]
			if len(files) > maxFiles {
				h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Too many files (max 5)", nil)
				return
			}

			// Convert files to base64 and attach to the last post
			if len(request.Posts) > 0 && len(files) > 0 {
				lastPostIdx := len(request.Posts) - 1
				request.Posts[lastPostIdx].Files = make([]ai.File, 0, len(files))

				for i, fileHeader := range files {
					if fileHeader.Size > maxUploadSize {
						h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "File too large (max 10MB)", nil)
						return
					}

					file, err := fileHeader.Open()
					if err != nil {
						h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "Failed to open uploaded file", err)
						return
					}
					defer file.Close()

					// Read file contents
					fileData, err := io.ReadAll(file)
					if err != nil {
						h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "Failed to read file", err)
						return
					}

					// Encode to base64
					base64Data := base64.StdEncoding.EncodeToString(fileData)

					// Detect mime type from header
					mimeType := fileHeader.Header.Get("Content-Type")
					if mimeType == "" {
						mimeType = "application/octet-stream"
					}

					// Add to post
					request.Posts[lastPostIdx].Files = append(request.Posts[lastPostIdx].Files, ai.File{
						ID:       fileHeader.Filename, // Use filename as ID for now
						Name:     fileHeader.Filename,
						MimeType: mimeType,
						Data:     base64Data,
					})

					c.logger.WithField("file", fileHeader.Filename).WithField("index", i).Debug("Processed uploaded file")
				}
			}
		}
	} else {
		// Standard JSON request (no files)
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Invalid request body", err)
			return
		}
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
