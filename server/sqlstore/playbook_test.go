package sqlstore

import (
	"fmt"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

var (
	pb01 = NewPBBuilder().
		WithTitle("playbook 1").
		WithDescription("this is a description, not very long, but it can be up to 4096 bytes").
		WithTeamID(team1id).
		WithCreateAt(500).
		WithChecklists([]int{1, 2}).
		WithMembers([]string{"jon", "Andrew", "Matt"}).
		ToPlaybook()

	pb02 = NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithCreateAt(600).
		WithCreatePublic(true).
		WithChecklists([]int{1, 4, 6, 7, 1}). // 19
		WithMembers([]string{"Andrew", "Matt"}).
		ToPlaybook()

	pb03 = NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team1id).
		WithChecklists([]int{1, 2, 3}).
		WithCreateAt(700).
		WithMembers([]string{"jon", "Matt", "Lucy"}).
		ToPlaybook()

	pb04 = NewPBBuilder().
		WithTitle("playbook 4").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithTeamID(team1id).
		WithCreateAt(800).
		WithChecklists([]int{20}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb05 = NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamID(team2id).
		WithCreateAt(1000).
		WithChecklists([]int{1}).
		WithMembers([]string{"jon", "Andrew"}).
		ToPlaybook()

	pb06 = NewPBBuilder().
		WithTitle("playbook 6").
		WithTeamID(team2id).
		WithCreateAt(1100).
		WithChecklists([]int{1, 2, 3}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb07 = NewPBBuilder().
		WithTitle("playbook 7").
		WithTeamID(team3id).
		WithCreateAt(1200).
		WithChecklists([]int{1}).
		WithMembers([]string{"Andrew"}).
		ToPlaybook()

	pb08 = NewPBBuilder().
		WithTitle("playbook 8 -- so many members, but should have Desmond and Lucy").
		WithTeamID(team3id).
		WithCreateAt(1300).
		WithChecklists([]int{1}).
		WithMembers([]string{"km69ab3boj1w6ft9mh83wao7qk", "48wthyysxrhhs3ww4mnnfmg1bn", "1sziwjjsxfe5iez9puk8dtrd6f", "dir7jfkho1dnna3frw96ahhp46", "bx4omgdi1exgpn155hs89trres", "g3gc8s63pnaxqf3q5bm3jq3itc", "ripkmp6wjxsrb6nctri3z96wga", "3xh8nxhp1asz3deb1gjcrotrhm", "8xig6s3465xyg7bsptdtu3b4dc", "mbrhcb57zpm1f7mtxewjwjux17", "hum776w1fsiqq6dgc9561pspjh", "ty7yisf6uohztcneox1swfmktz", "u68r5j1dyrn1rdemffwesh4mt4", "9w1sxocjx81pcd3gpbs3zhz5r5", "a5um18y94q9eurndefh78m4r1g", "bo7bx1entxw3nuizc1qg3r48oy", "x7cbowuxdykm7ytukdimnqji6c", "gdsnue5o8r4m6wfntsooff477s", "pp4oezhq9iw7rkzfercwx14i8i", "94idra7dufbzyjf4u1pte3hkr7", "ybz1okk7xwhop8abwehhep1aku", "yimdy1t684zbjowpbuiduwwodj", "9o1sennwafq93mfktesq3u148k", "wx53zae8f65dapqsyosrna8ut5", "w6myqcskkm8i8o9irdreuph56w", "3q7tmspxz19z69prdkarbdt3p8", "7ctuig4u1ufua6nssidpgr6ewq", "hkuxd5ek95y9taoxik9p64asf3", "zjj46gmzu13jjn5fqd94bp5u1a", "ujziq8brph9jiofzer9xnrf7mn", "cz8geybczsqntb7knr69rtwjfd", "rz4o3ma9z9wddcemxx45nzn8ww", "tusurxfzphgu9mn8p1x5yx6jrk", "17j5mienxuoiwuakmy1o5d7ib3", "9a3wbd837n8na6mwbnt14kkbpq", "nqo7mcziz9ziw5s3fs1ef1ijk4", "ynomnwu6w3d1ukdb4m5r16t1gz", "dhb4zk1yixrwjd677co3dskfab", "w4fktm4688grn5uujw5uazi6z1", "e8tpfuwhfcma1max7ecudewore", "tm7d9bpawauot1zmzmrebppauq", "8kr759nfjtxa6hictg3asgxig6", "1kjiu1wcm4hwhfjpagzwf4t7n3", "brhambc1te8z53emhgupa8kzpd", "m4ss9t7qq67b4jc5dnfrseqep6", "zikhetznm4a8mrf49ugm7tozqw", "u7571bbcmx8npcmd5566m5ukb6", "h4n4mre1dfuqycmfbieogifkot", "uy3n7pqxexm1zwzfznd7eaaxzd", "gtam6jfecsbz3rjdeaqrd7x9ug", "o3f49i6pj1o5f64zc4iwggodfp", "oxd5unhuobn7wwcaeqnwsdsu66", "gfaht9zz684qeaj5sp15f47wjh", "i66ra6qgri3qrdhq5f8qck4ph6", "9m6qrptdhgmcuz99x67x6u961u", "5u1o88mksy8rb7u4icwugmxbe1", "ndr7ynmqma9xdpmopydwpmgo3t", "idh3obto6pgqyyqyip7ccz1ofw", "f6ttuh1fib1z7ojn7m4k4ibfaj", "g5gy4ftagxxsg3oui8gje7bzs3", "bin6rum17mnkfdthwyacur54zb", "ubmprty7n17rujuz54ftt14fjq", "w4orazbza9fdky5xnf3134fhr6", "g9h113mgki94znn5yqxub3ag6d", "az17h8jcpyc1g18cngr9smts1h", "ik7bcdgsed9zg1k9h1of3ajyf1", "ams86onzsc438xrrtngjqd6ifd", "8y7ndwcrmtyeii4zyohbgy3kbx", "wag85ck6ywy6zo4mqpbim91kys", "iocdaqbuhgtwrzipp8kx17ebf9", "871rg1i4hboxcwdk4x65d7nbmc", "6eu6bpbo9g6my1pd4qnwbzbnff", "71suj8gdmzcukfqq9afoym8qm3", "ckmbrttb1kduukdgq8gboyk1zf", "cyyoh9rcuf6pm6xdrdf84qqwzk", "w1nr1cayrh5esp83a4mzppn3nw", "u1479anr9ergdf99mz6ofhi48n", "1khpthie5h7oapxtmqpuqdqkod", "t9eocsfwod3k3bbdga33k9uet4", "k5t8c41bbrko75knjh8zepkd3z", "1nky9tsw3k9nnwhyu38pcnoqfm", "rz8d3ke4j44hf6nabyc7wbgoft", "eri48z5ektr1b7xkr9sy17ao1i", "wibzmdmo1q1jjz4hapsout7geh", "b7nx3itj6nghd54u3gzy5ndj93", "i5r7fazxp31ddixiiwne1bhpaa", "z484cdy4e6gszik74myr5mcg4e", "8xb55g14qtuyih6ojnw4eptway", "djsmuoqhrj58jkonyh1pnp64f1", "t6cha81jkc5fhow3k3xbbbjis8", "ohwu5rut5j3shohaa8tz9p4hjx", "1t3wp8a63jpgpij9wxq83w98aq", "fjx4wargux3smyafn83q55qo8a", "n5hpf9cuskzpks57e145yi8u6q", "k9x35pzo5rq7tce5ob8uggs5x5", "u3c9yikcmy1tgooujkg4i5awuy", "tmmk74jhdz3mmnm6iehk5d48ic", "jwa9rumxk5zeknjdn11pq3mnyz", "87bratz37jt7s8bcg14tftydar", "gynarn89deddsoedut4yg4458s", "Desmond", "Lucy"}).
		ToPlaybook()

	pb = []playbook.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08}

	users = []string{"jon", "Andrew", "Matt", "Lucy", "Desmond"}
)

func TestGetPlaybook(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookStore := setupPlaybookStore(t, db)

		t.Run(driverName+" - id empty", func(t *testing.T) {
			actual, err := playbookStore.Get("")
			require.Error(t, err)
			require.EqualError(t, err, "ID cannot be empty")
			require.Equal(t, playbook.Playbook{}, actual)
		})

		t.Run(driverName+" - create and retrieve playbook", func(t *testing.T) {
			id, err := playbookStore.Create(pb02)
			require.NoError(t, err)
			expected := pb02.Clone()
			expected.ID = id

			actual, err := playbookStore.Get(id)
			require.NoError(t, err)
			require.Equal(t, expected, actual)
		})

		t.Run(driverName+" - create and retrieve all playbooks", func(t *testing.T) {
			var inserted []playbook.Playbook
			for _, p := range pb {
				id, err := playbookStore.Create(p)
				require.NoError(t, err)

				tmp := p.Clone()
				tmp.ID = id
				inserted = append(inserted, tmp)
			}

			for _, p := range inserted {
				got, err := playbookStore.Get(p.ID)
				require.NoError(t, err)
				require.Equal(t, p, got)
			}
			require.Equal(t, len(pb), len(inserted))
		})

		t.Run(driverName+" - create but retrieve non-existing playbook", func(t *testing.T) {
			id, err := playbookStore.Create(pb02)
			require.NoError(t, err)
			expected := pb02.Clone()
			expected.ID = id

			actual, err := playbookStore.Get("nonexisting")
			require.Error(t, err)
			require.EqualError(t, err, "playbook does not exist for id 'nonexisting': not found")
			require.Equal(t, playbook.Playbook{}, actual)
		})

		t.Run(driverName+" - set and retrieve playbook with no members and no checklists", func(t *testing.T) {
			pb10 := NewPBBuilder().
				WithTitle("playbook 10").
				WithTeamID(team1id).
				WithCreateAt(800).
				ToPlaybook()
			id, err := playbookStore.Create(pb10)
			require.NoError(t, err)
			expected := pb10.Clone()
			expected.ID = id

			actual, err := playbookStore.Get(id)
			require.NoError(t, err)
			require.Equal(t, expected, actual)
		})
	}
}

