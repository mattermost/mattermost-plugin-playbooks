package sqlstore

import (
	"fmt"
	"math"
	"math/rand"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"
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
		setupChannelMemberHistoryTable(t, db)
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

		t.Run(driverName+" RunsStartedPerWeekLastXWeeks for a playbook with no runs", func(t *testing.T) {
			runsStartedPerWeek, _ := statsStore.RunsStartedPerWeekLastXWeeks(4, &StatsFilters{
				PlaybookID: "playbook101test123123",
			})
			assert.Equal(t, []int{0, 0, 0, 0}, runsStartedPerWeek)
		})

		t.Run(driverName+" ActiveRunsPerDayLastXDays for a playbook with no runs", func(t *testing.T) {
			activeRunsPerDay, _ := statsStore.ActiveRunsPerDayLastXDays(4, &StatsFilters{
				PlaybookID: "playbook101test1234",
			})
			assert.Equal(t, []int{0, 0, 0, 0}, activeRunsPerDay)
		})

		t.Run(driverName+" ActiveParticipantsPerDayLastXDays for a playbook with no runs", func(t *testing.T) {
			activeParticipantsPerDay, _ := statsStore.ActiveParticipantsPerDayLastXDays(4, &StatsFilters{
				PlaybookID: "playbook101test32412",
			})
			assert.Equal(t, []int{0, 0, 0, 0}, activeParticipantsPerDay)
		})
	}
}

/*
Test cases:
	* Playbook no metrics: no runs, active runs, published runs
	* Playbook with metrics, no run
	* Playbook with metrics and active runs, no published retro
	* Playbook with metrics and active runs with metrics, no published retro
	* Playbook with metrics, active runs and few published runs
	* Playbook with metrics, active runs and lots of published runs


	playbook, numMetrics, numActiveRuns, numPublishedRuns, activeRuns, publishedRuns

*/
type MetricStatsTest struct {
	Playbook                 *app.Playbook
	numMetrics               int
	numActiveRuns            int
	numPublishedRuns         int
	ratioRunsWithMetrics     int // [0, 100] value, 0 means there is no run which has metrics values, 100 means all runs have metrics values
	publishedRunsWithMetrics []*app.PlaybookRun
}

