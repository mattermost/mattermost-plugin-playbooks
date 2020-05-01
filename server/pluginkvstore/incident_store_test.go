package pluginkvstore

import (
	"reflect"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
)

var id1 = incident.Header{
	ID:              "id1",
	Name:            "incident 1 - wheel cat aliens wheelbarrow",
	IsActive:        true,
	CommanderUserID: "commander1",
	TeamID:          "team1",
	CreatedAt:       123,
	EndedAt:         440,
}

var id2 = incident.Header{
	ID:              "id2",
	Name:            "incident 2 - horse stapler battery shotgun mouse shotputmouse",
	IsActive:        true,
	CommanderUserID: "commander2",
	TeamID:          "team1",
	CreatedAt:       145,
	EndedAt:         555,
}

var id3 = incident.Header{
	ID:              "id3",
	Name:            "incident 3 - stapler horse battery shotgun mouse shotputmouse",
	IsActive:        false,
	CommanderUserID: "commander1",
	TeamID:          "team1",
	CreatedAt:       222,
	EndedAt:         666,
}

var id4 = incident.Header{
	ID:              "id4",
	Name:            "incident 4 - titanic terminator aliens",
	IsActive:        false,
	CommanderUserID: "commander3",
	TeamID:          "team2",
	CreatedAt:       333,
	EndedAt:         444,
}

var id5 = incident.Header{
	ID:              "id5",
	Name:            "incident 5 - ubik high castle electric sheep",
	IsActive:        true,
	CommanderUserID: "commander3",
	TeamID:          "team2",
	CreatedAt:       223,
	EndedAt:         550,
}

var dbHeaderMap = idHeaderMap{
	"id1": id1,
	"id2": id2,
	"id3": id3,
	"id4": id4,
	"id5": id5,
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
			want:    []incident.Header{id4, id5, id3, id2, id1},
		},
		{
			name: "team1 only, ascending",
			options: incident.HeaderFilterOptions{
				TeamID:  "team1",
				OrderBy: incident.Asc,
			},
			want: []incident.Header{id1, id2, id3},
		},
		{
			name: "sort by ended_at",
			options: incident.HeaderFilterOptions{
				Sort: "ended_at",
			},
			want: []incident.Header{id3, id2, id5, id4, id1},
		},
		{
			name: "no options, paged by 1",
			options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 1,
			},
			want: []incident.Header{id4},
		},
		{
			name: "no options, paged by 3",
			options: incident.HeaderFilterOptions{
				Page:    0,
				PerPage: 3,
			},
			want: []incident.Header{id4, id5, id3},
		},
		{
			name: "no options, page 1 by 2",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
			},
			want: []incident.Header{id3, id2},
		},
		{
			name: "no options, page 1 by 3",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 3,
			},
			want: []incident.Header{id2, id1},
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
			want: []incident.Header{id5, id2},
		},
		{
			name: "only active, page 1 of 2",
			options: incident.HeaderFilterOptions{
				Page:    1,
				PerPage: 2,
				Active:  true,
			},
			want: []incident.Header{id1},
		},
		{
			name: "active, commander3, asc",
			options: incident.HeaderFilterOptions{
				Active:      true,
				CommanderID: "commander3",
				OrderBy:     incident.Asc,
			},
			want: []incident.Header{id5},
		},
		{
			name: "commander1, asc, by ended_at",
			options: incident.HeaderFilterOptions{
				CommanderID: "commander1",
				OrderBy:     incident.Asc,
				Sort:        "ended_at",
			},
			want: []incident.Header{id1, id3},
		},
		{
			name: "search for horse",
			options: incident.HeaderFilterOptions{
				Search: "horse",
			},
			want: []incident.Header{id2, id3},
		},
		{
			name: "search for aliens & commander3",
			options: incident.HeaderFilterOptions{
				CommanderID: "commander3",
				Search:      "aliens",
			},
			want: []incident.Header{id4},
		},
		{
			name: "fuzzy search using starting characters",
			options: incident.HeaderFilterOptions{
				Search: "sbsm",
			},
			want: []incident.Header{id2, id3},
		},
		{
			name: "fuzzy search using starting characters, active",
			options: incident.HeaderFilterOptions{
				Search: "sbsm",
				Active: true,
			},
			want: []incident.Header{id2},
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