func TestGetPlaybooks(t *testing.T) {
	tests := []struct {
		name        string
		expected    []playbook.Playbook
		expectedErr error
	}{
		{
			name:        "get all playbooks",
			expected:    pb,
			expectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookStore := setupPlaybookStore(t, db)

		t.Run("zero playbooks", func(t *testing.T) {
			result, err := playbookStore.GetPlaybooks()
			require.NoError(t, err)
			require.ElementsMatch(t, []playbook.Playbook{}, result)
		})

		// create playbooks, test that they were created correctly
		all, err := playbookStore.GetPlaybooks()
		require.NoError(t, err)
		require.Equal(t, 0, len(all))

		var inserted []playbook.Playbook
		for _, p := range pb {
			id, err := playbookStore.Create(p)
			require.NoError(t, err)

			tmp := p.Clone()
			tmp.ID = id
			inserted = append(inserted, tmp)
		}

		for _, p := range inserted {
			got, err := playbookStore.Get(p.ID)
			require.NoError(t, err)
			require.Equal(t, p, got)
		}
		require.Equal(t, len(pb), len(inserted))

		for _, testCase := range tests {
			t.Run(driverName+" - "+testCase.name, func(t *testing.T) {
				actual, err := playbookStore.GetPlaybooks()

				if testCase.expectedErr != nil {
					require.Nil(t, actual)
					require.Error(t, err)
					require.Equal(t, testCase.expectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, p := range actual {
					require.True(t, model.IsValidId(p.ID))
					actual[i].ID = ""
				}

				// remove the checklists from the expected playbooks--we don't return them in getPlaybooks
				var expected []playbook.Playbook
				for _, p := range testCase.expected {
					tmp := p.Clone()
					tmp.Checklists = nil
					expected = append(expected, tmp)
				}

				require.ElementsMatch(t, expected, actual)
			})
		}
	}
}

func TestGetPlaybooksForTeam(t *testing.T) {
	createPlaybooks := func(store playbook.Store) {
		t.Helper()

		for _, p := range pb {
			_, err := store.Create(p)
			require.NoError(t, err)
		}
	}

	tests := []struct {
		name          string
		teamID        string
		requesterInfo playbook.RequesterInfo
		options       playbook.Options
		expected      playbook.GetPlaybooksResults
		expectedErr   error
	}{
		{
			name:   "team1 from Andrew",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "Andrew",
				TeamID: team1id,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb01, pb02},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "jon",
				TeamID: team1id,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb01, pb03},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon title desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "jon",
				TeamID: team1id,
			},
			options: playbook.Options{
				Sort:      playbook.SortByTitle,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon sort by stages desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "jon",
				TeamID: team1id,
			},
			options: playbook.Options{
				Sort:      playbook.SortByStages,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb01, pb02, pb03, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin, member only",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
				MemberOnly:      true,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb03},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb04, pb02, pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by title desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort:      playbook.SortByTitle,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb04, pb03, pb02, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, default is asc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort: playbook.SortBySteps,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb01, pb03, pb02, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, specify asc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderAsc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb01, pb03, pb02, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb04, pb02, pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by stages",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort: playbook.SortByStages,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb04, pb01, pb03, pb02},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by stages, desc",
			teamID: team1id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort:      playbook.SortByStages,
				Direction: playbook.OrderDesc,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb02, pb03, pb01, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team2 from Matt",
			teamID: team2id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "Matt",
				TeamID: team2id,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb06},
			},
			expectedErr: nil,
		},
		{
			name:   "team3 from Andrew (not on team)",
			teamID: team3id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "Andrew",
				TeamID: team3id,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb07},
			},
			expectedErr: nil,
		},
		{
			name:   "team3 from Admin",
			teamID: team3id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb07, pb08},
			},
			expectedErr: nil,
		},
		{
			name:   "team3 from Admin, memberOnly",
			teamID: team3id,
			requesterInfo: playbook.RequesterInfo{
				UserID:          "Lucy",
				UserIDtoIsAdmin: map[string]bool{"Lucy": true},
				MemberOnly:      true,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb08},
			},
			expectedErr: nil,
		},
		{
			name:   "team3 from Desmond - testing many members",
			teamID: team3id,
			requesterInfo: playbook.RequesterInfo{
				UserID: "Desmond",
				TeamID: team3id,
			},
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected: playbook.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{pb08},
			},
			expectedErr: nil,
		},
		{
			name:   "none found",
			teamID: "not-existing",
			expected: playbook.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			expectedErr: nil,
		},
	}

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookStore := setupPlaybookStore(t, db)

		t.Run("zero playbooks", func(t *testing.T) {
			result, err := playbookStore.GetPlaybooks()
			require.NoError(t, err)
			require.ElementsMatch(t, []playbook.Playbook{}, result)
		})

		_, _, store := setupSQLStore(t, db)
		setupUsersTable(t, db)
		setupTeamMembersTable(t, db)
		addUsers(t, store, users)
		addUsersToTeam(t, store, users, team1id)
		addUsersToTeam(t, store, users, team2id)
		makeAdmin(t, store, "Lucy")

		createPlaybooks(playbookStore)

		for _, testCase := range tests {
			t.Run(driverName+" - "+testCase.name, func(t *testing.T) {
				actual, err := playbookStore.GetPlaybooksForTeam(testCase.requesterInfo, testCase.teamID, testCase.options)

				if testCase.expectedErr != nil {
					require.Nil(t, actual)
					require.Error(t, err)
					require.Equal(t, testCase.expectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, p := range actual.Items {
					require.True(t, model.IsValidId(p.ID))
					actual.Items[i].ID = ""
				}

				// remove the checklists and members from the expected playbooks--we don't return them in getPlaybooks
				for i := range testCase.expected.Items {
					testCase.expected.Items[i].Checklists = nil
					testCase.expected.Items[i].MemberIDs = nil
				}

				require.Equal(t, testCase.expected, actual)
			})
		}
	}
}