func TestMetricsStats(t *testing.T) {
	rand.Seed(1)
	const x = 14
	testCases := []MetricStatsTest{
		{
			numMetrics:           0,
			numActiveRuns:        0,
			numPublishedRuns:     0,
			ratioRunsWithMetrics: 0,
		},
		{
			numMetrics:           0,
			numActiveRuns:        5,
			numPublishedRuns:     11,
			ratioRunsWithMetrics: 0,
		},
		{
			numMetrics:           3,
			numActiveRuns:        0,
			numPublishedRuns:     0,
			ratioRunsWithMetrics: 0,
		},
		{
			numMetrics:           4,
			numActiveRuns:        7,
			numPublishedRuns:     0,
			ratioRunsWithMetrics: 0,
		},
		{
			numMetrics:           1,
			numActiveRuns:        7,
			numPublishedRuns:     11,
			ratioRunsWithMetrics: 0,
		},
		{
			numMetrics:           2,
			numActiveRuns:        10,
			numPublishedRuns:     0,
			ratioRunsWithMetrics: 70,
		},
		{
			numMetrics:           4,
			numActiveRuns:        10,
			numPublishedRuns:     5,
			ratioRunsWithMetrics: 70,
		},
		{
			numMetrics:           1,
			numActiveRuns:        15,
			numPublishedRuns:     8,
			ratioRunsWithMetrics: 80,
		},
		{
			numMetrics:           3,
			numActiveRuns:        5,
			numPublishedRuns:     14,
			ratioRunsWithMetrics: 100,
		},
		{
			numMetrics:           1,
			numActiveRuns:        21,
			numPublishedRuns:     21,
			ratioRunsWithMetrics: 100,
		},
		{
			numMetrics:           4,
			numActiveRuns:        20,
			numPublishedRuns:     30,
			ratioRunsWithMetrics: 80,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		playbookStore := setupPlaybookStore(t, db)
		statsStore := setupStatsStore(t, db)
		// _, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		// generate playbooks and runs based on tests array
		for testNum := range testCases {
			generateTestData(t, &testCases[testNum], testNum, db, playbookStore, playbookRunStore)
		}

		for _, testCase := range testCases {
			filters := StatsFilters{
				PlaybookID: testCase.Playbook.ID,
			}

			t.Run(testCase.Playbook.Title+"-MetricOverallAverage", func(t *testing.T) {
				actual := statsStore.MetricOverallAverage(&filters)

				expected := getMetricRollingAverage(len(testCase.publishedRunsWithMetrics), 0, &testCase)
				require.Equal(t, expected, actual)
			})

			t.Run(testCase.Playbook.Title+"-MetricValueRange", func(t *testing.T) {
				actual := statsStore.MetricValueRange(&filters)

				expected := getMetricValueRange(&testCase)
				require.Equal(t, expected, actual)
			})

			t.Run(testCase.Playbook.Title+"-MetricRollingValuesLastXRuns", func(t *testing.T) {
				actual := statsStore.MetricRollingValuesLastXRuns(x, 0, &filters)

				expected := getMetricRollingValuesLastXRuns(x, 0, &testCase)
				require.Equal(t, expected, actual)

				actual = statsStore.MetricRollingValuesLastXRuns(x, x, &filters)

				expected = getMetricRollingValuesLastXRuns(x, x, &testCase)
				require.Equal(t, expected, actual)
			})
		}
	}
}

func generateTestData(t *testing.T, testCase *MetricStatsTest, testNum int, db *sqlx.DB, playbookStore app.PlaybookStore, playbookRunStore app.PlaybookRunStore) {
	//create playbook with metrics
	playbook := NewPBBuilder().
		WithTitle(fmt.Sprintf("playbook %d", testNum)).
		WithMetrics(generateNames(testCase.numMetrics)).
		ToPlaybook()
	id, err := playbookStore.Create(playbook)
	require.NoError(t, err)
	playbook, err = playbookStore.Get(id)
	require.NoError(t, err)
	testCase.Playbook = &playbook

	// create active runs
	numRunsWithMetrics := testCase.numActiveRuns * testCase.ratioRunsWithMetrics / 100
	for i := 0; i < testCase.numActiveRuns; i++ {
		playbookRun := NewBuilder(t).WithPlaybookID(playbook.ID).ToPlaybookRun()
		playbookRun, err = playbookRunStore.CreatePlaybookRun(playbookRun)
		require.NoError(t, err)

		if i < numRunsWithMetrics {
			playbookRun.MetricsData = generateRandomMetricData(playbook.Metrics)
			err = playbookRunStore.UpdatePlaybookRun(playbookRun)
			require.NoError(t, err)
		}
	}

	// create and publish runs
	numRunsWithMetrics = testCase.numPublishedRuns * testCase.ratioRunsWithMetrics / 100
	testCase.publishedRunsWithMetrics = make([]*app.PlaybookRun, numRunsWithMetrics)
	for i := 0; i < testCase.numPublishedRuns; i++ {
		playbookRun := NewBuilder(t).WithPlaybookID(playbook.ID).ToPlaybookRun()
		playbookRun, err = playbookRunStore.CreatePlaybookRun(playbookRun)
		require.NoError(t, err)

		if i < numRunsWithMetrics {
			now := model.GetMillis()
			playbookRun.RetrospectivePublishedAt = now
			playbookRun.RetrospectiveWasCanceled = false
			playbookRun.MetricsData = generateRandomMetricData(playbook.Metrics)
			err = playbookRunStore.UpdatePlaybookRun(playbookRun)
			require.NoError(t, err)
			testCase.publishedRunsWithMetrics[i] = playbookRun
		}
	}
}

func generateNames(num int) []string {
	names := make([]string, num)
	for i := range names {
		names[i] = fmt.Sprintf("name %d", i+1)
	}
	return names
}

func getMetricRollingAverage(x, offset int, testCase *MetricStatsTest) []int64 {
	averages := make([]int64, 0)

	sums := make(map[string]int64)
	numRuns := len(testCase.publishedRunsWithMetrics)
	for i := offset; i < offset+x && i < numRuns; i++ {
		run := testCase.publishedRunsWithMetrics[numRuns-i-1]
		for _, m := range run.MetricsData {
			sums[m.MetricConfigID] += m.Value.Int64
		}
	}

	count := math.Min(float64(x), float64(numRuns))
	for _, mc := range testCase.Playbook.Metrics {
		if val, ok := sums[mc.ID]; ok {
			averages = append(averages, val/int64(count))
		}
	}
	return averages
}

func getMetricValueRange(testCase *MetricStatsTest) [][]int64 {
	minMaxes := make([][]int64, len(testCase.Playbook.Metrics))

	mins := make(map[string]int64)
	maxes := make(map[string]int64)
	for _, run := range testCase.publishedRunsWithMetrics {
		for _, m := range run.MetricsData {
			if val, ok := mins[m.MetricConfigID]; !ok || val > m.Value.Int64 {
				mins[m.MetricConfigID] = m.Value.Int64
			}
			if val, ok := maxes[m.MetricConfigID]; !ok || val < m.Value.Int64 {
				maxes[m.MetricConfigID] = m.Value.Int64
			}
		}
	}
	for i, mc := range testCase.Playbook.Metrics {
		if _, ok := mins[mc.ID]; ok {
			minMaxes[i] = []int64{mins[mc.ID], maxes[mc.ID]}

		}
	}
	return minMaxes
}

func getMetricRollingValuesLastXRuns(x, offset int, testCase *MetricStatsTest) [][]int64 {
	rollingValues := make([][]int64, len(testCase.Playbook.Metrics))

	idToValues := make(map[string][]int64)

	numRuns := len(testCase.publishedRunsWithMetrics)
	for i := offset; i < offset+x && i < numRuns; i++ {
		run := testCase.publishedRunsWithMetrics[numRuns-i-1]

		for _, m := range run.MetricsData {
			if _, ok := idToValues[m.MetricConfigID]; !ok {
				idToValues[m.MetricConfigID] = make([]int64, 0)
			}
			idToValues[m.MetricConfigID] = append(idToValues[m.MetricConfigID], m.Value.Int64)
		}
	}
	for i, mc := range testCase.Playbook.Metrics {
		rollingValues[i] = idToValues[mc.ID]
	}
	return rollingValues
}

func generateRandomMetricData(configs []app.PlaybookMetricConfig) []app.RunMetricData {
	data := make([]app.RunMetricData, len(configs))
	for i := range configs {
		data[i].MetricConfigID = configs[i].ID
		data[i].Value = null.IntFrom(rand.Int63() % 1000)
	}
	return data

}
