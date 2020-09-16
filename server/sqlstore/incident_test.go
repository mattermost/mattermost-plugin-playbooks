package sqlstore

import (
	"fmt"
	"strings"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

var (
	team1id = model.NewId()
	team2id = model.NewId()
	team3id = model.NewId()

	commander1 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 1",
	}
	commander2 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 2",
	}
	commander3 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 3",
	}
	commander4 = incident.CommanderInfo{
		UserID:   model.NewId(),
		Username: "Commander 4",
	}

	commanders = []incident.CommanderInfo{commander1, commander2, commander3, commander4}

	channelID01 = model.NewId()
	channelID02 = model.NewId()
	channelID03 = model.NewId()
	channelID04 = model.NewId()
	channelID05 = model.NewId()
	channelID06 = model.NewId()
	channelID07 = model.NewId()
	channelID08 = model.NewId()
	channelID09 = model.NewId()

	inc01 = *NewBuilder().
		WithName("incident 1 - wheel cat aliens wheelbarrow").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithChannelID(channelID01). // public
		WithIsActive(true).
		WithCommanderUserID(commander1.UserID).
		WithTeamID(team1id).
		WithCreateAt(123).
		WithEndAt(440).
		WithChecklists([]int{8}).
		ToIncident()

	inc02 = *NewBuilder().
		WithName("incident 2 - horse staple battery aliens shotgun mouse shotputmouse").
		WithChannelID(channelID02). // public
		WithIsActive(true).
		WithCommanderUserID(commander2.UserID).
		WithTeamID(team1id).
		WithCreateAt(199).
		WithEndAt(555).
		WithChecklists([]int{7}).
		ToIncident()

	inc03 = *NewBuilder().
		WithName("incident 3 - Hörse stapler battery shotgun mouse shotputmouse").
		WithChannelID(channelID03). // public
		WithIsActive(false).
		WithCommanderUserID(commander1.UserID).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithEndAt(666).
		WithChecklists([]int{6}).
		ToIncident()

	inc04 = *NewBuilder().
		WithName("incident 4 - titanic terminatoraliens").
		WithChannelID(channelID04). // private
		WithIsActive(false).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team1id).
		WithCreateAt(333).
		WithEndAt(444).
		WithChecklists([]int{5}).
		ToIncident()

	inc05 = *NewBuilder().
		WithName("incident 5 - titanic terminator aliens mouse").
		WithChannelID(channelID05). // private
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team1id).
		WithCreateAt(400).
		WithEndAt(500).
		WithChecklists([]int{1}).
		ToIncident()

	inc06 = *NewBuilder().
		WithName("incident 6 - ubik high castle electric sheep").
		WithChannelID(channelID06). // public
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(444).
		WithEndAt(550).
		WithChecklists([]int{4}).
		ToIncident()

	inc07 = *NewBuilder().
		WithName("incident 7 - ubik high castle electric sheep").
		WithChannelID(channelID07). // private
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(555).
		WithEndAt(660).
		WithChecklists([]int{4}).
		ToIncident()

	inc08 = *NewBuilder().
		WithName("incident 8 - ziggurat!").
		WithChannelID(channelID08). // private
		WithIsActive(true).
		WithCommanderUserID(commander4.UserID).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithEndAt(777).
		WithChecklists([]int{3}).
		ToIncident()

	inc09 = *NewBuilder().
		WithName("incident 9 - Ziggürat!").
		WithChannelID(channelID09). // private
		WithIsActive(true).
		WithCommanderUserID(commander4.UserID).
		WithTeamID(team3id).
		WithCreateAt(556).
		WithEndAt(778).
		WithChecklists([]int{2}).
		ToIncident()

	incidents = []incident.Incident{inc01, inc02, inc03, inc04, inc05, inc06, inc07, inc08, inc09}
)

