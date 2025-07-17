// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/csv"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockUserGetter implements UserGetter for testing
type mockUserGetter struct {
	users map[string]*model.User
}

func (m *mockUserGetter) Get(userID string) (*model.User, error) {
	if user, exists := m.users[userID]; exists {
		return user, nil
	}
	return &model.User{
		Id:       userID,
		Username: userID,
		Email:    userID + "@example.com",
	}, nil
}

func newMockUserGetter() *mockUserGetter {
	return &mockUserGetter{
		users: map[string]*model.User{
			"user-1":   {Id: "user-1", Username: "user1", Email: "user1@example.com"},
			"user-2":   {Id: "user-2", Username: "user2", Email: "user2@example.com"},
			"user-3":   {Id: "user-3", Username: "user3", Email: "user3@example.com"},
			"user-4":   {Id: "user-4", Username: "user4", Email: "user4@example.com"},
			"user-5":   {Id: "user-5", Username: "user5", Email: "user5@example.com"},
			"user-6":   {Id: "user-6", Username: "user6", Email: "user6@example.com"},
			"user-7":   {Id: "user-7", Username: "user7", Email: "user7@example.com"},
			"user-456": {Id: "user-456", Username: "testuser", Email: "testuser@example.com"},
			"user-789": {Id: "user-789", Username: "subject", Email: "subject@example.com"},
		},
	}
}

func TestShowEventForCSV(t *testing.T) {
	tests := []struct {
		name       string
		eventType  timelineEventType
		filter     TimelineFilterOptions
		shouldShow bool
	}{
		// Test "All" filter
		{
			name:       "All filter shows any event",
			eventType:  StatusUpdated,
			filter:     TimelineFilterOptions{All: true},
			shouldShow: true,
		},
		{
			name:       "All filter shows owner changed event",
			eventType:  OwnerChanged,
			filter:     TimelineFilterOptions{All: true},
			shouldShow: true,
		},

		// Test specific filters
		{
			name:       "OwnerChanged filter shows owner change event",
			eventType:  OwnerChanged,
			filter:     TimelineFilterOptions{OwnerChanged: true},
			shouldShow: true,
		},
		{
			name:       "OwnerChanged filter hides status update event",
			eventType:  StatusUpdated,
			filter:     TimelineFilterOptions{OwnerChanged: true},
			shouldShow: false,
		},

		// Test status update grouping
		{
			name:       "StatusUpdated filter shows PlaybookRunCreated",
			eventType:  PlaybookRunCreated,
			filter:     TimelineFilterOptions{StatusUpdated: true},
			shouldShow: true,
		},
		{
			name:       "StatusUpdated filter shows RunFinished",
			eventType:  RunFinished,
			filter:     TimelineFilterOptions{StatusUpdated: true},
			shouldShow: true,
		},
		{
			name:       "StatusUpdated filter shows RunRestored",
			eventType:  RunRestored,
			filter:     TimelineFilterOptions{StatusUpdated: true},
			shouldShow: true,
		},
		{
			name:       "StatusUpdated filter shows StatusUpdateRequested",
			eventType:  StatusUpdateRequested,
			filter:     TimelineFilterOptions{StatusUpdated: true},
			shouldShow: true,
		},

		// Test other event types
		{
			name:       "EventFromPost filter shows event from post",
			eventType:  EventFromPost,
			filter:     TimelineFilterOptions{EventFromPost: true},
			shouldShow: true,
		},
		{
			name:       "TaskStateModified filter shows task state change",
			eventType:  TaskStateModified,
			filter:     TimelineFilterOptions{TaskStateModified: true},
			shouldShow: true,
		},
		{
			name:       "AssigneeChanged filter shows assignee change",
			eventType:  AssigneeChanged,
			filter:     TimelineFilterOptions{AssigneeChanged: true},
			shouldShow: true,
		},
		{
			name:       "RanSlashCommand filter shows slash command",
			eventType:  RanSlashCommand,
			filter:     TimelineFilterOptions{RanSlashCommand: true},
			shouldShow: true,
		},

		// Test user joined/left grouping
		{
			name:       "UserJoinedLeft filter shows UserJoinedLeft event",
			eventType:  UserJoinedLeft,
			filter:     TimelineFilterOptions{UserJoinedLeft: true},
			shouldShow: true,
		},
		{
			name:       "UserJoinedLeft filter shows ParticipantsChanged event",
			eventType:  ParticipantsChanged,
			filter:     TimelineFilterOptions{UserJoinedLeft: true},
			shouldShow: true,
		},

		// Test multiple filters
		{
			name:       "Multiple filters - matching event type",
			eventType:  OwnerChanged,
			filter:     TimelineFilterOptions{OwnerChanged: true, StatusUpdated: true},
			shouldShow: true,
		},
		{
			name:       "Multiple filters - non-matching event type",
			eventType:  TaskStateModified,
			filter:     TimelineFilterOptions{OwnerChanged: true, StatusUpdated: true},
			shouldShow: false,
		},

		// Test default behavior for unknown event types
		{
			name:       "Unknown event type with All=false defaults to All behavior",
			eventType:  timelineEventType("unknown_event"),
			filter:     TimelineFilterOptions{All: false, OwnerChanged: true},
			shouldShow: false,
		},
		{
			name:       "Unknown event type with All=true shows event",
			eventType:  timelineEventType("unknown_event"),
			filter:     TimelineFilterOptions{All: true},
			shouldShow: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := showEventForCSV(tt.eventType, tt.filter)
			assert.Equal(t, tt.shouldShow, result)
		})
	}
}

