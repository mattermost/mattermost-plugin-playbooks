// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPlaybookRun_MarshalJSON(t *testing.T) {
	t.Run("marshal pointer", func(t *testing.T) {
		testPlaybookRun := &PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		require.NotContains(t, string(result), "null", "update MarshalJSON to initialize nil slices")
	})

	t.Run("marshal value", func(t *testing.T) {
		testPlaybookRun := PlaybookRun{}
		result, err := json.Marshal(testPlaybookRun)
		require.NoError(t, err)
		require.NotContains(t, string(result), "null", "update MarshalJSON to initialize nil slices")
	})
}

func TestPlaybookRunFilterOptions_Clone(t *testing.T) {
	options := PlaybookRunFilterOptions{
		TeamID:        "team_id",
		Page:          1,
		PerPage:       10,
		Sort:          SortByID,
		Direction:     DirectionAsc,
		Statuses:      []string{"InProgress", "Finished"},
		OwnerID:       "owner_id",
		ParticipantID: "participant_id",
		SearchTerm:    "search_term",
		PlaybookID:    "playbook_id",
	}
	marshalledOptions, err := json.Marshal(options)
	require.NoError(t, err)

	clone := options.Clone()
	clone.TeamID = "team_id_clone"
	clone.Page = 2
	clone.PerPage = 20
	clone.Sort = SortByName
	clone.Direction = DirectionDesc
	clone.Statuses[0] = "Finished"
	clone.OwnerID = "owner_id_clone"
	clone.ParticipantID = "participant_id_clone"
	clone.SearchTerm = "search_term_clone"
	clone.PlaybookID = "playbook_id_clone"

	var unmarshalledOptions PlaybookRunFilterOptions
	err = json.Unmarshal(marshalledOptions, &unmarshalledOptions)
	require.NoError(t, err)
	require.Equal(t, options, unmarshalledOptions)
	require.NotEqual(t, clone, unmarshalledOptions)
}