func TestUpdatePlaybook(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookStore := setupPlaybookStore(t, db)

		tests := []struct {
			name        string
			playbook    playbook.Playbook
			update      func(playbook.Playbook) playbook.Playbook
			expectedErr error
		}{
			{
				name:     "id should not be empty",
				playbook: NewPBBuilder().ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					return playbook.Playbook{}
				},
				expectedErr: errors.New("id should not be empty"),
			},
			{
				name:     "Incident should not contain checklists with no items",
				playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Checklists[0].Items = []playbook.ChecklistItem{}
					return old
				},
				expectedErr: errors.New("checklists with no items are not allowed"),
			},
			{
				name:     "playbook now public",
				playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.CreatePublicIncident = true
					return old
				},
				expectedErr: nil,
			},
			{
				name:     "playbook new title",
				playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Title = "new title"
					return old
				},
				expectedErr: nil,
			},
			{
				name: "playbook new description",
				playbook: NewPBBuilder().WithDescription("original description").
					WithChecklists([]int{1}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Description = "new description"
					return old
				},
				expectedErr: nil,
			},
			{
				name:     "delete playbook",
				playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.DeleteAt = model.GetMillis()
					return old
				},
				expectedErr: nil,
			},
			{
				name:     "Incident with 2 checklists, update the checklists a bit",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Checklists[0].Items[0].State = playbook.ChecklistItemStateClosed
					old.Checklists[1].Items[1].Title = "new title"
					return old
				},
				expectedErr: nil,
			},
			{
				name:     "Incident with 3 checklists, update to 0",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2, 5}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Checklists = []playbook.Checklist{}
					old.NumSteps = 0
					old.NumStages = 0
					return old
				},
				expectedErr: nil,
			},
			{
				name: "Incident with 2 members, go to 1",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
					WithMembers([]string{"Jon", "Andrew"}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.MemberIDs = []string{"Andrew"}
					return old
				},
				expectedErr: nil,
			},
			{
				name: "Incident with 3 members, go to 4 with different members",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
					WithMembers([]string{"Jon", "Andrew", "Bob"}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.MemberIDs = []string{"Matt", "Bill", "Alice", "Jen"}
					return old
				},
				expectedErr: nil,
			},
			{
				name: "Incident with 3 members, go to 4 with one different member",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
					WithMembers([]string{"Jon", "Andrew", "Bob"}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.MemberIDs = []string{"Jon", "Andrew", "Bob", "Alice"}
					return old
				},
				expectedErr: nil,
			},
			{
				name:     "Incident with 0 members, go to 2",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.MemberIDs = []string{"Alice", "Jen"}
					return old
				},
				expectedErr: nil,
			},
			{
				name: "Incident with 5 members, go to 0",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
					WithMembers([]string{"Jon", "Andrew", "j1", "j2", "j3"}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.MemberIDs = nil
					return old
				},
				expectedErr: nil,
			},
		}

		for _, testCase := range tests {
			t.Run(testCase.name, func(t *testing.T) {
				returned, err := playbookStore.Create(testCase.playbook)
				testCase.playbook.ID = returned
				require.NoError(t, err)
				expected := testCase.update(testCase.playbook)

				err = playbookStore.Update(expected)

				if testCase.expectedErr != nil {
					require.Error(t, err)
					require.EqualError(t, err, testCase.expectedErr.Error())
					return
				}

				require.NoError(t, err)

				actual, err := playbookStore.Get(expected.ID)
				require.NoError(t, err)
				require.Equal(t, expected, actual)
			})
		}
	}
}

