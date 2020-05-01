package pluginkvstore

import (
	"reflect"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
)

var dbHeaderMap = idHeaderMap{
	"id1": incident.Header{
		ID:              "id1",
		Name:            "incident 1",
		IsActive:        true,
		CommanderUserID: "commander1",
		TeamID:          "team1",
		CreatedAt:       123,
		EndedAt:         440,
	},
	"id2": incident.Header{
		ID:              "id2",
		Name:            "incident 2",
		IsActive:        true,
		CommanderUserID: "commander2",
		TeamID:          "team1",
		CreatedAt:       145,
		EndedAt:         555,
	},
	"id3": incident.Header{
		ID:              "id3",
		Name:            "incident 3",
		IsActive:        false,
		CommanderUserID: "commander1",
		TeamID:          "team1",
		CreatedAt:       222,
		EndedAt:         666,
	},
	"id4": incident.Header{
		ID:              "id4",
		Name:            "incident 4",
		IsActive:        false,
		CommanderUserID: "commander3",
		TeamID:          "team2",
		CreatedAt:       333,
		EndedAt:         444,
	},
	"id5": incident.Header{
		ID:              "id5",
		Name:            "incident 5",
		IsActive:        true,
		CommanderUserID: "commander3",
		TeamID:          "team2",
		CreatedAt:       223,
		EndedAt:         550,
	},
}

func Test_incidentStore_GetHeaders(t *testing.T) {
	tests := []struct {
		name    string
		options incident.HeaderFilterOptions
		want    []incident.Header
		wantErr bool
	}{
		{
			name:    "simple getHeaders, no options",
			options: incident.HeaderFilterOptions{},
			want: []incident.Header{
				{
					ID:              "id4",
					Name:            "incident 4",
					IsActive:        false,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       333,
					EndedAt:         444,
				},
				{
					ID:              "id5",
					Name:            "incident 5",
					IsActive:        true,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       223,
					EndedAt:         550,
				},
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
			},
		},
		{
			name: "team1 only, ascending",
			options: incident.HeaderFilterOptions{
				TeamID:  "team1",
				OrderBy: incident.Asc,
			},
			want: []incident.Header{
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
			},
		},
		{
			name: "sort by ended_at",
			options: incident.HeaderFilterOptions{
				Sort: "ended_at",
			},
			want: []incident.Header{
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
				{
					ID:              "id5",
					Name:            "incident 5",
					IsActive:        true,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       223,
					EndedAt:         550,
				},
				{
					ID:              "id4",
					Name:            "incident 4",
					IsActive:        false,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       333,
					EndedAt:         444,
				},
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
			},
		},
		{
			name: "no options, paged by 1",
			options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 1,
			},
			want: []incident.Header{
				{
					ID:              "id4",
					Name:            "incident 4",
					IsActive:        false,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       333,
					EndedAt:         444,
				},
			},
		},
		{
			name: "no options, paged by 3",
			options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 3,
			},
			want: []incident.Header{
				{
					ID:              "id4",
					Name:            "incident 4",
					IsActive:        false,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       333,
					EndedAt:         444,
				},
				{
					ID:              "id5",
					Name:            "incident 5",
					IsActive:        true,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       223,
					EndedAt:         550,
				},
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
			},
		},
		{
			name: "no options, page 1 by 2",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
			},
			want: []incident.Header{
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
			},
		},
		{
			name: "no options, page 1 by 3",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 3,
			},
			want: []incident.Header{
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
			},
		},
		{
			name: "no options, page 1 by 5",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 5,
			},
			want: []incident.Header{},
		},
		{
			name: "sorted by ended, ascending, page 1 of 2",
			options: incident.HeaderFilterOptions{
				Sort:    "ended_at",
				OrderBy: incident.Asc,
				Page:    1,
				PerPage: 2,
			},
			want: []incident.Header{
				{
					ID:              "id5",
					Name:            "incident 5",
					IsActive:        true,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       223,
					EndedAt:         550,
				},
				{
					ID:              "id2",
					Name:            "incident 2",
					IsActive:        true,
					CommanderUserID: "commander2",
					TeamID:          "team1",
					CreatedAt:       145,
					EndedAt:         555,
				},
			},
		},
		{
			name: "only active, page 1 of 2",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
				Active:  true,
			},
			want: []incident.Header{
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
			},
		},
		{
			name: "active, commander3, asc",
			options: incident.HeaderFilterOptions{
				Active:      true,
				CommanderID: "commander3",
				OrderBy:     incident.Asc,
			},
			want: []incident.Header{
				{
					ID:              "id5",
					Name:            "incident 5",
					IsActive:        true,
					CommanderUserID: "commander3",
					TeamID:          "team2",
					CreatedAt:       223,
					EndedAt:         550,
				},
			},
		},
		{
			name: "commander1, asc, by ended_at",
			options: incident.HeaderFilterOptions{
				CommanderID: "commander1",
				OrderBy:     incident.Asc,
				Sort:        "ended_at",
			},
			want: []incident.Header{
				{
					ID:              "id1",
					Name:            "incident 1",
					IsActive:        true,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       123,
					EndedAt:         440,
				},
				{
					ID:              "id3",
					Name:            "incident 3",
					IsActive:        false,
					CommanderUserID: "commander1",
					TeamID:          "team1",
					CreatedAt:       222,
					EndedAt:         666,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockCtrl := gomock.NewController(t)
			defer mockCtrl.Finish()
			kvAPI := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
			kvAPI.EXPECT().
				Get(allHeadersKey, gomock.Any()).
				SetArg(1, dbHeaderMap).
				Times(1)

			s := &incidentStore{
				pluginAPI: kvAPI,
			}
			got, err := s.GetHeaders(tt.options)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetHeaders() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("GetHeaders() got = %v, want %v", got, tt.want)
			}
		})
	}
}
