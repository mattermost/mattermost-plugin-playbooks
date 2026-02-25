// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// IncomingWebhookHandler handles incoming webhook requests from external systems.
type IncomingWebhookHandler struct {
	*ErrorHandler
	webhookStore       app.IncomingWebhookStore
	playbookRunService app.PlaybookRunService
	permissions        *app.PermissionsService
	propertyService    app.PropertyServiceReader
}

// IncomingWebhookRequest is the request body for incoming webhook calls.
type IncomingWebhookRequest struct {
	Action          string          `json:"action"`
	PlaybookRunID   string          `json:"playbook_run_id"`
	PropertyFieldID string          `json:"property_field_id"`
	PropertyName    string          `json:"property_name"`
	Value           json.RawMessage `json:"value"`
}

// NewIncomingWebhookHandler creates a new IncomingWebhookHandler and registers
// the route on the root router (bypassing MattermostAuthorizationRequired).
func NewIncomingWebhookHandler(
	apiHandler *Handler,
	webhookStore app.IncomingWebhookStore,
	playbookRunService app.PlaybookRunService,
	permissions *app.PermissionsService,
	propertyService app.PropertyServiceReader,
) *IncomingWebhookHandler {
	handler := &IncomingWebhookHandler{
		ErrorHandler:       &ErrorHandler{},
		webhookStore:       webhookStore,
		playbookRunService: playbookRunService,
		permissions:        permissions,
		propertyService:    propertyService,
	}

	apiHandler.root.HandleFunc(
		"/hooks/{id:[A-Za-z0-9]+}",
		withContext(handler.handleIncomingWebhook),
	).Methods(http.MethodPost)

	return handler
}

func (h *IncomingWebhookHandler) handleIncomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	webhookID := vars["id"]

	// Look up the webhook.
	webhook, err := h.webhookStore.Get(webhookID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "webhook not found", err)
		return
	}

	// Parse request body.
	var req IncomingWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to parse request body", err)
		return
	}

	// Validate action.
	if req.Action != "update_property" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unsupported action", errors.Errorf("unknown action: %s", req.Action))
		return
	}

	// Resolve target run.
	runID, err := h.resolveRunID(c, w, webhook, req)
	if err != nil {
		return // error already written to response
	}

	// Validate creator permissions.
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(webhook.CreatorID, runID)) {
		return
	}

	// Resolve property field ID.
	fieldID, err := h.resolvePropertyFieldID(c, w, runID, req)
	if err != nil {
		return // error already written to response
	}

	// Execute the property update.
	if _, err := h.playbookRunService.SetRunPropertyValue(webhook.CreatorID, runID, fieldID, req.Value); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]bool{"ok": true}, http.StatusOK)
}

// resolveRunID determines the target playbook run ID based on the webhook scope.
// For run-scoped webhooks, the webhook's own PlaybookRunID is used.
// For playbook-scoped webhooks, the request's PlaybookRunID is used after
// validating that the run belongs to the webhook's playbook.
func (h *IncomingWebhookHandler) resolveRunID(c *Context, w http.ResponseWriter, webhook app.IncomingWebhook, req IncomingWebhookRequest) (string, error) {
	// Run-scoped: use the webhook's run ID, ignore request field.
	if webhook.PlaybookRunID != "" {
		return webhook.PlaybookRunID, nil
	}

	// Playbook-scoped: require playbook_run_id in the request.
	if req.PlaybookRunID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest,
			"playbook_run_id is required for playbook-scoped webhooks",
			errors.New("missing playbook_run_id"))
		return "", errors.New("missing playbook_run_id")
	}

	// Validate the run belongs to the webhook's playbook.
	run, err := h.playbookRunService.GetPlaybookRun(req.PlaybookRunID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest,
			"playbook run not found", err)
		return "", err
	}

	if run.PlaybookID != webhook.PlaybookID {
		err := errors.Errorf("run %s belongs to playbook %s, not %s", req.PlaybookRunID, run.PlaybookID, webhook.PlaybookID)
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden,
			"playbook run does not belong to this webhook's playbook", err)
		return "", err
	}

	return req.PlaybookRunID, nil
}

// resolvePropertyFieldID resolves the property field ID from the request.
// If PropertyFieldID is set, it's used directly. Otherwise, PropertyName is
// looked up case-insensitively among the run's property fields.
func (h *IncomingWebhookHandler) resolvePropertyFieldID(c *Context, w http.ResponseWriter, runID string, req IncomingWebhookRequest) (string, error) {
	if req.PropertyFieldID != "" {
		return req.PropertyFieldID, nil
	}

	if req.PropertyName == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest,
			"either property_field_id or property_name must be provided",
			errors.New("missing property identifier"))
		return "", errors.New("missing property identifier")
	}

	fields, err := h.propertyService.GetRunPropertyFields(runID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return "", err
	}

	for _, field := range fields {
		if strings.EqualFold(field.Name, req.PropertyName) {
			return field.ID, nil
		}
	}

	err = errors.Errorf("no property field named %q found for run %s", req.PropertyName, runID)
	h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "property field not found", err)
	return "", err
}
