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

func TestPlaybookService_CreatePropertyField(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockConditionService := mock_app.NewMockConditionService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil, // api client
		nil, // auditor
		&metrics.Metrics{},
		mockPropertyService,
		mockConditionService,
	)

	playbookID := "playbook123"
	propertyField := app.PropertyField{
		PropertyField: model.PropertyField{
			Name: "Test Field",
			Type: model.PropertyFieldTypeText,
		},
	}

	t.Run("success - property field created and playbook updated", func(t *testing.T) {
		expectedField := &app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   "prop123",
				Name: "Test Field",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			CreatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockPropertyService.EXPECT().
			CreatePropertyField(playbookID, propertyField).
			Return(nil, expectedError)

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.Equal(t, expectedError, err)
		assert.Nil(t, result)
	})

	t.Run("bump fails after property creation", func(t *testing.T) {
		expectedField := &app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   "prop123",
				Name: "Test Field",
				Type: model.PropertyFieldTypeText,
			},
		}
		bumpError := errors.New("failed to bump playbook timestamp")

		mockPropertyService.EXPECT().
			CreatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(bumpError)

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to bump playbook timestamp")
		assert.Nil(t, result)
	})
}

func TestPlaybookService_UpdatePropertyField(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockConditionService := mock_app.NewMockConditionService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil,
		nil, // pluginAPI
		&metrics.Metrics{},
		mockPropertyService,
		mockConditionService,
	)

	playbookID := "playbook123"
	propertyField := app.PropertyField{
		PropertyField: model.PropertyField{
			ID:   "prop123",
			Name: "Updated Field",
			Type: model.PropertyFieldTypeText,
		},
	}

	t.Run("success - property field updated and playbook updated", func(t *testing.T) {
		expectedField := &app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   "prop123",
				Name: "Updated Field",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(nil, expectedError)

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.Equal(t, expectedError, err)
		assert.Nil(t, result)
	})

	t.Run("bump fails after property update", func(t *testing.T) {
		expectedField := &app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   "prop123",
				Name: "Updated Field",
				Type: model.PropertyFieldTypeText,
			},
		}
		bumpError := errors.New("failed to bump playbook timestamp")

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(bumpError)

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to bump playbook timestamp")
		assert.Nil(t, result)
	})
}

func TestPlaybookService_DeletePropertyField(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockConditionService := mock_app.NewMockConditionService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil,
		nil, // pluginAPI
		&metrics.Metrics{},
		mockPropertyService,
		mockConditionService,
	)

	playbookID := "playbook123"
	propertyID := "prop123"

	t.Run("success - property field deleted and playbook updated", func(t *testing.T) {
		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		err := service.DeletePropertyField(playbookID, propertyID)

		require.NoError(t, err)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(expectedError)

		err := service.DeletePropertyField(playbookID, propertyID)

		require.Error(t, err)
		assert.Equal(t, expectedError, err)
	})

	t.Run("bump fails after property deletion", func(t *testing.T) {
		bumpError := errors.New("failed to bump playbook timestamp")

		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(bumpError)

		err := service.DeletePropertyField(playbookID, propertyID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to bump playbook timestamp")
	})
}

func TestPlaybookService_Duplicate(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockConditionService := mock_app.NewMockConditionService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	mockAuditor.EXPECT().
		MakeAuditRecord(gomock.Any(), gomock.Any()).
		Return(&model.AuditRecord{}).
		AnyTimes()

	mockAuditor.EXPECT().
		LogAuditRec(gomock.Any()).
		AnyTimes()

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil,
		mockAuditor,
		nil, // metrics
		mockPropertyService,
		mockConditionService,
	)

	userID := model.NewId()
	originalPlaybookID := model.NewId()
	teamID := model.NewId()

	originalPlaybook := app.Playbook{
		ID:    originalPlaybookID,
		Title: "Original Playbook",
		TeamID: teamID,
	}

	t.Run("successfully duplicates playbook with properties and conditions", func(t *testing.T) {
		var capturedPlaybookID string

		propertyMappings := &app.PropertyCopyResult{
			FieldMappings:  map[string]string{"field1": "field2"},
			OptionMappings: map[string]string{"opt1": "opt2"},
		}

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			DoAndReturn(func(sourceID, targetID string) (*app.PropertyCopyResult, error) {
				capturedPlaybookID = targetID
				return propertyMappings, nil
			})

		mockConditionService.EXPECT().
			CopyPlaybookConditionsToPlaybook(originalPlaybookID, gomock.Any(), propertyMappings).
			DoAndReturn(func(sourceID, targetID string, mappings *app.PropertyCopyResult) (map[string]*app.Condition, error) {
				assert.Equal(t, capturedPlaybookID, targetID)
				return map[string]*app.Condition{}, nil
			})

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				assert.Equal(t, "Copy of Original Playbook", pb.Title)
				assert.Equal(t, teamID, pb.TeamID)
				assert.Len(t, pb.Members, 1)
				assert.Equal(t, userID, pb.Members[0].UserID)
				assert.NotEmpty(t, pb.ID)
				assert.Equal(t, capturedPlaybookID, pb.ID)
				return pb.ID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.Equal(t, capturedPlaybookID, resultID)
	})

	t.Run("duplicates playbook even if property copying fails", func(t *testing.T) {
		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(nil, errors.New("property copy failed"))

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return pb.ID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})

	t.Run("duplicates playbook even if condition copying fails", func(t *testing.T) {
		propertyMappings := &app.PropertyCopyResult{
			FieldMappings:  map[string]string{},
			OptionMappings: map[string]string{},
		}

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(propertyMappings, nil)

		mockConditionService.EXPECT().
			CopyPlaybookConditionsToPlaybook(originalPlaybookID, gomock.Any(), propertyMappings).
			Return(nil, errors.New("condition copy failed"))

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return pb.ID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})

	t.Run("fails if playbook creation fails", func(t *testing.T) {
		expectedError := errors.New("database error")

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(&app.PropertyCopyResult{}, nil)

		mockConditionService.EXPECT().
			CopyPlaybookConditionsToPlaybook(originalPlaybookID, gomock.Any(), gomock.Any()).
			Return(map[string]*app.Condition{}, nil)

		mockStore.EXPECT().
			Create(gomock.Any()).
			Return("", expectedError)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.Error(t, err)
		assert.Equal(t, "", resultID)
		assert.Equal(t, expectedError, err)
	})

	t.Run("does not copy conditions if property copying fails", func(t *testing.T) {
		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(nil, errors.New("property copy failed"))

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return pb.ID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})
}
