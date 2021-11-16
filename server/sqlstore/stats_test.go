package sqlstore

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupStatsStore(t *testing.T, db *sqlx.DB) *StatsStore {
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

func TestTotalInProgressPlaybookRuns(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()

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

	phil := userInfo{
		ID:   model.NewId(),
		Name: "phil",
	}

	quincy := userInfo{
		ID:   model.NewId(),
		Name: "quincy",
	}

	notInvolved := userInfo{
		ID:   model.NewId(),
		Name: "notinvolved",
	}

	bot1 := userInfo{
		ID:   model.NewId(),
		Name: "Mr. Bot",
	}

	bot2 := userInfo{
		ID:   model.NewId(),
		Name: "Mrs. Bot",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}
	channel02 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 199, DeleteAt: 0}
	channel03 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 222, DeleteAt: 0}
	channel04 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel05 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel06 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel07 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel08 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel09 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		statsStore := setupStatsStore(t, db)

		_, store := setupSQLStore(t, db)
		setupTeamMembersTable(t, db)
		setupChannelMembersTable(t, db)
		setupChannelsTable(t, db)

		addUsers(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2})
		addBots(t, store, []userInfo{bot1, bot2})
		addUsersToTeam(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2}, team1id)
		addUsersToTeam(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2}, team2id)
		createChannels(t, store, []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06, channel07, channel08, channel09})
		addUsersToChannels(t, store, []userInfo{bob, lucy, phil, bot1, bot2}, []string{channel01.Id, channel02.Id, channel03.Id, channel04.Id, channel06.Id, channel07.Id, channel08.Id, channel09.Id})
		addUsersToChannels(t, store, []userInfo{bob, quincy}, []string{channel05.Id})
		addUsersToChannels(t, store, []userInfo{john}, []string{channel01.Id})
		addUsersToChannels(t, store, []userInfo{jane}, []string{channel01.Id, channel02.Id})
		makeAdmin(t, store, bob)

		inc01 := *NewBuilder(nil).
			WithName("pr 1 - wheel cat aliens wheelbarrow").
			WithChannel(&channel01).
			WithTeamID(team1id).
			WithCurrentStatus(app.StatusInProgress).
			WithCreateAt(123).
			WithPlaybookID("playbook1").
			ToPlaybookRun()

		inc02 := *NewBuilder(nil).
			WithName("pr 2").
			WithChannel(&channel02).
			WithTeamID(team1id).
			WithCurrentStatus(app.StatusInProgress).
			WithCreateAt(123).
			WithPlaybookID("playbook1").
			ToPlaybookRun()

		inc03 := *NewBuilder(nil).
			WithName("pr 3").
			WithChannel(&channel03).
			WithTeamID(team1id).
			WithCurrentStatus(app.StatusFinished).
			WithPlaybookID("playbook2").
			WithCreateAt(123).
			ToPlaybookRun()

		inc04 := *NewBuilder(nil).
			WithName("pr 4").
			WithChannel(&channel04).
			WithTeamID(team2id).
			WithCurrentStatus(app.StatusInProgress).
			WithPlaybookID("playbook1").
			WithCreateAt(123).
			ToPlaybookRun()

		inc05 := *NewBuilder(nil).
			WithName("pr 5").
			WithChannel(&channel05).
			WithTeamID(team2id).
			WithCurrentStatus(app.StatusInProgress).
			WithPlaybookID("playbook2").
			WithCreateAt(123).
			ToPlaybookRun()

		inc06 := *NewBuilder(nil).
			WithName("pr 6").
			WithChannel(&channel06).
			WithTeamID(team1id).
			WithCurrentStatus(app.StatusInProgress).
			WithPlaybookID("playbook1").
			WithCreateAt(123).
			ToPlaybookRun()

		inc07 := *NewBuilder(nil).
			WithName("pr 7").
			WithChannel(&channel07).
			WithTeamID(team2id).
			WithCurrentStatus(app.StatusInProgress).
			WithPlaybookID("playbook2").
			WithCreateAt(123).
			ToPlaybookRun()

		inc08 := *NewBuilder(nil).
			WithName("pr 8").
			WithChannel(&channel08).
			WithTeamID(team1id).
			WithCurrentStatus(app.StatusFinished).
			WithPlaybookID("playbook1").
			WithCreateAt(123).
			ToPlaybookRun()

		inc09 := *NewBuilder(nil).
			WithName("pr 9").
			WithChannel(&channel09).
			WithTeamID(team2id).
			WithCurrentStatus(app.StatusFinished).
			WithPlaybookID("playbook2").
			WithCreateAt(123).
			ToPlaybookRun()

		playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06, inc07, inc08, inc09}

		for i := range playbookRuns {
			_, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
			require.NoError(t, err)
		}

		t.Run(driverName+" Active Participants - team1", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants(&StatsFilters{
				TeamID: team1id,
			})
			assert.Equal(t, 5, result)
		})

		t.Run(driverName+" Active Participants - team2", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants(&StatsFilters{
				TeamID: team2id,
			})
			assert.Equal(t, 4, result)
		})

		t.Run(driverName+" Active Participants, playbook1", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants(&StatsFilters{
				PlaybookID: "playbook1",
			})
			assert.Equal(t, 5, result)
		})

		t.Run(driverName+" Active Participants, playbook2", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants(&StatsFilters{
				PlaybookID: "playbook2",
			})
			assert.Equal(t, 4, result)
		})

		t.Run(driverName+" Active Participants, all", func(t *testing.T) {
			result := statsStore.TotalActiveParticipants(&StatsFilters{})
			assert.Equal(t, 6, result)
		})

		t.Run(driverName+" In-progress Playbook Runs - team1", func(t *testing.T) {
			result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
				TeamID: team1id,
			})
			assert.Equal(t, 3, result)
		})

		t.Run(driverName+" In-progress Playbook Runs - team2", func(t *testing.T) {
			result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
				TeamID: team2id,
			})
			assert.Equal(t, 3, result)
		})

		t.Run(driverName+" In-progress Playbook Runs - playbook1", func(t *testing.T) {
			result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
				PlaybookID: "playbook1",
			})
			assert.Equal(t, 4, result)
		})

		t.Run(driverName+" In-progress Playbook Runs - playbook2", func(t *testing.T) {
			result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
				PlaybookID: "playbook2",
			})
			assert.Equal(t, 2, result)
		})

		t.Run(driverName+" In-progress Playbook Runs - all", func(t *testing.T) {
			result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{})
			assert.Equal(t, 6, result)
		})

		/* This can't be tested well because it uses model.GetMillis() inside
		t.Run(driverName+" Average Druation Active Playbook Runs Minutes", func(t *testing.T) {
			result := statsStore.AverageDurationActivePlaybookRunsMinutes()
			assert.Equal(t, 26912080, result)
		})*/
	}
}
