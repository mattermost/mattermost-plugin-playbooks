package sqlstore

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateAndGetPlaybookRun(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		validPlaybookRuns := []struct {
			Name        string
			PlaybookRun *app.PlaybookRun
			ExpectedErr error
		}{
			{
				Name:        "Empty values",
				PlaybookRun: &app.PlaybookRun{},
				ExpectedErr: nil,
			},
			{
				Name:        "Base playbook run",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "Name with unicode characters",
				PlaybookRun: NewBuilder(t).WithName("valid unicode: ñäåö").ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "Created at 0",
				PlaybookRun: NewBuilder(t).WithCreateAt(0).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with one checklist and 10 items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{10}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with five checklists with different number of items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 2, 3, 4, 5}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun should not be nil",
				PlaybookRun: nil,
				ExpectedErr: errors.New("playbook run is nil"),
			},
			{
				Name:        "PlaybookRun /can/ contain checklists with no items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{0}).ToPlaybookRun(),
				ExpectedErr: nil,
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				var expectedPlaybookRun app.PlaybookRun
				if testCase.PlaybookRun != nil {
					expectedPlaybookRun = *testCase.PlaybookRun
				}

				returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					require.Nil(t, returned)
					return
				}

				require.NoError(t, err)
				require.True(t, model.IsValidId(returned.ID))
				expectedPlaybookRun.ID = returned.ID

				createPlaybookRunChannel(t, store, testCase.PlaybookRun)

				_, err = playbookRunStore.GetPlaybookRun(expectedPlaybookRun.ID)
				require.NoError(t, err)
			})
		}
	}
}

// TestGetPlaybookRun only tests getting a non-existent playbook run, since getting existing playbook runs
// is tested in TestCreateAndGetPlaybookRun above.
func TestGetPlaybookRun(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)

		validPlaybookRuns := []struct {
			Name        string
			ID          string
			ExpectedErr error
		}{
			{
				Name:        "Get a non-existing playbook run",
				ID:          "nonexisting",
				ExpectedErr: errors.New("playbook run with id 'nonexisting' does not exist: not found"),
			},
			{
				Name:        "Get without ID",
				ID:          "",
				ExpectedErr: errors.New("ID cannot be empty"),
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := playbookRunStore.GetPlaybookRun(testCase.ID)

				require.Error(t, err)
				require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
				require.Nil(t, returned)
			})
		}
	}
}

