package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestTrialLicences(t *testing.T) {
	// This test is flaky due to upstream connectivity issues.
	t.Skip()

	e := Setup(t)
	e.CreateBasic()

	t.Run("request trial license without permissions", func(t *testing.T) {
		dialogRequest := model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			PostId: e.BasicPublicChannelPost.Id,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		resp, err := e.ServerClient.DoAPIRequestBytes(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/bot/notify-admins/button-start-trial", dialogRequestBytes, "")
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("request trial license with permissions", func(t *testing.T) {
		dialogRequest := model.PostActionIntegrationRequest{
			UserId: e.AdminUser.Id,
			PostId: e.BasicPublicChannelPost.Id,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		resp, err := e.ServerAdminClient.DoAPIRequestBytes(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/bot/notify-admins/button-start-trial", dialogRequestBytes, "")
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
