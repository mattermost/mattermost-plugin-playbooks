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

func makePlaybookService(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore, *mock_app.MockPropertyService) {
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
	return svc, mockStore, mockPropertyService
}

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

	t.Run("prefix change is allowed", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, _ := makeService(ctrl)

		updated := basePlaybook
		updated.RunNumberPrefix = "CHANGED"

		mockStore.EXPECT().IsRunNumberPrefixUsed("team1", "CHANGED", "pb1").Return(false, nil)
		mockStore.EXPECT().Update(gomock.Any()).Return(nil)

		err := svc.Update(updated, "user1")
		require.NoError(t, err)
	})
}

func TestRunNumberPrefixUniqueness(t *testing.T) {
	makeService := func(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore) {
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
		return svc, mockStore
	}

	t.Run("duplicate prefix on same team is rejected with ErrDuplicateEntry", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		playbookB := app.Playbook{
			ID:              "pb2",
			Title:           "Second Playbook",
			TeamID:          "team1",
			RunNumberPrefix: "INC",
		}

		mockStore.EXPECT().IsRunNumberPrefixUsed("team1", "INC", "pb2").Return(true, nil)

		err := svc.Update(playbookB, "user1")
		require.Error(t, err)
		assert.True(t, errors.Is(err, app.ErrDuplicateEntry))
	})

	t.Run("same prefix on different team is allowed", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore := makeService(ctrl)

		playbookC := app.Playbook{
			ID:              "pb3",
			Title:           "Third Playbook",
			TeamID:          "team2",
			RunNumberPrefix: "INC",
		}

		mockStore.EXPECT().IsRunNumberPrefixUsed("team2", "INC", "pb3").Return(false, nil)
		mockStore.EXPECT().Update(gomock.Any()).Return(nil)

		err := svc.Update(playbookC, "user1")
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
		// Defensive: IncrementRunNumber always returns >= 1 in production; test that the service doesn't swallow an unexpected 0.
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

func TestPlaybookService_UpdateChannelNameTemplate(t *testing.T) {
	t.Run("saves valid template with no field references", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService := makePlaybookService(ctrl)

		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(nil, nil)
		mockStore.EXPECT().UpdateChannelNameTemplate("pb1", "Incident - Run").Return(nil)

		err := svc.UpdateChannelNameTemplate("pb1", "Incident - Run", "user1")
		require.NoError(t, err)
	})

	t.Run("saves valid template referencing a known field", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService := makePlaybookService(ctrl)

		fields := []app.PropertyField{{PropertyField: model.PropertyField{ID: "f1", Name: "Zone"}}}
		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(fields, nil)
		mockStore.EXPECT().UpdateChannelNameTemplate("pb1", "{Zone} - Incident").Return(nil)

		err := svc.UpdateChannelNameTemplate("pb1", "{Zone} - Incident", "user1")
		require.NoError(t, err)
	})

	t.Run("rejects template referencing an unknown field", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, _, mockPropertyService := makePlaybookService(ctrl)

		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(nil, nil)

		err := svc.UpdateChannelNameTemplate("pb1", "{NoSuchField} - Incident", "user1")
		require.Error(t, err)
		assert.True(t, errors.Is(err, app.ErrMalformedPlaybookRun))
	})

	t.Run("rejects template exceeding max length", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, _, _ := makePlaybookService(ctrl)

		longTemplate := string(make([]byte, app.MaxChannelNameTemplateLength+1))
		err := svc.UpdateChannelNameTemplate("pb1", longTemplate, "user1")
		require.Error(t, err)
		assert.True(t, errors.Is(err, app.ErrMalformedPlaybookRun))
	})

	t.Run("allows empty template (clears it)", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService := makePlaybookService(ctrl)

		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(nil, nil)
		mockStore.EXPECT().UpdateChannelNameTemplate("pb1", "").Return(nil)

		err := svc.UpdateChannelNameTemplate("pb1", "", "user1")
		require.NoError(t, err)
	})

	t.Run("propagates GetPropertyFields error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, _, mockPropertyService := makePlaybookService(ctrl)

		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(nil, errors.New("db error"))

		err := svc.UpdateChannelNameTemplate("pb1", "Incident", "user1")
		require.Error(t, err)
	})

	t.Run("propagates store error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService := makePlaybookService(ctrl)

		mockPropertyService.EXPECT().GetPropertyFields("pb1").Return(nil, nil)
		mockStore.EXPECT().UpdateChannelNameTemplate("pb1", "Incident").Return(errors.New("update failed"))

		err := svc.UpdateChannelNameTemplate("pb1", "Incident", "user1")
		require.Error(t, err)
	})
}
