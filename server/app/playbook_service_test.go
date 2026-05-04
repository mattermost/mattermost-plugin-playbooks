// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app_test

import (
	"encoding/json"
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
	"gopkg.in/guregu/null.v4"
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
		ID:     originalPlaybookID,
		Title:  "Original Playbook",
		TeamID: teamID,
	}

	t.Run("successfully duplicates playbook with properties and conditions", func(t *testing.T) {
		var capturedPlaybookID string

		propertyMappings := &app.PropertyCopyResult{
			FieldMappings:  map[string]string{"field1": "field2"},
			OptionMappings: map[string]string{"opt1": "opt2"},
		}

		conditionMapping := map[string]*app.Condition{
			"old_cond_id": {ID: "new_cond_id"},
		}

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				assert.Equal(t, "Copy of Original Playbook", pb.Title)
				assert.Equal(t, teamID, pb.TeamID)
				assert.Len(t, pb.Members, 1)
				assert.Equal(t, userID, pb.Members[0].UserID)
				capturedPlaybookID = model.NewId()
				return capturedPlaybookID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			DoAndReturn(func(sourceID, targetID string) (*app.PropertyCopyResult, error) {
				assert.Equal(t, capturedPlaybookID, targetID)
				return propertyMappings, nil
			})

		mockConditionService.EXPECT().
			CopyPlaybookConditionsToPlaybook(originalPlaybookID, gomock.Any(), propertyMappings).
			DoAndReturn(func(sourceID, targetID string, mappings *app.PropertyCopyResult) (map[string]*app.Condition, error) {
				assert.Equal(t, capturedPlaybookID, targetID)
				return conditionMapping, nil
			})

		// Mock Get for updating condition IDs
		mockStore.EXPECT().
			Get(gomock.Any()).
			DoAndReturn(func(id string) (app.Playbook, error) {
				assert.Equal(t, capturedPlaybookID, id)
				pb := originalPlaybook
				pb.ID = id
				return pb, nil
			})

		// Mock Update for saving condition IDs
		mockStore.EXPECT().
			Update(gomock.Any()).
			Return(nil)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.Equal(t, capturedPlaybookID, resultID)
	})

	t.Run("duplicates playbook even if property copying fails", func(t *testing.T) {
		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return model.NewId(), nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(nil, errors.New("property copy failed"))

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})

	t.Run("duplicates playbook even if condition copying fails", func(t *testing.T) {
		propertyMappings := &app.PropertyCopyResult{
			FieldMappings:  map[string]string{},
			OptionMappings: map[string]string{},
		}

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return model.NewId(), nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(propertyMappings, nil)

		mockConditionService.EXPECT().
			CopyPlaybookConditionsToPlaybook(originalPlaybookID, gomock.Any(), propertyMappings).
			Return(nil, errors.New("condition copy failed"))

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})

	t.Run("fails if playbook creation fails", func(t *testing.T) {
		expectedError := errors.New("database error")

		mockStore.EXPECT().
			Create(gomock.Any()).
			Return("", expectedError)

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.Error(t, err)
		assert.Equal(t, "", resultID)
		assert.Equal(t, expectedError, err)
	})

	t.Run("does not copy conditions if property copying fails", func(t *testing.T) {
		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return model.NewId(), nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		mockPropertyService.EXPECT().
			CopyPlaybookPropertiesToPlaybook(originalPlaybookID, gomock.Any()).
			Return(nil, errors.New("property copy failed"))

		resultID, err := service.Duplicate(originalPlaybook, userID)

		require.NoError(t, err)
		assert.NotEmpty(t, resultID)
	})
}

