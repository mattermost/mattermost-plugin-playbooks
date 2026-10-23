// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore"
)

type certificationStoreForTest struct {
	state         sqlstore.TaskActivityCertification
	activateCalls int
	disableCalls  int
}

func (s *certificationStoreForTest) GetTaskActivityCertification(context.Context) (sqlstore.TaskActivityCertification, error) {
	return s.state, nil
}

func (s *certificationStoreForTest) ActivateTaskActivityCertification(_ context.Context, generation int64) (sqlstore.TaskActivityCertification, error) {
	s.activateCalls++
	if generation != s.state.Generation || s.state.Enabled {
		return s.state, errors.New("stale generation")
	}
	s.state.Enabled = true
	s.state.Epoch = "new-epoch"
	s.state.Generation++
	return s.state, nil
}

func (s *certificationStoreForTest) DisableTaskActivityCertification(context.Context) (sqlstore.TaskActivityCertification, error) {
	s.disableCalls++
	s.state.Enabled = false
	s.state.Generation++
	return s.state, nil
}

func TestTaskActivityCertificationRequiresAdminAndRolloutAcknowledgment(t *testing.T) {
	store := &certificationStoreForTest{state: sqlstore.TaskActivityCertification{Generation: 4}}
	router := mux.NewRouter()
	NewTaskActivityCertificationHandler(router, func(userID string) bool { return userID == "admin" }, store)

	request := func(method, body, userID string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "/admin/task-activity-certification", strings.NewReader(body))
		r.Header.Set("Mattermost-User-ID", userID)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}

	valid := `{"expected_generation":4,"all_older_plugin_nodes_stopped":true,"covered_writers_audited":true}`
	require.Equal(t, http.StatusForbidden, request(http.MethodPost, valid, "user").Code)
	require.Equal(t, http.StatusBadRequest, request(http.MethodPost, `{"expected_generation":4}`, "admin").Code)
	require.Equal(t, 0, store.activateCalls)
	require.Equal(t, http.StatusConflict, request(http.MethodPost, `{"expected_generation":3,"all_older_plugin_nodes_stopped":true,"covered_writers_audited":true}`, "admin").Code)
	require.Equal(t, http.StatusOK, request(http.MethodPost, valid, "admin").Code)
	require.Equal(t, "new-epoch", store.state.Epoch)
	require.Equal(t, int64(5), store.state.Generation)
	require.Equal(t, http.StatusOK, request(http.MethodDelete, "", "admin").Code)
	require.False(t, store.state.Enabled)
	require.Equal(t, 1, store.disableCalls)
}
