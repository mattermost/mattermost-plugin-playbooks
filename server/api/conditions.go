// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// NewConditionHandler creates the condition API handler and sets up routes
func NewConditionHandler(router *mux.Router, conditionService app.ConditionService, playbookService app.PlaybookService, playbookRunService app.PlaybookRunService, propertyService app.PropertyService, permissions *app.PermissionsService, pluginAPI *pluginapi.Client) *ConditionHandler {
	handler := &ConditionHandler{
		ErrorHandler:       &ErrorHandler{},
		conditionService:   conditionService,
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		propertyService:    propertyService,
		permissions:        permissions,
		pluginAPI:          pluginAPI,
	}

	// Playbook conditions: /playbooks/{id}/conditions
	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookConditionsRouter := playbookRouter.PathPrefix("/conditions").Subrouter()
	playbookConditionsRouter.HandleFunc("", withContext(handler.getPlaybookConditions)).Methods(http.MethodGet)
	playbookConditionsRouter.HandleFunc("", withContext(handler.createPlaybookCondition)).Methods(http.MethodPost)

	playbookConditionRouter := playbookConditionsRouter.PathPrefix("/{conditionID:[A-Za-z0-9]+}").Subrouter()
	playbookConditionRouter.HandleFunc("", withContext(handler.getPlaybookCondition)).Methods(http.MethodGet)
	playbookConditionRouter.HandleFunc("", withContext(handler.updatePlaybookCondition)).Methods(http.MethodPut)
	playbookConditionRouter.HandleFunc("", withContext(handler.deletePlaybookCondition)).Methods(http.MethodDelete)

	// Run conditions: /runs/{id}/conditions (read-only)
	runsRouter := router.PathPrefix("/runs").Subrouter()
	runRouter := runsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	runConditionsRouter := runRouter.PathPrefix("/conditions").Subrouter()
	runConditionsRouter.HandleFunc("", withContext(handler.getRunConditions)).Methods(http.MethodGet)

	runConditionRouter := runConditionsRouter.PathPrefix("/{conditionID:[A-Za-z0-9]+}").Subrouter()
	runConditionRouter.HandleFunc("", withContext(handler.getRunCondition)).Methods(http.MethodGet)

	return handler
}

// ConditionHandler handles condition-related API endpoints
type ConditionHandler struct {
	*ErrorHandler
	conditionService   app.ConditionService
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	propertyService    app.PropertyService
	permissions        *app.PermissionsService
	pluginAPI          *pluginapi.Client
}

// READ operations

// getPlaybookConditions handles GET /api/v0/playbooks/{id}/conditions
func (h *ConditionHandler) getPlaybookConditions(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	options := app.ConditionFilterOptions{
		PlaybookID: playbookID,
	}

	// Parse pagination parameters
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page >= 0 {
			options.Page = page
		}
	}

	if perPageStr := r.URL.Query().Get("per_page"); perPageStr != "" {
		if perPage, err := strconv.Atoi(perPageStr); err == nil && perPage > 0 {
			if perPage > 200 {
				perPage = 200 // Maximum limit
			}
			options.PerPage = perPage
		}
	}

	conditions, err := h.conditionService.GetConditions(userID, playbookID, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, conditions, http.StatusOK)
}

// getPlaybookCondition handles GET /api/v0/playbooks/{id}/conditions/{conditionID}
func (h *ConditionHandler) getPlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]
	conditionID := vars["conditionID"]

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	condition, err := h.conditionService.Get(userID, playbookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this playbook
	if condition.PlaybookID != playbookID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	ReturnJSON(w, condition, http.StatusOK)
}

// getRunConditions handles GET /api/v0/runs/{id}/conditions
func (h *ConditionHandler) getRunConditions(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	runID := vars["id"]

	// Permission check for run view
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, runID)) {
		return
	}

	// Get the run to find the playbookID
	run, err := h.playbookRunService.GetPlaybookRun(runID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	options := app.ConditionFilterOptions{
		RunID: runID,
	}

	// Parse pagination parameters
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page >= 0 {
			options.Page = page
		}
	}

	if perPageStr := r.URL.Query().Get("per_page"); perPageStr != "" {
		if perPage, err := strconv.Atoi(perPageStr); err == nil && perPage > 0 {
			if perPage > 200 {
				perPage = 200 // Maximum limit
			}
			options.PerPage = perPage
		}
	}

	conditions, err := h.conditionService.GetConditions(userID, run.PlaybookID, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, conditions, http.StatusOK)
}

// getRunCondition handles GET /api/v0/runs/{id}/conditions/{conditionID}
func (h *ConditionHandler) getRunCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	runID := vars["id"]
	conditionID := vars["conditionID"]

	// Permission check for run view
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, runID)) {
		return
	}

	// Get the run to find the playbookID
	run, err := h.playbookRunService.GetPlaybookRun(runID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	condition, err := h.conditionService.Get(userID, run.PlaybookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this run
	if condition.RunID != runID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	ReturnJSON(w, condition, http.StatusOK)
}

// WRITE operations (playbook conditions only - run conditions are read-only)

// createPlaybookCondition handles POST /api/v0/playbooks/{id}/conditions
func (h *ConditionHandler) createPlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageProperties(userID, playbook)) {
		return
	}

	var condition app.Condition
	if err := json.NewDecoder(r.Body).Decode(&condition); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode condition", err)
		return
	}

	// Set playbook ID from URL
	condition.PlaybookID = playbookID

	createdCondition, err := h.conditionService.Create(userID, condition)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s/conditions/%s", playbookID, createdCondition.ID))
	ReturnJSON(w, createdCondition, http.StatusCreated)
}

// updatePlaybookCondition handles PUT /api/v0/playbooks/{id}/conditions/{conditionID}
func (h *ConditionHandler) updatePlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]
	conditionID := vars["conditionID"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageProperties(userID, playbook)) {
		return
	}

	// Get existing condition
	existing, err := h.conditionService.Get(userID, playbookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this playbook
	if existing.PlaybookID != playbookID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	var condition app.Condition
	if err := json.NewDecoder(r.Body).Decode(&condition); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode condition", err)
		return
	}

	// Set condition metadata from URL
	condition.ID = conditionID
	condition.PlaybookID = playbookID

	updatedCondition, err := h.conditionService.Update(userID, condition)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, updatedCondition, http.StatusOK)
}

// deletePlaybookCondition handles DELETE /api/v0/playbooks/{id}/conditions/{conditionID}
func (h *ConditionHandler) deletePlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]
	conditionID := vars["conditionID"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageProperties(userID, playbook)) {
		return
	}

	// Get existing condition
	existing, err := h.conditionService.Get(userID, playbookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this playbook
	if existing.PlaybookID != playbookID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	// Check if this is a run condition (read-only)
	if existing.RunID != "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "run conditions cannot be deleted", nil)
		return
	}

	if err := h.conditionService.Delete(userID, playbookID, conditionID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
