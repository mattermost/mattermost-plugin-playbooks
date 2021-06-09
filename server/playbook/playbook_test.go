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
			name: "marshals a struct with nil slices into empty arrays",
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
				InvitedGroupIDs:             nil,
			},
			expected: []byte(`"checklists":[]`),
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
				MemberIDs:                    []string{"bob", "divyani"},
				BroadcastChannelID:           "",
				ReminderMessageTemplate:      "This is a message",
				ReminderTimerDefaultSeconds:  0,
				InvitedUserIDs:               nil,
				InvitedGroupIDs:              nil,
				WebhookOnStatusUpdateURL:     "testurl",
				WebhookOnStatusUpdateEnabled: true,
			},
			expected: []byte(`"checklists":[{"id":"checklist1","title":"checklist 1","items":[]}]`),
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
			require.Contains(t, string(got), string(tt.expected))
		})
	}
}
