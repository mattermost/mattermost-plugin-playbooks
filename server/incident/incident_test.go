package incident

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIncident_MarshalJSON(t *testing.T) {
	testIncident := &Incident{}
	result, err := json.Marshal(testIncident)
	require.NoError(t, err)
	// Should not contain null. Triggering this?
	// Add your new nullable thing to one of the MarshalJSONs in incident/incident.go
	require.NotContains(t, string(result), "null")
}

func TestIncident_LastResovedAt(t *testing.T) {
	for name, tc := range map[string]struct {
		inc      Incident
		expected int64
	}{
		"blank": {
			inc: Incident{
				StatusPosts: []StatusPost{},
			},
			expected: 0,
		},
		"just active": {
			inc: Incident{
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
			inc: Incident{
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
			inc: Incident{
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
			inc: Incident{
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
			inc: Incident{
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
			inc: Incident{
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
			inc: Incident{
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
