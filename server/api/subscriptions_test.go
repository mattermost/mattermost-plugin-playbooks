package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	mock_playbook "github.com/mattermost/mattermost-plugin-incident-response/server/playbook/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
	mock_plugin "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks/serverpluginapi"
	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateSubscription(t *testing.T) {
	setup := func(t *testing.T) (*mock_playbook.MockService, *Handler) {
		t.Helper()

		mockCtrl := gomock.NewController(t)

		kvAPI := mock_pluginkvstore.NewMockKVAPI(mockCtrl)

		kvAPI.EXPECT().
			Set(gomock.Any(), gomock.Any()).
			Return(true, nil)

		kvAPI.EXPECT().
			SetAtomicWithRetries(gomock.Any(), gomock.Any()).
			Return(nil)

		subscriptionStore := pluginkvstore.NewSubscriptionStore(kvAPI)
		subscriptionService := subscription.NewService(subscriptionStore)

		playbookService := mock_playbook.NewMockService(mockCtrl)

		pluginAPI := mock_plugin.NewMockAPI(mockCtrl)
		pluginAPI.EXPECT().
			HasPermissionToTeam(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(true).
			Times(1)

		client := pluginapi.NewClient(pluginAPI)

		handler := NewHandler()
		NewSubscriptionHandler(handler.APIRouter, subscriptionService, playbookService, client)

		return playbookService, handler
	}

	testUserID := "testuserid"
	fixtureData := []struct {
		testName       string
		pbook          playbook.Playbook
		subsc          subscription.Subscription
		requestUser    string
		expectedStatus int
	}{
		{
			testName: "valid subscription",
			pbook: playbook.Playbook{
				ID:                   "pbookID",
				Title:                "My Playbook",
				TeamID:               "teamid",
				CreatePublicIncident: true,
				Checklists:           []playbook.Checklist{},
				MemberIDs:            []string{testUserID},
			},
			subsc: subscription.Subscription{
				URL:        url.URL{},
				PlaybookID: "pbookID",
				UserID:     testUserID,
			},
			requestUser:    testUserID,
			expectedStatus: http.StatusCreated,
		},
		{
			testName: "different user and subscriber",
			pbook: playbook.Playbook{
				ID:                   "pbookID",
				Title:                "My Playbook",
				TeamID:               "teamid",
				CreatePublicIncident: true,
				Checklists:           []playbook.Checklist{},
				MemberIDs:            []string{testUserID},
			},
			subsc: subscription.Subscription{
				URL:        url.URL{},
				PlaybookID: "pbookID",
				UserID:     "otheruserid",
			},
			requestUser:    testUserID,
			expectedStatus: http.StatusBadRequest,
		},
		{
			testName: "user not in playbook",
			pbook: playbook.Playbook{
				ID:                   "pbookID",
				Title:                "My Playbook",
				TeamID:               "teamid",
				CreatePublicIncident: true,
				Checklists:           []playbook.Checklist{},
				MemberIDs:            []string{"otheruserid"},
			},
			subsc: subscription.Subscription{
				URL:        url.URL{},
				PlaybookID: "pbookID",
				UserID:     testUserID,
			},
			requestUser:    testUserID,
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, test := range fixtureData {
		t.Run(test.testName, func(t *testing.T) {
			playbookService, handler := setup(t)

			playbookService.EXPECT().
				Get(test.pbook.ID).
				Return(test.pbook, nil).
				Times(1)

			subscriptionJSON, err := json.Marshal(test.subsc)
			require.NoError(t, err)

			request, err := http.NewRequest("POST", "/api/v0/eventsubscriptions", bytes.NewBuffer(subscriptionJSON))
			require.NoError(t, err)
			request.Header.Add("Mattermost-User-ID", test.requestUser)

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request, "testpluginid")

			resp := recorder.Result()
			defer resp.Body.Close()
			assert.Equal(t, test.expectedStatus, resp.StatusCode)

			if test.expectedStatus == http.StatusCreated {
				var resultSubscription subscription.Subscription
				err = json.NewDecoder(resp.Body).Decode(&resultSubscription)
				require.NoError(t, err)
				assert.NotEmpty(t, resultSubscription.ID)
			}
		})
	}
}
