// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestIncidentStore_CreateTimelineEvent(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		iStore := setupIncidentStore(t, db)
		_, store := setupSQLStore(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		t.Run("Save and retrieve 4 timeline events", func(t *testing.T) {
			createAt := model.GetMillis()
			inc01 := NewBuilder(nil).
				WithName("incident 1").
				WithCreateAt(createAt).
				WithChecklists([]int{8}).
				ToIncident()

			incdnt, err := iStore.CreateIncident(inc01)
			require.NoError(t, err)

			createIncidentChannel(t, store, inc01)

			event1 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt,
				EventAt:       1234,
				EventType:     incident.IncidentCreated,
				Summary:       "this is a summary",
				Details:       "these are the details",
				PostID:        "testpostID",
				SubjectUserID: "testuserID",
				CreatorUserID: "testUserID2",
			}
			_, err = iStore.CreateTimelineEvent(event1)
			require.NoError(t, err)

			event2 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 1,
				EventAt:       1235,
				EventType:     incident.AssigneeChanged,
				Summary:       "this is a summary",
				Details:       "these are the details",
				PostID:        "testpostID2",
				SubjectUserID: "testuserID",
				CreatorUserID: "testUserID2",
			}
			_, err = iStore.CreateTimelineEvent(event2)
			require.NoError(t, err)

			event3 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 2,
				EventAt:       1236,
				EventType:     incident.StatusUpdated,
				Summary:       "this is a summary",
				Details:       "these are the details",
				PostID:        "testpostID3",
				SubjectUserID: "testuserID",
				CreatorUserID: "testUserID2",
			}
			_, err = iStore.CreateTimelineEvent(event3)
			require.NoError(t, err)

			event4 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 3,
				EventAt:       123734,
				EventType:     incident.StatusUpdated,
				Summary:       "this is a summary",
				Details:       "these are the details",
				PostID:        "testpostID4",
				SubjectUserID: "testuserID",
				CreatorUserID: "testUserID2",
			}
			_, err = iStore.CreateTimelineEvent(event4)
			require.NoError(t, err)

			retIncident, err := iStore.GetIncident(incdnt.ID)
			require.NoError(t, err)

			require.Len(t, retIncident.TimelineEvents, 4)
			require.Equal(t, *event1, retIncident.TimelineEvents[0])
			require.Equal(t, *event2, retIncident.TimelineEvents[1])
			require.Equal(t, *event3, retIncident.TimelineEvents[2])
			require.Equal(t, *event4, retIncident.TimelineEvents[3])
		})
	}
}

func TestIncidentStore_UpdateTimelineEvent(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		iStore := setupIncidentStore(t, db)
		_, store := setupSQLStore(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		t.Run("Save 4 and delete 2 timeline events", func(t *testing.T) {
			createAt := model.GetMillis()
			inc01 := NewBuilder(nil).
				WithName("incident 1").
				WithCreateAt(createAt).
				WithChecklists([]int{8}).
				ToIncident()

			incdnt, err := iStore.CreateIncident(inc01)
			require.NoError(t, err)

			createIncidentChannel(t, store, inc01)

			event1 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt,
				EventType:     incident.IncidentCreated,
				PostID:        "testpostID",
				SubjectUserID: "testuserID",
			}
			_, err = iStore.CreateTimelineEvent(event1)
			require.NoError(t, err)

			event2 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 1,
				EventType:     incident.AssigneeChanged,
				PostID:        "testpostID2",
				SubjectUserID: "testuserID",
			}
			_, err = iStore.CreateTimelineEvent(event2)
			require.NoError(t, err)

			event3 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 2,
				EventAt:       1236,
				EventType:     incident.StatusUpdated,
				Summary:       "this is a summary",
				Details:       "these are the details",
				PostID:        "testpostID3",
				SubjectUserID: "testuserID",
				CreatorUserID: "testUserID2",
			}
			_, err = iStore.CreateTimelineEvent(event3)
			require.NoError(t, err)

			event4 := &incident.TimelineEvent{
				IncidentID:    incdnt.ID,
				CreateAt:      createAt + 3,
				EventType:     incident.StatusUpdated,
				PostID:        "testpostID4",
				SubjectUserID: "testuserID",
			}
			_, err = iStore.CreateTimelineEvent(event4)
			require.NoError(t, err)

			retIncident, err := iStore.GetIncident(incdnt.ID)
			require.NoError(t, err)

			require.Len(t, retIncident.TimelineEvents, 4)
			require.Equal(t, *event1, retIncident.TimelineEvents[0])
			require.Equal(t, *event2, retIncident.TimelineEvents[1])
			require.Equal(t, *event3, retIncident.TimelineEvents[2])
			require.Equal(t, *event4, retIncident.TimelineEvents[3])

			event3.DeleteAt = model.GetMillis()
			event3.EventAt = 34089143
			event3.EventType = incident.AssigneeChanged
			event3.Summary = "new summary"
			event3.Details = "new details"
			event3.PostID = "23abc34"
			event3.SubjectUserID = "23409agbcef"
			event3.CreatorUserID = "someoneelse"
			err = iStore.UpdateTimelineEvent(event3)
			require.NoError(t, err)

			event4.DeleteAt = model.GetMillis()
			err = iStore.UpdateTimelineEvent(event4)
			require.NoError(t, err)

			retIncident, err = iStore.GetIncident(incdnt.ID)
			require.NoError(t, err)

			require.Len(t, retIncident.TimelineEvents, 4)
			require.Equal(t, *event1, retIncident.TimelineEvents[0])
			require.Equal(t, *event2, retIncident.TimelineEvents[1])
			require.Equal(t, *event3, retIncident.TimelineEvents[2])
			require.Equal(t, *event4, retIncident.TimelineEvents[3])
		})
	}
}
