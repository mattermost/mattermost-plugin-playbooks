// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// mockQuicklistConfigService is a mock implementation of config.Service for quicklist tests.
type mockQuicklistConfigService struct {
	quicklistEnabled bool
	config           *config.Configuration
}

func (m *mockQuicklistConfigService) IsQuicklistEnabled() bool {
	return m.quicklistEnabled
}

func (m *mockQuicklistConfigService) GetConfiguration() *config.Configuration {
	if m.config == nil {
		return &config.Configuration{}
	}
	return m.config
}

func (m *mockQuicklistConfigService) UpdateConfiguration(f func(*config.Configuration)) error {
	return nil
}

func (m *mockQuicklistConfigService) RegisterConfigChangeListener(listener func()) string {
	return ""
}

func (m *mockQuicklistConfigService) UnregisterConfigChangeListener(id string) {}

func (m *mockQuicklistConfigService) GetManifest() *model.Manifest {
	return &model.Manifest{}
}

func (m *mockQuicklistConfigService) IsConfiguredForDevelopmentAndTesting() bool {
	return false
}

func (m *mockQuicklistConfigService) IsCloud() bool {
	return false
}

func (m *mockQuicklistConfigService) SupportsGivingFeedback() error {
	return nil
}

func (m *mockQuicklistConfigService) IsIncrementalUpdatesEnabled() bool {
	return false
}

func (m *mockQuicklistConfigService) IsExperimentalFeaturesEnabled() bool {
	return false
}

// mockThreadService is a mock implementation of ThreadService for testing.
type mockThreadService struct {
	fetchResult *app.ThreadContent
	fetchError  error
}

func (m *mockThreadService) FetchAndFormatThread(postID string) (*app.ThreadContent, error) {
	return m.fetchResult, m.fetchError
}

// mockAIService is a mock implementation of AIService for testing.
type mockAIService struct {
	isAvailableError     error
	generateResult       *app.GeneratedChecklist
	generateError        error
	lastGenerateReq      app.QuicklistGenerateRequest
	generateCallCount    int
	isAvailableCallCount int
	refineResult         *app.GeneratedChecklist
	refineError          error
	lastRefineReq        app.QuicklistRefineRequest
	refineCallCount      int
}

func (m *mockAIService) IsAvailable() error {
	m.isAvailableCallCount++
	return m.isAvailableError
}

func (m *mockAIService) GenerateChecklist(req app.QuicklistGenerateRequest) (*app.GeneratedChecklist, error) {
	m.generateCallCount++
	m.lastGenerateReq = req
	return m.generateResult, m.generateError
}

func (m *mockAIService) RefineChecklist(req app.QuicklistRefineRequest) (*app.GeneratedChecklist, error) {
	m.refineCallCount++
	m.lastRefineReq = req
	return m.refineResult, m.refineError
}

func createQuicklistTestHandler(
	mockAPI plugin.API,
	mockThreadSvc *mockThreadService,
	mockAISvc *mockAIService,
	mockConfig config.Service,
) (*mux.Router, *QuicklistHandler) {
	router := mux.NewRouter()
	apiRouter := router.PathPrefix("/api/v0").Subrouter()

	// Create wrapper services for the handler
	threadSvc := app.NewThreadService(mockAPI, mockConfig)
	aiSvc := app.NewAIService(nil, mockConfig)

	handler := &QuicklistHandler{
		ErrorHandler:  &ErrorHandler{},
		api:           mockAPI,
		threadService: threadSvc,
		aiService:     aiSvc,
		config:        mockConfig,
	}

	// Override with mock services using a custom handler setup
	quicklistRouter := apiRouter.PathPrefix("/quicklist").Subrouter()
	quicklistRouter.HandleFunc("/generate", func(w http.ResponseWriter, r *http.Request) {
		// Use a modified generate function that uses mocks
		testGenerate(handler, mockThreadSvc, mockAISvc, w, r)
	}).Methods(http.MethodPost)
	quicklistRouter.HandleFunc("/refine", func(w http.ResponseWriter, r *http.Request) {
		// Use a modified refine function that uses mocks
		testRefine(handler, mockThreadSvc, mockAISvc, w, r)
	}).Methods(http.MethodPost)

	return router, handler
}

