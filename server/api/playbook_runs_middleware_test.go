// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	"github.com/mattermost/mattermost/server/public/model"
)

func TestMattermostAuthorizationRequired(t *testing.T) {
	const (
		userID       = "user_abc123"
		callerPlugin = "com.example.caller"
	)

	for _, tc := range []struct {
		name             string
		userHeader       string
		pluginHeader     string
		actingUserHeader string
		expectStatus     int
		expectUserID     string // the Mattermost-User-Id the downstream handler should observe
		expectAudit      bool   // whether the acting-as-user grant should be recorded
	}{
		{
			name:         "authenticated user request passes unchanged",
			userHeader:   userID,
			expectStatus: http.StatusOK,
			expectUserID: userID,
		},
		{
			name:             "authenticated user request ignores plugin headers",
			userHeader:       userID,
			pluginHeader:     callerPlugin,
			actingUserHeader: "someone_else",
			expectStatus:     http.StatusOK,
			expectUserID:     userID,
		},
		{
			name:         "no headers at all is rejected",
			expectStatus: http.StatusUnauthorized,
		},
		{
			name:             "inter-plugin call promotes the acting user",
			pluginHeader:     callerPlugin,
			actingUserHeader: userID,
			expectStatus:     http.StatusOK,
			expectUserID:     userID,
			expectAudit:      true,
		},
		{
			name:             "inter-plugin call without an acting user is rejected",
			pluginHeader:     callerPlugin,
			actingUserHeader: "",
			expectStatus:     http.StatusUnauthorized,
		},
		{
			name:             "acting-user header without a plugin header is rejected (external spoof guard)",
			pluginHeader:     "",
			actingUserHeader: userID,
			expectStatus:     http.StatusUnauthorized,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			// gomock fails the test on any unexpected call, so paths that must NOT audit
			// (normal user requests, rejections) are verified by setting no expectations.
			mockAuditor := mock_app.NewMockAuditor(ctrl)
			if tc.expectAudit {
				auditRec := &model.AuditRecord{}
				mockAuditor.EXPECT().
					MakeAuditRecord("interPluginActAsUser", model.AuditStatusSuccess).
					Return(auditRec)
				mockAuditor.EXPECT().LogAuditRec(auditRec)
			}

			h := &Handler{auditor: mockAuditor}

			var observedUserID string
			handlerCalled := false
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handlerCalled = true
				observedUserID = r.Header.Get("Mattermost-User-Id")
				w.WriteHeader(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/plugins/playbooks/api/v0/runs/runid", nil)
			if tc.userHeader != "" {
				req.Header.Set("Mattermost-User-Id", tc.userHeader)
			}
			if tc.pluginHeader != "" {
				req.Header.Set("Mattermost-Plugin-ID", tc.pluginHeader)
			}
			if tc.actingUserHeader != "" {
				req.Header.Set("Mattermost-Plugin-Acting-User-Id", tc.actingUserHeader)
			}

			rec := httptest.NewRecorder()
			h.MattermostAuthorizationRequired(next).ServeHTTP(rec, req)

			require.Equal(t, tc.expectStatus, rec.Code)
			if tc.expectStatus == http.StatusOK {
				require.True(t, handlerCalled, "downstream handler should have been called")
				require.Equal(t, tc.expectUserID, observedUserID, "downstream handler saw the wrong user")
			} else {
				require.False(t, handlerCalled, "downstream handler must not be called on rejection")
			}
		})
	}
}

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
