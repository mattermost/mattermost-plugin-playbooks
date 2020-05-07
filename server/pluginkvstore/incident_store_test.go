package pluginkvstore

import (
	"fmt"
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
		IsActive:        true,
		CommanderUserID: "commander1",
		TeamID:          "team1",
		CreatedAt:       222,
		EndedAt:         666,
	},
	"id4": incident.Header{
		ID:              "id4",
		Name:            "incident 4",
		IsActive:        true,
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

var id1 = incident.Incident{
	Header: incident.Header{
		ID:              "id1",
		Name:            "incident 1",
		IsActive:        true,
		CommanderUserID: "commander1",
		TeamID:          "team1",
		CreatedAt:       123,
		EndedAt:         440,
	},
}

var id2 = incident.Incident{
	Header: incident.Header{
		ID:              "id2",
		Name:            "incident 2",
		IsActive:        true,
		CommanderUserID: "commander2",
		TeamID:          "team1",
		CreatedAt:       145,
		EndedAt:         555,
	},
}

var id3 = incident.Incident{
	Header: incident.Header{
		ID:              "id3",
		Name:            "incident 3",
		IsActive:        true,
		CommanderUserID: "commander1",
		TeamID:          "team1",
		CreatedAt:       222,
		EndedAt:         666,
	},
}

var id4 = incident.Incident{
	Header: incident.Header{
		ID:              "id4",
		Name:            "incident 4",
		IsActive:        true,
		CommanderUserID: "commander3",
		TeamID:          "team2",
		CreatedAt:       333,
		EndedAt:         444,
	},
}

var id5 = incident.Incident{
	Header: incident.Header{
		ID:              "id5",
		Name:            "incident 5",
		IsActive:        true,
		CommanderUserID: "commander3",
		TeamID:          "team2",
		CreatedAt:       223,
		EndedAt:         550,
	},
}

func Test_incidentStore_GetIncidents(t *testing.T) {
	tests := []struct {
		name    string
		options incident.FilterOptions
		want    []incident.Incident
		wantErr bool
	}{
		{
			name:    "simple getHeaders, no options",
			options: incident.FilterOptions{},
			want:    []incident.Incident{id4, id5, id3, id2, id1},
		},
		{
			name: "team1 only, ascending",
			options: incident.FilterOptions{
				TeamID: "team1",
				Order:  incident.Asc,
			},
			want: []incident.Incident{id1, id2, id3},
		},
		{
			name: "sort by ended_at",
			options: incident.FilterOptions{
				Sort: incident.EndedAt,
			},
			want: []incident.Incident{id3, id2, id5, id4, id1},
		},
		{
			name: "no options, paged by 1",
			options: incident.FilterOptions{
				Page:    0,
				PerPage: 1,
			},
			want: []incident.Incident{id4},
		},
		{
			name: "no options, paged by 3",
			options: incident.FilterOptions{
				Page:    0,
				PerPage: 3,
			},
			want: []incident.Incident{id4, id5, id3},
		},
		{
			name: "no options, page 1 by 2",
			options: incident.FilterOptions{
				Page:    1,
				PerPage: 2,
			},
			want: []incident.Incident{id3, id2},
		},
		{
			name: "no options, page 1 by 3",
			options: incident.FilterOptions{
				Page:    1,
				PerPage: 3,
			},
			want: []incident.Incident{id2, id1},
		},
		{
			name: "no options, page 1 by 5",
			options: incident.FilterOptions{
				Page:    1,
				PerPage: 5,
			},
			want: nil,
		},
		{
			name: "sorted by ended, ascending, page 1 of 2",
			options: incident.FilterOptions{
				Sort:    incident.EndedAt,
				Order:   incident.Asc,
				Page:    1,
				PerPage: 2,
			},
			want: []incident.Incident{id5, id2},
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

			for _, i := range []incident.Incident{id1, id2, id3, id4, id5} {
				kvAPI.EXPECT().
					Get(fmt.Sprintf("incident_%s", i.ID), gomock.Any()).
					SetArg(1, i).
					AnyTimes()
			}

			s := &incidentStore{
				pluginAPI: kvAPI,
			}
			got, err := s.GetIncidents(tt.options)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetIncidents() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("GetIncidents() got = %v, want %v", got, tt.want)
			}
		})
	}
}