func TestGetIncidents(t *testing.T) {
	createIncidents := func(store incident.Store) {
		t.Helper()

		createdIncidents := make([]incident.Incident, len(incidents))

		for i := range incidents {
			createdIncident, err := store.CreateIncident(&incidents[i])
			require.NoError(t, err)

			createdIncidents[i] = *createdIncident
		}
	}

	testData := []struct {
		Name          string
		RequesterInfo incident.RequesterInfo
		Options       incident.HeaderFilterOptions
		Want          incident.GetIncidentsResults
		ExpectedErr   error
	}{
		{
			Name: "no options - team1 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc01, inc02, inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - desc - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
				Order:  "desc",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - sort by CreateAt desc - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
				Sort:   incident.SortByCreateAt,
				Order:  incident.OrderDesc,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, team3, sort by Name",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team3id,
				Sort:   incident.SortByName,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc08, inc09},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, team2, sort by EndAt",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
				Sort:   incident.SortByEndAt,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc06, inc07},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team paged by 1, admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    0,
				PerPage: 1,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  5,
				HasMore:    true,
				Items:      []incident.Incident{inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 0 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    0,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    true,
				Items:      []incident.Incident{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 1 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    1,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []incident.Incident{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    2,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 999 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    999,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 2 by 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    2,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    false,
				Items:      []incident.Incident{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 1 by 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc03, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 1 by 4 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    1,
				PerPage: 4,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  2,
				HasMore:    false,
				Items:      []incident.Incident{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - sorted by ended, desc, page 1 by 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Sort:    "end_at",
				Order:   "desc",
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - only active, page 1 by 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:  team1id,
				Page:    1,
				PerPage: 2,
				Status:  incident.Ongoing,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []incident.Incident{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - active, commander3, desc - admin ",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team1id,
				Status:      incident.Ongoing,
				CommanderID: commander3.UserID,
				Order:       "desc",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - commander1, desc, by end_at - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team1id,
				CommanderID: commander1.UserID,
				Order:       "desc",
				Sort:        "end_at",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc03, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - search for horse - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team1id,
				SearchTerm: "horse",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - search for mouse, endat - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team1id,
				SearchTerm: "mouse",
				Sort:       "end_at",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc05, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - search for aliens & commander3 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team1id,
				CommanderID: commander3.UserID,
				SearchTerm:  "aliens",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters -- not implemented",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team1id,
				SearchTerm: "sbsm",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters, active -- not implemented",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team1id,
				SearchTerm: "sbsm",
				Status:     incident.Ongoing,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "team3 - case-insensitive and unicode-normalized - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team3id,
				SearchTerm: "ziggurat",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc08, inc09},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team3 - case-insensitive and unicode-normalized with unicode search term - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team3id,
				SearchTerm: "ziggūràt",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc08, inc09},
			},
			ExpectedErr: nil,
		},
		{
			Name: "bad parameter sort",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
				Sort:   "unknown_field",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'sort'"),
		},
		{
			Name: "bad team id",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters"),
		},
		{
			Name: "bad parameter order by",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
				Order:  "invalid order",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'order_by'"),
		},
		{
			Name: "bad commander id",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team2id,
				CommanderID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'commander_id': must be 26 characters or blank"),
		},
		{
			Name: "team1 - desc - Bob (in all channels)",
			RequesterInfo: incident.RequesterInfo{
				UserID: "Bob",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
				Order:  "desc",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 -  Bob (in all channels)",
			RequesterInfo: incident.RequesterInfo{
				UserID: "Bob",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc06, inc07},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Alice (in no channels but member of team, can see public incidents)",
			RequesterInfo: incident.RequesterInfo{
				UserID:              "Alice",
				CanViewTeamChannels: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc01, inc02, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Alice (in no channels and not member of team)",
			RequesterInfo: incident.RequesterInfo{
				UserID:              "Alice",
				CanViewTeamChannels: false,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Charlotte (in no channels but member of team)",
			RequesterInfo: incident.RequesterInfo{
				UserID:              "Charlotte",
				IsAdmin:             false,
				CanViewTeamChannels: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc06},
			},
			ExpectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		_, _, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)
		addUsers(t, store, []string{"Lucy", "Bob"})
		addUsersToTeam(t, store, []string{"Alice", "Charlotte"}, team1id)
		addUsersToTeam(t, store, []string{"Charlotte"}, team2id)
		addUsersToChannels(t, store, []string{"Bob"}, []string{channelID01, channelID02, channelID03, channelID04, channelID05, channelID06, channelID07, channelID08, channelID09})
		makeChannelsPublicOrPrivate(t, store, []string{channelID01, channelID02, channelID03, channelID06}, true)
		makeChannelsPublicOrPrivate(t, store, []string{channelID04, channelID05, channelID07, channelID08, channelID09}, false)
		makeAdmin(t, store, "Lucy")

		t.Run("zero incidents", func(t *testing.T) {
			result, err := incidentStore.GetIncidents(incident.RequesterInfo{
				UserID:              "Lucy",
				IsAdmin:             true,
				CanViewTeamChannels: false,
			},
				incident.HeaderFilterOptions{
					TeamID:  team1id,
					Page:    0,
					PerPage: 10,
				})
			require.NoError(t, err)

			require.Equal(t, 0, result.TotalCount)
			require.Equal(t, 0, result.PageCount)
			require.False(t, result.HasMore)
			require.Equal(t, []incident.Incident(nil), result.Items)
		})

		createIncidents(incidentStore)

		for _, testCase := range testData {
			t.Run(driverName+" - "+testCase.Name, func(t *testing.T) {
				result, err := incidentStore.GetIncidents(testCase.RequesterInfo, testCase.Options)

				if testCase.ExpectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, item := range result.Items {
					require.True(t, model.IsValidId(item.ID))
					item.ID = ""
					result.Items[i] = item
				}

				// remove the checklists from the expected incidents--we don't return them in getIncidents
				for i := range testCase.Want.Items {
					testCase.Want.Items[i].Checklists = nil
				}

				require.Equal(t, testCase.Want, *result)
			})
		}
	}
}

func TestCreateAndGetIncident(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		validIncidents := []struct {
			Name        string
			Incident    *incident.Incident
			ExpectedErr error
		}{
			{
				Name:        "Empty values",
				Incident:    &incident.Incident{},
				ExpectedErr: nil,
			},
			{
				Name:        "Base incident",
				Incident:    NewBuilder().ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Name with unicode characters",
				Incident:    NewBuilder().WithName("valid unicode: ñäåö").ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Created at 0",
				Incident:    NewBuilder().WithCreateAt(0).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Deleted incident",
				Incident:    NewBuilder().WithDeleteAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Ended incident",
				Incident:    NewBuilder().WithEndAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Inactive incident",
				Incident:    NewBuilder().WithIsActive(false).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with one checklist and 10 items",
				Incident:    NewBuilder().WithChecklists([]int{10}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with five checklists with different number of items",
				Incident:    NewBuilder().WithChecklists([]int{1, 2, 3, 4, 5}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident should not be nil",
				Incident:    nil,
				ExpectedErr: errors.New("incident is nil"),
			},
			{
				Name:        "Incident should not have ID set",
				Incident:    NewBuilder().WithID().ToIncident(),
				ExpectedErr: errors.New("ID should not be set"),
			},
			{
				Name:        "Incident should not contain checklists with no items",
				Incident:    NewBuilder().WithChecklists([]int{0}).ToIncident(),
				ExpectedErr: errors.New("checklists with no items are not allowed"),
			},
		}

		for _, testCase := range validIncidents {
			t.Run(testCase.Name, func(t *testing.T) {
				var expectedIncident incident.Incident
				if testCase.Incident != nil {
					expectedIncident = *testCase.Incident
				}

				returned, err := incidentStore.CreateIncident(testCase.Incident)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					require.Nil(t, returned)
					return
				}

				require.NoError(t, err)
				require.True(t, model.IsValidId(returned.ID))
				expectedIncident.ID = returned.ID

				actualIncident, err := incidentStore.GetIncident(expectedIncident.ID)
				require.NoError(t, err)

				require.Equal(t, &expectedIncident, actualIncident)
			})
		}
	}
}

// TestGetIncident only tests getting a non-existent incident, since getting existing incidents
// is tested in TestCreateAndGetIncident above.
func TestGetIncident(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		validIncidents := []struct {
			Name        string
			ID          string
			ExpectedErr error
		}{
			{
				Name:        "Get a non-existing incident",
				ID:          "nonexisting",
				ExpectedErr: errors.New("incident with id 'nonexisting' does not exist: not found"),
			},
			{
				Name:        "Get without ID",
				ID:          "",
				ExpectedErr: errors.New("ID cannot be empty"),
			},
		}

		for _, testCase := range validIncidents {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := incidentStore.GetIncident(testCase.ID)

				require.Error(t, err)
				require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
				require.Nil(t, returned)
			})
		}
	}
}

