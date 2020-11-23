package incident

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
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
			name: "marshals a struct with nil checklist",
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
					ActiveStage:      NoActiveStage,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: nil,
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":-1,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with an empty checklist",
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
					ActiveStage:      NoActiveStage,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: nil,
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":-1,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with an empty checklist, invalid active stage",
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
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":-1,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
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
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]}],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with a checklist but with active stage < 0",
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
					ActiveStage:      NoActiveStage,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: []playbook.Checklist{
					{
						ID:    "checklist 1",
						Title: "checklist1",
						Items: []playbook.ChecklistItem{},
					},
				},
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]}],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with a checklist but with active stage = len(checklist)",
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
					ActiveStage:      2,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: []playbook.Checklist{
					{
						ID:    "checklist 1",
						Title: "checklist1",
						Items: []playbook.ChecklistItem{},
					},
					{
						ID:    "checklist 2",
						Title: "checklist2",
						Items: []playbook.ChecklistItem{},
					},
				},
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]},{"id":"checklist 2","title":"checklist2","items":[]}],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with a checklist but with active stage > len(checklist)",
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
					ActiveStage:      100,
					ActiveStageTitle: "",
				},
				PostID:     "",
				PlaybookID: "theplaybookid",
				Checklists: []playbook.Checklist{
					{
						ID:    "checklist 1",
						Title: "checklist1",
						Items: []playbook.ChecklistItem{},
					},
					{
						ID:    "checklist 2",
						Title: "checklist2",
						Items: []playbook.ChecklistItem{},
					},
				},
			},
			expected: []byte(`{"id":"theincidentid","name":"the incident's name","description":"the incident's description","is_active":true,"commander_user_id":"theincidentcommander","team_id":"theteamid","channel_id":"thechannelid","create_at":200,"end_at":0,"delete_at":0,"active_stage":0,"active_stage_title":"","post_id":"","playbook_id":"theplaybookid","checklists":[{"id":"checklist 1","title":"checklist1","items":[]},{"id":"checklist 2","title":"checklist2","items":[]}],"status_post_ids":[],"status_posts":[],"reminder_post_id":""}`),
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