func TestDeletePlaybook(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		playbookStore := setupPlaybookStore(t, db)

		t.Run(driverName+" - id empty", func(t *testing.T) {
			err := playbookStore.Delete("")
			require.Error(t, err)
			require.EqualError(t, err, "ID cannot be empty")
		})

		t.Run(driverName+" - create and delete playbook", func(t *testing.T) {
			before := model.GetMillis()

			id, err := playbookStore.Create(pb02)
			require.NoError(t, err)
			expected := pb02.Clone()
			expected.ID = id

			actual, err := playbookStore.Get(id)
			require.NoError(t, err)
			require.Equal(t, expected, actual)

			err = playbookStore.Delete(id)
			require.NoError(t, err)

			actual, err = playbookStore.Get(id)
			require.NoError(t, err)
			require.Greater(t, actual.DeleteAt, before)

			expected.DeleteAt = actual.DeleteAt
			require.Equal(t, expected, actual)
		})
	}
}

// PlaybookBuilder is a utility to build playbooks with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToPlaybook()
type PlaybookBuilder struct {
	*playbook.Playbook
}

func NewPBBuilder() *PlaybookBuilder {
	return &PlaybookBuilder{
		&playbook.Playbook{
			Title:                "base playbook",
			TeamID:               model.NewId(),
			CreatePublicIncident: false,
			CreateAt:             model.GetMillis(),
			DeleteAt:             0,
			Checklists:           []playbook.Checklist(nil),
			MemberIDs:            []string(nil),
		},
	}
}

