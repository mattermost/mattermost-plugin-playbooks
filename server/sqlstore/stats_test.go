package sqlstore

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-incident-collaboration/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupStatsStore(t testing.TB, db *sqlx.DB) *StatsStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	logger, sqlStore := setupSQLStore(t, db)

	return NewStatsStore(pluginAPIClient, logger, sqlStore)
}

func TestTotalReportedIncidents(t *testing.T) {
	team1id := model.NewId()

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	john := userInfo{
		ID:   model.NewId(),
		Name: "john",
	}

	jane := userInfo{
		ID:   model.NewId(),
		Name: "jane",
	}

	notInvolved := userInfo{
		ID:   model.NewId(),
		Name: "notinvolved",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}
	channel02 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 199, DeleteAt: 0}
	channel03 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 222, DeleteAt: 0}
	channel04 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		incidentStore := setupIncidentStore(t, db)
		statsStore := setupStatsStore(t, db)

		_, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)

		addUsers(t, store, []userInfo{lucy, bob, john, jane, notInvolved})
		addUsersToTeam(t, store, []userInfo{lucy, bob, john, jane, notInvolved}, team1id)
		createChannels(t, store, []model.Channel{channel01, channel02, channel03, channel04})
		addUsersToChannels(t, store, []userInfo{bob, lucy}, []string{channel01.Id, channel02.Id, channel03.Id, channel04.Id})
		addUsersToChannels(t, store, []userInfo{john}, []string{channel01.Id})
		addUsersToChannels(t, store, []userInfo{jane}, []string{channel01.Id, channel02.Id})
		makeAdmin(t, store, bob)

		inc01 := *NewBuilder(nil).
			WithName("incident 1 - wheel cat aliens wheelbarrow").
			WithChannel(&channel01).
			WithTeamID(team1id).
			WithCurrentStatus("Reported").
			WithCreateAt(123).
			ToIncident()

		inc02 := *NewBuilder(nil).
			WithName("incident 2").
			WithChannel(&channel02).
			WithTeamID(team1id).
			WithCurrentStatus("Active").
			WithCreateAt(123).
			ToIncident()

		inc03 := *NewBuilder(nil).
			WithName("incident 3").
			WithChannel(&channel03).
			WithTeamID(team1id).
			WithCurrentStatus("Active").
			WithCreateAt(123).
			ToIncident()

		incidents := []incident.Incident{inc01, inc02, inc03}

		for i := range incidents {
			_, err := incidentStore.CreateIncident(&incidents[i])
			require.NoError(t, err)
		}

		t.Run(driverName+" Reported Incidents", func(t *testing.T) {
			result := statsStore.TotalReportedIncidents()
			assert.Equal(t, 1, result)
		})

		t.Run(driverName+" Active Incidents", func(t *testing.T) {
			result := statsStore.TotalActiveIncidents()
			assert.Equal(t, 2, result)
		})

		t.Run(driverName+" Active Participants", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants()
			assert.Equal(t, 4, result)
		})

		/* This can't be tested well because it uses model.GetMillis() inside
		t.Run(driverName+" Average Druation Active Incidents Minutes", func(t *testing.T) {
			result := statsStore.AverageDurationActiveIncidentsMinutes()
			assert.Equal(t, 26912080, result)
		})*/
	}
}