func TestPlaybookService_Import(t *testing.T) {
	userID := model.NewId()
	newPlaybookID := model.NewId()

	basePlaybook := app.Playbook{
		Title:       "Test Playbook",
		Description: "Test Description",
		Checklists: []app.Checklist{
			{
				Title: "Checklist 1",
				Items: []app.ChecklistItem{
					{
						Title:       "Item with condition",
						ConditionID: "old-cond-1",
					},
				},
			},
		},
	}

	baseExportProperty := app.ExportPropertyField{
		ID:   "old-prop-1",
		Name: "Status",
		Type: model.PropertyFieldTypeSelect,
		Attrs: app.Attrs{
			Visibility: app.PropertyFieldVisibilityAlways,
			Options: model.PropertyOptions[*model.PluginPropertyOption]{
				model.NewPluginPropertyOption("opt-1", "Active"),
				model.NewPluginPropertyOption("opt-2", "Inactive"),
			},
		},
	}

	t.Run("successfully imports playbook with properties and conditions", func(t *testing.T) {
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

		oldFieldID := "old-prop-1"
		newFieldID := "new-prop-1"
		oldChildFieldID := "old-prop-child"
		newChildFieldID := "new-prop-child"
		oldOptionID := "old-opt-1"
		newOptionID := "new-opt-1"
		oldConditionID := "old-cond-1"
		newConditionID := "new-cond-1"

		exportProperties := []app.ExportPropertyField{
			{
				ID:   oldFieldID,
				Name: "Status",
				Type: model.PropertyFieldTypeSelect,
				Attrs: app.Attrs{
					Visibility: app.PropertyFieldVisibilityAlways,
					Options: model.PropertyOptions[*model.PluginPropertyOption]{
						model.NewPluginPropertyOption(oldOptionID, "Active"),
					},
				},
			},
			{
				ID:   oldChildFieldID,
				Name: "SubStatus",
				Type: model.PropertyFieldTypeText,
				Attrs: app.Attrs{
					Visibility: app.PropertyFieldVisibilityAlways,
					ParentID:   oldFieldID,
				},
			},
		}

		exportConditions := []app.ExportCondition{{
			ID:      oldConditionID,
			Version: 1,
			ConditionExpr: &app.ConditionExprV1{
				Is: &app.ComparisonCondition{
					FieldID: oldFieldID,
					Value:   json.RawMessage(`["` + oldOptionID + `"]`),
				},
			},
		}}

		playbook := app.Playbook{
			Title: "Test",
			Checklists: []app.Checklist{{
				Title: "CL",
				Items: []app.ChecklistItem{{
					Title:           "Conditional task",
					ConditionID:     oldConditionID,
					ConditionAction: app.ConditionActionHidden,
				}},
			}},
		}

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				assert.Empty(t, pb.Checklists[0].Items[0].ConditionID,
					"ConditionID should be cleared before Create")
				assert.Empty(t, pb.Checklists[0].Items[0].ConditionAction,
					"ConditionAction should be cleared before Create")
				return newPlaybookID, nil
			})
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		createdField := &app.PropertyField{
			PropertyField: model.PropertyField{ID: newFieldID, Name: "Status", Type: model.PropertyFieldTypeSelect},
			Attrs: app.Attrs{
				Visibility: app.PropertyFieldVisibilityAlways,
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption(newOptionID, "Active"),
				},
			},
		}
		createdChildField := &app.PropertyField{
			PropertyField: model.PropertyField{ID: newChildFieldID, Name: "SubStatus", Type: model.PropertyFieldTypeText},
			Attrs: app.Attrs{
				Visibility: app.PropertyFieldVisibilityAlways,
				ParentID:   oldFieldID, // still has old parent ID before remap
			},
		}

		firstCreate := mockPropertyService.EXPECT().CreatePropertyField(newPlaybookID, gomock.Any()).Return(createdField, nil)
		mockPropertyService.EXPECT().CreatePropertyField(newPlaybookID, gomock.Any()).Return(createdChildField, nil).After(firstCreate)

		mockPropertyService.EXPECT().
			UpdatePropertyField(newPlaybookID, gomock.Any()).
			DoAndReturn(func(pbID string, field app.PropertyField) (*app.PropertyField, error) {
				assert.Equal(t, newChildFieldID, field.ID, "should update the child field")
				assert.Equal(t, newFieldID, field.Attrs.ParentID, "ParentID should be remapped to new field ID")
				return &field, nil
			})

		mockConditionService.EXPECT().
			CreateConditionsFromExport(newPlaybookID, exportConditions, gomock.Any()).
			DoAndReturn(func(pbID string, conds []app.ExportCondition, mappings *app.PropertyCopyResult) (map[string]*app.Condition, error) {
				assert.Contains(t, mappings.FieldMappings, oldFieldID, "field mappings should contain old field ID")
				assert.Equal(t, newFieldID, mappings.FieldMappings[oldFieldID], "field mapping should be old->new")
				assert.Contains(t, mappings.OptionMappings, oldOptionID, "option mappings should contain old option ID")
				assert.Equal(t, newOptionID, mappings.OptionMappings[oldOptionID], "option mapping should be old->new")

				return map[string]*app.Condition{
					oldConditionID: {ID: newConditionID},
				}, nil
			})

		// Get returns the playbook as stored (with cleared ConditionIDs)
		storedPlaybook := app.Playbook{
			Title: "Test",
			Checklists: []app.Checklist{{
				Title: "CL",
				Items: []app.ChecklistItem{{
					Title:       "Conditional task",
					ConditionID: "",
				}},
			}},
		}
		mockStore.EXPECT().Get(newPlaybookID).Return(storedPlaybook, nil)

		mockStore.EXPECT().
			Update(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) error {
				assert.Equal(t, newConditionID, pb.Checklists[0].Items[0].ConditionID,
					"checklist item ConditionID should be remapped to new condition ID")
				assert.Equal(t, app.ConditionActionHidden, pb.Checklists[0].Items[0].ConditionAction,
					"checklist item ConditionAction should be restored after remap")
				return nil
			})

		resultID, err := service.Import(app.PlaybookImportData{
			Playbook:   playbook,
			Properties: exportProperties,
			Conditions: exportConditions,
		}, userID)
		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, resultID)
	})

	t.Run("returns early if no properties or conditions", func(t *testing.T) {
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

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return newPlaybookID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), basePlaybook.TeamID)

		resultID, err := service.Import(app.PlaybookImportData{
			Playbook:   basePlaybook,
			Properties: []app.ExportPropertyField{},
			Conditions: []app.ExportCondition{},
		}, userID)

		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, resultID)
	})

	t.Run("gracefully handles property creation failure", func(t *testing.T) {
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

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(pb app.Playbook) (string, error) {
				return newPlaybookID, nil
			})

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), basePlaybook.TeamID)

		mockPropertyService.EXPECT().
			CreatePropertyField(newPlaybookID, gomock.Any()).
			Return(nil, errors.New("property creation failed"))

		resultID, err := service.Import(app.PlaybookImportData{
			Playbook:   basePlaybook,
			Properties: []app.ExportPropertyField{baseExportProperty},
			Conditions: []app.ExportCondition{},
		}, userID)

		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, resultID)
	})

	t.Run("skips conditions when all property creations fail", func(t *testing.T) {
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
			nil,
			mockPropertyService,
			mockConditionService,
		)

		mockStore.EXPECT().
			Create(gomock.Any()).
			Return(newPlaybookID, nil)

		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), gomock.Any())

		mockPropertyService.EXPECT().
			CreatePropertyField(newPlaybookID, gomock.Any()).
			Return(nil, errors.New("property creation failed"))

		resultID, err := service.Import(app.PlaybookImportData{
			Playbook:   basePlaybook,
			Properties: []app.ExportPropertyField{baseExportProperty},
			Conditions: []app.ExportCondition{{
				ID:      "cond-1",
				Version: 1,
				ConditionExpr: &app.ConditionExprV1{
					Is: &app.ComparisonCondition{
						FieldID: "old-prop-1",
						Value:   json.RawMessage(`["opt-1"]`),
					},
				},
			}},
		}, userID)

		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, resultID)
	})

	t.Run("strips metric IDs before create", func(t *testing.T) {
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
			nil,
			mockPropertyService,
			mockConditionService,
		)

		foreignID := "metric_id_from_another_playbook"
		pb := basePlaybook
		pb.Metrics = []app.PlaybookMetricConfig{
			{ID: foreignID, Title: "m1", Type: app.MetricTypeInteger, Description: "d", Target: null.IntFrom(1)},
		}

		mockStore.EXPECT().
			Create(gomock.Any()).
			DoAndReturn(func(created app.Playbook) (string, error) {
				require.Empty(t, created.Metrics[0].ID, "import must strip metric IDs so Create only inserts new metrics")
				return newPlaybookID, nil
			})
		mockPoster.EXPECT().PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), basePlaybook.TeamID)

		resultID, err := service.Import(app.PlaybookImportData{Playbook: pb}, userID)
		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, resultID)
	})
}