func TestUpdatePlaybookRun(t *testing.T) {
	pbWithMetrics := NewPBBuilder().
		WithTitle("playbook").
		WithMetrics([]string{"name3", "name1", "name2"}).
		ToPlaybook()

	post1 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 10000000,
		DeleteAt: 0,
	}
	post2 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 20000000,
		DeleteAt: 0,
	}
	post3 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 30000000,
		DeleteAt: 0,
	}
	post4 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000000,
		DeleteAt: 40300000,
	}
	post5 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000001,
		DeleteAt: 0,
	}
	post6 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000002,
		DeleteAt: 0,
	}
	allPosts := []*model.Post{post1, post2, post3, post4, post5, post6}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		savePosts(t, store, allPosts)

		playbookStore := setupPlaybookStore(t, db)
		id, err := playbookStore.Create(pbWithMetrics)
		require.NoError(t, err)
		pbWithMetrics, err := playbookStore.Get(id)
		require.NoError(t, err)

		validPlaybookRuns := []struct {
			Name        string
			PlaybookRun *app.PlaybookRun
			Update      func(app.PlaybookRun) *app.PlaybookRun
			ExpectedErr error
		}{
			{
				Name:        "nil playbook run",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					return nil
				},
				ExpectedErr: errors.New("playbook run is nil"),
			},
			{
				Name:        "id should not be empty",
				PlaybookRun: NewBuilder(t).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.ID = ""
					return &old
				},
				ExpectedErr: errors.New("ID should not be empty"),
			},
			{
				Name:        "PlaybookRun /can/ contain checklists with no items",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Checklists[0].Items = nil
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "new description",
				PlaybookRun: NewBuilder(t).WithDescription("old description").ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Summary = "new description"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with 2 checklists, update the checklists a bit",
				PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 1}).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
					old.Checklists[1].Items[0].Title = "new title"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with metrics, update retrospective text and metrics data",
				PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.MetricsData = generateMetricData(pbWithMetrics)
					old.Retrospective = "Retro1"
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with metrics, update metrics data partially",
				PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.MetricsData = generateMetricData(pbWithMetrics)[1:]
					return &old
				},
				ExpectedErr: nil,
			},
			{
				Name:        "PlaybookRun with metrics, update metrics data twice. First one will test insert in the table, second will test update",
				PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
				Update: func(old app.PlaybookRun) *app.PlaybookRun {
					old.MetricsData = generateMetricData(pbWithMetrics)

					//first update will insert rows
					err = playbookRunStore.UpdatePlaybookRun(&old)
					require.NoError(t, err)

					//second update will update values
					for i := range old.MetricsData {
						old.MetricsData[i].Value *= 10
					}
					old.Retrospective = "Retro3"
					return &old
				},
				ExpectedErr: nil,
			},
		}

		for _, testCase := range validPlaybookRuns {
			t.Run(testCase.Name, func(t *testing.T) {
				returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)
				require.NoError(t, err)
				createPlaybookRunChannel(t, store, returned)

				expected := testCase.Update(*returned)

				err = playbookRunStore.UpdatePlaybookRun(expected)

				if testCase.ExpectedErr != nil {
					require.Error(t, err)
					require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
					return
				}

				require.NoError(t, err)

				actual, err := playbookRunStore.GetPlaybookRun(expected.ID)
				require.NoError(t, err)
				require.Equal(t, expected, actual)
			})
		}
	}
}

func TestIfDeletedMetricsAreOmitted(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)

		//create playbook with metrics
		playbookStore := setupPlaybookStore(t, db)
		playbook := NewPBBuilder().
			WithTitle("playbook").
			WithMetrics([]string{"name3", "name1"}).
			ToPlaybook()
		id, err := playbookStore.Create(playbook)
		require.NoError(t, err)
		playbook, err = playbookStore.Get(id)
		require.NoError(t, err)

		// create run based on playbook
		playbookRun := NewBuilder(t).WithPlaybookID(playbook.ID).ToPlaybookRun()
		playbookRun, err = playbookRunStore.CreatePlaybookRun(playbookRun)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, playbookRun)

		// store metrics values
		playbookRun.MetricsData = generateMetricData(playbook)
		err = playbookRunStore.UpdatePlaybookRun(playbookRun)
		require.NoError(t, err)

		// delete one metric config from playbook
		playbook.Metrics = playbook.Metrics[1:]
		err = playbookStore.Update(playbook)
		require.NoError(t, err)

		// should return single metric
		actual, err := playbookRunStore.GetPlaybookRun(playbookRun.ID)
		require.NoError(t, err)
		require.Equal(t, len(actual.MetricsData), 1)
		require.Equal(t, actual.MetricsData[0].MetricConfigID, playbook.Metrics[0].ID)
	}
}

func TestRestorePlaybookRun(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		now := model.GetMillis()
		initialPlaybookRun := NewBuilder(t).
			WithCreateAt(now - 1000).
			WithCurrentStatus(app.StatusFinished).
			ToPlaybookRun()

		returned, err := playbookRunStore.CreatePlaybookRun(initialPlaybookRun)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, returned)

		err = playbookRunStore.RestorePlaybookRun(returned.ID, now)
		require.NoError(t, err)

		finalPlaybookRun := *returned
		finalPlaybookRun.CurrentStatus = app.StatusInProgress
		finalPlaybookRun.EndAt = 0
		finalPlaybookRun.LastStatusUpdateAt = now

		actual, err := playbookRunStore.GetPlaybookRun(returned.ID)
		require.NoError(t, err)
		require.Equal(t, &finalPlaybookRun, actual)
	}
}

