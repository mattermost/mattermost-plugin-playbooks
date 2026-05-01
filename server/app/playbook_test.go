// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateRunNumberPrefix(t *testing.T) {
	t.Run("empty string is valid", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix(""))
	})

	t.Run("whitespace-only string is valid", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("   "))
	})

	t.Run("simple alphanumeric prefix", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("INC"))
	})

	t.Run("hyphenated prefix", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("INC-PROD"))
	})

	t.Run("single character is valid", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("A"))
	})

	t.Run("digits only", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("123"))
	})

	t.Run("exactly 32 characters is valid", func(t *testing.T) {
		require.NoError(t, ValidateRunNumberPrefix("ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"))
	})

	t.Run("33 characters exceeds maximum", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567"))
	})

	t.Run("leading hyphen is invalid", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("-INC"))
	})

	t.Run("trailing hyphen is invalid", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("INC-"))
	})

	t.Run("underscore is invalid", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("INC_A"))
	})

	t.Run("space in the middle is invalid", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("INC A"))
	})

	t.Run("unicode character ñ is invalid", func(t *testing.T) {
		require.Error(t, ValidateRunNumberPrefix("INCñ"))
	})

	t.Run("unicode-only prefix counts runes not bytes for length", func(t *testing.T) {
		// 32 × 'A' followed by 'B' = 33 runes; multi-byte chars should not slip under the limit
		require.Error(t, ValidateRunNumberPrefix("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567"))
	})
}

func TestNormalizeRunNumberPrefix(t *testing.T) {
	t.Run("no-op for clean prefix", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("INC"))
	})

	t.Run("trims leading whitespace", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("  INC"))
	})

	t.Run("trims trailing whitespace", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("INC  "))
	})

	t.Run("trims leading hyphen", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("-INC"))
	})

	t.Run("trims trailing hyphen", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("INC-"))
	})

	t.Run("trims leading and trailing hyphens", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("-INC-"))
	})

	t.Run("trims whitespace then hyphens", func(t *testing.T) {
		require.Equal(t, "INC", NormalizeRunNumberPrefix("  -INC-  "))
	})

	t.Run("empty string stays empty", func(t *testing.T) {
		require.Equal(t, "", NormalizeRunNumberPrefix(""))
	})

	t.Run("whitespace-only becomes empty", func(t *testing.T) {
		require.Equal(t, "", NormalizeRunNumberPrefix("   "))
	})

	t.Run("interior hyphens are preserved", func(t *testing.T) {
		require.Equal(t, "INC-PROD", NormalizeRunNumberPrefix("INC-PROD"))
	})

	t.Run("single hyphen becomes empty", func(t *testing.T) {
		require.Equal(t, "", NormalizeRunNumberPrefix("-"))
	})

	t.Run("multiple hyphens become empty", func(t *testing.T) {
		require.Equal(t, "", NormalizeRunNumberPrefix("---"))
	})

	t.Run("hyphen with surrounding whitespace becomes empty", func(t *testing.T) {
		require.Equal(t, "", NormalizeRunNumberPrefix(" - "))
	})

	t.Run("hyphens around inner text are trimmed", func(t *testing.T) {
		require.Equal(t, "abc", NormalizeRunNumberPrefix("-abc-"))
	})
}

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
