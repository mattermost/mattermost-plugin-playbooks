package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/golang/mock/gomock"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
	mock_plugin "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks/serverpluginapi"
	"github.com/mattermost/mattermost-plugin-incident-response/server/subscription"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateSubscription(t *testing.T) {
	setup := func(t *testing.T) (*mock_pluginkvstore.MockKVAPI, *Handler) {
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
		playbookStore := pluginkvstore.NewPlaybookStore(kvAPI)

		subscriptionService := subscription.NewService(subscriptionStore)
		playbookService := playbook.NewService(playbookStore, mock_poster.NewMockPoster(mockCtrl), &telemetry.NoopTelemetry{})

		pluginAPI := mock_plugin.NewMockAPI(mockCtrl)
		pluginAPI.EXPECT().
			HasPermissionToTeam(gomock.Any(), gomock.Any(), gomock.Any()).
			Return(true).
			Times(1)

		client := pluginapi.NewClient(pluginAPI)

		handler := NewHandler()
		NewSubscriptionHandler(handler.APIRouter, subscriptionService, playbookService, client)

		return kvAPI, handler
	}

	recorder := httptest.NewRecorder()

	fixtureData := []struct {
		testName string
		pbook    playbook.Playbook
		subsc    subscription.Subscription
	}{
		{
			testName: "valid playbook",
			pbook: playbook.Playbook{
				ID:                   "pbookID",
				Title:                "My Playbook",
				TeamID:               "teamid",
				CreatePublicIncident: true,
				Checklists:           []playbook.Checklist{},
				MemberIDs:            []string{"testuserid", "subscriberID"},
			},
			subsc: subscription.Subscription{
				URL:        url.URL{},
				PlaybookID: "pbookID",
				UserID:     "subscriberID",
			},
		},
	}

	for _, test := range fixtureData {
		kvAPI, handler := setup(t)

		kvAPI.EXPECT().
			Get(pluginkvstore.PlaybookIndexKey, gomock.Any()).
			Return(nil).
			SetArg(1, []string{test.pbook.ID})

		kvAPI.EXPECT().
			Get(pluginkvstore.PlaybookKey+test.pbook.ID, gomock.Any()).
			Return(nil).SetArg(1, test.pbook)

		subscriptionJSON, err := json.Marshal(test.subsc)
		require.NoError(t, err)

		request, err := http.NewRequest("POST", "/api/v1/eventsubscriptions", bytes.NewBuffer(subscriptionJSON))
		require.NoError(t, err)
		request.Header.Add("Mattermost-User-ID", "testuserid")

		handler.ServeHTTP(recorder, request, "testpluginid")

		resp := recorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var resultSubscription subscription.Subscription
		err = json.NewDecoder(resp.Body).Decode(&resultSubscription)
		require.NoError(t, err)
		assert.NotEmpty(t, resultSubscription.ID)
	}
}
