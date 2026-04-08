// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlaybook_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		original Playbook
		expected []byte
		wantErr  bool
	}{
		{
			name: "marshals a struct with nil slices into empty arrays",
			original: Playbook{
				ID:                          "playbookid",
				Title:                       "the playbook title",
				Description:                 "the playbook's description",
				TeamID:                      "theteamid",
				CreatePublicPlaybookRun:     true,
				CreateAt:                    4503134,
				DeleteAt:                    0,
				NumStages:                   0,
				NumSteps:                    0,
				Checklists:                  nil,
				Members:                     nil,
				BroadcastChannelIDs:         []string{"channelid"},
				ReminderMessageTemplate:     "This is a message",
				ReminderTimerDefaultSeconds: 0,
				InvitedUserIDs:              nil,
				InvitedGroupIDs:             nil,
			},
			expected: []byte(`"checklists":[]`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with nil []checklistItems into an empty array",
			original: Playbook{
				ID:                      "playbookid",
				Title:                   "the playbook title",
				Description:             "the playbook's description",
				TeamID:                  "theteamid",
				CreatePublicPlaybookRun: true,
				CreateAt:                4503134,
				DeleteAt:                0,
				NumStages:               0,
				NumSteps:                0,
				Checklists: []Checklist{
					{
						ID:    "checklist1",
						Title: "checklist 1",
						Items: nil,
					},
				},
				BroadcastChannelIDs:          []string{},
				ReminderMessageTemplate:      "This is a message",
				ReminderTimerDefaultSeconds:  0,
				InvitedUserIDs:               nil,
				InvitedGroupIDs:              nil,
				WebhookOnStatusUpdateURLs:    []string{"testurl"},
				WebhookOnStatusUpdateEnabled: true,
			},
			expected: []byte(`"checklists":[{"id":"checklist1","title":"checklist 1","items":[],"items_order":null,"update_at":0}]`),
			wantErr:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.original)
			if (err != nil) != tt.wantErr {
				t.Errorf("MarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Contains(t, string(got), string(tt.expected))
		})
	}
}

func TestPlaybookFilterOptions_Clone(t *testing.T) {
	options := PlaybookFilterOptions{
		Page:      1,
		PerPage:   10,
		Sort:      SortByID,
		Direction: DirectionAsc,
	}
	marshalledOptions, err := json.Marshal(options)
	require.NoError(t, err)

	clone := options.Clone()
	clone.Page = 2
	clone.PerPage = 20
	clone.Sort = SortByName
	clone.Direction = DirectionDesc

	var unmarshalledOptions PlaybookFilterOptions
	err = json.Unmarshal(marshalledOptions, &unmarshalledOptions)
	require.NoError(t, err)
	require.Equal(t, options, unmarshalledOptions)
	require.NotEqual(t, clone, unmarshalledOptions)
}

func TestPlaybookFilterOptions_Validate(t *testing.T) {
	t.Run("non-positive PerPage", func(t *testing.T) {
		options := PlaybookFilterOptions{
			PerPage: -1,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, PerPageDefault, validOptions.PerPage)
	})

	t.Run("invalid sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Sort: SortField("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Sort: SortField("STAges"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, SortByStages, validOptions.Sort)
	})

	t.Run("valid, no explicit sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, SortByID, validOptions.Sort)
	})

	t.Run("invalid sort direction", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Direction: SortDirection("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case direction option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Direction: SortDirection("DEsC"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, DirectionDesc, validOptions.Direction)
	})

	t.Run("valid, no explicit direction", func(t *testing.T) {
		options := PlaybookFilterOptions{}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, DirectionAsc, validOptions.Direction)
	})

	t.Run("valid", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Page:      1,
			PerPage:   10,
			Sort:      SortByTitle,
			Direction: DirectionAsc,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options, validOptions)
	})
}

func TestChecklist_GetItemsOrder(t *testing.T) {
	checklist := Checklist{
		Items: []ChecklistItem{
			{ID: "item1"},
			{ID: "item2"},
		},
	}

	itemsOrder := checklist.GetItemsOrder()
	require.Equal(t, []string{"item1", "item2"}, itemsOrder)

	checklist.Items = []ChecklistItem{
		{ID: "item2"},
		{ID: "item1"},
	}

	itemsOrder = checklist.GetItemsOrder()
	require.Equal(t, []string{"item2", "item1"}, itemsOrder)

	checklist.Items = []ChecklistItem{}
	itemsOrder = checklist.GetItemsOrder()
	require.Nil(t, itemsOrder)
}

