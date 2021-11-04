package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
	"gotest.tools/assert"
)

func TestRuns(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("dialog requests", func(t *testing.T) {
		for name, tc := range map[string]struct {
			dialogRequest model.SubmitDialogRequest
			expected      func(t *testing.T, result *http.Response, err error)
		}{
			"valid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"valid from post": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPublicChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"somone else's user id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.AdminUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			"missing playbook id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: "noesnotexist",
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
			"no permissions to postid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPrivateChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)
				result, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", dialogRequestBytes, "")
				tc.expected(t, result, err)
			})
		}
	})
}