// testGenerate is a test-specific version of the generate handler that uses mocks.
func testGenerate(h *QuicklistHandler, mockThreadSvc *mockThreadService, mockAISvc *mockAIService, w http.ResponseWriter, r *http.Request) {
	logger := getLogger(r)
	c := &Context{logger}
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

	// Check if AI service is available (using mock)
	if err := mockAISvc.IsAvailable(); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusServiceUnavailable, "AI service is not available", err)
		return
	}

	// Fetch and format thread (using mock)
	threadContent, err := mockThreadSvc.FetchAndFormatThread(req.PostID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to fetch thread", err)
		return
	}

	// Generate checklist using AI (using mock)
	generated, err := mockAISvc.GenerateChecklist(app.QuicklistGenerateRequest{
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

// testRefine is a test-specific version of the refine handler that uses mocks.
func testRefine(h *QuicklistHandler, mockThreadSvc *mockThreadService, mockAISvc *mockAIService, w http.ResponseWriter, r *http.Request) {
	logger := getLogger(r)
	c := &Context{logger}
	userID := r.Header.Get("Mattermost-User-ID")

	// Check feature flag
	if !h.config.IsQuicklistEnabled() {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "quicklist feature is not enabled", nil)
		return
	}

	// Decode request body
	var req QuicklistRefineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	// Validate required fields
	if req.PostID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "post_id is required", nil)
		return
	}

	if req.Feedback == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "feedback is required", nil)
		return
	}

	if len(req.CurrentChecklists) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "current_checklists is required", nil)
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

	channelID := post.ChannelId

	// Check user has permission to read the channel
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
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "cannot refine quicklist from archived channel", nil)
		return
	}

	// Check if AI service is available (using mock)
	if err := mockAISvc.IsAvailable(); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusServiceUnavailable, "AI service is not available", err)
		return
	}

	// Fetch and format thread (using mock)
	threadContent, err := mockThreadSvc.FetchAndFormatThread(req.PostID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to fetch thread", err)
		return
	}

	// Refine checklist using AI (using mock)
	generated, err := mockAISvc.RefineChecklist(app.QuicklistRefineRequest{
		ThreadContent:     threadContent.FormattedContent,
		ChannelID:         channelID,
		UserID:            userID,
		CurrentChecklists: req.CurrentChecklists,
		Feedback:          req.Feedback,
	})
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "failed to refine checklist", err)
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

func TestQuicklistGenerate_FeatureDisabled(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: false,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: "validpostid123456789012"}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusForbidden, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "quicklist feature is not enabled")
}

func TestQuicklistGenerate_MissingPostID(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: ""}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "post_id is required")
}

func TestQuicklistGenerate_InvalidPostIDFormat(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: "invalid"}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "invalid post_id format")
}

func TestQuicklistGenerate_PostNotFound(t *testing.T) {
	postID := model.NewId() // Generate valid 26-char ID
	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(nil, model.NewAppError("GetPost", "app.post.get.not_found", nil, "", http.StatusNotFound))

	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusNotFound, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "post not found")

	mockAPI.AssertExpectations(t)
}

func TestQuicklistGenerate_NoChannelAccess(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(false)

	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	// Returns 404 instead of 403 to prevent enumeration of private channels/posts
	assert.Equal(t, http.StatusNotFound, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "post not found")

	mockAPI.AssertExpectations(t)
}

func TestQuicklistGenerate_ArchivedChannel(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 1234567890, // Archived
	}, nil)

	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "cannot generate quicklist from archived channel")

	mockAPI.AssertExpectations(t)
}

func TestQuicklistGenerate_AIServiceUnavailable(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 0, // Not archived
	}, nil)

	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{
		isAvailableError: model.NewAppError("IsAvailable", "ai.unavailable", nil, "AI service down", http.StatusServiceUnavailable),
	}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "AI service is not available")

	mockAPI.AssertExpectations(t)
}

