// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app_test

import (
	"encoding/json"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestConditionService_Create_Limit(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()

	condition := &app.Condition{
		PlaybookID: playbookID,
		ConditionExpr: app.ConditionExpr{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success when under limit", func(t *testing.T) {
		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return under limit
		mockStore.EXPECT().
			GetConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook-1, nil)

		// Mock successful creation
		createdCondition := *condition
		createdCondition.ID = model.NewId()
		createdCondition.CreateAt = model.GetMillis()
		createdCondition.UpdateAt = model.GetMillis()

		mockStore.EXPECT().
			CreateCondition(playbookID, gomock.Any()).
			Return(&createdCondition, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("condition_created", &createdCondition, teamID)

		result, err := service.Create(userID, *condition, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, createdCondition.ID, result.ID)
	})

	t.Run("failure when at limit", func(t *testing.T) {
		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return at limit
		mockStore.EXPECT().
			GetConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook, nil)

		result, err := service.Create(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})

	t.Run("failure when over limit", func(t *testing.T) {
		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return over limit
		mockStore.EXPECT().
			GetConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook+5, nil)

		result, err := service.Create(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})
}
