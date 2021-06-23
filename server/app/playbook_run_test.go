package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestPlaybookRun_MarshalJSON(t *testing.T) {
	testPlaybookRun := &PlaybookRun{}
	result, err := json.Marshal(testPlaybookRun)
	require.NoError(t, err)
	require.NotContains(t, string(result), "null", "update MarshalJSON to initialize nil slices")
}

func TestPlaybookRun_LastResovedAt(t *testing.T) {
	for name, tc := range map[string]struct {
		inc      PlaybookRun
		expected int64
	}{
		"blank": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{},
			},
			expected: 0,
		},
		"just active": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 999,
						Status:   StatusActive,
					},
				},
			},
			expected: 0,
		},
		"just resolved": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 999,
						Status:   StatusResolved,
					},
				},
			},
			expected: 999,
		},
		"resolved": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 1,
						Status:   StatusActive,
					},
					{
						DeleteAt: 0,
						CreateAt: 123,
						Status:   StatusResolved,
					},
				},
			},
			expected: 123,
		},
		"resolved deleted": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 1,
						Status:   StatusActive,
					},
					{
						DeleteAt: 23,
						CreateAt: 123,
						Status:   StatusResolved,
					},
				},
			},
			expected: 0,
		},
		"multiple resolution": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 1,
						Status:   StatusActive,
					},
					{
						DeleteAt: 0,
						CreateAt: 123,
						Status:   StatusResolved,
					},
					{
						DeleteAt: 0,
						CreateAt: 456,
						Status:   StatusResolved,
					},
				},
			},
			expected: 123,
		},
		"multiple resolution with break": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 1,
						Status:   StatusActive,
					},
					{
						DeleteAt: 0,
						CreateAt: 123,
						Status:   StatusResolved,
					},
					{
						DeleteAt: 0,
						CreateAt: 223,
						Status:   StatusActive,
					},
					{
						DeleteAt: 0,
						CreateAt: 456,
						Status:   StatusResolved,
					},
				},
			},
			expected: 456,
		},
		"resolution but has active afterwards": {
			inc: PlaybookRun{
				StatusPosts: []StatusPost{
					{
						DeleteAt: 0,
						CreateAt: 1,
						Status:   StatusActive,
					},
					{
						DeleteAt: 0,
						CreateAt: 123,
						Status:   StatusResolved,
					},
					{
						DeleteAt: 0,
						CreateAt: 223,
						Status:   StatusActive,
					},
				},
			},
			expected: 0,
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.inc.ResolvedAt())
		})
	}
}

func TestPlaybookRunFilterOptions_Clone(t *testing.T) {
	options := PlaybookRunFilterOptions{
		TeamID:     "team_id",
		Page:       1,
		PerPage:    10,
		Sort:       SortByID,
		Direction:  DirectionAsc,
		Status:     "active",
		Statuses:   []string{"active", "resolved"},
		OwnerID:    "owner_id",
		MemberID:   "member_id",
		SearchTerm: "search_term",
		PlaybookID: "playbook_id",
	}
	marshalledOptions, err := json.Marshal(options)
	require.NoError(t, err)

	clone := options.Clone()
	clone.TeamID = "team_id_clone"
	clone.Page = 2
	clone.PerPage = 20
	clone.Sort = SortByName
	clone.Direction = DirectionDesc
	clone.Status = "archived"
	clone.Statuses[0] = "reported"
	clone.OwnerID = "owner_id_clone"
	clone.MemberID = "member_id_clone"
	clone.SearchTerm = "search_term_clone"
	clone.PlaybookID = "playbook_id_clone"

	var unmarshalledOptions PlaybookRunFilterOptions
	err = json.Unmarshal(marshalledOptions, &unmarshalledOptions)
	require.NoError(t, err)
	require.Equal(t, options, unmarshalledOptions)
}

func TestPlaybookRunFilterOptions_Validate(t *testing.T) {
	t.Run("non-positive PerPage", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			PerPage: -1,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, PerPageDefault, validOptions.PerPage)
	})

	t.Run("invalid sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
			Sort:   SortField("END_at"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByEndAt, validOptions.Sort)
	})

	t.Run("valid, no explicit sort option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, SortByCreateAt, validOptions.Sort)
	})

	t.Run("invalid sort direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case direction option", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:    model.NewId(),
			Direction: SortDirection("DEsC"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionDesc, validOptions.Direction)
	})

	t.Run("valid, no explicit direction", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options.TeamID, validOptions.TeamID)
		require.Equal(t, DirectionAsc, validOptions.Direction)
	})

	t.Run("invalid team id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid owner id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:  model.NewId(),
			OwnerID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid member id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:   model.NewId(),
			MemberID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("invalid playbook id", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:     model.NewId(),
			PlaybookID: "invalid",
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid", func(t *testing.T) {
		options := PlaybookRunFilterOptions{
			TeamID:     model.NewId(),
			Page:       1,
			PerPage:    10,
			Sort:       SortByID,
			Direction:  DirectionAsc,
			Status:     "active",
			Statuses:   []string{"active", "resolved"},
			OwnerID:    model.NewId(),
			MemberID:   model.NewId(),
			SearchTerm: "search_term",
			PlaybookID: model.NewId(),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options, validOptions)
	})
}