func TestUpdateIncident(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		validIncidents := []struct {
			Name        string
			Incident    *incident.Incident
			Update      func(incident.Incident) *incident.Incident
			ExpectedErr error
		}{
			{
				Name:     "nil incident",
				Incident: NewBuilder().ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					return nil
				},
				ExpectedErr: errors.New("incident is nil"),
			},
			{
				Name:     "id should not be empty",
				Incident: NewBuilder().ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.ID = ""
					return &old
				},
				ExpectedErr: errors.New("ID should not be empty"),
			},
			{
				Name:     "Incident should not contain checklists with no items",
				Incident: NewBuilder().WithChecklists([]int{1}).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Checklists[0].Items = []playbook.ChecklistItem{}
					return &old
				},
				ExpectedErr: errors.New("checklists with no items are not allowed"),
			},
			{
				Name:     "Not active",
				Incident: NewBuilder().ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.IsActive = false
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "new description",
				Incident: NewBuilder().WithDescription("old description").ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Description = "new description"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "deleted",
				Incident: NewBuilder().ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.DeleteAt = model.GetMillis()
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "ended",
				Incident: NewBuilder().ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.EndAt = model.GetMillis()
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "Incident with 2 checklists, update the checklists a bit",
				Incident: NewBuilder().WithChecklists([]int{1, 1}).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Checklists[0].Items[0].State = playbook.ChecklistItemStateClosed
					old.Checklists[1].Items[0].Title = "new title"
					return &old
				},
				ExpectedErr: nil,
			},
		}

		for _, testCase := range validIncidents {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := incidentStore.CreateIncident(testCase.Incident)
				require.NoError(t, err)
				expected := testCase.Update(*returned)

				err = incidentStore.UpdateIncident(expected)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					return
				}

				require.NoError(t, err)

				actual, err := incidentStore.GetIncident(expected.ID)
				require.NoError(t, err)
				require.Equal(t, expected, actual)
			})
		}
	}
}