// intended to catch problems with the code assembling StatusPosts
func TestStressTestGetPlaybookRuns(t *testing.T) {
	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test. Keep them low for CI.
	numPlaybookRuns := 100
	postsPerPlaybookRun := 3
	perPage := 10
	verifyPages := []int{0, 2, 4, 6, 8}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		teamID := model.NewId()
		withPosts := createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			for _, p := range verifyPages {
				returned, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
					UserID:  "testID",
					IsAdmin: true,
				}, app.PlaybookRunFilterOptions{
					TeamID:    teamID,
					Sort:      app.SortByCreateAt,
					Direction: app.DirectionAsc,
					Page:      p,
					PerPage:   perPage,
				})
				require.NoError(t, err)
				numRet := min(perPage, len(withPosts))
				require.Equal(t, numRet, len(returned.Items))
				for i := 0; i < numRet; i++ {
					idx := p*perPage + i
					assert.ElementsMatch(t, withPosts[idx].StatusPosts, returned.Items[i].StatusPosts)
					expWithoutStatusPosts := withPosts[idx]
					expWithoutStatusPosts.StatusPosts = nil
					actWithoutStatusPosts := returned.Items[i]
					actWithoutStatusPosts.StatusPosts = nil
					assert.Equal(t, expWithoutStatusPosts, actWithoutStatusPosts)
				}
			}
		})
	}
}

