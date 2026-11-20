// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type timingTestEnv struct {
	*TestEnvironment
	playbookID string
	itemID     string
}

func setupTimingTest(t *testing.T) timingTestEnv {
	e := Setup(t)
	e.CreateBasic()

	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Timing playbook",
		TeamID: e.BasicTeam.Id,
		Public: false,
		Checklists: []client.Checklist{{
			Title: "Triage",
			Items: []client.ChecklistItem{{Title: "Acknowledge alert"}, {Title: "Contain"}},
		}},
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
	})
	require.NoError(t, err)

	playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), playbookID)
	require.NoError(t, err)
	itemID := playbook.Checklists[0].Items[0].ID
	require.True(t, model.IsValidId(itemID), "playbook tasks get stable IDs")

	return timingTestEnv{TestEnvironment: e, playbookID: playbookID, itemID: itemID}
}

func (e timingTestEnv) loginClient(user *model.User) *model.Client4 {
	c := model.NewAPIv4Client(e.ServerClient.URL)
	_, _, err := c.Login(context.Background(), user.Email, testUserPassword)
	require.NoError(e.T, err)
	return c
}

func (e timingTestEnv) do(c *model.Client4, method, path string, body any) (int, map[string]any) {
	data := ""
	if body != nil {
		encoded, err := json.Marshal(body)
		require.NoError(e.T, err)
		data = string(encoded)
	}
	resp, err := e.DoPluginAPIRequestWithHeaders(context.Background(), c, method, "/api/v0"+path, data, nil)
	require.NotNil(e.T, resp, "request failed: %v", err)
	if resp.StatusCode >= 300 {
		return resp.StatusCode, nil
	}
	defer resp.Body.Close()
	var result map[string]any
	require.NoError(e.T, json.NewDecoder(resp.Body).Decode(&result))
	return resp.StatusCode, result
}

func (e timingTestEnv) mtta() map[string]any {
	return map[string]any{
		"name":          "Time to acknowledge",
		"industry_name": "MTTA",
		"target_millis": 15 * 60 * 1000,
		"start":         map[string]any{"type": app.TimingPointRunStarted},
		"end":           map[string]any{"type": app.TimingPointTaskFinished, "item_id": e.itemID},
	}
}

func (e timingTestEnv) setTiming(playbookType string) {
	status, _ := e.do(e.ServerClient, http.MethodPut, "/playbooks/"+e.playbookID+"/timing", map[string]any{
		"playbook_type":  playbookType,
		"timing_metrics": []any{e.mtta()},
	})
	require.Equal(e.T, http.StatusOK, status)
}

func (e timingTestEnv) startRun() string {
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Timing run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.playbookID,
	})
	require.NoError(e.T, err)
	return run.ID
}

func TestUpdatePlaybookTiming(t *testing.T) {
	e := setupTimingTest(t)
	path := "/playbooks/" + e.playbookID + "/timing"

	t.Run("saves the type and metrics and assigns metric IDs", func(t *testing.T) {
		status, result := e.do(e.ServerClient, http.MethodPut, path, map[string]any{
			"playbook_type":  app.PlaybookTypeExercise,
			"timing_metrics": []any{e.mtta()},
		})
		require.Equal(t, http.StatusOK, status)

		assert.Equal(t, app.PlaybookTypeExercise, result["playbook_type"])
		metrics := result["timing_metrics"].([]any)
		require.Len(t, metrics, 1)
		assert.True(t, model.IsValidId(metrics[0].(map[string]any)["id"].(string)))
	})

	for name, body := range map[string]map[string]any{
		"an unknown playbook type": {"playbook_type": "drill", "timing_metrics": []any{}},
		"a metric on a missing task": {"timing_metrics": []any{map[string]any{
			"name":  "Contain",
			"start": map[string]any{"type": app.TimingPointRunStarted},
			"end":   map[string]any{"type": app.TimingPointTaskFinished, "item_id": model.NewId()},
		}}},
		"a metric without a name": {"timing_metrics": []any{map[string]any{
			"start": map[string]any{"type": app.TimingPointRunStarted},
			"end":   map[string]any{"type": app.TimingPointTaskFinished, "item_id": e.itemID},
		}}},
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			status, _ := e.do(e.ServerClient, http.MethodPut, path, body)
			assert.Equal(t, http.StatusBadRequest, status)
		})
	}

	t.Run("rejects users who cannot manage the playbook", func(t *testing.T) {
		status, _ := e.do(e.loginClient(e.RegularUser2), http.MethodPut, path, map[string]any{"timing_metrics": []any{}})
		assert.Equal(t, http.StatusForbidden, status)
	})

	t.Run("runs copy the metrics and the exercise flag", func(t *testing.T) {
		e.setTiming(app.PlaybookTypeExercise)
		runID := e.startRun()

		status, run := e.do(e.ServerClient, http.MethodGet, "/runs/"+runID, nil)
		require.Equal(t, http.StatusOK, status)
		assert.Equal(t, true, run["exercise"])
		assert.Len(t, run["timing_metrics"], 1)
	})
}

