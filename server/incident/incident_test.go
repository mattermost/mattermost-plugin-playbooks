package incident

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/stretchr/testify/require"
)

func TestIncident_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		original *Incident
		expected []byte
		wantErr  bool
	}{
		{
			name: "marshals a struct with nil checklist into an empty array",
			original: &Incident{
				Header: Header{
					ID:               "theincidentid",
					Name:             "the incident's name",
					Description:      "the incident's description",
					IsActive:         true,
					CommanderUserID:  "theincidentcommander",
					TeamID:           "theteamid",
					ChannelID:        "thechannelid",
					CreateAt:         200,
					EndAt:            0,
					DeleteAt:         0,
					ActiveStage:      0,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: nil,
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[]}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with nil []checklistItem into an empty array",
			original: &Incident{
				Header: Header{
					ID:               "theincidentid",
					Name:             "the incident's name",
					Description:      "the incident's description",
					IsActive:         true,
					CommanderUserID:  "theincidentcommander",
					TeamID:           "theteamid",
					ChannelID:        "thechannelid",
					CreateAt:         200,
					EndAt:            0,
					DeleteAt:         0,
					ActiveStage:      0,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: []playbook.Checklist{
					{
						ID:    "checklist 1",
						Title: "checklist1",
						Items: nil,
					},
				},
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]}]}`),
			wantErr:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.original)
			if (err != nil) != tt.wantErr {
				t.Errorf("MarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Equal(t, string(tt.expected), string(got))
		})
	}
}

func TestWithDetails_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		original *WithDetails
		expected []byte
		wantErr  bool
	}{
		{
			name: "marshals a details struct with nil checklist into an empty array",
			original: &WithDetails{
				Incident: Incident{
					Header: Header{
						ID:               "theincidentid",
						Name:             "the incident's name",
						Description:      "the incident's description",
						IsActive:         true,
						CommanderUserID:  "theincidentcommander",
						TeamID:           "theteamid",
						ChannelID:        "thechannelid",
						CreateAt:         200,
						EndAt:            0,
						DeleteAt:         0,
						ActiveStage:      0,
						ActiveStageTitle: "",
					},
					PostID:     "",
					PlaybookID: "theplaybookid",
					Checklists: nil,
				},
				Details: Details{
					ChannelName:        "theChannel Name",
					ChannelDisplayName: "theChannel Display Name",
					TeamName:           "the team's name",
					NumMembers:         3,
					TotalPosts:         45,
				},
			},

			expected: []byte(`{"incident":{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[]},"details":{"channel_name":"theChannel Name","channel_display_name":"theChannel Display Name","team_name":"the team's name","num_members":3,"total_posts":45}}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with nil []checklistItem into an empty array",
			original: &WithDetails{
				Incident: Incident{
					Header: Header{
						ID:               "theincidentid",
						Name:             "the incident's name",
						Description:      "the incident's description",
						IsActive:         true,
						CommanderUserID:  "theincidentcommander",
						TeamID:           "theteamid",
						ChannelID:        "thechannelid",
						CreateAt:         200,
						EndAt:            0,
						DeleteAt:         0,
						ActiveStage:      0,
						ActiveStageTitle: "",
					},
					PostID:     "",
					PlaybookID: "theplaybookid",
					Checklists: []playbook.Checklist{
						{
							ID:    "checklist 1",
							Title: "checklist1",
							Items: nil,
						},
					},
				},
				Details: Details{
					ChannelName:        "theChannel Name",
					ChannelDisplayName: "theChannel Display Name",
					TeamName:           "the team's name",
					NumMembers:         3,
					TotalPosts:         45,
				},
			},
			expected: []byte(`{"incident":{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]}]},"details":{"channel_name":"theChannel Name","channel_display_name":"theChannel Display Name","team_name":"the team's name","num_members":3,"total_posts":45}}`),
			wantErr:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.original)
			if (err != nil) != tt.wantErr {
				t.Errorf("MarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Equal(t, string(tt.expected), string(got))
		})
	}
}