func TestStressTestGetPlaybookRunsStats(t *testing.T) {
	// don't need to assemble stats in CI
	t.SkipNow()

	rand.Seed(time.Now().UTC().UnixNano())

	// Change these to larger numbers to stress test.
	numPlaybookRuns := 1000
	postsPerPlaybookRun := 3
	perPage := 10

	// For stats:
	numReps := 30

	// so we don't start returning pages with 0 playbook runs:
	require.LessOrEqual(t, numReps*perPage, numPlaybookRuns)

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookRunStore := setupPlaybookRunStore(t, db)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupPostsTable(t, db)
		teamID := model.NewId()
		_ = createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

		t.Run("stress test status posts retrieval", func(t *testing.T) {
			intervals := make([]int64, 0, numReps)
			for i := 0; i < numReps; i++ {
				start := time.Now()
				_, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
					UserID:  "testID",
					IsAdmin: true,
				}, app.PlaybookRunFilterOptions{
					TeamID:    teamID,
					Sort:      app.SortByCreateAt,
					Direction: app.DirectionAsc,
					Page:      i,
					PerPage:   perPage,
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

func createPlaybookRunsAndPosts(t testing.TB, store *SQLStore, playbookRunStore app.PlaybookRunStore, numPlaybookRuns, maxPostsPerPlaybookRun int, teamID string) []app.PlaybookRun {
	playbookRunsSorted := make([]app.PlaybookRun, 0, numPlaybookRuns)
	for i := 0; i < numPlaybookRuns; i++ {
		numPosts := maxPostsPerPlaybookRun
		posts := make([]*model.Post, 0, numPosts)
		for j := 0; j < numPosts; j++ {
			post := newPost(rand.Intn(2) == 0)
			posts = append(posts, post)
		}
		savePosts(t, store, posts)

		inc := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(int64(100000 + i)).
			WithName(fmt.Sprintf("playbook run %d", i)).
			WithChecklists([]int{1}).
			ToPlaybookRun()
		ret, err := playbookRunStore.CreatePlaybookRun(inc)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, ret)
		playbookRunsSorted = append(playbookRunsSorted, *ret)
	}

	return playbookRunsSorted
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

func TestGetPlaybookRunIDForChannel(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupChannelsTable(t, db)

		t.Run("retrieve existing playbookRunID", func(t *testing.T) {
			playbookRun1 := NewBuilder(t).ToPlaybookRun()
			playbookRun2 := NewBuilder(t).ToPlaybookRun()

			returned1, err := playbookRunStore.CreatePlaybookRun(playbookRun1)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, playbookRun1)

			returned2, err := playbookRunStore.CreatePlaybookRun(playbookRun2)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, playbookRun2)

			id1, err := playbookRunStore.GetPlaybookRunIDForChannel(playbookRun1.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned1.ID, id1)
			id2, err := playbookRunStore.GetPlaybookRunIDForChannel(playbookRun2.ChannelID)
			require.NoError(t, err)
			require.Equal(t, returned2.ID, id2)
		})
		t.Run("fail to retrieve non-existing playbookRunID", func(t *testing.T) {
			id1, err := playbookRunStore.GetPlaybookRunIDForChannel("nonexistingid")
			require.Error(t, err)
			require.Equal(t, "", id1)
			require.True(t, strings.HasPrefix(err.Error(),
				"channel with id (nonexistingid) does not have a playbook run"))
		})
	}
}

func TestNukeDB(t *testing.T) {
	team1id := model.NewId()

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)

		setupChannelsTable(t, db)
		setupTeamMembersTable(t, db)

		playbookRunStore := setupPlaybookRunStore(t, db)
		playbookStore := setupPlaybookStore(t, db)

		t.Run("nuke db with a few playbook runs in it", func(t *testing.T) {
			for i := 0; i < 10; i++ {
				newPlaybookRun := NewBuilder(t).ToPlaybookRun()
				_, err := playbookRunStore.CreatePlaybookRun(newPlaybookRun)
				require.NoError(t, err)
				createPlaybookRunChannel(t, store, newPlaybookRun)
			}

			var rows int64
			err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 10, int(rows))

			err = playbookRunStore.NukeDB()
			require.NoError(t, err)

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))
		})

		t.Run("nuke db with playbooks", func(t *testing.T) {
			members := []userInfo{alice, bob}
			addUsers(t, store, members)
			addUsersToTeam(t, store, members, team1id)

			for i := 0; i < 10; i++ {
				newPlaybook := NewPBBuilder().WithMembers(members).ToPlaybook()
				_, err := playbookStore.Create(newPlaybook)
				require.NoError(t, err)
			}

			var rows int64

			err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
			require.NoError(t, err)
			require.Equal(t, 10, int(rows))

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
			require.NoError(t, err)
			require.Equal(t, 20, int(rows))

			err = playbookRunStore.NukeDB()
			require.NoError(t, err)

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
			require.NoError(t, err)
			require.Equal(t, 0, int(rows))
		})
	}
}

func TestCheckAndSendMessageOnJoin(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, _ = setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)

		t.Run("two new users get welcome messages, one old user doesn't", func(t *testing.T) {
			channelID := model.NewId()

			oldID := model.NewId()
			newID1 := model.NewId()
			newID2 := model.NewId()

			err := playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)

			// Setting multiple times is okay
			err = playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)
			err = playbookRunStore.SetViewedChannel(oldID, channelID)
			require.NoError(t, err)

			// new users get welcome messages
			hasViewed := playbookRunStore.HasViewedChannel(newID1, channelID)
			require.False(t, hasViewed)
			err = playbookRunStore.SetViewedChannel(newID1, channelID)
			require.NoError(t, err)

			hasViewed = playbookRunStore.HasViewedChannel(newID2, channelID)
			require.False(t, hasViewed)
			err = playbookRunStore.SetViewedChannel(newID2, channelID)
			require.NoError(t, err)

			// old user does not
			hasViewed = playbookRunStore.HasViewedChannel(oldID, channelID)
			require.True(t, hasViewed)

			// new users do not, now:
			hasViewed = playbookRunStore.HasViewedChannel(newID1, channelID)
			require.True(t, hasViewed)
			hasViewed = playbookRunStore.HasViewedChannel(newID2, channelID)
			require.True(t, hasViewed)

			var rows int64
			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
			require.NoError(t, err)
			require.Equal(t, 3, int(rows))

			// cannot add a duplicate row
			if driverName == model.DatabaseDriverPostgres {
				_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES ($1, $2)", oldID, channelID)
				require.Error(t, err)
				require.Contains(t, err.Error(), "duplicate key value")
			} else {
				_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES (?, ?)", oldID, channelID)
				require.Error(t, err)
				require.Contains(t, err.Error(), "Duplicate entry")
			}

			err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
			require.NoError(t, err)
			require.Equal(t, 3, int(rows))
		})
	}
}

