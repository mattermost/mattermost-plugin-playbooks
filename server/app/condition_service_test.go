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
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()

	condition := &app.Condition{
		PlaybookID: playbookID,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success when under limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return under limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
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

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, createdCondition.ID, result.ID)
	})

	t.Run("failure when at limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return at limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook, nil)

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})

	t.Run("failure when over limit", func(t *testing.T) {
		// Mock audit record creation and logging
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("createCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		// Mock property service to return empty fields (no validation issues)
		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		// Mock count to return over limit
		mockStore.EXPECT().
			GetPlaybookConditionCount(playbookID).
			Return(app.MaxConditionsPerPlaybook+5, nil)

		result, err := service.CreatePlaybookCondition(userID, *condition, teamID)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "cannot create condition: playbook already has the maximum allowed number of conditions")
		require.Contains(t, err.Error(), "1000")
	})
}

func TestConditionService_Update(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()
	conditionID := model.NewId()

	existingCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   model.GetMillis() - 1000,
		UpdateAt:   model.GetMillis() - 1000,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["low_id"]`),
			},
		},
	}

	updatedCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   existingCondition.CreateAt,
		UpdateAt:   model.GetMillis(),
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success update", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("updateCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingCondition, nil)

		mockPropertyService.EXPECT().
			GetPropertyFields(playbookID).
			Return([]app.PropertyField{}, nil)

		mockStore.EXPECT().
			UpdateCondition(playbookID, gomock.Any()).
			Return(updatedCondition, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("condition_updated", updatedCondition, teamID)

		result, err := service.UpdatePlaybookCondition(userID, *updatedCondition, teamID)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, conditionID, result.ID)
	})
}

func TestConditionService_Delete(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockConditionStore(ctrl)
	mockPropertyService := mock_app.NewMockPropertyService(ctrl)
	mockPoster := mock_bot.NewMockPoster(ctrl)
	mockAuditor := mock_app.NewMockAuditor(ctrl)

	service := app.NewConditionService(mockStore, mockPropertyService, mockPoster, mockAuditor)

	playbookID := model.NewId()
	teamID := model.NewId()
	userID := model.NewId()
	conditionID := model.NewId()

	existingCondition := &app.Condition{
		ID:         conditionID,
		PlaybookID: playbookID,
		CreateAt:   model.GetMillis() - 1000,
		UpdateAt:   model.GetMillis() - 1000,
		ConditionExpr: &app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		},
	}

	t.Run("success delete", func(t *testing.T) {
		auditRec := &model.AuditRecord{}
		mockAuditor.EXPECT().
			MakeAuditRecord("deleteCondition", model.AuditStatusFail).
			Return(auditRec)
		mockAuditor.EXPECT().
			LogAuditRec(auditRec)

		mockStore.EXPECT().
			GetCondition(playbookID, conditionID).
			Return(existingCondition, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam("condition_deleted", existingCondition, teamID)

		mockStore.EXPECT().
			DeleteCondition(playbookID, conditionID).
			Return(nil)

		err := service.DeletePlaybookCondition(userID, playbookID, conditionID, teamID)
		require.NoError(t, err)
	})
}
