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

func TestPlaybookService_UpdatePropertyField_RenameCascade(t *testing.T) {
	const playbookID = "playbook-cascade-test"
	const fieldID = "field-abc"

	makeService := func(ctrl *gomock.Controller) (app.PlaybookService, *mock_app.MockPlaybookStore, *mock_app.MockPropertyService, *mock_bot.MockPoster) {
		mockStore := mock_app.NewMockPlaybookStore(ctrl)
		mockPropertyService := mock_app.NewMockPropertyService(ctrl)
		mockConditionService := mock_app.NewMockConditionService(ctrl)
		mockPoster := mock_bot.NewMockPoster(ctrl)

		svc := app.NewPlaybookService(
			mockStore,
			mockPoster,
			nil,
			nil,
			&metrics.Metrics{},
			mockPropertyService,
			mockConditionService,
		)
		return svc, mockStore, mockPropertyService, mockPoster
	}

	t.Run("field renamed - UpdateChannelNameTemplateAtomically called with transform fn", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService, mockPoster := makeService(ctrl)

		oldField := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "OldName",
				Type: model.PropertyFieldTypeText,
			},
		}
		updatedField := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "NewName",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{oldField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, updatedField).
			Return(&updatedField, nil)

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

		result, err := svc.UpdatePropertyField(playbookID, updatedField)

		require.NoError(t, err)
		assert.Equal(t, &updatedField, result)
	})

	t.Run("field name unchanged - UpdateChannelNameTemplateAtomically NOT called, BumpPlaybookUpdatedAt called", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService, mockPoster := makeService(ctrl)

		field := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "SameName",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{field}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, field).
			Return(&field, nil)

		// UpdateChannelNameTemplateAtomically must NOT be called — gomock will fail the test
		// if it is called because no expectation is registered for it.

		mockStore.EXPECT().
			BumpPlaybookUpdatedAt(playbookID).
			Return(nil)

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "team1")

		result, err := svc.UpdatePropertyField(playbookID, field)

		require.NoError(t, err)
		assert.Equal(t, &field, result)
	})

	t.Run("case-only rename triggers cascade", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService, mockPoster := makeService(ctrl)

		existingField := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "myfield",
				Type: model.PropertyFieldTypeText,
			},
		}
		updatePayload := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "MyField",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{existingField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, updatePayload).
			Return(&updatePayload, nil)

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

		result, err := svc.UpdatePropertyField(playbookID, updatePayload)

		require.NoError(t, err)
		assert.Equal(t, &updatePayload, result)
	})

	t.Run("UpdateChannelNameTemplateAtomically error propagates on rename", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService, _ := makeService(ctrl)

		oldField := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "Alpha",
				Type: model.PropertyFieldTypeText,
			},
		}
		newField := app.PropertyField{
			PropertyField: model.PropertyField{
				ID:   fieldID,
				Name: "Beta",
				Type: model.PropertyFieldTypeText,
			},
		}
		replaceErr := errors.New("db replace error")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{oldField}, nil)

		mockPropertyService.EXPECT().
			UpdatePropertyField(playbookID, newField).
			Return(&newField, nil)

		mockStore.EXPECT().
			UpdateChannelNameTemplateAtomically(playbookID, gomock.Any()).
			Return(replaceErr)

		result, err := svc.UpdatePropertyField(playbookID, newField)

		require.Error(t, err)
		assert.ErrorContains(t, err, "failed to update name templates after field rename cascade")
		assert.Nil(t, result)
	})

	t.Run("GetPropertyFields error propagates before any update", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		svc, mockStore, mockPropertyService, _ := makeService(ctrl)

		getErr := errors.New("store unavailable")

		mockStore.EXPECT().
			Get(playbookID).
			Return(app.Playbook{TeamID: "team1"}, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return(nil, getErr)

		// No further calls expected.

		result, err := svc.UpdatePropertyField(playbookID, app.PropertyField{
			PropertyField: model.PropertyField{ID: fieldID, Name: "Anything"},
		})

		require.Error(t, err)
		assert.ErrorContains(t, err, "failed to load existing fields for rename cascade check")
		assert.Nil(t, result)
	})
}