func TestPlaybookService_ValidateNewChannelOnlyMode(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStore := mock_app.NewMockPlaybookStore(ctrl)
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
		nil,
		nil,
	)

	userID := model.NewId()
	teamID := model.NewId()

	t.Run("Create rejects NewChannelOnly=true with ChannelMode=LinkExistingChannel", func(t *testing.T) {
		playbook := app.Playbook{
			Title:          "Test Playbook",
			TeamID:         teamID,
			NewChannelOnly: true,
			ChannelMode:    app.PlaybookRunLinkExistingChannel,
		}

		_, err := service.Create(playbook, userID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "link an existing channel")
	})

	t.Run("Create allows NewChannelOnly=true with ChannelMode=CreateNewChannel", func(t *testing.T) {
		newPlaybookID := model.NewId()
		playbook := app.Playbook{
			Title:          "Test Playbook",
			TeamID:         teamID,
			NewChannelOnly: true,
			ChannelMode:    app.PlaybookRunCreateNewChannel,
		}

		mockStore.EXPECT().
			Create(gomock.Any()).
			Return(newPlaybookID, nil)
		mockPoster.EXPECT().
			PublishWebsocketEventToTeam(gomock.Any(), gomock.Any(), teamID)

		id, err := service.Create(playbook, userID)
		require.NoError(t, err)
		assert.Equal(t, newPlaybookID, id)
	})

	t.Run("Update rejects NewChannelOnly=true with ChannelMode=LinkExistingChannel", func(t *testing.T) {
		playbook := app.Playbook{
			ID:             model.NewId(),
			Title:          "Test Playbook",
			TeamID:         teamID,
			NewChannelOnly: true,
			ChannelMode:    app.PlaybookRunLinkExistingChannel,
		}

		err := service.Update(playbook, userID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "link an existing channel")
	})

	t.Run("Update allows NewChannelOnly=true with ChannelMode=CreateNewChannel", func(t *testing.T) {
		playbookID := model.NewId()
		playbook := app.Playbook{
			ID:             playbookID,
			Title:          "Test Playbook",
			TeamID:         teamID,
			NewChannelOnly: true,
			ChannelMode:    app.PlaybookRunCreateNewChannel,
		}

		mockStore.EXPECT().
			Update(gomock.Any()).
			Return(nil)

		err := service.Update(playbook, userID)
		require.NoError(t, err)
	})

	t.Run("Import rejects NewChannelOnly=true with ChannelMode=LinkExistingChannel", func(t *testing.T) {
		playbook := app.Playbook{
			Title:          "Test Playbook",
			TeamID:         teamID,
			NewChannelOnly: true,
			ChannelMode:    app.PlaybookRunLinkExistingChannel,
		}

		_, err := service.Import(app.PlaybookImportData{Playbook: playbook}, userID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "link an existing channel")
	})
}
