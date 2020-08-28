package sqlstore

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	mock_bot "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

var (
	team1id      = model.NewId()
	team2id      = model.NewId()
	team3id      = model.NewId()
	commander1id = model.NewId()
	commander2id = model.NewId()
	commander3id = model.NewId()
	commander5id = model.NewId()

	inc01 = *NewBuilder().
		WithName("incident 1 - wheel cat aliens wheelbarrow").
		WithIsActive(true).
		WithCommanderUserID(commander1id).
		WithTeamID(team1id).
		WithCreateAt(123).
		WithEndAt(440).
		ToIncident()

	inc02 = *NewBuilder().
		WithName("incident 2 - horse staple battery shotgun mouse shotputmouse").
		WithIsActive(true).
		WithCommanderUserID(commander2id).
		WithTeamID(team1id).
		WithCreateAt(145).
		WithEndAt(555).
		ToIncident()

	inc03 = *NewBuilder().
		WithName("incident 3 - Horse stapler battery shotgun mouse shotputmouse").
		WithIsActive(false).
		WithCommanderUserID(commander1id).
		WithTeamID(team1id).
		WithCreateAt(222).
		WithEndAt(666).
		ToIncident()

	inc04 = *NewBuilder().
		WithName("incident 4 - titanic terminator aliens").
		WithIsActive(false).
		WithCommanderUserID(commander3id).
		WithTeamID(team2id).
		WithCreateAt(333).
		WithEndAt(444).
		ToIncident()

	inc05 = *NewBuilder().
		WithName("incident 5 - ubik high castle electric sheep").
		WithIsActive(true).
		WithCommanderUserID(commander3id).
		WithTeamID(team2id).
		WithCreateAt(223).
		WithEndAt(550).
		ToIncident()

	inc06 = *NewBuilder().
		WithName("incident 6 - ziggurat!").
		WithIsActive(true).
		WithCommanderUserID(commander5id).
		WithTeamID(team3id).
		WithCreateAt(555).
		WithEndAt(777).
		ToIncident()

	inc07 = *NewBuilder().
		WithName("incident 7 - Ziggürat!").
		WithIsActive(true).
		WithCommanderUserID(commander5id).
		WithTeamID(team3id).
		WithCreateAt(556).
		WithEndAt(778).
		ToIncident()

	incidents = []incident.Incident{inc01, inc02, inc03, inc04, inc05, inc06, inc07}
)

