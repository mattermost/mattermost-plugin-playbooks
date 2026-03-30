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
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil, // api client
		nil, // pluginAPI
		&metrics.Metrics{},
		mockPropertyService,
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

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			CreatePropertyField(playbookID, propertyField).
			Return(nil, expectedError)

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.ErrorIs(t, err, expectedError)
		assert.Nil(t, result)
	})

	t.Run("bump fails - still succeeds with warning log", func(t *testing.T) {
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

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		result, err := service.CreatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})
}

func TestPlaybookService_UpdatePropertyField(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil,
		nil, // pluginAPI
		&metrics.Metrics{},
		mockPropertyService,
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
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{propertyField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{propertyField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(nil, expectedError)

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.Error(t, err)
		assert.ErrorContains(t, err, expectedError.Error())
		assert.Nil(t, result)
	})

	t.Run("bump fails - still succeeds with warning log", func(t *testing.T) {
		expectedField := &app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   "prop123",
				Name: "Updated Field",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{propertyField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, propertyField).
			Return(expectedField, nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(errors.New("failed to bump playbook timestamp"))

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		result, err := service.UpdatePropertyField(playbookID, propertyField)

		require.NoError(t, err)
		assert.Equal(t, expectedField, result)
	})
}

func TestPlaybookService_DeletePropertyField(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewPlaybookService(
		mockStore,
		mockPoster,
		nil,
		nil, // pluginAPI
		&metrics.Metrics{},
		mockPropertyService,
	)

	playbookID := "playbook123"
	propertyID := "prop123"

	t.Run("success - property field deleted and playbook updated", func(t *testing.T) {
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{{PropertyField: model.PropertyField{ID: propertyID, Name: "SomeField"}}}, nil)

		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(nil)

		mockStore.EXPECT().
			UpdateChannelNameTemplateAtomically(playbookID, gomock.Any()).
			Return(nil)

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		err := service.DeletePropertyField(playbookID, propertyID)

		require.NoError(t, err)
	})

	t.Run("property service error - no bump called", func(t *testing.T) {
		expectedError := errors.New("property service error")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{{PropertyField: model.PropertyField{ID: propertyID, Name: "SomeField"}}}, nil)

		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(expectedError)

		err := service.DeletePropertyField(playbookID, propertyID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "property service error")
	})

	t.Run("strip fails after property deletion", func(t *testing.T) {
		stripError := errors.New("failed to strip field from name templates")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{{PropertyField: model.PropertyField{ID: propertyID, Name: "SomeField"}}}, nil)

		mockPropertyService.EXPECT().
			DeletePropertyField(playbookID, propertyID).
			Return(nil)

		mockStore.EXPECT().
			UpdateChannelNameTemplateAtomically(playbookID, gomock.Any()).
			Return(stripError)

		err := service.DeletePropertyField(playbookID, propertyID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to update name templates after field delete cascade")
	})
}