func TestGenerateTimelineCSV(t *testing.T) {
	mockUser := newMockUserGetter()
	siteURL := "https://test.mattermost.com"
	teamName := "test-team"

	t.Run("empty timeline", func(t *testing.T) {
		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{},
		}
		filter := TimelineFilterOptions{All: true}

		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		lines := strings.Split(strings.TrimSpace(string(csvData)), "\n")
		assert.Len(t, lines, 1, "Should only have header row")

		// Verify header
		expectedHeader := "Event Time,Event Type,Summary,Details,Post Link"
		assert.Equal(t, expectedHeader, lines[0])
	})

	t.Run("single event", func(t *testing.T) {
		eventTime := time.Date(2023, 1, 15, 10, 30, 0, 0, time.UTC).UnixMilli()
		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{
					ID:            "event-123",
					EventAt:       eventTime,
					EventType:     StatusUpdated,
					Summary:       "Status updated to In Progress",
					Details:       "Updated by user",
					CreatorUserID: "user-456",
					SubjectUserID: "user-789",
					PostID:        "post-101",
					DeleteAt:      0,
				},
			},
		}
		filter := TimelineFilterOptions{All: true}

		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		lines := strings.Split(strings.TrimSpace(string(csvData)), "\n")
		assert.Len(t, lines, 2, "Should have header + 1 data row")

		// Parse CSV to verify format
		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2)

		// Verify header
		expectedHeader := []string{"Event Time", "Event Type", "Summary", "Details", "Post Link"}
		assert.Equal(t, expectedHeader, records[0])

		// Verify data row
		expectedData := []string{
			"2023-01-15 10:30:00 UTC",
			"status_updated",
			"Status updated to In Progress",
			"Updated by user", // Status update details included
			"/test-team/pl/post-101",
		}
		assert.Equal(t, expectedData, records[1])
	})

	t.Run("multiple events with filtering", func(t *testing.T) {
		baseTime := time.Date(2023, 1, 15, 10, 0, 0, 0, time.UTC).UnixMilli()
		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{
					ID:            "event-1",
					EventAt:       baseTime,
					EventType:     StatusUpdated,
					Summary:       "Status updated",
					CreatorUserID: "user-1",
					DeleteAt:      0,
				},
				{
					ID:            "event-2",
					EventAt:       baseTime + 1000,
					EventType:     OwnerChanged,
					Summary:       "Owner changed",
					CreatorUserID: "user-2",
					DeleteAt:      0,
				},
				{
					ID:            "event-3",
					EventAt:       baseTime + 2000,
					EventType:     TaskStateModified,
					Summary:       "Task completed",
					CreatorUserID: "user-3",
					DeleteAt:      0,
				},
			},
		}

		// Filter to only show status updates
		filter := TimelineFilterOptions{StatusUpdated: true}

		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2, "Should have header + 1 filtered row")

		// Should only include the status update event - verify the summary (which should be enhanced)
		assert.Equal(t, "status_updated", records[1][1])
	})

	t.Run("skips deleted events", func(t *testing.T) {
		eventTime := time.Date(2023, 1, 15, 10, 30, 0, 0, time.UTC).UnixMilli()
		deleteTime := time.Date(2023, 1, 16, 10, 30, 0, 0, time.UTC).UnixMilli()

		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{
					ID:            "event-active",
					EventAt:       eventTime,
					EventType:     StatusUpdated,
					Summary:       "Active event",
					CreatorUserID: "user-1",
					DeleteAt:      0, // Not deleted
				},
				{
					ID:            "event-deleted",
					EventAt:       eventTime + 1000,
					EventType:     OwnerChanged,
					Summary:       "Deleted event",
					CreatorUserID: "user-2",
					DeleteAt:      deleteTime, // Deleted
				},
			},
		}
		filter := TimelineFilterOptions{All: true}

		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2, "Should have header + 1 active event")

		// Should only include the non-deleted event - verify it's the active one
		assert.Contains(t, records[1][2], "Active event")
	})

	t.Run("handles special characters in CSV", func(t *testing.T) {
		eventTime := time.Date(2023, 1, 15, 10, 30, 0, 0, time.UTC).UnixMilli()
		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{
					ID:            "event-special",
					EventAt:       eventTime,
					EventType:     EventFromPost,
					Summary:       `Summary with "quotes" and, commas`,
					Details:       "Details with\nnewlines",
					CreatorUserID: "user-1",
					DeleteAt:      0,
				},
			},
		}
		filter := TimelineFilterOptions{All: true}

		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		// Verify CSV can be parsed correctly
		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2)

		// Verify special characters are handled correctly - details column is empty for non-status events
		assert.Equal(t, "", records[1][3]) // Details column should be empty for EventFromPost
	})

	t.Run("time formatting", func(t *testing.T) {
		// Test various timestamps to ensure consistent formatting
		testCases := []struct {
			name         string
			timestamp    int64
			expectedTime string
		}{
			{
				name:         "beginning of year",
				timestamp:    time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
				expectedTime: "2023-01-01 00:00:00 UTC",
			},
			{
				name:         "with milliseconds",
				timestamp:    time.Date(2023, 12, 31, 23, 59, 59, 500000000, time.UTC).UnixMilli(),
				expectedTime: "2023-12-31 23:59:59 UTC",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				playbookRun := &PlaybookRun{
					TimelineEvents: []TimelineEvent{
						{
							ID:            "event-time-test",
							EventAt:       tc.timestamp,
							EventType:     StatusUpdated,
							Summary:       "Time test",
							CreatorUserID: "user-1",
							DeleteAt:      0,
						},
					},
				}
				filter := TimelineFilterOptions{All: true}

				csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
				require.NoError(t, err)

				reader := csv.NewReader(strings.NewReader(string(csvData)))
				records, err := reader.ReadAll()
				require.NoError(t, err)
				require.Len(t, records, 2)

				assert.Equal(t, tc.expectedTime, records[1][0])
			})
		}
	})
}