func TestGetIncidents(t *testing.T) {
	createIncidents := func(store incident.Store) {
		t.Helper()

		createdIncidents := make([]incident.Incident, len(incidents))

		for i, incident := range incidents {
			createdIncident, err := store.CreateIncident(&incident)
			require.NoError(t, err)

			createdIncidents[i] = *createdIncident
		}
	}

	testData := []struct {
		Name        string
		Options     incident.HeaderFilterOptions
		Want        incident.GetIncidentsResults
		ExpectedErr error
	}{
		{
			Name:    "no options",
			Options: incident.HeaderFilterOptions{},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc04, inc05, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "team1 only, ascending",
			Options: incident.HeaderFilterOptions{
				TeamID: team1id,
				Order:  "asc",
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
			Name: "no paging, sort by CreateAt",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByCreateAt,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc04, inc05, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, sort by Name",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByName,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc05, inc04, inc03, inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no paging, sort by EndAt",
			Options: incident.HeaderFilterOptions{
				Sort: incident.SortByEndAt,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc07, inc06, inc03, inc02, inc05, inc04, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, paged by 1",
			Options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 1,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  7,
				HasMore:    true,
				Items:      []incident.Incident{inc07},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, paged by 3",
			Options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc07, inc06, inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 4 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    4,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 999 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    999,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    false,
				Items:      nil,
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    true,
				Items:      []incident.Incident{inc04, inc05},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 3",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 3,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc03, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "no options, page 1 by 5",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 5,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  2,
				HasMore:    false,
				Items:      []incident.Incident{inc02, inc01},
			},
			ExpectedErr: nil,
		},
		{
			Name: "sorted by ended, ascending, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Sort:    "end_at",
				Order:   "asc",
				Page:    1,
				PerPage: 2,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 7,
				PageCount:  4,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "only active, page 1 by 2",
			Options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
				Status:  incident.Ongoing,
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 5,
				PageCount:  3,
				HasMore:    true,
				Items:      []incident.Incident{inc05, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "active, commander3, asc",
			Options: incident.HeaderFilterOptions{
				Status:      incident.Ongoing,
				CommanderID: commander3id,
				Order:       "asc",
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
			Name: "commander1, asc, by end_at",
			Options: incident.HeaderFilterOptions{
				CommanderID: commander1id,
				Order:       "asc",
				Sort:        "end_at",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc01, inc03},
			},
			ExpectedErr: nil,
		},
		{
			Name: "search for horse",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "horse",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc03, inc02},
			},
			ExpectedErr: nil,
		},
		{
			Name: "search for aliens & commander3",
			Options: incident.HeaderFilterOptions{
				CommanderID: commander3id,
				SearchTerm:  "aliens",
			},
			Want: incident.GetIncidentsResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []incident.Incident{inc04},
			},
			ExpectedErr: nil,
		},
		{
			Name: "fuzzy search using starting characters -- not implemented",
			Options: incident.HeaderFilterOptions{
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
			Options: incident.HeaderFilterOptions{
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
			Name: "case-insensitive and unicode-normalized",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "ziggurat",
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
			Name: "case-insensitive and unicode-normalized with unicode search term",
			Options: incident.HeaderFilterOptions{
				SearchTerm: "ziggūràt",
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
			Name: "bad parameter sort",
			Options: incident.HeaderFilterOptions{
				Sort: "unknown_field",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'sort'"),
		},
		{
			Name: "bad team id",
			Options: incident.HeaderFilterOptions{
				TeamID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'team_id': must be 26 characters or blank"),
		},
		{
			Name: "bad parameter order by",
			Options: incident.HeaderFilterOptions{
				Order: "invalid order",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'order_by'"),
		},
		{
			Name: "bad commander id",
			Options: incident.HeaderFilterOptions{
				CommanderID: "invalid ID",
			},
			Want:        incident.GetIncidentsResults{},
			ExpectedErr: errors.New("bad parameter 'commander_id': must be 26 characters or blank"),
		},
	}

	for _, driverName := range driverNames {
		incidentStore := setupIncidentStore(t, driverName)

		t.Run("zero incidents", func(t *testing.T) {
			result, err := incidentStore.GetIncidents(incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 10,
			})
			require.NoError(t, err)

			require.Equal(t, 0, result.TotalCount)
			require.Equal(t, 0, result.PageCount)
			require.False(t, result.HasMore)
			require.Nil(t, result.Items)
		})

		createIncidents(incidentStore)

		for _, test := range testData {
			t.Run(driverName+" - "+test.Name, func(t *testing.T) {
				result, err := incidentStore.GetIncidents(test.Options)

				if test.ExpectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					fmt.Println(err)
					require.Equal(t, test.ExpectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, item := range result.Items {
					require.True(t, model.IsValidId(item.ID))
					item.ID = ""
					result.Items[i] = item
				}
				require.Equal(t, test.Want, *result)
			})
		}
	}
}

func TestCreateIncident(t *testing.T) {
	tRun(t, "Create valid incident", func(t *testing.T, driverName string) {
		validIncidents := []*incident.Incident{
			{},
			NewBuilder().ToIncident(),
			NewBuilder().WithName("unicode en español").ToIncident(),
			NewBuilder().WithCreateAt(0).ToIncident(),
			NewBuilder().WithDeleteAt(model.GetMillis()).ToIncident(),
			NewBuilder().WithEmptyChecklists(10).ToIncident(),
			NewBuilder().WithNonEmptyChecklists([]int{10}).ToIncident(),
			NewBuilder().WithNonEmptyChecklists([]int{1, 2, 3, 4, 5}).ToIncident(),
		}

		incidentStore := setupIncidentStore(t, driverName)

		for _, incident := range validIncidents {
			expectedIncident := *incident

			actualIncident, err := incidentStore.CreateIncident(incident)
			require.NoError(t, err)
			require.NotEqual(t, "", actualIncident.ID)

			expectedIncident.ID = actualIncident.ID

			require.Equal(t, &expectedIncident, actualIncident)
		}
	})

	tRun(t, "Create invalid incident", func(t *testing.T, driverName string) {
		invalidIncidents := []*incident.Incident{
			nil,
			NewBuilder().WithID().ToIncident(),
		}

		incidentStore := setupIncidentStore(t, driverName)

		for _, incident := range invalidIncidents {
			createdIncident, err := incidentStore.CreateIncident(incident)
			require.Nil(t, createdIncident)
			require.Error(t, err)
		}
	})
}

func TestUpdateIncident(t *testing.T)             {}
func TestGetIncident(t *testing.T)                {}
func TestGetIncidentIDForChannel(t *testing.T)    {}
func TestGetAllIncidentMembersCount(t *testing.T) {}
func TestGetCommanders(t *testing.T)              {}
func TestNukeDB(t *testing.T)                     {}

///////////////////////////////////////////////////////

var driverNames = []string{model.DATABASE_DRIVER_POSTGRES, model.DATABASE_DRIVER_MYSQL}

func setupTestDB(t *testing.T, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)
	if driverName == model.DATABASE_DRIVER_MYSQL {
		db.MapperFunc(func(s string) string { return s })
	}

	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
		storetest.CleanupSqlSettings(sqlSettings)
	})

	return db
}

func setupSQLStore(t *testing.T, driverName string, logger bot.Logger) *SQLStore {
	t.Helper()

	sqlStore := &SQLStore{
		logger,
		setupTestDB(t, driverName),
	}

	err := migrations[0].migrationFunc(sqlStore.db)
	require.NoError(t, err)

	return sqlStore
}

func setupIncidentStore(t *testing.T, driverName string) incident.Store {
	mockCtrl := gomock.NewController(t)

	logger := mock_bot.NewMockLogger(mockCtrl)

	pluginAPI := &plugintest.API{}
	client := pluginapi.NewClient(pluginAPI)
	pluginAPI.On("GetConfig").Return(&model.Config{
		SqlSettings: model.SqlSettings{DriverName: &driverName},
	})

	return NewIncidentStore(NewClient(client), logger, setupSQLStore(t, driverName, logger))
}

func tRun(t *testing.T, testName string, test func(t *testing.T, driverName string)) {
	for _, driverName := range driverNames {
		t.Run(driverName+" - "+testName, func(t *testing.T) { test(t, driverName) })
	}
}

///////////////////////////////////////////////////////

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
			Checklists: []playbook.Checklist{},
		},
	}
}

func (t *IncidentBuilder) WithName(name string) *IncidentBuilder {
	t.Name = name

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

func (t *IncidentBuilder) WithEmptyChecklists(num int) *IncidentBuilder {
	t.Checklists = make([]playbook.Checklist, num)
	for i := 0; i < num; i++ {
		t.Checklists[i] = playbook.Checklist{}
	}

	return t
}

func (t *IncidentBuilder) WithNonEmptyChecklists(itemsPerChecklist []int) *IncidentBuilder {
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
