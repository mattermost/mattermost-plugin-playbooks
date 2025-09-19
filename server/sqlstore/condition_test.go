// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
)

func setupConditionStore(t *testing.T, db *sqlx.DB) (app.ConditionStore, app.PlaybookStore) {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)
	conditionStore := NewConditionStore(pluginAPIClient, sqlStore)
	playbookStore := NewPlaybookStore(pluginAPIClient, sqlStore)

	return conditionStore, playbookStore
}

func TestConditionStore(t *testing.T) {
	db := setupTestDB(t)
	_ = setupTables(t, db)
	conditionStore, playbookStore := setupConditionStore(t, db)

	t.Run("create and get condition", func(t *testing.T) {
		conditionID := model.NewId()

		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         conditionID,
			PlaybookID: playbookID,
			RunID:      "",
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id","high_id"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
			DeleteAt: 0,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)
		require.NotEmpty(t, created.ID)
		require.Equal(t, playbookID, created.PlaybookID)
		require.Equal(t, condition.ConditionExpr, created.ConditionExpr)

		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.Equal(t, created.ID, retrieved.ID)
		require.Equal(t, playbookID, retrieved.PlaybookID)
		require.Equal(t, condition.ConditionExpr, retrieved.ConditionExpr)
	})

	t.Run("create condition with complex nested expression", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				And: []app.ConditionExpr{
					{
						Is: &app.ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id"]`),
						},
					},
					{
						Or: []app.ConditionExpr{
							{
								IsNot: &app.ComparisonCondition{
									FieldID: "acknowledged_id",
									Value:   json.RawMessage(`"true"`),
								},
							},
							{
								Is: &app.ComparisonCondition{
									FieldID: "categories_id",
									Value:   json.RawMessage(`["cat_a_id","cat_b_id"]`),
								},
							},
						},
					},
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)

		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.Equal(t, created.ID, retrieved.ID)
		require.Equal(t, playbookID, retrieved.PlaybookID)
		require.Equal(t, condition.ConditionExpr, retrieved.ConditionExpr)

		// Verify the complex nested structure is preserved
		require.NotNil(t, retrieved.ConditionExpr.And)
		require.Len(t, retrieved.ConditionExpr.And, 2)
		require.NotNil(t, retrieved.ConditionExpr.And[0].Is)
		require.Equal(t, "severity_id", retrieved.ConditionExpr.And[0].Is.FieldID)
		require.NotNil(t, retrieved.ConditionExpr.And[1].Or)
		require.Len(t, retrieved.ConditionExpr.And[1].Or, 2)
	})

	t.Run("update condition", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["low_id"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)

		// Update the condition
		created.ConditionExpr = app.ConditionExpr{
			IsNot: &app.ComparisonCondition{
				FieldID: "status_id",
				Value:   json.RawMessage(`["closed_id","archived_id"]`),
			},
		}

		updated, err := conditionStore.UpdateCondition(playbookID, *created)
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, created.ID, updated.ID)
		require.GreaterOrEqual(t, updated.UpdateAt, created.UpdateAt)
		require.Equal(t, "status_id", updated.ConditionExpr.IsNot.FieldID)

		// Verify changes persisted
		retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
		require.NoError(t, err)
		require.Equal(t, updated.ConditionExpr, retrieved.ConditionExpr)
	})

	t.Run("delete condition", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "priority_id",
					Value:   json.RawMessage(`["urgent_id"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)

		err = conditionStore.DeleteCondition(playbookID, created.ID)
		require.NoError(t, err)

		// Should not be retrievable after deletion
		_, err = conditionStore.GetCondition(playbookID, created.ID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition not found")
	})

	t.Run("get multiple conditions", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create multiple conditions
		conditions := []app.Condition{
			{
				ID:         model.NewId(),
				PlaybookID: playbookID,
				ConditionExpr: app.ConditionExpr{
					Is: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				CreateAt: 1000,
				UpdateAt: 1000,
			},
			{
				ID:         model.NewId(),
				PlaybookID: playbookID,
				ConditionExpr: app.ConditionExpr{
					IsNot: &app.ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
				CreateAt: 2000,
				UpdateAt: 2000,
			},
		}

		for _, condition := range conditions {
			_, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)
		}

		retrieved, err := conditionStore.GetConditions(playbookID, app.ConditionFilterOptions{})
		require.NoError(t, err)
		require.Len(t, retrieved, 2)

		// Test pagination
		retrieved, err = conditionStore.GetConditions(playbookID, app.ConditionFilterOptions{
			PerPage: 1,
			Page:    0,
		})
		require.NoError(t, err)
		require.Len(t, retrieved, 1)
	})

	t.Run("get conditions with run filter", func(t *testing.T) {
		runID := model.NewId()

		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create conditions - one for playbook, one for run
		playbookCondition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      "",
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["high_id"]`),
				},
			},
			CreateAt: 1000,
			UpdateAt: 1000,
		}

		runCondition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			RunID:      runID,
			ConditionExpr: app.ConditionExpr{
				IsNot: &app.ComparisonCondition{
					FieldID: "status_id",
					Value:   json.RawMessage(`["resolved_id"]`),
				},
			},
			CreateAt: 2000,
			UpdateAt: 2000,
		}

		_, err = conditionStore.CreateCondition(playbookID, playbookCondition)
		require.NoError(t, err)
		_, err = conditionStore.CreateCondition(playbookID, runCondition)
		require.NoError(t, err)

		// Get all conditions (should return both)
		allConditions, err := conditionStore.GetConditions(playbookID, app.ConditionFilterOptions{})
		require.NoError(t, err)
		require.Len(t, allConditions, 2)

		// Get only run conditions
		runConditions, err := conditionStore.GetConditions(playbookID, app.ConditionFilterOptions{
			RunID: runID,
		})
		require.NoError(t, err)
		require.Len(t, runConditions, 1)
		require.Equal(t, runID, runConditions[0].RunID)
	})

	t.Run("condition not found error", func(t *testing.T) {
		playbookID := model.NewId()
		nonExistentID := model.NewId()

		_, err := conditionStore.GetCondition(playbookID, nonExistentID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition not found")
	})

	t.Run("auto-generate ID on create", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		condition := app.Condition{
			ID:         "", // Empty ID should be auto-generated
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "test_field",
					Value:   json.RawMessage(`["test_value"]`),
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotEmpty(t, created.ID)
		require.Len(t, created.ID, 26) // Mattermost ID length
	})

	t.Run("verify database storage of extracted field and option IDs", func(t *testing.T) {
		// Create test playbook first
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Create a complex condition with multiple fields and options
		condition := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				And: []app.ConditionExpr{
					{
						Is: &app.ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id","high_id"]`),
						},
					},
					{
						IsNot: &app.ComparisonCondition{
							FieldID: "status_id",
							Value:   json.RawMessage(`["closed_id","archived_id"]`),
						},
					},
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
		}

		// Store the condition
		created, err := conditionStore.CreateCondition(playbookID, condition)
		require.NoError(t, err)
		require.NotNil(t, created)

		// Manually query the database to check the JSON fields
		var result struct {
			PropertyFieldIDs   json.RawMessage `db:"propertyfieldids"`
			PropertyOptionsIDs json.RawMessage `db:"propertyoptionsids"`
		}
		query := "SELECT propertyfieldids, propertyoptionsids FROM IR_Condition WHERE id = $1"
		err = db.Get(&result, query, created.ID)
		require.NoError(t, err)

		// Parse the stored JSON and verify the extracted field IDs
		var fieldIDs []string
		err = json.Unmarshal(result.PropertyFieldIDs, &fieldIDs)
		require.NoError(t, err)
		require.Len(t, fieldIDs, 2)
		require.Contains(t, fieldIDs, "severity_id")
		require.Contains(t, fieldIDs, "status_id")

		// Parse the stored JSON and verify the extracted option IDs
		var optionIDs []string
		err = json.Unmarshal(result.PropertyOptionsIDs, &optionIDs)
		require.NoError(t, err)
		require.Len(t, optionIDs, 4)
		require.Contains(t, optionIDs, "critical_id")
		require.Contains(t, optionIDs, "high_id")
		require.Contains(t, optionIDs, "closed_id")
		require.Contains(t, optionIDs, "archived_id")
	})

	t.Run("get condition count", func(t *testing.T) {
		// Create test playbook
		playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// Initially should have 0 conditions
		count, err := conditionStore.GetConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 0, count)

		// Create first condition
		condition1 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				Is: &app.ComparisonCondition{
					FieldID: "severity_id",
					Value:   json.RawMessage(`["critical_id"]`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		_, err = conditionStore.CreateCondition(playbookID, condition1)
		require.NoError(t, err)

		// Should now have 1 condition
		count, err = conditionStore.GetConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		// Create second condition
		condition2 := app.Condition{
			ID:         model.NewId(),
			PlaybookID: playbookID,
			ConditionExpr: app.ConditionExpr{
				IsNot: &app.ComparisonCondition{
					FieldID: "status_id",
					Value:   json.RawMessage(`"resolved"`),
				},
			},
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}

		_, err = conditionStore.CreateCondition(playbookID, condition2)
		require.NoError(t, err)

		// Should now have 2 conditions
		count, err = conditionStore.GetConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 2, count)

		// Soft delete first condition
		err = conditionStore.DeleteCondition(playbookID, condition1.ID)
		require.NoError(t, err)

		// Should now have 1 condition (deleted ones don't count)
		count, err = conditionStore.GetConditionCount(playbookID)
		require.NoError(t, err)
		require.Equal(t, 1, count)
	})
}
