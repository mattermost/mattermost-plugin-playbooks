// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
)

type taskActivityCertificationStore interface {
	GetTaskActivityCertification(context.Context) (sqlstore.TaskActivityCertification, error)
	ActivateTaskActivityCertification(context.Context, int64) (sqlstore.TaskActivityCertification, error)
	DisableTaskActivityCertification(context.Context) (sqlstore.TaskActivityCertification, error)
}

func NewTaskActivityCertificationHandler(router *mux.Router, isSystemAdmin func(string) bool, store taskActivityCertificationStore) {
	router.HandleFunc("/admin/task-activity-certification", func(w http.ResponseWriter, r *http.Request) {
		if !isSystemAdmin(r.Header.Get("Mattermost-User-ID")) {
			handleResponseWithCode(w, http.StatusForbidden, "System administrator permission required")
			return
		}

		switch r.Method {
		case http.MethodGet:
			certification, err := store.GetTaskActivityCertification(r.Context())
			if err != nil {
				handleResponseWithCode(w, http.StatusInternalServerError, "Could not read task activity certification")
				return
			}
			ReturnJSON(w, certification, http.StatusOK)
		case http.MethodPost:
			var request struct {
				ExpectedGeneration    *int64 `json:"expected_generation"`
				AllOlderNodesStopped  bool   `json:"all_older_plugin_nodes_stopped"`
				CoveredWritersAudited bool   `json:"covered_writers_audited"`
			}
			if err := json.NewDecoder(r.Body).Decode(&request); err != nil || request.ExpectedGeneration == nil ||
				!request.AllOlderNodesStopped || !request.CoveredWritersAudited {
				handleResponseWithCode(w, http.StatusBadRequest, "Activation requires the current generation and rollout acknowledgments")
				return
			}
			certification, err := store.ActivateTaskActivityCertification(r.Context(), *request.ExpectedGeneration)
			if err != nil {
				handleResponseWithCode(w, http.StatusConflict, "Task activity certification generation changed or activation failed")
				return
			}
			ReturnJSON(w, certification, http.StatusOK)
		case http.MethodDelete:
			certification, err := store.DisableTaskActivityCertification(r.Context())
			if err != nil {
				handleResponseWithCode(w, http.StatusInternalServerError, "Could not disable task activity certification")
				return
			}
			ReturnJSON(w, certification, http.StatusOK)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}).Methods(http.MethodGet, http.MethodPost, http.MethodDelete)
}
