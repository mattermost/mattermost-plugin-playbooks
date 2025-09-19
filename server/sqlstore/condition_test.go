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
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_ = setupTables(t, db)
		conditionStore, playbookStore := setupConditionStore(t, db)

		t.Run("create and get condition", func(t *testing.T) {
			conditionID := model.NewId()

			// Create test playbook first
			playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
			playbookID, err := playbookStore.Create(playbook)
			require.NoError(t, err)

			condition := app.StoredCondition{
				Condition: app.Condition{
					ID:         conditionID,
					PlaybookID: playbookID,
					RunID:      "",
					ConditionExpr: app.ConditionExpr{
						Is: &app.ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id", "high_id"]`),
						},
					},
					CreateAt: 1234567890,
					UpdateAt: 1234567890,
					DeleteAt: 0,
				},
				PropertyFieldIDs:   []string{"severity_id"},
				PropertyOptionsIDs: []string{"critical_id", "high_id"},
			}

			created, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)
			require.NotNil(t, created)
			require.NotEmpty(t, created.ID)
			require.Equal(t, playbookID, created.PlaybookID)
			require.Equal(t, condition.PropertyFieldIDs, created.PropertyFieldIDs)
			require.Equal(t, condition.PropertyOptionsIDs, created.PropertyOptionsIDs)

			retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
			require.NoError(t, err)
			require.NotNil(t, retrieved)
			require.Equal(t, created.ID, retrieved.ID)
			require.Equal(t, playbookID, retrieved.PlaybookID)
			require.Equal(t, condition.PropertyFieldIDs, retrieved.PropertyFieldIDs)
			require.Equal(t, condition.PropertyOptionsIDs, retrieved.PropertyOptionsIDs)
		})

		t.Run("create condition with complex nested expression", func(t *testing.T) {
			// Create test playbook first
			playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
			playbookID, err := playbookStore.Create(playbook)
			require.NoError(t, err)

			condition := app.StoredCondition{
				Condition: app.Condition{
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
											Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
										},
									},
								},
							},
						},
					},
					CreateAt: 1234567890,
					UpdateAt: 1234567890,
				},
				PropertyFieldIDs:   []string{"severity_id", "acknowledged_id", "categories_id"},
				PropertyOptionsIDs: []string{"critical_id", "cat_a_id", "cat_b_id"},
			}

			created, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)
			require.NotNil(t, created)

			retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
			require.NoError(t, err)
			require.NotNil(t, retrieved)
			require.Len(t, retrieved.PropertyFieldIDs, 3)
			require.Len(t, retrieved.PropertyOptionsIDs, 3)
			require.Contains(t, retrieved.PropertyFieldIDs, "severity_id")
			require.Contains(t, retrieved.PropertyFieldIDs, "acknowledged_id")
			require.Contains(t, retrieved.PropertyFieldIDs, "categories_id")
			require.Contains(t, retrieved.PropertyOptionsIDs, "critical_id")
			require.Contains(t, retrieved.PropertyOptionsIDs, "cat_a_id")
			require.Contains(t, retrieved.PropertyOptionsIDs, "cat_b_id")
		})

		t.Run("update condition", func(t *testing.T) {
			// Create test playbook first
			playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
			playbookID, err := playbookStore.Create(playbook)
			require.NoError(t, err)

			condition := app.StoredCondition{
				Condition: app.Condition{
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
				},
				PropertyFieldIDs:   []string{"severity_id"},
				PropertyOptionsIDs: []string{"low_id"},
			}

			created, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)

			// Update the condition
			created.ConditionExpr = app.ConditionExpr{
				IsNot: &app.ComparisonCondition{
					FieldID: "status_id",
					Value:   json.RawMessage(`["closed_id", "archived_id"]`),
				},
			}
			created.PropertyFieldIDs = []string{"status_id"}
			created.PropertyOptionsIDs = []string{"closed_id", "archived_id"}

			updated, err := conditionStore.UpdateCondition(playbookID, *created)
			require.NoError(t, err)
			require.NotNil(t, updated)
			require.Equal(t, created.ID, updated.ID)
			require.GreaterOrEqual(t, updated.UpdateAt, created.UpdateAt)
			require.Equal(t, []string{"status_id"}, updated.PropertyFieldIDs)
			require.Equal(t, []string{"closed_id", "archived_id"}, updated.PropertyOptionsIDs)

			// Verify changes persisted
			retrieved, err := conditionStore.GetCondition(playbookID, created.ID)
			require.NoError(t, err)
			require.Equal(t, updated.PropertyFieldIDs, retrieved.PropertyFieldIDs)
			require.Equal(t, updated.PropertyOptionsIDs, retrieved.PropertyOptionsIDs)
		})

		t.Run("delete condition", func(t *testing.T) {
			// Create test playbook first
			playbook := NewPBBuilder().WithTitle("Test Playbook").ToPlaybook()
			playbookID, err := playbookStore.Create(playbook)
			require.NoError(t, err)

			condition := app.StoredCondition{
				Condition: app.Condition{
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
				},
				PropertyFieldIDs:   []string{"priority_id"},
				PropertyOptionsIDs: []string{"urgent_id"},
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
			conditions := []app.StoredCondition{
				{
					Condition: app.Condition{
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
					PropertyFieldIDs:   []string{"severity_id"},
					PropertyOptionsIDs: []string{"critical_id"},
				},
				{
					Condition: app.Condition{
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
					PropertyFieldIDs:   []string{"status_id"},
					PropertyOptionsIDs: []string{"closed_id"},
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
			playbookCondition := app.StoredCondition{
				Condition: app.Condition{
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
				},
				PropertyFieldIDs:   []string{"severity_id"},
				PropertyOptionsIDs: []string{"high_id"},
			}

			runCondition := app.StoredCondition{
				Condition: app.Condition{
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
				},
				PropertyFieldIDs:   []string{"status_id"},
				PropertyOptionsIDs: []string{"resolved_id"},
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

			condition := app.StoredCondition{
				Condition: app.Condition{
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
				},
				PropertyFieldIDs:   []string{"test_field"},
				PropertyOptionsIDs: []string{"test_value"},
			}

			created, err := conditionStore.CreateCondition(playbookID, condition)
			require.NoError(t, err)
			require.NotEmpty(t, created.ID)
			require.Len(t, created.ID, 26) // Mattermost ID length
		})
	}
}
