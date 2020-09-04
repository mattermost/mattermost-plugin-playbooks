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
		WithTeamId(team1id).
		WithCreateAt(500).
		WithChecklists([]int{1, 2}).
		WithMembers([]string{"jon", "Andrew", "Matt"}).
		ToPlaybook()

	pb02 = NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamId(team1id).
		WithCreateAt(600).
		WithChecklists([]int{1, 4, 6, 7, 1}).
		WithMembers([]string{"Andrew", "Matt"}).
		ToPlaybook()

	pb03 = NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamId(team2id).
		WithCreateAt(700).
		WithChecklists([]int{1, 2, 3}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb04 = NewPBBuilder().
		WithTitle("playbook 4").
		WithTeamId(team1id).
		WithCreateAt(800).
		WithChecklists([]int{1, 2, 40}).
		WithMembers([]string{"Andrew"}).
		ToPlaybook()

	pb05 = NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamId(team2id).
		WithCreateAt(900).
		WithChecklists([]int{1}).
		WithMembers([]string{"jon", "Andrew"}).
		ToPlaybook()

	pb06 = NewPBBuilder().
		WithTitle("playbook 6").
		WithTeamId(team1id).
		WithCreateAt(1000).
		WithChecklists([]int{20}).
		WithMembers([]string{"Matt"}).
		ToPlaybook()

	pb07 = NewPBBuilder().
		WithTitle("playbook 7").
		WithTeamId(team3id).
		WithCreateAt(1100).
		WithChecklists([]int{1}).
		WithMembers([]string{"Andrew"}).
		ToPlaybook()

	pb08 = NewPBBuilder().
		WithTitle("playbook 8").
		WithTeamId(team1id).
		WithCreateAt(1200).
		WithMembers([]string{"jon", "Matt"}).
		ToPlaybook()

	pb = []playbook.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08}
)

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
		want        []playbook.Playbook
		expectedErr error
	}{
		{
			name:        "get all playbooks",
			want:        []playbook.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08},
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

		for _, tt := range tests {
			t.Run(driverName+" - "+tt.name, func(t *testing.T) {
				result, err := playbookStore.GetPlaybooks()

				if tt.expectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					require.Equal(t, tt.expectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, p := range result {
					require.True(t, model.IsValidId(p.ID))
					result[i].ID = ""
				}

				// remove the checklists from the expected playbooks--we don't return them in getPlaybooks
				for i := range tt.want {
					tt.want[i].Checklists = []playbook.Checklist(nil)
				}

				require.ElementsMatch(t, tt.want, result)
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
		want        []playbook.Playbook
		expectedErr error
	}{
		{
			name:   "team1",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			want:        []playbook.Playbook{pb01, pb02, pb04, pb06, pb08},
			expectedErr: nil,
		},
		{
			name:   "team2",
			teamID: team2id,
			options: playbook.Options{
				Sort: playbook.SortByTitle,
			},
			want:        []playbook.Playbook{pb03, pb05},
			expectedErr: nil,
		},
		{
			name:        "team3",
			teamID:      team3id,
			want:        []playbook.Playbook{pb07},
			expectedErr: nil,
		},
		{
			name:   "team1 title desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortByTitle,
				Direction: playbook.OrderDesc,
			},
			want:        []playbook.Playbook{pb08, pb06, pb04, pb02, pb01},
			expectedErr: nil,
		},
		{
			name:   "team1 steps",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortBySteps,
			},
			want:        []playbook.Playbook{pb08, pb01, pb02, pb06, pb04},
			expectedErr: nil,
		},
		{
			name:   "team1 steps desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortBySteps,
				Direction: playbook.OrderDesc,
			},
			want:        []playbook.Playbook{pb04, pb06, pb02, pb01, pb08},
			expectedErr: nil,
		},
		{
			name:   "team1 stages",
			teamID: team1id,
			options: playbook.Options{
				Sort: playbook.SortByStages,
			},
			want:        []playbook.Playbook{pb08, pb06, pb01, pb04, pb02},
			expectedErr: nil,
		},
		{
			name:   "team1 stages desc",
			teamID: team1id,
			options: playbook.Options{
				Sort:      playbook.SortByStages,
				Direction: playbook.OrderDesc,
			},
			want:        []playbook.Playbook{pb02, pb04, pb01, pb06, pb08},
			expectedErr: nil,
		},
		{
			name:        "none found",
			teamID:      "not-existing",
			want:        []playbook.Playbook(nil),
			expectedErr: errors.Wrap(playbook.ErrNotFound, "no playbooks found"),
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

		for _, tt := range tests {
			t.Run(driverName+" - "+tt.name, func(t *testing.T) {
				result, err := playbookStore.GetPlaybooksForTeam(tt.teamID, tt.options)

				if tt.expectedErr != nil {
					require.Nil(t, result)
					require.Error(t, err)
					require.Equal(t, tt.expectedErr.Error(), err.Error())

					return
				}

				require.NoError(t, err)

				for i, p := range result {
					require.True(t, model.IsValidId(p.ID))
					result[i].ID = ""
				}

				// remove the checklists from the expected playbooks--we don't return them in getPlaybooks
				for i := range tt.want {
					tt.want[i].Checklists = []playbook.Checklist(nil)
				}

				require.Equal(t, tt.want, result)
			})
		}
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

func (p *PlaybookBuilder) WithTeamId(id string) *PlaybookBuilder {
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