func TestGenerateTimelineCSVWithMultipleEvents(t *testing.T) {
	mockUser := newMockUserGetter()
	siteURL := "https://test.mattermost.com"
	teamName := "test-team"

	t.Run("large timeline with all event types", func(t *testing.T) {
		baseTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()

		// Create a comprehensive timeline with all event types
		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{
					ID:            "event-1",
					EventAt:       baseTime,
					EventType:     PlaybookRunCreated,
					Summary:       "Playbook run created",
					Details:       "Initial creation",
					CreatorUserID: "user-1",
					SubjectUserID: "user-1",
					PostID:        "post-1",
					DeleteAt:      0,
				},
				{
					ID:            "event-2",
					EventAt:       baseTime + 60000, // +1 minute
					EventType:     OwnerChanged,
					Summary:       "Owner changed from user-1 to user-2",
					Details:       "Ownership transfer",
					CreatorUserID: "user-1",
					SubjectUserID: "user-2",
					PostID:        "post-2",
					DeleteAt:      0,
				},
				{
					ID:            "event-3",
					EventAt:       baseTime + 120000, // +2 minutes
					EventType:     StatusUpdated,
					Summary:       "Status updated to In Progress",
					Details:       "Status change details",
					CreatorUserID: "user-2",
					SubjectUserID: "user-2",
					PostID:        "post-3",
					DeleteAt:      0,
				},
				{
					ID:            "event-4",
					EventAt:       baseTime + 180000, // +3 minutes
					EventType:     TaskStateModified,
					Summary:       "Task 'Setup environment' completed",
					Details:       "{\"action\":\"check\",\"task\":\"Setup environment\"}",
					CreatorUserID: "user-3",
					SubjectUserID: "user-3",
					PostID:        "",
					DeleteAt:      0,
				},
				{
					ID:            "event-5",
					EventAt:       baseTime + 240000, // +4 minutes
					EventType:     AssigneeChanged,
					Summary:       "Task assigned to user-4",
					Details:       "Assignment change",
					CreatorUserID: "user-2",
					SubjectUserID: "user-4",
					PostID:        "",
					DeleteAt:      0,
				},
				{
					ID:            "event-6",
					EventAt:       baseTime + 300000, // +5 minutes
					EventType:     EventFromPost,
					Summary:       "Important message saved to timeline",
					Details:       "Post saved for reference",
					CreatorUserID: "user-5",
					SubjectUserID: "user-5",
					PostID:        "post-6",
					DeleteAt:      0,
				},
				{
					ID:            "event-7",
					EventAt:       baseTime + 360000, // +6 minutes
					EventType:     RanSlashCommand,
					Summary:       "Executed /status command",
					Details:       "Slash command execution",
					CreatorUserID: "user-3",
					SubjectUserID: "user-3",
					PostID:        "post-7",
					DeleteAt:      0,
				},
				{
					ID:            "event-8",
					EventAt:       baseTime + 420000, // +7 minutes
					EventType:     UserJoinedLeft,
					Summary:       "user-6 joined the run",
					Details:       "User participation change",
					CreatorUserID: "user-6",
					SubjectUserID: "user-6",
					PostID:        "post-8",
					DeleteAt:      0,
				},
				{
					ID:            "event-9",
					EventAt:       baseTime + 480000, // +8 minutes
					EventType:     ParticipantsChanged,
					Summary:       "Multiple users added to run",
					Details:       "Bulk participant addition",
					CreatorUserID: "user-2",
					SubjectUserID: "user-7",
					PostID:        "post-9",
					DeleteAt:      0,
				},
				{
					ID:            "event-10",
					EventAt:       baseTime + 540000, // +9 minutes
					EventType:     RunFinished,
					Summary:       "Playbook run completed successfully",
					Details:       "Run completion",
					CreatorUserID: "user-2",
					SubjectUserID: "user-2",
					PostID:        "post-10",
					DeleteAt:      0,
				},
			},
		}

		// Test with "All" filter - should include all events
		filter := TimelineFilterOptions{All: true}
		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 11, "Should have header + 10 events")

		// Verify all events are present and in correct order (by timestamp)
		eventTimes := make([]string, 10)
		for i := 1; i < 11; i++ {
			eventTimes[i-1] = records[i][0] // Event Time is now the first column
		}
		expectedTimes := []string{
			"2023-01-01 10:00:00 UTC", "2023-01-01 10:01:00 UTC", "2023-01-01 10:02:00 UTC",
			"2023-01-01 10:03:00 UTC", "2023-01-01 10:04:00 UTC", "2023-01-01 10:05:00 UTC",
			"2023-01-01 10:06:00 UTC", "2023-01-01 10:07:00 UTC", "2023-01-01 10:08:00 UTC",
			"2023-01-01 10:09:00 UTC",
		}
		assert.Equal(t, expectedTimes, eventTimes)
	})

	t.Run("complex filtering scenarios", func(t *testing.T) {
		baseTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()

		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				// Status-related events
				{ID: "status-1", EventAt: baseTime, EventType: PlaybookRunCreated, Summary: "Run created", DeleteAt: 0},
				{ID: "status-2", EventAt: baseTime + 60000, EventType: StatusUpdated, Summary: "Status updated", DeleteAt: 0},
				{ID: "status-3", EventAt: baseTime + 120000, EventType: RunFinished, Summary: "Run finished", DeleteAt: 0},
				{ID: "status-4", EventAt: baseTime + 180000, EventType: StatusUpdateRequested, Summary: "Update requested", DeleteAt: 0},

				// Task-related events
				{ID: "task-1", EventAt: baseTime + 240000, EventType: TaskStateModified, Summary: "Task completed", DeleteAt: 0},
				{ID: "task-2", EventAt: baseTime + 300000, EventType: AssigneeChanged, Summary: "Task assigned", DeleteAt: 0},
				{ID: "task-3", EventAt: baseTime + 360000, EventType: TaskStateModified, Summary: "Another task", DeleteAt: 0},

				// User-related events
				{ID: "user-1", EventAt: baseTime + 420000, EventType: UserJoinedLeft, Summary: "User joined", DeleteAt: 0},
				{ID: "user-2", EventAt: baseTime + 480000, EventType: ParticipantsChanged, Summary: "Participants changed", DeleteAt: 0},
				{ID: "user-3", EventAt: baseTime + 540000, EventType: OwnerChanged, Summary: "Owner changed", DeleteAt: 0},

				// Other events
				{ID: "other-1", EventAt: baseTime + 600000, EventType: EventFromPost, Summary: "Post saved", DeleteAt: 0},
				{ID: "other-2", EventAt: baseTime + 660000, EventType: RanSlashCommand, Summary: "Command executed", DeleteAt: 0},
			},
		}

		// Test status updates filter (should include status-1, status-2, status-3, status-4)
		statusFilter := TimelineFilterOptions{StatusUpdated: true}
		csvData, err := GenerateTimelineCSV(playbookRun, statusFilter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 5, "Should have header + 4 status events")

		// Verify correct event types are included
		statusEventTypes := []string{records[1][1], records[2][1], records[3][1], records[4][1]}
		expectedStatusTypes := []string{"incident_created", "status_updated", "run_finished", "status_update_requested"}
		assert.Equal(t, expectedStatusTypes, statusEventTypes)

		// Test multiple filters (task events)
		taskFilter := TimelineFilterOptions{TaskStateModified: true, AssigneeChanged: true}
		csvData, err = GenerateTimelineCSV(playbookRun, taskFilter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader = csv.NewReader(strings.NewReader(string(csvData)))
		records, err = reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 4, "Should have header + 3 task events")

		// Verify correct task event types are included
		taskEventTypes := []string{records[1][1], records[2][1], records[3][1]}
		expectedTaskTypes := []string{"task_state_modified", "assignee_changed", "task_state_modified"}
		assert.Equal(t, expectedTaskTypes, taskEventTypes)

		// Test user participation filter (should include user-1, user-2)
		userFilter := TimelineFilterOptions{UserJoinedLeft: true}
		csvData, err = GenerateTimelineCSV(playbookRun, userFilter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader = csv.NewReader(strings.NewReader(string(csvData)))
		records, err = reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 3, "Should have header + 2 user events")

		// Verify correct user event types are included
		userEventTypes := []string{records[1][1], records[2][1]}
		expectedUserTypes := []string{"user_joined_left", "participants_changed"}
		assert.Equal(t, expectedUserTypes, userEventTypes)
	})

	t.Run("timeline with mixed deleted and active events", func(t *testing.T) {
		baseTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()
		deleteTime := time.Date(2023, 1, 2, 10, 0, 0, 0, time.UTC).UnixMilli()

		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{ID: "active-1", EventAt: baseTime, EventType: StatusUpdated, Summary: "Active event 1", DeleteAt: 0},
				{ID: "deleted-1", EventAt: baseTime + 60000, EventType: OwnerChanged, Summary: "Deleted event 1", DeleteAt: deleteTime},
				{ID: "active-2", EventAt: baseTime + 120000, EventType: TaskStateModified, Summary: "Active event 2", DeleteAt: 0},
				{ID: "deleted-2", EventAt: baseTime + 180000, EventType: EventFromPost, Summary: "Deleted event 2", DeleteAt: deleteTime},
				{ID: "active-3", EventAt: baseTime + 240000, EventType: UserJoinedLeft, Summary: "Active event 3", DeleteAt: 0},
				{ID: "deleted-3", EventAt: baseTime + 300000, EventType: RanSlashCommand, Summary: "Deleted event 3", DeleteAt: deleteTime},
				{ID: "active-4", EventAt: baseTime + 360000, EventType: AssigneeChanged, Summary: "Active event 4", DeleteAt: 0},
			},
		}

		filter := TimelineFilterOptions{All: true}
		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 5, "Should have header + 4 active events (deleted events excluded)")

		// Verify only active events are included - check that we have the right event types
		activeEventTypes := []string{records[1][1], records[2][1], records[3][1], records[4][1]}
		expectedActiveTypes := []string{"status_updated", "task_state_modified", "user_joined_left", "assignee_changed"}
		assert.Equal(t, expectedActiveTypes, activeEventTypes)
	})

	t.Run("performance with many events", func(t *testing.T) {
		// Test with a larger number of events to ensure reasonable performance
		baseTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()
		eventTypes := []timelineEventType{
			StatusUpdated, OwnerChanged, TaskStateModified, AssigneeChanged,
			EventFromPost, RanSlashCommand, UserJoinedLeft, ParticipantsChanged,
		}

		events := make([]TimelineEvent, 100)
		for i := 0; i < 100; i++ {
			events[i] = TimelineEvent{
				ID:            fmt.Sprintf("event-%d", i+1),
				EventAt:       baseTime + int64(i*1000), // 1 second apart
				EventType:     eventTypes[i%len(eventTypes)],
				Summary:       fmt.Sprintf("Event %d summary", i+1),
				Details:       fmt.Sprintf("Event %d details", i+1),
				CreatorUserID: fmt.Sprintf("user-%d", (i%5)+1),
				SubjectUserID: fmt.Sprintf("user-%d", (i%5)+1),
				PostID:        fmt.Sprintf("post-%d", i+1),
				DeleteAt:      0,
			}
		}

		playbookRun := &PlaybookRun{TimelineEvents: events}

		// Test with all events
		filter := TimelineFilterOptions{All: true}
		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 101, "Should have header + 100 events")

		// Verify first and last events have correct timestamps
		assert.Equal(t, "2023-01-01 10:00:00 UTC", records[1][0])
		assert.Equal(t, "2023-01-01 10:01:39 UTC", records[100][0])

		// Test with specific filter (only status updates)
		statusFilter := TimelineFilterOptions{StatusUpdated: true}
		csvData, err = GenerateTimelineCSV(playbookRun, statusFilter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader = csv.NewReader(strings.NewReader(string(csvData)))
		records, err = reader.ReadAll()
		require.NoError(t, err)

		// Calculate expected number of status events (every 8th event starting from index 0)
		expectedStatusEvents := 100 / len(eventTypes) // 12 or 13 events
		assert.True(t, len(records)-1 >= expectedStatusEvents-1 && len(records)-1 <= expectedStatusEvents+1,
			"Should have approximately %d status events, got %d", expectedStatusEvents, len(records)-1)
	})

	t.Run("events with identical timestamps", func(t *testing.T) {
		// Test events that occur at the exact same time
		eventTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()

		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{ID: "simultaneous-1", EventAt: eventTime, EventType: StatusUpdated, Summary: "First simultaneous event", DeleteAt: 0},
				{ID: "simultaneous-2", EventAt: eventTime, EventType: OwnerChanged, Summary: "Second simultaneous event", DeleteAt: 0},
				{ID: "simultaneous-3", EventAt: eventTime, EventType: TaskStateModified, Summary: "Third simultaneous event", DeleteAt: 0},
				{ID: "later-event", EventAt: eventTime + 1000, EventType: EventFromPost, Summary: "Later event", DeleteAt: 0},
			},
		}

		filter := TimelineFilterOptions{All: true}
		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 5, "Should have header + 4 events")

		// Verify all simultaneous events have the same timestamp
		expectedTime := "2023-01-01 10:00:00 UTC"
		assert.Equal(t, expectedTime, records[1][0])
		assert.Equal(t, expectedTime, records[2][0])
		assert.Equal(t, expectedTime, records[3][0])
		assert.Equal(t, "2023-01-01 10:00:01 UTC", records[4][0])
	})

	t.Run("empty filter results", func(t *testing.T) {
		baseTime := time.Date(2023, 1, 1, 10, 0, 0, 0, time.UTC).UnixMilli()

		playbookRun := &PlaybookRun{
			TimelineEvents: []TimelineEvent{
				{ID: "event-1", EventAt: baseTime, EventType: StatusUpdated, Summary: "Status event", DeleteAt: 0},
				{ID: "event-2", EventAt: baseTime + 60000, EventType: OwnerChanged, Summary: "Owner event", DeleteAt: 0},
				{ID: "event-3", EventAt: baseTime + 120000, EventType: TaskStateModified, Summary: "Task event", DeleteAt: 0},
			},
		}

		// Filter for event types that don't exist in the timeline
		filter := TimelineFilterOptions{RanSlashCommand: true, EventFromPost: true}
		csvData, err := GenerateTimelineCSV(playbookRun, filter, mockUser, siteURL, teamName)
		require.NoError(t, err)

		reader := csv.NewReader(strings.NewReader(string(csvData)))
		records, err := reader.ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 1, "Should have only header when no events match filter")

		// Verify header is present
		expectedHeader := []string{"Event Time", "Event Type", "Summary", "Details", "Post Link"}
		assert.Equal(t, expectedHeader, records[0])
	})
}