func TestTasksAndRunsDigest(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupSQLStore(t, db)
		playbookRunStore := setupPlaybookRunStore(t, db)
		setupTeamsTable(t, db)

		userID := "testUserID"
		testUser := userInfo{ID: userID, Name: "test.user"}
		otherCommanderUserID := model.NewId()
		otherCommander := userInfo{ID: otherCommanderUserID, Name: "other.commander"}
		addUsers(t, store, []userInfo{testUser, otherCommander})

		team1 := model.Team{
			Id:   model.NewId(),
			Name: "Team1",
		}
		team2 := model.Team{
			Id:   model.NewId(),
			Name: "Team2",
		}
		createTeams(t, store, []model.Team{team1, team2})

		channel01 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-01"}
		channel02 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-02"}
		channel03 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-03"}
		channel04 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-04"}
		channel05 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-05"}
		channel06 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-06"}
		channels := []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06}
		addUsersToChannels(t, store, []userInfo{testUser}, []string{channel01.Id, channel02.Id, channel03.Id, channel04.Id, channel06.Id})

		// three assigned tasks for inc01, and an overdue update
		inc01 := *NewBuilder(nil).
			WithName("inc01 - this is the playbook name for channel 01").
			WithChannel(&channel01).
			WithTeamID(team1.Id).
			WithChecklists([]int{1, 2, 3, 4}).
			WithUpdateOverdueBy(2 * time.Minute).
			WithOwnerUserID(userID).
			ToPlaybookRun()
		inc01.Checklists[0].Items[0].AssigneeID = userID
		inc01.Checklists[1].Items[1].AssigneeID = userID
		inc01.Checklists[2].Items[2].AssigneeID = userID
		inc01TaskTitles := []string{
			inc01.Checklists[0].Items[0].Title,
			inc01.Checklists[1].Items[1].Title,
			inc01.Checklists[2].Items[2].Title,
		}
		// This should not trigger an assigned task:
		inc01.Checklists[3].Items[0].Title = userID

		// one assigned task for inc02, works cross team, with overdue update
		inc02 := *NewBuilder(nil).
			WithName("inc02 - this is the playbook name for channel 02").
			WithChannel(&channel02).
			WithTeamID(team2.Id).
			WithUpdateOverdueBy(1 * time.Minute).
			WithOwnerUserID(userID).
			WithChecklists([]int{1, 2, 3, 4}).
			ToPlaybookRun()
		inc02.Checklists[3].Items[2].AssigneeID = userID
		inc02TaskTitles := []string{inc02.Checklists[3].Items[2].Title}

		// no assigned task for inc03, with non-overdue update
		inc03 := *NewBuilder(nil).
			WithName("inc03 - this is the playbook name for channel 03").
			WithChannel(&channel03).
			WithTeamID(team1.Id).
			WithUpdateOverdueBy(-2 * time.Minute).
			WithOwnerUserID(userID).
			WithChecklists([]int{1, 2, 3, 4}).
			ToPlaybookRun()
		inc03.Checklists[3].Items[2].AssigneeID = "someotheruserid"

		// one assigned task for inc04, with overdue update, but inc04 is finished
		inc04 := *NewBuilder(nil).
			WithName("inc04 - this is the playbook name for channel 04").
			WithChannel(&channel04).
			WithTeamID(team1.Id).
			WithChecklists([]int{1, 2, 3, 4}).
			WithUpdateOverdueBy(2 * time.Minute).
			WithOwnerUserID(userID).
			WithCurrentStatus(app.StatusFinished).
			ToPlaybookRun()
		inc04.Checklists[3].Items[2].AssigneeID = userID

		// no assigned task for inc05, and not participant in inc05
		inc05 := *NewBuilder(nil).
			WithName("inc05 - this is the playbook name for channel 05").
			WithChannel(&channel05).
			WithTeamID(team1.Id).
			WithOwnerUserID(otherCommanderUserID).
			WithChecklists([]int{1, 2, 3, 4}).
			ToPlaybookRun()
		inc05.Checklists[3].Items[2].AssigneeID = "someotheruserid"

		// no assigned task for inc06, with overdue update, not commander but participating
		inc06 := *NewBuilder(nil).
			WithName("inc06 - this is the playbook name for channel 06").
			WithChannel(&channel06).
			WithTeamID(team1.Id).
			WithOwnerUserID(otherCommanderUserID).
			WithUpdateOverdueBy(2 * time.Minute).
			WithChecklists([]int{1, 2, 3, 4}).
			ToPlaybookRun()
		inc03.Checklists[2].Items[2].AssigneeID = "someotheruserid"

		playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06}

		for i := range playbookRuns {
			_, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
			require.NoError(t, err)
		}

		createChannels(t, store, channels)

		t.Run("gets assigned tasks only", func(t *testing.T) {
			runs, err := playbookRunStore.GetRunsWithAssignedTasks(userID)
			require.NoError(t, err)

			total := 0
			for _, run := range runs {
				total += len(run.Tasks)
			}

			require.Equal(t, 4, total)

			// don't make assumptions about ordering until we figure that out PM-side
			expected := map[string][]string{
				channel01.Name: inc01TaskTitles,
				channel02.Name: inc02TaskTitles,
			}

			for _, run := range runs {
				for _, task := range run.Tasks {
					require.Contains(t, expected[run.ChannelName], task.Title)
				}
			}
		})

		t.Run("gets participating runs only", func(t *testing.T) {
			runs, err := playbookRunStore.GetParticipatingRuns(userID)
			require.NoError(t, err)

			total := len(runs)

			require.Equal(t, 4, total)

			// don't make assumptions about ordering until we figure that out PM-side
			expected := map[string]int{
				channel01.Name: 1,
				channel02.Name: 1,
				channel03.Name: 1,
				channel06.Name: 1,
			}

			actual := make(map[string]int)

			for _, run := range runs {
				actual[run.ChannelName]++
			}

			require.Equal(t, expected, actual)
		})

		t.Run("gets overdue updates", func(t *testing.T) {
			runs, err := playbookRunStore.GetOverdueUpdateRuns(userID)
			require.NoError(t, err)

			total := len(runs)

			require.Equal(t, 2, total)

			// don't make assumptions about ordering until we figure that out PM-side
			expected := map[string]int{
				channel01.Name: 1,
				channel02.Name: 1,
			}

			actual := make(map[string]int)

			for _, run := range runs {
				actual[run.ChannelName]++
			}

			require.Equal(t, expected, actual)
		})
	}
}