func TestGetIncidentIDForChannel(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		t.Run("retrieve existing incidentID", func(t *testing.T) {
			incident1 := NewBuilder().ToIncident()
			incident2 := NewBuilder().ToIncident()

			returned1, err := incidentStore.CreateIncident(incident1)
			require.NoError(t, err)
			returned2, err := incidentStore.CreateIncident(incident2)
			require.NoError(t, err)

			id1, err := incidentStore.GetIncidentIDForChannel(incident1.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned1.ID, id1)
			id2, err := incidentStore.GetIncidentIDForChannel(incident2.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned2.ID, id2)
		})
		t.Run("fail to retrieve non-existing incidentID", func(t *testing.T) {
			id1, err := incidentStore.GetIncidentIDForChannel("nonexistingid")
			require.Error(t, err)
			require.Equal(t, "", id1)
			require.True(t, strings.HasPrefix(err.Error(),
				"channel with id (nonexistingid) does not have an incident"))
		})
	}
}

func TestGetCommanders(t *testing.T) {
	cases := []struct {
		Name          string
		RequesterInfo incident.RequesterInfo
		Options       incident.HeaderFilterOptions
		Expected      []incident.CommanderInfo
		ExpectedErr   error
	}{
		{
			Name: "team 1 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Expected:    []incident.CommanderInfo{commander1, commander2, commander3},
			ExpectedErr: nil,
		},
		{
			Name: "team 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Expected:    []incident.CommanderInfo{commander3},
			ExpectedErr: nil,
		},
		{
			Name: "team 3 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team3id,
			},
			Expected:    []incident.CommanderInfo{commander4},
			ExpectedErr: nil,
		},
		{
			Name: "team 1 - non-member",
			RequesterInfo: incident.RequesterInfo{
				UserID: "non-existing-id",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "team 2 - non-member",
			RequesterInfo: incident.RequesterInfo{
				UserID: "non-existing-id",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "team 3 - non-member",
			RequesterInfo: incident.RequesterInfo{
				UserID: "non-existing-id",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team3id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Alice (in no channels but member of team, can see public incidents)",
			RequesterInfo: incident.RequesterInfo{
				UserID:              "Alice",
				CanViewTeamChannels: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Expected:    []incident.CommanderInfo{commander1, commander2},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Alice (in no channels and not member of team)",
			RequesterInfo: incident.RequesterInfo{
				UserID: "Alice",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Expected:    nil,
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Charlotte (in no channels but member of team)",
			RequesterInfo: incident.RequesterInfo{
				UserID:              "Charlotte",
				CanViewTeamChannels: true,
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team2id,
			},
			Expected:    []incident.CommanderInfo{commander3},
			ExpectedErr: nil,
		},
		{
			Name: "no team - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:  "Lucy",
				IsAdmin: true,
			},
			Options:     incident.HeaderFilterOptions{},
			Expected:    nil,
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters"),
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		_, _, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupChannelMemberHistoryTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)

		addUsers(t, store, []string{"Lucy"})
		makeAdmin(t, store, "Lucy")
		addUsersToTeam(t, store, []string{"Alice", "Charlotte"}, team1id)
		addUsersToTeam(t, store, []string{"Charlotte"}, team2id)
		addUsersToChannels(t, store, []string{"Bob"}, []string{channelID01, channelID02, channelID03, channelID04, channelID05, channelID06, channelID07, channelID08, channelID09})
		makeChannelsPublicOrPrivate(t, store, []string{channelID01, channelID02, channelID03, channelID06}, true)
		makeChannelsPublicOrPrivate(t, store, []string{channelID04, channelID05, channelID07, channelID08, channelID09}, false)

		queryBuilder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
		if driverName == model.DATABASE_DRIVER_POSTGRES {
			queryBuilder = queryBuilder.PlaceholderFormat(sq.Dollar)
		}

		insertCommander := queryBuilder.Insert("Users").Columns("ID", "Username")
		for _, commander := range commanders {
			insertCommander = insertCommander.Values(commander.UserID, commander.Username)
		}

		query, args, err := insertCommander.ToSql()
		require.NoError(t, err)
		_, err = db.Exec(query, args...)
		require.NoError(t, err)

		for i := range incidents {
			_, err := incidentStore.CreateIncident(&incidents[i])
			require.NoError(t, err)
		}

		for _, testCase := range cases {
			t.Run(testCase.Name, func(t *testing.T) {
				actual, actualErr := incidentStore.GetCommanders(testCase.RequesterInfo, testCase.Options)

				if testCase.ExpectedErr != nil {
					require.NotNil(t, actualErr)
					require.Equal(t, testCase.ExpectedErr.Error(), actualErr.Error())
					require.Nil(t, actual)
					return
				}

				require.NoError(t, actualErr)

				require.ElementsMatch(t, testCase.Expected, actual)
			})
		}
	}
}

func TestNukeDB(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		t.Run("nuke db with a few incidents in it", func(t *testing.T) {
			for i := 0; i < 10; i++ {
				newIncident := NewBuilder().ToIncident()
				_, err := incidentStore.CreateIncident(newIncident)
				require.NoError(t, err)
			}

			var rows int64
			err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 10, int(rows))

			err = incidentStore.NukeDB()
			require.NoError(t, err)

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))

			// TODO: test for playbooks and playbook members
		})
	}
}

