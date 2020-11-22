package sqlstore

import (
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-incident-management/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
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

	lucy = userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	bob = userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	john = userInfo{
		ID:   model.NewId(),
		Name: "john",
	}

	jane = userInfo{
		ID:   model.NewId(),
		Name: "jane",
	}

	alice = userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	charlotte = userInfo{
		ID:   model.NewId(),
		Name: "Charlotte",
	}

	channelID01 = model.NewId()
	channelID02 = model.NewId()
	channelID03 = model.NewId()
	channelID04 = model.NewId()
	channelID05 = model.NewId()
	channelID06 = model.NewId()
	channelID07 = model.NewId()
	channelID08 = model.NewId()
	channelID09 = model.NewId()

	post1 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 10000000,
		DeleteAt: 0,
	}
	post2 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 20000000,
		DeleteAt: 0,
	}
	post3 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 30000000,
		DeleteAt: 0,
	}
	post4 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000000,
		DeleteAt: 40300000,
	}
	post5 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000001,
		DeleteAt: 0,
	}
	post6 = &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000002,
		DeleteAt: 0,
	}
	allPosts = []*model.Post{post1, post2, post3, post4, post5, post6}

	inc01 = *NewBuilder(nil).
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

	inc02 = *NewBuilder(nil).
		WithName("incident 2 - horse staple battery aliens shotgun mouse shotputmouse").
		WithChannelID(channelID02). // public
		WithIsActive(true).
		WithCommanderUserID(commander2.UserID).
		WithTeamID(team1id).
		WithCreateAt(199).
		WithEndAt(555).
		WithChecklists([]int{7}).
		ToIncident()

	inc03 = *NewBuilder(nil).
		WithName("incident 3 - Horse stapler battery shotgun mouse shotputmouse").
		WithChannelID(channelID03). // public
		WithIsActive(false).
		WithCommanderUserID(commander1.UserID).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithEndAt(666).
		WithChecklists([]int{6}).
		ToIncident()

	inc04 = *NewBuilder(nil).
		WithName("incident 4 - titanic terminatoraliens").
		WithChannelID(channelID04). // private
		WithIsActive(false).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team1id).
		WithCreateAt(333).
		WithEndAt(444).
		WithChecklists([]int{5}).
		ToIncident()

	inc05 = *NewBuilder(nil).
		WithName("incident 5 - titanic terminator aliens mouse").
		WithChannelID(channelID05). // private
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team1id).
		WithCreateAt(400).
		WithEndAt(500).
		WithChecklists([]int{1}).
		ToIncident()

	inc06 = *NewBuilder(nil).
		WithName("incident 6 - ubik high castle electric sheep").
		WithChannelID(channelID06). // public
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(444).
		WithEndAt(550).
		WithChecklists([]int{4}).
		ToIncident()

	inc07 = *NewBuilder(nil).
		WithName("incident 7 - ubik high castle electric sheep").
		WithChannelID(channelID07). // private
		WithIsActive(true).
		WithCommanderUserID(commander3.UserID).
		WithTeamID(team2id).
		WithCreateAt(555).
		WithEndAt(660).
		WithChecklists([]int{4}).
		ToIncident()

	inc08 = *NewBuilder(nil).
		WithName("incident 8 - ziggürat!").
		WithChannelID(channelID08). // private
		WithIsActive(true).
		WithCommanderUserID(commander4.UserID).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithEndAt(777).
		WithChecklists([]int{3}).
		ToIncident()

	inc09 = *NewBuilder(nil).
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:    team1id,
				Direction: "desc",
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:    team2id,
				Sort:      incident.SortByCreateAt,
				Direction: incident.DirectionDesc,
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				Items:      []incident.Incident{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - paged by 3, page 999 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				Items:      []incident.Incident{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, team1 - page 2 by 2 - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:    team1id,
				Sort:      "end_at",
				Direction: "desc",
				Page:      1,
				PerPage:   2,
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team1id,
				Status:      incident.Ongoing,
				CommanderID: commander3.UserID,
				Direction:   "desc",
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:      team1id,
				CommanderID: commander1.UserID,
				Direction:   "desc",
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team1id,
				SearchTerm: "sbsm",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []incident.Incident{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters, active -- not implemented",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				Items:      []incident.Incident{},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team3 - case-insensitive and unicode characters - admin",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:     team3id,
				SearchTerm: "ZiGgüRat",
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters"),
		},
		{
			Name: "bad parameter direction by",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:    team2id,
				Direction: "invalid direction",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'direction'"),
		},
		{
			Name: "bad commander id",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID: bob.ID,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:    team1id,
				Direction: "desc",
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
				UserID: bob.ID,
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
			Name: "team1 - Alice (in no channels but member of team (because request must have made it through the API team membership test to the store), can see public incidents)",
			RequesterInfo: incident.RequesterInfo{
				UserID: alice.ID,
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
			Name: "team2 - Charlotte (in no channels but member of team -- because her request must have made it to the store through the API's team membership check)",
			RequesterInfo: incident.RequesterInfo{
				UserID: charlotte.ID,
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
		{
			Name: "team1 - Admin gets incidents with John as member",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:   team1id,
				MemberID: john.ID,
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
			Name: "team1 - Admin gets incidents with Jane as member",
			RequesterInfo: incident.RequesterInfo{
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID:   team1id,
				MemberID: jane.ID,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - John gets its own incidents",
			RequesterInfo: incident.RequesterInfo{
				UserID: john.ID,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:   team1id,
				MemberID: john.ID,
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
			Name: "team1 - Jane gets its own incidents",
			RequesterInfo: incident.RequesterInfo{
				UserID: jane.ID,
			},
			Options: incident.HeaderFilterOptions{
				TeamID:   team1id,
				MemberID: jane.ID,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc03, inc04, inc05},
			},
			ExpectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		_, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		addUsers(t, store, []userInfo{lucy, bob, john, jane})
		addUsersToTeam(t, store, []userInfo{alice, charlotte, john, jane}, team1id)
		addUsersToTeam(t, store, []userInfo{charlotte}, team2id)
		addUsersToChannels(t, store, []userInfo{bob}, []string{channelID01, channelID02, channelID03, channelID04, channelID05, channelID06, channelID07, channelID08, channelID09})
		addUsersToChannels(t, store, []userInfo{john}, []string{channelID01, channelID02, channelID03})
		addUsersToChannels(t, store, []userInfo{jane}, []string{channelID03, channelID04, channelID05})
		makeChannelsPublicOrPrivate(t, store, []string{channelID01, channelID02, channelID03, channelID06}, true)
		makeChannelsPublicOrPrivate(t, store, []string{channelID04, channelID05, channelID07, channelID08, channelID09}, false)
		makeAdmin(t, store, lucy)

		t.Run("zero incidents", func(t *testing.T) {
			result, err := incidentStore.GetIncidents(incident.RequesterInfo{
				UserID: lucy.ID,
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
			require.Empty(t, result.Items)
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

				require.Equal(t, testCase.Want, *result)
			})
		}
	}
}

func TestCreateAndGetIncident(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)
		setupPostsTable(t, db)

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
				Incident:    NewBuilder(t).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Name with unicode characters",
				Incident:    NewBuilder(t).WithName("valid unicode: ñäåö").ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Created at 0",
				Incident:    NewBuilder(t).WithCreateAt(0).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Deleted incident",
				Incident:    NewBuilder(t).WithDeleteAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Ended incident",
				Incident:    NewBuilder(t).WithEndAt(model.GetMillis()).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Inactive incident",
				Incident:    NewBuilder(t).WithIsActive(false).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with one checklist and 10 items",
				Incident:    NewBuilder(t).WithChecklists([]int{10}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident with five checklists with different number of items",
				Incident:    NewBuilder(t).WithChecklists([]int{1, 2, 3, 4, 5}).ToIncident(),
				ExpectedErr: nil,
			},
			{
				Name:        "Incident should not be nil",
				Incident:    nil,
				ExpectedErr: errors.New("incident is nil"),
			},
			{
				Name:        "Incident should not have ID set",
				Incident:    NewBuilder(t).WithID().ToIncident(),
				ExpectedErr: errors.New("ID should not be set"),
			},
			{
				Name:        "Incident /can/ contain checklists with no items",
				Incident:    NewBuilder(t).WithChecklists([]int{0}).ToIncident(),
				ExpectedErr: nil,
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
		_, store := setupSQLStore(t, db)

		setupPostsTable(t, db)
		savePosts(t, store, allPosts)

		validIncidents := []struct {
			Name        string
			Incident    *incident.Incident
			Update      func(incident.Incident) *incident.Incident
			ExpectedErr error
		}{
			{
				Name:     "nil incident",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					return nil
				},
				ExpectedErr: errors.New("incident is nil"),
			},
			{
				Name:     "id should not be empty",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.ID = ""
					return &old
				},
				ExpectedErr: errors.New("ID should not be empty"),
			},
			{
				Name:     "Incident /can/ contain checklists with no items",
				Incident: NewBuilder(t).WithChecklists([]int{1}).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Checklists[0].Items = nil
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "Not active",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.IsActive = false
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "new description",
				Incident: NewBuilder(t).WithDescription("old description").ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Description = "new description"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "deleted",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.DeleteAt = model.GetMillis()
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "ended",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.EndAt = model.GetMillis()
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "Incident with 2 checklists, update the checklists a bit",
				Incident: NewBuilder(t).WithChecklists([]int{1, 1}).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.Checklists[0].Items[0].State = playbook.ChecklistItemStateClosed
					old.Checklists[1].Items[0].Title = "new title"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "Incident with no updates, add an update postid",
				Incident: NewBuilder(t).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.StatusPostIDs = append(old.StatusPostIDs, post1.Id)
					addStatusPostsToIncidentFromIDs(t, &old, allPosts, []string{post1.Id})
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:     "Incident with a few updates, add an update postid",
				Incident: NewBuilder(t).WithUpdateStatusIDs(allPosts, []string{post2.Id, post3.Id, post4.Id}).ToIncident(),
				Update: func(old incident.Incident) *incident.Incident {
					old.StatusPostIDs = append(old.StatusPostIDs, post5.Id)
					addStatusPostsToIncidentFromIDs(t, &old, allPosts, []string{post5.Id})
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

// intended to catch problems with the code assembling StatusPosts
func TestStressTestGetIncidents(t *testing.T) {
	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test. Keep them low for CI.
	numIncidents := 100
	postsPerIncident := 3
	perPage := 10
	verifyPages := []int{0, 2, 4, 6, 8}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)
		_, store := setupSQLStore(t, db)

		setupPostsTable(t, db)
		teamID := model.NewId()
		withPosts := createIncidentsAndPosts(t, store, incidentStore, numIncidents, postsPerIncident, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			for _, p := range verifyPages {
				returned, err := incidentStore.GetIncidents(incident.RequesterInfo{
					UserID:          "testID",
					UserIDtoIsAdmin: map[string]bool{"testID": true},
				}, incident.HeaderFilterOptions{
					TeamID:  teamID,
					Page:    p,
					PerPage: perPage,
					Sort:    "create_at",
				})
				require.NoError(t, err)
				numRet := min(perPage, len(withPosts))
				assert.Equal(t, numRet, len(returned.Items))
				for i := 0; i < numRet; i++ {
					idx := p*perPage + i
					assert.ElementsMatch(t, withPosts[idx].StatusPosts, returned.Items[i].StatusPosts)
					assert.ElementsMatch(t, withPosts[idx].StatusPostIDs, returned.Items[i].StatusPostIDs)
					expWithoutStatusPosts := withPosts[idx]
					expWithoutStatusPosts.StatusPosts = nil
					expWithoutStatusPosts.StatusPostIDs = nil
					actWithoutStatusPosts := returned.Items[i]
					actWithoutStatusPosts.StatusPosts = nil
					actWithoutStatusPosts.StatusPostIDs = nil
					assert.Equal(t, expWithoutStatusPosts, actWithoutStatusPosts)
				}
			}
		})
	}
}

func TestStressTestGetIncidentsStats(t *testing.T) {
	// don't need to assemble stats in CI
	t.SkipNow()

	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test.
	numIncidents := 1000
	postsPerIncident := 3
	perPage := 10

	// For stats:
	numReps := 30

	// so we don't start returning pages with 0 incidents:
	require.LessOrEqual(t, numReps*perPage, numIncidents)

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)
		_, store := setupSQLStore(t, db)

		setupPostsTable(t, db)
		teamID := model.NewId()
		_ = createIncidentsAndPosts(t, store, incidentStore, numIncidents, postsPerIncident, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			intervals := make([]int64, 0, numReps)
			for i := 0; i < numReps; i++ {
				start := time.Now()
				_, err := incidentStore.GetIncidents(incident.RequesterInfo{
					UserID:          "testID",
					UserIDtoIsAdmin: map[string]bool{"testID": true},
				}, incident.HeaderFilterOptions{
					TeamID:  teamID,
					Page:    i,
					PerPage: perPage,
					Sort:    "create_at",
				})
				intervals = append(intervals, time.Since(start).Milliseconds())
				require.NoError(t, err)
			}
			cil, ciu := ciForN30(intervals)
			fmt.Printf("Mean: %.2f\tStdErr: %.2f\t95%% CI: (%.2f, %.2f)\n",
				mean(intervals), stdErr(intervals), cil, ciu)
		})
	}
}

func createIncidentsAndPosts(t testing.TB, store *SQLStore, incidentStore incident.Store, numIncidents, maxPostsPerIncident int, teamID string) []incident.Incident {
	incidentsSorted := make([]incident.Incident, 0, numIncidents)
	for i := 0; i < numIncidents; i++ {
		numPosts := maxPostsPerIncident
		posts := make([]*model.Post, 0, numPosts)
		postIDs := make([]string, 0, numPosts)
		for j := 0; j < numPosts; j++ {
			post := newPost(rand.Intn(2) == 0)
			posts = append(posts, post)
			postIDs = append(postIDs, post.Id)
		}
		savePosts(t, store, posts)

		inc := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(int64(100000+i)).
			WithName(fmt.Sprintf("incident %d", i)).
			WithChecklists([]int{1}).
			WithUpdateStatusIDs(posts, postIDs).
			ToIncident()
		ret, err := incidentStore.CreateIncident(inc)
		require.NoError(t, err)
		incidentsSorted = append(incidentsSorted, *ret)
	}

	return incidentsSorted
}

func newPost(deleted bool) *model.Post {
	createAt := rand.Int63()
	deleteAt := int64(0)
	if deleted {
		deleteAt = createAt + 100
	}
	return &model.Post{
		Id:       model.NewId(),
		CreateAt: createAt,
		DeleteAt: deleteAt,
	}
}

func TestGetIncidentIDForChannel(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		t.Run("retrieve existing incidentID", func(t *testing.T) {
			incident1 := NewBuilder(t).ToIncident()
			incident2 := NewBuilder(t).ToIncident()

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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team3id,
			},
			Expected:    []incident.CommanderInfo{commander4},
			ExpectedErr: nil,
		},
		{
			Name: "team1 - Alice (in no channels but member of team (because must have made it through API team membership test), can see public incidents)",
			RequesterInfo: incident.RequesterInfo{
				UserID: "Alice",
			},
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
			},
			Expected:    []incident.CommanderInfo{commander1, commander2},
			ExpectedErr: nil,
		},
		{
			Name: "team2 - Charlotte (in no channels but member of team, because must have made it through API team membership test)",
			RequesterInfo: incident.RequesterInfo{
				UserID: "Charlotte",
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
				UserID:          lucy.ID,
				UserIDtoIsAdmin: map[string]bool{lucy.ID: true},
			},
			Options:     incident.HeaderFilterOptions{},
			Expected:    nil,
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters"),
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)

		_, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupChannelMemberHistoryTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		addUsers(t, store, []userInfo{lucy})
		makeAdmin(t, store, lucy)
		addUsersToTeam(t, store, []userInfo{alice, charlotte}, team1id)
		addUsersToTeam(t, store, []userInfo{charlotte}, team2id)
		addUsersToChannels(t, store, []userInfo{bob}, []string{channelID01, channelID02, channelID03, channelID04, channelID05, channelID06, channelID07, channelID08, channelID09})
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
				newIncident := NewBuilder(t).ToIncident()
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

func setupIncidentStore(t testing.TB, db *sqlx.DB) incident.Store {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	logger, sqlStore := setupSQLStore(t, db)

	return NewIncidentStore(pluginAPIClient, logger, sqlStore)
}

// IncidentBuilder is a utility to build incidents with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToIncident()
type IncidentBuilder struct {
	t testing.TB
	i *incident.Incident
}

func NewBuilder(t testing.TB) *IncidentBuilder {
	return &IncidentBuilder{
		t: t,
		i: &incident.Incident{
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
			PostID:        model.NewId(),
			PlaybookID:    model.NewId(),
			Checklists:    nil,
			StatusPostIDs: nil,
		},
	}
}

func (ib *IncidentBuilder) WithName(name string) *IncidentBuilder {
	ib.i.Name = name

	return ib
}

func (ib *IncidentBuilder) WithDescription(desc string) *IncidentBuilder {
	ib.i.Description = desc

	return ib
}

func (ib *IncidentBuilder) WithID() *IncidentBuilder {
	ib.i.ID = model.NewId()

	return ib
}

func (ib *IncidentBuilder) WithUpdateStatusIDs(posts []*model.Post, ids []string) *IncidentBuilder {
	ib.i.StatusPostIDs = append(ib.i.StatusPostIDs, ids...)
	addStatusPostsToIncidentFromIDs(ib.t, ib.i, posts, ids)
	return ib
}

func addStatusPostsToIncidentFromIDs(t testing.TB, i *incident.Incident, posts []*model.Post, ids []string) {
	for _, id := range ids {
		post := makeStatusPostByID(posts, id)
		if t != nil {
			require.NotEqual(t, "", post.ID)
		} else {
			fmt.Println("<><> could not find PostById, only update with posts that are already in the db")
		}
		i.StatusPosts = append(i.StatusPosts, post)
	}
}

func makeStatusPostByID(posts []*model.Post, id string) incident.StatusPost {
	for _, p := range posts {
		if p.Id == id {
			return incident.StatusPost{
				ID:       p.Id,
				CreateAt: p.CreateAt,
				DeleteAt: p.DeleteAt,
			}
		}
	}
	return incident.StatusPost{}
}

func (ib *IncidentBuilder) ToIncident() *incident.Incident {
	if len(ib.i.Checklists) > 0 {
		ib.i.ActiveStageTitle = ib.i.Checklists[ib.i.ActiveStage].Title
	}

	return ib.i
}

func (ib *IncidentBuilder) WithCreateAt(createAt int64) *IncidentBuilder {
	ib.i.CreateAt = createAt

	return ib
}

func (ib *IncidentBuilder) WithEndAt(endAt int64) *IncidentBuilder {
	ib.i.EndAt = endAt

	return ib
}

func (ib *IncidentBuilder) WithDeleteAt(deleteAt int64) *IncidentBuilder {
	ib.i.DeleteAt = deleteAt

	return ib
}

func (ib *IncidentBuilder) WithChecklists(itemsPerChecklist []int) *IncidentBuilder {
	ib.i.Checklists = make([]playbook.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		var items []playbook.ChecklistItem
		for j := 0; j < numItems; j++ {
			items = append(items, playbook.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			})
		}

		ib.i.Checklists[i] = playbook.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	return ib
}

func (ib *IncidentBuilder) WithCommanderUserID(id string) *IncidentBuilder {
	ib.i.CommanderUserID = id

	return ib
}

func (ib *IncidentBuilder) WithTeamID(id string) *IncidentBuilder {
	ib.i.TeamID = id

	return ib
}

func (ib *IncidentBuilder) WithIsActive(isActive bool) *IncidentBuilder {
	ib.i.IsActive = isActive

	return ib
}

func (ib *IncidentBuilder) WithChannelID(id string) *IncidentBuilder {
	ib.i.ChannelID = id

	return ib
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