func setupPlaybookRunStore(t *testing.T, db *sqlx.DB) app.PlaybookRunStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	logger, sqlStore := setupSQLStore(t, db)

	return NewPlaybookRunStore(pluginAPIClient, logger, sqlStore)
}

// PlaybookRunBuilder is a utility to build playbook runs with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToPlaybookRun()
type PlaybookRunBuilder struct {
	t           testing.TB
	playbookRun *app.PlaybookRun
}

func NewBuilder(t testing.TB) *PlaybookRunBuilder {
	return &PlaybookRunBuilder{
		t: t,
		playbookRun: &app.PlaybookRun{
			Name:          "base playbook run",
			OwnerUserID:   model.NewId(),
			TeamID:        model.NewId(),
			ChannelID:     model.NewId(),
			CreateAt:      model.GetMillis(),
			DeleteAt:      0,
			PostID:        model.NewId(),
			PlaybookID:    model.NewId(),
			Checklists:    nil,
			CurrentStatus: "InProgress",
		},
	}
}

func (ib *PlaybookRunBuilder) WithName(name string) *PlaybookRunBuilder {
	ib.playbookRun.Name = name

	return ib
}

func (ib *PlaybookRunBuilder) WithDescription(desc string) *PlaybookRunBuilder {
	ib.playbookRun.Summary = desc

	return ib
}