func setupIncidentStore(t *testing.T, db *sqlx.DB) incident.Store {
	return NewIncidentStore(setupSQLStore(t, db))
}

// IncidentBuilder is a utility to build incidents with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToIncident()
type IncidentBuilder struct {
	*incident.Incident
}

func NewBuilder() *IncidentBuilder {
	return &IncidentBuilder{
		&incident.Incident{
			Header: incident.Header{
				Name:            "base incident",
				IsActive:        true,
				CommanderUserID: model.NewId(),
				TeamID:          model.NewId(),
				ChannelID:       model.NewId(),
				CreateAt:        model.GetMillis(),
				EndAt:           0,
				DeleteAt:        0,
				ActiveStage:     0,
			},
			PostID:     model.NewId(),
			PlaybookID: model.NewId(),
			Checklists: nil,
		},
	}
}

func (t *IncidentBuilder) WithName(name string) *IncidentBuilder {
	t.Name = name

	return t
}

func (t *IncidentBuilder) WithDescription(desc string) *IncidentBuilder {
	t.Description = desc

	return t
}

func (t *IncidentBuilder) WithID() *IncidentBuilder {
	t.ID = model.NewId()

	return t
}

func (t *IncidentBuilder) ToIncident() *incident.Incident {
	return t.Incident
}

func (t *IncidentBuilder) WithCreateAt(createAt int64) *IncidentBuilder {
	t.CreateAt = createAt

	return t
}

func (t *IncidentBuilder) WithEndAt(endAt int64) *IncidentBuilder {
	t.EndAt = endAt

	return t
}

func (t *IncidentBuilder) WithDeleteAt(deleteAt int64) *IncidentBuilder {
	t.DeleteAt = deleteAt

	return t
}

func (t *IncidentBuilder) WithChecklists(itemsPerChecklist []int) *IncidentBuilder {
	t.Checklists = make([]playbook.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		items := make([]playbook.ChecklistItem, numItems)
		for j := 0; j < numItems; j++ {
			items[j] = playbook.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			}
		}

		t.Checklists[i] = playbook.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	return t
}

func (t *IncidentBuilder) WithCommanderUserID(id string) *IncidentBuilder {
	t.CommanderUserID = id

	return t
}

func (t *IncidentBuilder) WithTeamID(id string) *IncidentBuilder {
	t.TeamID = id

	return t
}

func (t *IncidentBuilder) WithIsActive(isActive bool) *IncidentBuilder {
	t.IsActive = isActive

	return t
}

func (t *IncidentBuilder) WithChannelID(id string) *IncidentBuilder {
	t.ChannelID = id

	return t
}
