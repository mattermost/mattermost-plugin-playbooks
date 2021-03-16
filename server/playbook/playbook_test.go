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
			name: "marshals a struct with nil checklists, memberIDs and InvitedUserIDs into empty arrays",
			original: Playbook{
				ID:                          "playbookid",
				Title:                       "the playbook title",
				Description:                 "the playbook's description",
				TeamID:                      "theteamid",
				CreatePublicIncident:        true,
				CreateAt:                    4503134,
				DeleteAt:                    0,
				NumStages:                   0,
				NumSteps:                    0,
				Checklists:                  nil,
				MemberIDs:                   nil,
				BroadcastChannelID:          "channelid",
				ReminderMessageTemplate:     "This is a message",
				ReminderTimerDefaultSeconds: 0,
				InvitedUserIDs:              nil,
			},
			expected: []byte(`{"id":"playbookid","title":"the playbook title","description":"the playbook's description","team_id":"theteamid","create_public_incident":true,"create_at":4503134,"delete_at":0,"num_stages":0,"num_steps":0,"checklists":[],"member_ids":[],"broadcast_channel_id":"channelid","reminder_message_template":"This is a message","reminder_timer_default_seconds":0,"invited_user_ids":[],"invite_users_enabled":false,"default_commander_id":"","default_commander_enabled":false}`),
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
				MemberIDs:                   []string{"bob", "divyani"},
				BroadcastChannelID:          "",
				ReminderMessageTemplate:     "This is a message",
				ReminderTimerDefaultSeconds: 0,
			},
			expected: []byte(`{"id":"playbookid","title":"the playbook title","description":"the playbook's description","team_id":"theteamid","create_public_incident":true,"create_at":4503134,"delete_at":0,"num_stages":0,"num_steps":0,"checklists":[{"id":"checklist1","title":"checklist 1","items":[]}],"member_ids":["bob","divyani"],"broadcast_channel_id":"","reminder_message_template":"This is a message","reminder_timer_default_seconds":0,"invited_user_ids":[],"invite_users_enabled":false,"default_commander_id":"","default_commander_enabled":false}`),
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