func TestQuicklistGenerate_Success(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 0,
	}, nil)

	mockThreadSvc := &mockThreadService{
		fetchResult: &app.ThreadContent{
			FormattedContent: "Formatted thread content",
			MessageCount:     10,
			ParticipantCount: 3,
			Truncated:        true,
			TruncatedCount:   5,
		},
	}
	mockAISvc := &mockAIService{
		generateResult: &app.GeneratedChecklist{
			Title: "Q4 Launch Plan",
			Sections: []app.GeneratedSection{
				{
					Title: "Design Phase",
					Items: []app.GeneratedItem{
						{Title: "Create mockups", Description: "High fidelity designs", DueDate: "2024-01-15"},
						{Title: "Review with team", Description: "Get feedback", DueDate: ""},
					},
				},
				{
					Title: "Development",
					Items: []app.GeneratedItem{
						{Title: "Implement API", Description: "Backend work", DueDate: "2024-01-20"},
					},
				},
			},
		},
	}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusOK, recorder.Code)

	var response QuicklistGenerateResponse
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify response structure
	assert.Equal(t, "Q4 Launch Plan", response.Title)
	assert.Len(t, response.Checklists, 2)
	assert.Equal(t, "Design Phase", response.Checklists[0].Title)
	assert.Len(t, response.Checklists[0].Items, 2)
	assert.Equal(t, "Create mockups", response.Checklists[0].Items[0].Title)
	assert.Equal(t, "Development", response.Checklists[1].Title)
	assert.Len(t, response.Checklists[1].Items, 1)

	// Verify thread_info
	assert.True(t, response.ThreadInfo.Truncated)
	assert.Equal(t, 5, response.ThreadInfo.TruncatedCount)
	assert.Equal(t, 10, response.ThreadInfo.MessageCount)
	assert.Equal(t, 3, response.ThreadInfo.ParticipantCount)

	// Verify AI service was called with correct parameters
	assert.Equal(t, 1, mockAISvc.generateCallCount)
	assert.Equal(t, "Formatted thread content", mockAISvc.lastGenerateReq.ThreadContent)
	assert.Equal(t, channelID, mockAISvc.lastGenerateReq.ChannelID)
	assert.Equal(t, userID, mockAISvc.lastGenerateReq.UserID)

	mockAPI.AssertExpectations(t)
}

func TestQuicklistGenerate_ResponseIncludesAllThreadInfoFields(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 0,
	}, nil)

	mockThreadSvc := &mockThreadService{
		fetchResult: &app.ThreadContent{
			FormattedContent: "Content",
			MessageCount:     50,
			ParticipantCount: 12,
			Truncated:        false,
			TruncatedCount:   0,
		},
	}
	mockAISvc := &mockAIService{
		generateResult: &app.GeneratedChecklist{
			Title:    "Test",
			Sections: []app.GeneratedSection{},
		},
	}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistGenerateRequest{PostID: postID}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/generate", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusOK, recorder.Code)

	// Parse as raw JSON to verify all fields are present
	var rawResponse map[string]any
	err := json.Unmarshal(recorder.Body.Bytes(), &rawResponse)
	require.NoError(t, err)

	threadInfo, ok := rawResponse["thread_info"].(map[string]any)
	require.True(t, ok, "thread_info should be present in response")

	// Verify all thread_info fields are present
	assert.Contains(t, threadInfo, "truncated")
	assert.Contains(t, threadInfo, "truncated_count")
	assert.Contains(t, threadInfo, "message_count")
	assert.Contains(t, threadInfo, "participant_count")

	// Verify values
	assert.Equal(t, false, threadInfo["truncated"])
	assert.Equal(t, float64(0), threadInfo["truncated_count"])
	assert.Equal(t, float64(50), threadInfo["message_count"])
	assert.Equal(t, float64(12), threadInfo["participant_count"])

	mockAPI.AssertExpectations(t)
}

// --- Refine endpoint tests ---

func TestQuicklistRefine_FeatureDisabled(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: false,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            model.NewId(),
		CurrentChecklists: []app.Checklist{{ID: "test", Title: "Test", Items: []app.ChecklistItem{}}},
		Feedback:          "Add a task for testing",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusForbidden, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "quicklist feature is not enabled")
}

func TestQuicklistRefine_MissingPostID(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            "",
		CurrentChecklists: []app.Checklist{{ID: "test", Title: "Test", Items: []app.ChecklistItem{}}},
		Feedback:          "Add a task",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "post_id is required")
}

func TestQuicklistRefine_MissingFeedback(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            model.NewId(),
		CurrentChecklists: []app.Checklist{{ID: "test", Title: "Test", Items: []app.ChecklistItem{}}},
		Feedback:          "",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "feedback is required")
}

func TestQuicklistRefine_MissingCurrentChecklists(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            model.NewId(),
		CurrentChecklists: []app.Checklist{},
		Feedback:          "Add a task",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "current_checklists is required")
}

func TestQuicklistRefine_InvalidPostIDFormat(t *testing.T) {
	mockAPI := &plugintest.API{}
	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            "invalid",
		CurrentChecklists: []app.Checklist{{ID: "test", Title: "Test", Items: []app.ChecklistItem{}}},
		Feedback:          "Add a task",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", "user123")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "invalid post_id format")
}

