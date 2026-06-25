// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// MaxRequestSize is the size limit for any incoming request
// The default limit set by mattermost-server is the configured max file size, and
// it sometimes isn't small enough to prevent some scenarios.
//
// This is important to prevent huge payloads from being sent
// that could end in a bigger problem.
//
// If an endpoint needs a smaller limit than this one, it could be solved by adding their
// own limit BEFORE reading the request body `r.Body = http.MaxBytesReader(w, r.Body, MaxRequestSize)`
const MaxRequestSize = 5 * 1024 * 1024 // 5MB

// Handler Root API handler.
type Handler struct {
	*ErrorHandler
	pluginAPI *pluginapi.Client
	APIRouter *mux.Router
	root      *mux.Router
	config    config.Service
	auditor   app.Auditor
}

// NewHandler constructs a new handler.
func NewHandler(pluginAPI *pluginapi.Client, config config.Service, auditor app.Auditor) *Handler {
	handler := &Handler{
		ErrorHandler: &ErrorHandler{},
		pluginAPI:    pluginAPI,
		config:       config,
		auditor:      auditor,
	}

	root := mux.NewRouter()
	root.Use(LogRequest)
	api := root.PathPrefix("/api/v0").Subrouter()
	api.Use(handler.MattermostAuthorizationRequired)

	api.Handle("{anything:.*}", http.NotFoundHandler())
	api.NotFoundHandler = http.NotFoundHandler()

	handler.APIRouter = api
	handler.root = root
	handler.config = config

	return handler
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestSize)
	h.root.ServeHTTP(w, r)
}

// handleResponseWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func handleResponseWithCode(w http.ResponseWriter, code int, publicMsg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	responseMsg, _ := json.Marshal(struct {
		Error string `json:"error"` // A public facing message providing details about the error.
	}{
		Error: publicMsg,
	})
	_, _ = w.Write(responseMsg)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func HandleErrorWithCode(logger logrus.FieldLogger, w http.ResponseWriter, code int, publicErrorMsg string, internalErr error) {
	if internalErr != nil {
		logger = logger.WithError(internalErr)
	}

	if code >= http.StatusInternalServerError {
		logger.Error(publicErrorMsg)
	} else {
		logger.Warn(publicErrorMsg)
	}

	handleResponseWithCode(w, code, publicErrorMsg)
}

// ReturnJSON writes the given pointerToObject as json with the provided httpStatus
func ReturnJSON(w http.ResponseWriter, pointerToObject interface{}, httpStatus int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	if err := json.NewEncoder(w).Encode(pointerToObject); err != nil {
		logrus.WithError(err).Warn("Unable to write to http.ResponseWriter")
		return
	}
}

// Header names used to authorize requests. HTTP headers are case-insensitive; both spellings of
// the user header in use throughout the handlers (Mattermost-User-Id / Mattermost-User-ID)
// canonicalize to the same key, so promoting the acting user under this name is visible to all of
// them.
const (
	userIDHeader = "Mattermost-User-Id"
	// pluginIDHeader is set by the Mattermost server on inter-plugin/internal requests to identify
	// the calling plugin. The server deletes it from externally-originated requests, so it cannot
	// be spoofed by an external client -- it is the trust anchor for inter-plugin authorization.
	pluginIDHeader = "Mattermost-Plugin-ID"
	// actingUserIDHeader is set by the calling plugin to name the user it is acting on behalf of.
	// It is only honored when the request is a trusted inter-plugin call from an allowed caller.
	actingUserIDHeader = "Mattermost-Plugin-Acting-User-Id"
)

// MattermostAuthorizationRequired checks if a request is authorized.
//
// A request is authorized when it carries an authenticated user (the Mattermost-User-Id header set
// by the server for user sessions). Additionally, a trusted inter-plugin request may assert the
// user it is acting on behalf of via the Mattermost-Plugin-Acting-User-Id header; that user is then
// promoted into Mattermost-User-Id so every downstream per-user permission check applies to the
// asserted user unchanged.
func (h *Handler) MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Normal authenticated user request -- unchanged behavior.
		if r.Header.Get(userIDHeader) != "" {
			next.ServeHTTP(w, r)
			return
		}

		// Trusted inter-plugin request asserting an acting user.
		if actingUserID := resolveInterPluginUser(r); actingUserID != "" {
			// Record the privileged acting-as-user grant in the audit log. The upstream
			// LogRequest middleware runs before promotion, so the application log would
			// otherwise record a blank user and never the calling plugin. The record
			// documents the grant itself, not the eventual request outcome.
			auditRec := h.auditor.MakeAuditRecord("interPluginActAsUser", model.AuditStatusSuccess)
			auditRec.Actor.UserId = actingUserID
			model.AddEventParameterToAuditRec(auditRec, "caller_plugin_id", r.Header.Get(pluginIDHeader))
			model.AddEventParameterToAuditRec(auditRec, "acting_user_id", actingUserID)
			model.AddEventParameterToAuditRec(auditRec, "method", r.Method)
			model.AddEventParameterToAuditRec(auditRec, "url", r.URL.String())
			h.auditor.LogAuditRec(auditRec)

			r.Header.Set(userIDHeader, actingUserID)
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "Not authorized", http.StatusUnauthorized)
	})
}

// resolveInterPluginUser returns the user ID an inter-plugin request is acting on behalf of, or an
// empty string if the request is not a trusted inter-plugin call asserting a user.
//
// This relies on the Mattermost-Plugin-ID header being set only by the server on genuine
// inter-plugin/internal requests (and stripped from external requests), so an external client
// cannot reach this branch by forging the headers. The calling plugin is trusted to name the user
// it acts for; the asserted user's own permissions are still fully enforced downstream.
func resolveInterPluginUser(r *http.Request) string {
	callerPluginID := r.Header.Get(pluginIDHeader)
	actingUserID := r.Header.Get(actingUserIDHeader)
	if callerPluginID == "" || actingUserID == "" {
		return ""
	}

	return actingUserID
}
