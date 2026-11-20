// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func validateTiming(playbook *app.Playbook) error {
	if err := app.ValidatePlaybookType(playbook.PlaybookType); err != nil {
		return err
	}
	return app.ValidateTimingMetrics(playbook.TimingMetrics, nil)
}

type playbookTiming struct {
	PlaybookType  string             `json:"playbook_type"`
	TimingMetrics []app.TimingMetric `json:"timing_metrics"`
}

// updatePlaybookTiming replaces a playbook's type and timing metrics.
func (h *PlaybookHandler) updatePlaybookTiming(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params playbookTiming
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode timing", err)
		return
	}

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageProperties(userID, playbook)) {
		return
	}

	if playbook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Playbook cannot be modified", fmt.Errorf("playbook with id '%s' is archived", playbookID))
		return
	}

	if err := app.ValidatePlaybookType(params.PlaybookType); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid playbook type", err)
		return
	}
	if params.TimingMetrics == nil {
		params.TimingMetrics = []app.TimingMetric{}
	}
	if err := app.ValidateTimingMetrics(params.TimingMetrics, playbook.Checklists); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid timing metrics", err)
		return
	}

	playbook.PlaybookType = params.PlaybookType
	playbook.TimingMetrics = params.TimingMetrics
	if err := h.playbookService.Update(playbook, userID); err != nil {
		h.handlePlaybookWriteError(w, c.logger, err)
		return
	}

	ReturnJSON(w, playbookTiming{PlaybookType: playbook.PlaybookType, TimingMetrics: playbook.TimingMetrics}, http.StatusOK)
}

// getTimingReport aggregates timing metrics across the runs the user can view.
func (h *PlaybookRunHandler) getTimingReport(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	query := r.URL.Query()

	options := app.TimingReportOptions{
		TeamID:           query.Get("team_id"),
		PlaybookID:       query.Get("playbook_id"),
		IncludeExercises: query.Get("include_exercises") == "true",
	}
	if since := query.Get("started_gte"); since != "" {
		startedGTE, err := strconv.ParseInt(since, 10, 64)
		if err != nil || startedGTE < 0 {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter started_gte", errors.New("started_gte must be a non-negative timestamp"))
			return
		}
		options.StartedGTE = startedGTE
	}

	if options.TeamID != "" && !h.pluginAPI.User.HasPermissionToTeam(userID, options.TeamID, model.PermissionViewTeam) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "Not authorized", errors.Errorf("userID %s does not have permission to view team %s", userID, options.TeamID))
		return
	}
	if options.PlaybookID != "" && !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, options.PlaybookID)) {
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	report, err := h.playbookRunService.GetTimingReport(requesterInfo, options)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, report, http.StatusOK)
}