func TestDetectChangedFields(t *testing.T) {
	t.Run("nil runs", func(t *testing.T) {
		// Test with nil runs
		changes := DetectChangedFields(nil, nil)
		require.Nil(t, changes)

		// Test with one nil run
		prev := &PlaybookRun{ID: "run1"}
		changes = DetectChangedFields(prev, nil)
		require.Nil(t, changes)

		changes = DetectChangedFields(nil, prev)
		require.Nil(t, changes)
	})

	t.Run("no changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}
		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}

		changes := DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("scalar field changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			Summary:     "Summary",
			OwnerUserID: "user1",
		}
		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1 Updated", // Changed
			Summary:     "New Summary",   // Changed
			OwnerUserID: "user1",
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "New Summary", changes["summary"])
	})

	t.Run("array field changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2"},
			InvitedUserIDs:      []string{"user3"},
			BroadcastChannelIDs: []string{"channel1"},
		}
		curr := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2", "user3"}, // Added user3
			InvitedUserIDs:      []string{"user3"},                   // No change
			BroadcastChannelIDs: []string{"channel1", "channel2"},    // Added channel2
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)
		require.ElementsMatch(t, []string{"user1", "user2", "user3"}, changes["participant_ids"])
		require.ElementsMatch(t, []string{"channel1", "channel2"}, changes["broadcast_channel_ids"])
	})

	t.Run("array field with different order but same elements", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user1", "user2", "user3"},
			InvitedUserIDs:      []string{"user4", "user5"},
			BroadcastChannelIDs: []string{"channel1", "channel2"},
		}
		curr := &PlaybookRun{
			ID:                  "run1",
			ParticipantIDs:      []string{"user3", "user1", "user2"}, // Same users but different order
			InvitedUserIDs:      []string{"user5", "user4"},          // Same users but different order
			BroadcastChannelIDs: []string{"channel2", "channel1"},    // Same channels but different order
		}

		// StringSetsEqual should treat these as equal since order doesn't matter
		changes := DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("status posts changes", func(t *testing.T) {
		prevPost := StatusPost{
			ID:       "post1",
			CreateAt: 100,
			DeleteAt: 0,
		}

		// Same post but different delete time
		currPost := StatusPost{
			ID:       "post1",
			CreateAt: 100,
			DeleteAt: 200, // Changed
		}

		prev := &PlaybookRun{
			ID:          "run1",
			StatusPosts: []StatusPost{prevPost},
		}
		curr := &PlaybookRun{
			ID:          "run1",
			StatusPosts: []StatusPost{currPost},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		statusPosts, ok := changes["status_posts"].([]StatusPost)
		require.True(t, ok)
		require.Len(t, statusPosts, 1)
		require.Equal(t, int64(200), statusPosts[0].DeleteAt)
	})

	t.Run("timeline events changes", func(t *testing.T) {
		prevEvent := TimelineEvent{
			ID:        "event1",
			CreateAt:  100,
			DeleteAt:  0,
			EventType: "type1",
			Summary:   "summary1",
		}

		// Added new event
		curr := &PlaybookRun{
			ID: "run1",
			TimelineEvents: []TimelineEvent{
				prevEvent,
				{
					ID:        "event2",
					CreateAt:  200,
					DeleteAt:  0,
					EventType: "type2",
					Summary:   "summary2",
				},
			},
		}
		prev := &PlaybookRun{
			ID:             "run1",
			TimelineEvents: []TimelineEvent{prevEvent},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		events, ok := changes["timeline_events"].([]TimelineEvent)
		require.True(t, ok)
		require.Len(t, events, 2)
	})

	t.Run("metrics data changes", func(t *testing.T) {
		// Create a dummy value for Value field
		dummyValue1 := RunMetricData{}.Value // get zero value
		dummyValue2 := RunMetricData{}.Value // get zero value

		// Set valid values through struct initialization
		prevMetric := RunMetricData{
			MetricConfigID: "metric1",
			Value:          dummyValue1,
		}

		// Changed value - we'll update just the MetricConfigID for simplicity
		currMetric := RunMetricData{
			MetricConfigID: "metric2", // Changed
			Value:          dummyValue2,
		}

		prev := &PlaybookRun{
			ID:          "run1",
			MetricsData: []RunMetricData{prevMetric},
		}
		curr := &PlaybookRun{
			ID:          "run1",
			MetricsData: []RunMetricData{currMetric},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		metrics, ok := changes["metrics_data"].([]RunMetricData)
		require.True(t, ok)
		require.Len(t, metrics, 1)
		require.Equal(t, "metric2", metrics[0].MetricConfigID)
	})

	t.Run("checklist changes", func(t *testing.T) {
		prevItem := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateOpen,
		}
		prevChecklist := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{prevItem},
		}

		// Changed item state
		currItem := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateClosed, // Changed
		}
		currChecklist := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{currItem},
		}

		prev := &PlaybookRun{
			ID:         "run1",
			Checklists: []Checklist{prevChecklist},
		}
		curr := &PlaybookRun{
			ID:         "run1",
			Checklists: []Checklist{currChecklist},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)

		// Verify the checklist item state was detected as changed
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("multiple field types changing simultaneously", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1",
			OwnerUserID:         "user1",
			ParticipantIDs:      []string{"user1", "user2"},
			StatusUpdateEnabled: true,
			Checklists: []Checklist{{
				ID:    "checklist1",
				Title: "Checklist 1",
				Items: []ChecklistItem{{
					ID:    "item1",
					Title: "Item 1",
					State: ChecklistItemStateOpen,
				}},
			}},
		}

		curr := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1 Updated",            // Changed scalar
			OwnerUserID:         "user2",                    // Changed scalar
			ParticipantIDs:      []string{"user1", "user3"}, // Changed array
			StatusUpdateEnabled: false,                      // Changed boolean
			Checklists: []Checklist{{
				ID:    "checklist1",
				Title: "Checklist 1 Updated", // Changed checklist title
				Items: []ChecklistItem{{
					ID:    "item1",
					Title: "Item 1",
					State: ChecklistItemStateClosed, // Changed item state
				}},
			}},
		}

		changes := DetectChangedFields(prev, curr)

		// Validate the changes contain all expected fields
		require.Len(t, changes, 5)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "user2", changes["owner_user_id"])
		require.Equal(t, false, changes["status_update_enabled"])
		require.ElementsMatch(t, []string{"user1", "user3"}, changes["participant_ids"])

		// Validate checklist changes
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// Verify checklist title change
		require.Contains(t, checklistUpdates[0].Fields, "title")
		require.Equal(t, "Checklist 1 Updated", checklistUpdates[0].Fields["title"])

		// Verify item state change
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("adding and removing array elements", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1", "user2", "user3"},
			InvitedUserIDs: []string{"user1", "user2", "user3", "user4"},
		}

		curr := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1", "user4", "user5"}, // Removed user2, user3; Added user4, user5
			InvitedUserIDs: []string{"user1", "user2"},          // Removed user3, user4
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)

		// Check participant changes
		participants, ok := changes["participant_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1", "user4", "user5"}, participants)

		// Check invited users changes
		invitedUsers, ok := changes["invited_user_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1", "user2"}, invitedUsers)
	})

	t.Run("adding and removing checklists", func(t *testing.T) {
		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)

		// Validate that the checklist addition was detected
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)

		// There should be a change detecting the new checklist
		require.NotEmpty(t, checklistUpdates)
	})

	t.Run("reordering checklist items", func(t *testing.T) {
		items1 := []ChecklistItem{
			{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
			{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
		}

		items2 := []ChecklistItem{
			{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
			{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
		}

		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "Checklist 1", Items: items1},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", Title: "Checklist 1", Items: items2},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// There should be a change to indicate reordering
		require.NotEmpty(t, changes)

		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.NotEmpty(t, checklistUpdates)
	})

	t.Run("edge case - empty arrays", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{},
			InvitedUserIDs: []string{"user1"},
			Checklists:     []Checklist{},
		}

		curr := &PlaybookRun{
			ID:             "run1",
			ParticipantIDs: []string{"user1"},
			InvitedUserIDs: []string{},
			Checklists:     []Checklist{},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 2)

		// Check that going from empty to populated is detected
		participants, ok := changes["participant_ids"].([]string)
		require.True(t, ok)
		require.ElementsMatch(t, []string{"user1"}, participants)

		// Check that going from populated to empty is detected
		invitedUsers, ok := changes["invited_user_ids"].([]string)
		require.True(t, ok)
		require.Empty(t, invitedUsers)
	})

	t.Run("sort order changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:        "run1",
			SortOrder: []string{"checklist1", "checklist2"},
		}

		curr := &PlaybookRun{
			ID:        "run1",
			SortOrder: []string{"checklist2", "checklist1"},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		require.Equal(t, []string{"checklist2", "checklist1"}, changes["sort_order"])

		prev.SortOrder = curr.SortOrder
		changes = DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})

	t.Run("checklist sort order changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", SortOrder: []string{"item1", "item2"}},
			},
		}

		curr := &PlaybookRun{
			ID: "run1",
			Checklists: []Checklist{
				{ID: "checklist1", SortOrder: []string{"item2", "item1"}},
			},
		}

		changes := DetectChangedFields(prev, curr)
		require.Len(t, changes, 1)
		require.Equal(t, []string{"item2", "item1"}, changes["checklists"].([]ChecklistUpdate)[0].Fields["sort_order"])

		prev.Checklists[0].SortOrder = curr.Checklists[0].SortOrder
		changes = DetectChangedFields(prev, curr)
		require.Empty(t, changes)
	})
}