func TestCreationRule_Clone(t *testing.T) {
	t.Run("should deep-copy condition pointer", func(t *testing.T) {
		original := CreationRule{
			Condition: &ConditionExprV1{
				Is: &ComparisonCondition{
					FieldID: "field_1",
					Value:   json.RawMessage(`["opt_1"]`),
				},
			},
			SetOwnerID:    "owner_1",
			SetChannelID:  "channel_1",
			InviteUserIDs: []string{"user_1", "user_2"},
		}

		cloned := original.Clone()

		require.NotSame(t, original.Condition, cloned.Condition)
		require.Equal(t, original.Condition.Is.FieldID, cloned.Condition.Is.FieldID)
		require.Equal(t, original.SetOwnerID, cloned.SetOwnerID)
		require.Equal(t, original.InviteUserIDs, cloned.InviteUserIDs)

		cloned.Condition.Is.FieldID = "field_modified"
		cloned.InviteUserIDs[0] = "user_modified"

		require.Equal(t, "field_1", original.Condition.Is.FieldID)
		require.Equal(t, "user_1", original.InviteUserIDs[0])
	})

	t.Run("should handle nil condition", func(t *testing.T) {
		original := CreationRule{
			SetOwnerID: "owner_1",
		}

		cloned := original.Clone()

		require.Nil(t, cloned.Condition)
		require.Equal(t, "owner_1", cloned.SetOwnerID)
	})

	t.Run("should deep-copy And/Or slices", func(t *testing.T) {
		original := CreationRule{
			Condition: &ConditionExprV1{
				And: []ConditionExprV1{
					{Is: &ComparisonCondition{FieldID: "f1", Value: json.RawMessage(`"v1"`)}},
					{IsNot: &ComparisonCondition{FieldID: "f2", Value: json.RawMessage(`"v2"`)}},
				},
			},
		}

		cloned := original.Clone()

		cloned.Condition.And = append(cloned.Condition.And, ConditionExprV1{
			Is: &ComparisonCondition{FieldID: "f3", Value: json.RawMessage(`"v3"`)},
		})

		require.Len(t, original.Condition.And, 2)
		require.Len(t, cloned.Condition.And, 3)
	})
}

func TestPlaybook_Clone_CreationRules(t *testing.T) {
	t.Run("should deep-copy creation rules", func(t *testing.T) {
		original := Playbook{
			ID:    "pb_1",
			Title: "Test Playbook",
			CreationRules: []CreationRule{
				{
					Condition: &ConditionExprV1{
						Is: &ComparisonCondition{
							FieldID: "old_field_id",
							Value:   json.RawMessage(`["old_opt_id"]`),
						},
					},
					SetOwnerID:    "owner_1",
					InviteUserIDs: []string{"user_1"},
				},
				{
					SetChannelID: "channel_1",
				},
			},
		}

		cloned := original.Clone()

		require.Len(t, cloned.CreationRules, 2)
		require.NotSame(t, &original.CreationRules[0], &cloned.CreationRules[0])
		require.NotSame(t, original.CreationRules[0].Condition, cloned.CreationRules[0].Condition)
		require.Equal(t, "old_field_id", cloned.CreationRules[0].Condition.Is.FieldID)

		cloned.CreationRules[0].Condition.Is.FieldID = "new_field_id"
		cloned.CreationRules[0].InviteUserIDs[0] = "user_modified"

		require.Equal(t, "old_field_id", original.CreationRules[0].Condition.Is.FieldID)
		require.Equal(t, "user_1", original.CreationRules[0].InviteUserIDs[0])
	})

	t.Run("should handle empty creation rules", func(t *testing.T) {
		original := Playbook{
			ID:            "pb_1",
			CreationRules: nil,
		}

		cloned := original.Clone()
		require.Nil(t, cloned.CreationRules)
	})
}
