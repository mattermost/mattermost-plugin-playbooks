package playbook

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlaybook_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		original Playbook
		expected []byte
		wantErr  bool
	}{
		{
			name: "marshals a struct with nil checklists and memberIDs into empty arrays",
			original: Playbook{
				ID:                   "playbookid",
				Title:                "the playbook title",
				Description:          "the playbook's description",
				TeamID:               "theteamid",
				CreatePublicIncident: true,
				CreateAt:             4503134,
				DeleteAt:             0,
				NumStages:            0,
				NumSteps:             0,
				Checklists:           nil,
				MemberIDs:            nil,
				Props: Props{
					BroadcastChannelID: "channelid",
				},
			},
			expected: []byte(`{"id":"playbookid","title":"the playbook title","description":"the playbook's description","team_id":"theteamid","create_public_incident":true,"create_at":4503134,"delete_at":0,"num_stages":0,"num_steps":0,"checklists":[],"member_ids":[],"broadcast_channel_id":"channelid"}`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with nil []checklistItems into an empty array",
			original: Playbook{
				ID:                   "playbookid",
				Title:                "the playbook title",
				Description:          "the playbook's description",
				TeamID:               "theteamid",
				CreatePublicIncident: true,
				CreateAt:             4503134,
				DeleteAt:             0,
				NumStages:            0,
				NumSteps:             0,
				Checklists: []Checklist{
					{
						ID:    "checklist1",
						Title: "checklist 1",
						Items: nil,
					},
				},
				MemberIDs: []string{"bob", "divyani"},
				Props: Props{
					BroadcastChannelID: "",
				},
			},
			expected: []byte(`{"id":"playbookid","title":"the playbook title","description":"the playbook's description","team_id":"theteamid","create_public_incident":true,"create_at":4503134,"delete_at":0,"num_stages":0,"num_steps":0,"checklists":[{"id":"checklist1","title":"checklist 1","items":[]}],"member_ids":["bob","divyani"],"broadcast_channel_id":""}`),
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
