package sqlstore

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestOldChecklistToNewChecklist(t *testing.T) {
	testCases := []struct {
		name     string
		old      oldChecklist
		expected playbook.Checklist
	}{
		{
			"default checklist",
			oldChecklist{},
			playbook.Checklist{},
		},
		{
			"one default item",
			oldChecklist{
				Items: []oldChecklistItem{{}},
			},
			playbook.Checklist{
				Items: []playbook.ChecklistItem{{}},
			},
		},
		{
			"complete checklist",
			oldChecklist{
				Title: "A checklist",
				Items: []oldChecklistItem{
					{
						Title:       "not checked, no assignee",
						State:       playbook.ChecklistItemStateOpen,
						Command:     "/slashcmd",
						Description: "A detailed item",
					},
					{
						Title:               "checked, no assignee",
						State:               playbook.ChecklistItemStateClosed,
						StateModified:       time.Date(2017, 7, 14, 2, 40, 0, 0, time.UTC),
						StateModifiedPostID: "state post id",
					},
					{
						Title:                  "not checked, assignee",
						State:                  playbook.ChecklistItemStateOpen,
						AssigneeID:             "assignee id",
						AssigneeModified:       time.Date(2020, 9, 13, 12, 26, 40, 0, time.UTC),
						AssigneeModifiedPostID: "assignee post id",
					},
					{
						Title:                  "checked, assignee",
						State:                  playbook.ChecklistItemStateClosed,
						StateModified:          time.Date(2020, 9, 25, 8, 47, 22, 0, time.UTC),
						StateModifiedPostID:    "state post id",
						AssigneeID:             "assigneed id",
						AssigneeModified:       time.Date(2020, 9, 25, 2, 31, 1, 0, time.UTC),
						AssigneeModifiedPostID: "assignee post id",
					},
				},
			},
			playbook.Checklist{
				Title: "A checklist",
				Items: []playbook.ChecklistItem{
					{
						Title:       "not checked, no assignee",
						State:       playbook.ChecklistItemStateOpen,
						Command:     "/slashcmd",
						Description: "A detailed item",
					},
					{
						Title:               "checked, no assignee",
						State:               playbook.ChecklistItemStateClosed,
						StateModified:       1500000000000,
						StateModifiedPostID: "state post id",
					},
					{
						Title:                  "not checked, assignee",
						State:                  playbook.ChecklistItemStateOpen,
						AssigneeID:             "assignee id",
						AssigneeModified:       1600000000000,
						AssigneeModifiedPostID: "assignee post id",
					},
					{
						Title:                  "checked, assignee",
						State:                  playbook.ChecklistItemStateClosed,
						StateModified:          1601023642000,
						StateModifiedPostID:    "state post id",
						AssigneeID:             "assigneed id",
						AssigneeModified:       1601001061000,
						AssigneeModifiedPostID: "assignee post id",
					},
				},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			actual := oldChecklistToNewChecklist(testCase.old)

			require.True(t, model.IsValidId(actual.ID))
			require.Equal(t, testCase.expected.Title, actual.Title)
			require.Equal(t, len(testCase.expected.Items), len(actual.Items))
			for i, actualItem := range actual.Items {
				expectedItem := testCase.expected.Items[i]

				// The IDs are generated, we can only check that it is valid and
				// assign it to the expected value for the comparison to work
				require.True(t, model.IsValidId(actualItem.ID))
				expectedItem.ID = actualItem.ID

				require.Equal(t, expectedItem, actualItem)
			}
		})
	}
}