func TestQuicklistRefine_Success(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 0,
	}, nil)

	mockThreadSvc := &mockThreadService{
		fetchResult: &app.ThreadContent{
			FormattedContent: "Formatted thread content",
			MessageCount:     10,
			ParticipantCount: 3,
			Truncated:        false,
			TruncatedCount:   0,
		},
	}

	// Existing checklist to refine
	existingChecklist := []app.Checklist{
		{
			ID:    "checklist1",
			Title: "Design Phase",
			Items: []app.ChecklistItem{
				{ID: "item1", Title: "Create mockups", Description: "High fidelity designs", DueDate: 1705276800000},
			},
			ItemsOrder: []string{"item1"},
		},
	}

	mockAISvc := &mockAIService{
		refineResult: &app.GeneratedChecklist{
			Title: "Q4 Launch Plan",
			Sections: []app.GeneratedSection{
				{
					Title: "Design Phase",
					Items: []app.GeneratedItem{
						{Title: "Create mockups", Description: "High fidelity designs", DueDate: "2024-01-15"},
						{Title: "Review with team", Description: "Get feedback from stakeholders", DueDate: ""},
					},
				},
				{
					Title: "Testing",
					Items: []app.GeneratedItem{
						{Title: "QA testing", Description: "Test all features", DueDate: "2024-01-20"},
					},
				},
			},
		},
	}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            postID,
		CurrentChecklists: existingChecklist,
		Feedback:          "Add a section for QA testing",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusOK, recorder.Code)

	var response QuicklistGenerateResponse
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify response structure
	assert.Equal(t, "Q4 Launch Plan", response.Title)
	assert.Len(t, response.Checklists, 2)
	assert.Equal(t, "Design Phase", response.Checklists[0].Title)
	assert.Len(t, response.Checklists[0].Items, 2)
	assert.Equal(t, "Testing", response.Checklists[1].Title)
	assert.Len(t, response.Checklists[1].Items, 1)
	assert.Equal(t, "QA testing", response.Checklists[1].Items[0].Title)

	// Verify thread_info
	assert.False(t, response.ThreadInfo.Truncated)
	assert.Equal(t, 0, response.ThreadInfo.TruncatedCount)
	assert.Equal(t, 10, response.ThreadInfo.MessageCount)
	assert.Equal(t, 3, response.ThreadInfo.ParticipantCount)

	// Verify AI service was called with correct parameters
	assert.Equal(t, 1, mockAISvc.refineCallCount)
	assert.Equal(t, "Formatted thread content", mockAISvc.lastRefineReq.ThreadContent)
	assert.Equal(t, channelID, mockAISvc.lastRefineReq.ChannelID)
	assert.Equal(t, userID, mockAISvc.lastRefineReq.UserID)
	assert.Equal(t, "Add a section for QA testing", mockAISvc.lastRefineReq.Feedback)
	assert.Len(t, mockAISvc.lastRefineReq.CurrentChecklists, 1)
	assert.Equal(t, "Design Phase", mockAISvc.lastRefineReq.CurrentChecklists[0].Title)

	mockAPI.AssertExpectations(t)
}

func TestQuicklistRefine_AIServiceUnavailable(t *testing.T) {
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	mockAPI := &plugintest.API{}
	mockAPI.On("GetPost", postID).Return(&model.Post{
		Id:        postID,
		ChannelId: channelID,
		Message:   "Test post",
	}, nil)
	mockAPI.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)
	mockAPI.On("GetChannel", channelID).Return(&model.Channel{
		Id:       channelID,
		DeleteAt: 0,
	}, nil)

	mockThreadSvc := &mockThreadService{}
	mockAISvc := &mockAIService{
		isAvailableError: model.NewAppError("IsAvailable", "ai.unavailable", nil, "AI service down", http.StatusServiceUnavailable),
	}
	mockConfig := &mockQuicklistConfigService{
		quicklistEnabled: true,
	}

	router, _ := createQuicklistTestHandler(mockAPI, mockThreadSvc, mockAISvc, mockConfig)

	reqBody := QuicklistRefineRequest{
		PostID:            postID,
		CurrentChecklists: []app.Checklist{{ID: "test", Title: "Test", Items: []app.ChecklistItem{}}},
		Feedback:          "Add a task",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v0/quicklist/refine", bytes.NewBuffer(body))
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)

	var response struct {
		Error string `json:"error"`
	}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response.Error, "AI service is not available")

	mockAPI.AssertExpectations(t)
}
