// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func TestIsRunRestoreRequest(t *testing.T) {
	t.Run("run restore", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid"})
		require.True(t, isRunRestoreRequest(req))
	})

	t.Run("checklist restore is not run restore", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/checklists/0/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid", "checklist": "0"})
		require.False(t, isRunRestoreRequest(req))
	})

	t.Run("item restore is not run restore", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/checklists/0/item/1/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid", "checklist": "0", "item": "1"})
		require.False(t, isRunRestoreRequest(req))
	})

	t.Run("non-PUT is not run restore", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid"})
		require.False(t, isRunRestoreRequest(req))
	})
}

func TestIsRetrospectiveRequest(t *testing.T) {
	t.Run("update retrospective", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/retrospective", nil)
		require.True(t, isRetrospectiveRequest(req))
	})

	t.Run("publish retrospective", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/retrospective/publish", nil)
		require.True(t, isRetrospectiveRequest(req))
	})

	t.Run("no retrospective button", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/no-retrospective-button", nil)
		require.True(t, isRetrospectiveRequest(req))
	})

	t.Run("toggle retrospective enabled", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/retrospective-enabled", nil)
		require.True(t, isRetrospectiveRequest(req))
	})

	t.Run("unrelated POST is not retrospective", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/status", nil)
		require.False(t, isRetrospectiveRequest(req))
	})

	t.Run("unrelated PUT is not retrospective", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/status-update-enabled", nil)
		require.False(t, isRetrospectiveRequest(req))
	})
}

func TestIsExemptFromActiveRunCheck(t *testing.T) {
	t.Run("run restore is exempt", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid"})
		require.True(t, isExemptFromActiveRunCheck(req))
	})

	t.Run("checklist restore is not exempt", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/checklists/0/restore", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "runid", "checklist": "0"})
		require.False(t, isExemptFromActiveRunCheck(req))
	})

	t.Run("retrospective update is exempt", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/retrospective", nil)
		require.True(t, isExemptFromActiveRunCheck(req))
	})

	t.Run("retrospective toggle is exempt", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/plugins/playbooks/api/v0/runs/runid/retrospective-enabled", nil)
		require.True(t, isExemptFromActiveRunCheck(req))
	})

	t.Run("owner change is not exempt", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/plugins/playbooks/api/v0/runs/runid/owner", nil)
		require.False(t, isExemptFromActiveRunCheck(req))
	})
}