func TestGetRunTiming(t *testing.T) {
	e := setupTimingTest(t)
	e.setTiming(app.PlaybookTypeOperational)
	runID := e.startRun()

	t.Run("returns the run's metric results", func(t *testing.T) {
		status, timing := e.do(e.ServerClient, http.MethodGet, "/runs/"+runID+"/timing", nil)
		require.Equal(t, http.StatusOK, status)

		metrics := timing["metrics"].([]any)
		require.Len(t, metrics, 1)
		assert.Equal(t, app.TimingMetricStatusRunning, metrics[0].(map[string]any)["status"])
	})

	t.Run("rejects users who cannot view the run", func(t *testing.T) {
		status, _ := e.do(e.loginClient(e.RegularUserNotInTeam), http.MethodGet, "/runs/"+runID+"/timing", nil)
		assert.Equal(t, http.StatusForbidden, status)
	})
}

func TestGetTimingReport(t *testing.T) {
	e := setupTimingTest(t)
	e.setTiming(app.PlaybookTypeExercise)
	e.startRun()
	reportPath := func(query string) string {
		return fmt.Sprintf("/runs/timing-report?team_id=%s&playbook_id=%s%s", e.BasicTeam.Id, e.playbookID, query)
	}

	t.Run("leaves out exercise runs unless asked", func(t *testing.T) {
		status, report := e.do(e.ServerClient, http.MethodGet, reportPath(""), nil)
		require.Equal(t, http.StatusOK, status)
		assert.EqualValues(t, 0, report["run_count"])

		status, report = e.do(e.ServerClient, http.MethodGet, reportPath("&include_exercises=true"), nil)
		require.Equal(t, http.StatusOK, status)
		assert.EqualValues(t, 1, report["run_count"])
		assert.Len(t, report["metrics"], 1)
		assert.Len(t, report["steps"], 2, "every task of the selected playbook gets a step")
	})

	t.Run("rejects a malformed started_gte", func(t *testing.T) {
		for _, value := range []string{"yesterday", "-1"} {
			status, _ := e.do(e.ServerClient, http.MethodGet, reportPath("&started_gte="+value), nil)
			assert.Equal(t, http.StatusBadRequest, status, value)
		}
	})

	t.Run("rejects users outside the team", func(t *testing.T) {
		status, _ := e.do(e.loginClient(e.RegularUserNotInTeam), http.MethodGet, "/runs/timing-report?team_id="+e.BasicTeam.Id, nil)
		assert.Equal(t, http.StatusForbidden, status)
	})

	t.Run("rejects users who cannot view the playbook", func(t *testing.T) {
		status, _ := e.do(e.loginClient(e.RegularUser2), http.MethodGet, reportPath(""), nil)
		assert.Equal(t, http.StatusForbidden, status)
	})
}