func (p *PlaybookBuilder) WithID() *PlaybookBuilder {
	p.ID = model.NewId()

	return p
}

func (p *PlaybookBuilder) WithTitle(title string) *PlaybookBuilder {
	p.Title = title

	return p
}

func (p *PlaybookBuilder) WithDescription(desc string) *PlaybookBuilder {
	p.Description = desc

	return p
}

func (p *PlaybookBuilder) WithTeamID(id string) *PlaybookBuilder {
	p.TeamID = id

	return p
}

func (p *PlaybookBuilder) WithCreatePublic(public bool) *PlaybookBuilder {
	p.CreatePublicIncident = public

	return p
}

func (p *PlaybookBuilder) WithCreateAt(createAt int64) *PlaybookBuilder {
	p.CreateAt = createAt

	return p
}

func (p *PlaybookBuilder) WithDeleteAt(deleteAt int64) *PlaybookBuilder {
	p.DeleteAt = deleteAt

	return p
}

func (p *PlaybookBuilder) WithChecklists(itemsPerChecklist []int) *PlaybookBuilder {
	p.Checklists = make([]playbook.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		items := make([]playbook.ChecklistItem, numItems)
		for j := 0; j < numItems; j++ {
			items[j] = playbook.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			}
		}

		p.Checklists[i] = playbook.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	p.NumStages = int64(len(itemsPerChecklist))
	p.NumSteps = sum(itemsPerChecklist)

	return p
}

func sum(nums []int) int64 {
	ret := 0
	for _, n := range nums {
		ret += n
	}
	return int64(ret)
}

func (p *PlaybookBuilder) WithMembers(members []string) *PlaybookBuilder {
	p.MemberIDs = members

	return p
}

func (p *PlaybookBuilder) ToPlaybook() playbook.Playbook {
	return *p.Playbook
}

func setupPlaybookStore(t *testing.T, db *sqlx.DB) playbook.Store {
	return NewPlaybookStore(setupSQLStore(t, db))
}
