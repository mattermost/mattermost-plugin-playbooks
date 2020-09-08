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
		WithChecklists([]int{1, 4, 6, 7, 1}).
		WithMembers([]string{"Andrew", "Matt"}).
		ToPlaybook()

	pb03 = NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team2id).
		WithCreateAt(700).
		WithChecklists([]int{1, 2, 3}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb04 = NewPBBuilder().
		WithTitle("playbook 4").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithTeamID(team1id).
		WithCreateAt(800).
		WithChecklists([]int{1, 2, 40}).
		ToPlaybook()

	pb05 = NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamID(team2id).
		WithCreateAt(900).
		WithChecklists([]int{1}).
		WithMembers([]string{"jon", "Andrew"}).
		ToPlaybook()

	pb06 = NewPBBuilder().
		WithTitle("playbook 6").
		WithTeamID(team1id).
		WithCreateAt(1000).
		WithChecklists([]int{20}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb07 = NewPBBuilder().
		WithTitle("playbook 7").
		WithTeamID(team3id).
		WithCreateAt(1100).
		WithChecklists([]int{1}).
		WithMembers([]string{"Andrew"}).
		ToPlaybook()

	pb08 = NewPBBuilder().
		WithTitle("playbook 8").
		WithTeamID(team1id).
		WithCreateAt(1200).
		WithMembers([]string{"jon", "Matt"}).
		ToPlaybook()

	pb = []playbook.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08}
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
	createPlaybooks := func(store playbook.Store) {
		t.Helper()

		for i := range pb {
			_, err := store.Create(pb[i])
			require.NoError(t, err)
		}
	}

	tests := []struct {
		name        string
		expected    []playbook.Playbook
		expectedErr error
	}{
		{
			name:        "get all playbooks",
			expected:    []playbook.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08},
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

		createPlaybooks(playbookStore)

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
				for i := range testCase.expected {
					testCase.expected[i].Checklists = []playbook.Checklist(nil)
				}

				require.ElementsMatch(t, testCase.expected, actual)
			})
		}
	}
}

func TestGetPlaybooksForTeam(t *testing.T) {
	createPlaybooks := func(store playbook.Store) {
		t.Helper()

		for i := range pb {
			_, err := store.Create(pb[i])
			require.NoError(t, err)
		}
	}

	tests := []struct {
		name        string
		teamID      string
		options     playbook.Options
		expected    []playbook.Playbook
		expectedErr error
	}{
		{
			name:   "team1",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected:    []playbook.Playbook{pb01, pb02, pb04, pb06, pb08},
			expectedErr: nil,
		},
		{
			name:   "team2",
			teamID: team2id,
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			expected:    []playbook.Playbook{pb03, pb05},
			expectedErr: nil,
		},
		{
			name:        "team3",
			teamID:      team3id,
			expected:    []playbook.Playbook{pb07},
			expectedErr: nil,
		},
		{
			name:   "team1 title desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortByTitle,
				Direction: playbook.OrderDesc,
			},
			expected:    []playbook.Playbook{pb08, pb06, pb04, pb02, pb01},
			expectedErr: nil,
		},
		{
			name:   "team1 steps default is ASC",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortBySteps,
			},
			expected:    []playbook.Playbook{pb08, pb01, pb02, pb06, pb04},
			expectedErr: nil,
		},
		{
			name:   "team1 steps, specify ASC",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderAsc,
			},
			expected:    []playbook.Playbook{pb08, pb01, pb02, pb06, pb04},
			expectedErr: nil,
		},
		{
			name:   "team1 steps desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderDesc,
			},
			expected:    []playbook.Playbook{pb04, pb06, pb02, pb01, pb08},
			expectedErr: nil,
		},
		{
			name:   "team1 stages",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortByStages,
			},
			expected:    []playbook.Playbook{pb08, pb06, pb01, pb04, pb02},
			expectedErr: nil,
		},
		{
			name:   "team1 stages desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortByStages,
				Direction: playbook.OrderDesc,
			},
			expected:    []playbook.Playbook{pb02, pb04, pb01, pb06, pb08},
			expectedErr: nil,
		},
		{
			name:        "none found",
			teamID:      "not-existing",
			expected:    []playbook.Playbook(nil),
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

		createPlaybooks(playbookStore)

		for _, testCase := range tests {
			t.Run(driverName+" - "+testCase.name, func(t *testing.T) {
				actual, err := playbookStore.GetPlaybooksForTeam(testCase.teamID, testCase.options)

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
				for i := range testCase.expected {
					testCase.expected[i].Checklists = []playbook.Checklist(nil)
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
				name:     "Incident with 3 checklists, update the 0",
				playbook: NewPBBuilder().WithChecklists([]int{1, 2, 5}).ToPlaybook(),
				update: func(old playbook.Playbook) playbook.Playbook {
					old.Checklists = []playbook.Checklist{}
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

	return p
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