func (ib *PlaybookRunBuilder) WithID() *PlaybookRunBuilder {
	ib.playbookRun.ID = model.NewId()

	return ib
}

func (ib *PlaybookRunBuilder) WithParticipant(user userInfo) *PlaybookRunBuilder {
	ib.playbookRun.ParticipantIDs = append(ib.playbookRun.ParticipantIDs, user.ID)
	sort.Strings(ib.playbookRun.ParticipantIDs)

	return ib
}

func (ib *PlaybookRunBuilder) ToPlaybookRun() *app.PlaybookRun {
	return ib.playbookRun
}

func (ib *PlaybookRunBuilder) WithCreateAt(createAt int64) *PlaybookRunBuilder {
	ib.playbookRun.CreateAt = createAt

	return ib
}

func (ib *PlaybookRunBuilder) WithChecklists(itemsPerChecklist []int) *PlaybookRunBuilder {
	ib.playbookRun.Checklists = make([]app.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		var items []app.ChecklistItem
		for j := 0; j < numItems; j++ {
			items = append(items, app.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			})
		}

		ib.playbookRun.Checklists[i] = app.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	return ib
}

func (ib *PlaybookRunBuilder) WithOwnerUserID(id string) *PlaybookRunBuilder {
	ib.playbookRun.OwnerUserID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithTeamID(id string) *PlaybookRunBuilder {
	ib.playbookRun.TeamID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithCurrentStatus(status string) *PlaybookRunBuilder {
	ib.playbookRun.CurrentStatus = status

	if status == app.StatusFinished {
		ib.playbookRun.EndAt = ib.playbookRun.CreateAt + 100
	}

	return ib
}

func (ib *PlaybookRunBuilder) WithChannel(channel *model.Channel) *PlaybookRunBuilder {
	ib.playbookRun.ChannelID = channel.Id

	// Consider the playbook run name as authoritative.
	channel.DisplayName = ib.playbookRun.Name

	return ib
}

func (ib *PlaybookRunBuilder) WithPlaybookID(id string) *PlaybookRunBuilder {
	ib.playbookRun.PlaybookID = id

	return ib
}

// WithUpdateOverdueBy sets a PreviousReminder and LastStatusUpdate such that there is an update
// due overdueAmount ago. Set a negative number for an update due in the future.
func (ib *PlaybookRunBuilder) WithUpdateOverdueBy(overdueAmount time.Duration) *PlaybookRunBuilder {
	// simplify the math: set previous reminder to be the overdue amount
	ib.playbookRun.PreviousReminder = overdueAmount

	// and the lastStatusUpdateAt to be twice as much before that
	ib.playbookRun.LastStatusUpdateAt = time.Now().Add(-2*overdueAmount).Unix() * 1000

	return ib
}

func generateMetricData(playbook app.Playbook) []app.RunMetricData {
	metrics := make([]app.RunMetricData, 0)
	for i, mc := range playbook.Metrics {
		metrics = append(metrics,
			app.RunMetricData{
				MetricConfigID: mc.ID,
				Value:          int64(i + 10),
			},
		)
	}
	// Entirely for consistency for the tests
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].MetricConfigID < metrics[j].MetricConfigID })

	return metrics
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
