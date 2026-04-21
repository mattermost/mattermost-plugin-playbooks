// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app_test

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
)

func TestPlaybookService_UpdateRunNumberPrefixMutable(t *testing.T) {
	makeService := func(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore, *mock_bot.MockPoster) {
		mockStore := mock_app.NewMockPlaybookStore(ctrl)
		mockPoster := mock_bot.NewMockPoster(ctrl)
		mockPropertyService := mock_app.NewMockPropertyService(ctrl)
		mockConditionService := mock_app.NewMockConditionService(ctrl)
		mockAuditor := mock_app.NewMockAuditor(ctrl)
		mockAuditor.EXPECT().MakeAuditRecord(gomock.Any(), gomock.Any()).Return(&model.AuditRecord{}).AnyTimes()
		mockAuditor.EXPECT().LogAuditRec(gomock.Any()).AnyTimes()

		svc := app.NewPlaybookService(
			mockStore,
			mockPoster,
			nil,
			mockAuditor,
			&metrics.Metrics{},
			mockPropertyService,
			mockConditionService,
		)
		return svc, mockStore, mockPoster
	}

	basePlaybook := app.Playbook{
		ID:              "pb1",
		Title:           "Test Playbook",
		TeamID:          "team1",
		RunNumberPrefix: "INC",
	}

	t.Run("prefix change allowed even when runs exist", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPoster := makeService(ctrl)

		updated := basePlaybook
		updated.RunNumberPrefix = "CHANGED"

		mockStore.EXPECT().Update(gomock.Any()).Return(nil)
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		err := svc.Update(updated, "user1")
		require.NoError(t, err)
	})

	t.Run("prefix change allowed when no runs exist", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPoster := makeService(ctrl)

		updated := basePlaybook
		updated.RunNumberPrefix = "NEW"

		mockStore.EXPECT().Update(gomock.Any()).Return(nil)
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		err := svc.Update(updated, "user1")
		require.NoError(t, err)
	})
}

func TestPlaybookService_GraphqlUpdateRunNumberPrefixMutable(t *testing.T) {
	makeService := func(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore, *mock_bot.MockPoster) {
		mockStore := mock_app.NewMockPlaybookStore(ctrl)
		mockPoster := mock_bot.NewMockPoster(ctrl)
		mockPropertyService := mock_app.NewMockPropertyService(ctrl)
		mockConditionService := mock_app.NewMockConditionService(ctrl)

		svc := app.NewPlaybookService(
			mockStore,
			mockPoster,
			nil,
			nil,
			&metrics.Metrics{},
			mockPropertyService,
			mockConditionService,
		)
		return svc, mockStore, mockPoster
	}

	basePlaybook := app.Playbook{
		ID:              "pb1",
		Title:           "Test Playbook",
		TeamID:          "team1",
		RunNumberPrefix: "INC",
	}

	t.Run("prefix change allowed via GraphqlUpdate even when runs exist", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPoster := makeService(ctrl)

		mockStore.EXPECT().Get("pb1").Return(basePlaybook, nil)
		mockStore.EXPECT().GraphqlUpdate("pb1", gomock.Any()).Return(nil)
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		err := svc.GraphqlUpdate("pb1", map[string]interface{}{"RunNumberPrefix": "CHANGED"})
		require.NoError(t, err)
	})

	t.Run("non-RunNumberPrefix fields work normally", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPoster := makeService(ctrl)

		mockStore.EXPECT().Get("pb1").Return(basePlaybook, nil)
		mockStore.EXPECT().GraphqlUpdate("pb1", gomock.Any()).Return(nil)
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		err := svc.GraphqlUpdate("pb1", map[string]interface{}{"Title": "New Title"})
		require.NoError(t, err)
	})
}

func TestPlaybookService_IncrementRunNumber(t *testing.T) {
	makeService := func(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore) {
		mockStore := mock_app.NewMockPlaybookStore(ctrl)
		mockPoster := mock_bot.NewMockPoster(ctrl)
		mockPropertyService := mock_app.NewMockPropertyService(ctrl)
		mockConditionService := mock_app.NewMockConditionService(ctrl)

		svc := app.NewPlaybookService(
			mockStore,
			mockPoster,
			nil,
			nil,
			&metrics.Metrics{},
			mockPropertyService,
			mockConditionService,
		)
		return svc, mockStore
	}

	t.Run("valid playbookID returns incremented run number", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		mockStore.EXPECT().
			IncrementRunNumber("playbook1").
			Return(int64(42), nil)

		runNumber, err := svc.IncrementRunNumber("playbook1")

		require.NoError(t, err)
		assert.Equal(t, int64(42), runNumber)
	})

	t.Run("service passes through unexpected zero runNumber from store", func(t *testing.T) {
		// This is a defensive interface-contract test. In production, IncrementRunNumber
		// always returns >= 1 (NextRunNumber starts at 1; RETURNING NextRunNumber-1 => 1
		// on the first call). CreatePlaybookRun hard-rejects RunNumber == 0, so this
		// path is not a valid production outcome — it tests that the service layer does
		// not silently swallow an unexpected zero from the store.
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		mockStore.EXPECT().
			IncrementRunNumber("playbook1").
			Return(int64(0), nil)

		runNumber, err := svc.IncrementRunNumber("playbook1")

		require.NoError(t, err)
		assert.Equal(t, int64(0), runNumber)
	})

	t.Run("empty playbookID delegates to store and returns its error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		storeErr := errors.New("playbookID cannot be empty")
		mockStore.EXPECT().
			IncrementRunNumber("").
			Return(int64(0), storeErr)

		runNumber, err := svc.IncrementRunNumber("")

		require.Error(t, err)
		assert.True(t, errors.Is(err, storeErr))
		assert.Equal(t, int64(0), runNumber)
	})

	t.Run("non-existent playbookID returns ErrNotFound", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		mockStore.EXPECT().
			IncrementRunNumber("nonexistent").
			Return(int64(0), app.ErrNotFound)

		runNumber, err := svc.IncrementRunNumber("nonexistent")

		require.Error(t, err)
		assert.True(t, errors.Is(err, app.ErrNotFound))
		assert.Equal(t, int64(0), runNumber)
	})

	t.Run("store error propagates unchanged", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		storeErr := errors.New("connection lost")
		mockStore.EXPECT().
			IncrementRunNumber("playbook1").
			Return(int64(0), storeErr)

		runNumber, err := svc.IncrementRunNumber("playbook1")

		require.Error(t, err)
		assert.True(t, errors.Is(err, storeErr))
		assert.Equal(t, int64(0), runNumber)
	})
}