func TestPlaybookRunFilterOptions_Validate(t *testing.T) {
	t.Run("non-positive PerPage", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			PerPage: -1,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, PerPageDefault, validOptions.PerPage)
	})

	t.Run("invalid sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("END_at"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByEndAt, validOptions.Sort)
	})

	t.Run("valid, no explicit sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByCreateAt, validOptions.Sort)
	})

	t.Run("invalid sort direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case direction option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("DEsC"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionDesc, validOptions.Direction)
	})

	t.Run("valid, no explicit direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionAsc, validOptions.Direction)
	})

	t.Run("invalid team id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid owner id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			OwnerID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid participant id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			ParticipantID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid playbook id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:     model.NewId(),
			PlaybookID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid statuses", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			Page:          1,
			PerPage:       10,
			Sort:          SortByID,
			Direction:     DirectionAsc,
			Statuses:      []string{"active", "Finished"},
			OwnerID:       model.NewId(),
			ParticipantID: model.NewId(),
			SearchTerm:    "search_term",
			PlaybookID:    model.NewId(),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid status", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:        model.NewId(),
			Page:          1,
			PerPage:       10,
			Sort:          SortByID,
			Direction:     DirectionAsc,
			Statuses:      []string{"InProgress", "Finished"},
			OwnerID:       model.NewId(),
			ParticipantID: model.NewId(),
			SearchTerm:    "search_term",
			PlaybookID:    model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options, validOptions)
	})

	t.Run("only run-level changes - no checklist or item changes", func(t *testing.T) {
		// Create identical checklists
		checklistA := Checklist{
			ID:    "checklist1",
			Title: "Checklist 1",
			Items: []ChecklistItem{
				{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
			},
		}

		prev := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1",
			Summary:             "Original summary",
			OwnerUserID:         "user1",
			StatusUpdateEnabled: true,
			Checklists:          []Checklist{checklistA},
		}

		curr := &PlaybookRun{
			ID:                  "run1",
			Name:                "Run 1 Updated",         // Changed
			Summary:             "Original summary",      // Unchanged
			OwnerUserID:         "user2",                 // Changed
			StatusUpdateEnabled: true,                    // Unchanged
			Checklists:          []Checklist{checklistA}, // Unchanged
		}

		changes := DetectChangedFields(prev, curr)

		// Only run-level fields should be detected as changed
		require.Len(t, changes, 2)
		require.Equal(t, "Run 1 Updated", changes["name"])
		require.Equal(t, "user2", changes["owner_user_id"])

		// No checklist changes should be reported
		_, hasChecklistChanges := changes["checklists"]
		require.False(t, hasChecklistChanges)
	})

	t.Run("only checklist-level changes - no run or item changes", func(t *testing.T) {
		itemA := ChecklistItem{
			ID:    "item1",
			Title: "Item 1",
			State: ChecklistItemStateOpen,
		}

		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			OwnerUserID: "user1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Original Title",
					Items: []ChecklistItem{itemA},
				},
			},
		}

		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1", // Unchanged
			OwnerUserID: "user1", // Unchanged
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "New Title",            // Changed
					Items: []ChecklistItem{itemA}, // Unchanged
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// Only checklist-level changes should be detected
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// Verify the checklist title is changed
		require.Equal(t, "checklist1", checklistUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].Fields, "title")
		require.Equal(t, "New Title", checklistUpdates[0].Fields["title"])

		// No item updates should be present
		require.Empty(t, checklistUpdates[0].ItemUpdates)
	})

	t.Run("only checklist-item-level changes - no run or checklist changes", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1",
			OwnerUserID: "user1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{
							ID:    "item1",
							Title: "Item 1",
							State: ChecklistItemStateOpen,
						},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID:          "run1",
			Name:        "Run 1", // Unchanged
			OwnerUserID: "user1", // Unchanged
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1", // Unchanged
					Items: []ChecklistItem{
						{
							ID:    "item1",
							Title: "Item 1",
							State: ChecklistItemStateClosed, // Changed
						},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// Only item-level changes should be detected
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)
		require.Len(t, checklistUpdates, 1)

		// No checklist title changes
		_, hasTitleChange := checklistUpdates[0].Fields["title"]
		require.False(t, hasTitleChange)

		// Verify item change is detected
		require.Len(t, checklistUpdates[0].ItemUpdates, 1)
		require.Equal(t, "item1", checklistUpdates[0].ItemUpdates[0].ID)
		require.Contains(t, checklistUpdates[0].ItemUpdates[0].Fields, "state")
		require.Equal(t, ChecklistItemStateClosed, checklistUpdates[0].ItemUpdates[0].Fields["state"])
	})

	t.Run("multiple checklists with changes at different levels", func(t *testing.T) {
		prev := &PlaybookRun{
			ID:   "run1",
			Name: "Run 1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1",
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist3",
					Title: "Checklist 3",
					Items: []ChecklistItem{
						{ID: "item3", Title: "Item 3", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		curr := &PlaybookRun{
			ID:   "run1",
			Name: "Run 1",
			Checklists: []Checklist{
				{
					ID:    "checklist1",
					Title: "Checklist 1 Modified", // Checklist title change
					Items: []ChecklistItem{
						{ID: "item1", Title: "Item 1", State: ChecklistItemStateOpen},
					},
				},
				{
					ID:    "checklist2",
					Title: "Checklist 2",
					Items: []ChecklistItem{
						{ID: "item2", Title: "Item 2", State: ChecklistItemStateClosed}, // Item state change
					},
				},
				// checklist3 deleted, checklist4 added
				{
					ID:    "checklist4",
					Title: "Checklist 4",
					Items: []ChecklistItem{
						{ID: "item4", Title: "Item 4", State: ChecklistItemStateOpen},
					},
				},
			},
		}

		changes := DetectChangedFields(prev, curr)

		// There should be checklist changes
		require.Len(t, changes, 1)
		checklistUpdates, ok := changes["checklists"].([]ChecklistUpdate)
		require.True(t, ok)

		// We should have updates for three checklists (modified, modified, added)
		// and implicitly recognize the deletion of checklist3
		require.NotEmpty(t, checklistUpdates)

		// Verify we have a mixture of different types of changes
		checklistTitleChanged := false
		itemStateChanged := false
		checklistAdded := false

		for _, update := range checklistUpdates {
			if update.ID == "checklist1" && update.Fields["title"] == "Checklist 1 Modified" {
				checklistTitleChanged = true
			}

			if update.ID == "checklist2" && len(update.ItemUpdates) > 0 {
				itemState, ok := update.ItemUpdates[0].Fields["state"]
				if ok && itemState == ChecklistItemStateClosed {
					itemStateChanged = true
				}
			}

			if update.ID == "checklist4" {
				checklistAdded = true
			}
		}

		require.True(t, checklistTitleChanged, "Failed to detect checklist title change")
		require.True(t, itemStateChanged, "Failed to detect item state change")
		require.True(t, checklistAdded, "Failed to detect checklist addition")
	})
}

func TestPlaybookRun_GetSortOrder(t *testing.T) {
	playbookRun := &PlaybookRun{
		Checklists: []Checklist{
			{ID: "checklist1"},
			{ID: "checklist2"},
		},
	}

	sortOrder := playbookRun.GetSortOrder()
	require.Equal(t, []string{"checklist1", "checklist2"}, sortOrder)

	playbookRun.Checklists = []Checklist{
		{ID: "checklist2"},
		{ID: "checklist1"},
	}

	sortOrder = playbookRun.GetSortOrder()
	require.Equal(t, []string{"checklist2", "checklist1"}, sortOrder)

	playbookRun.Checklists = []Checklist{}
	sortOrder = playbookRun.GetSortOrder()
	require.Equal(t, []string{}, sortOrder)
}

func TestPlaybookRun_CompareSortOrder(t *testing.T) {
	prev := []string{"checklist1", "checklist2"}
	curr := []string{"checklist2", "checklist1"}

	require.False(t, compareSortOrder(prev, curr))

	prev = []string{"checklist1", "checklist2"}
	curr = []string{"checklist1", "checklist2"}
	require.True(t, compareSortOrder(prev, curr))

	prev = []string{"checklist1", "checklist2"}
	curr = []string{"checklist1", "checklist2", "checklist3"}
	require.False(t, compareSortOrder(prev, curr))

	prev = []string{"checklist1", "checklist2", "checklist3"}
	curr = []string{"checklist1", "checklist2"}
	require.False(t, compareSortOrder(prev, curr))
}
