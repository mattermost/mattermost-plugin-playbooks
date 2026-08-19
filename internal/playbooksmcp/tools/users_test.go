// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// bobUserID is the ID the fake resolves the username "bob" to.
const bobUserID = "fghijklmnopqrstuvwxyzabcde"

func userRefClient() *fakeAPIClient {
	return &fakeAPIClient{usersByUsername: map[string]string{"bob": bobUserID}}
}

func TestResolveUserRef(t *testing.T) {
	tests := []struct {
		name    string
		ref     string
		want    string
		wantErr string
	}{
		{
			name: "empty stays empty so callers can treat it as unset",
			ref:  "",
			want: "",
		},
		{
			name: "whitespace only is treated as unset",
			ref:  "   ",
			want: "",
		},
		{
			name: "me becomes the acting user",
			ref:  "me",
			want: testCurrentUser,
		},
		{
			name: "a well-formed ID passes through",
			ref:  testUserID,
			want: testUserID,
		},
		{
			name: "a bare username is resolved",
			ref:  "bob",
			want: bobUserID,
		},
		{
			name: "an @-prefixed username is resolved",
			ref:  "@bob",
			want: bobUserID,
		},
		{
			name:    "an unknown username is an actionable error naming the field",
			ref:     "@nobody",
			wantErr: `assignee_id: no user found with username "nobody" — check the spelling (usernames are case-insensitive, without the @)`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveUserRef(context.Background(), userRefClient(), tt.ref, "assignee_id")
			if tt.wantErr != "" {
				require.EqualError(t, err, tt.wantErr)
				assert.Empty(t, got)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResolveUserRefs(t *testing.T) {
	tests := []struct {
		name    string
		refs    []string
		want    []string
		wantErr string
	}{
		{
			name: "mixed forms all resolve",
			refs: []string{"@bob", "me", testUserID},
			want: []string{bobUserID, testCurrentUser, testUserID},
		},
		{
			name: "references that land on the same user are deduplicated",
			refs: []string{"@bob", "bob", bobUserID},
			want: []string{bobUserID},
		},
		{
			name:    "an unknown username reports its index",
			refs:    []string{"@bob", "@nobody"},
			wantErr: `user_ids[1]: no user found with username "nobody" — check the spelling (usernames are case-insensitive, without the @)`,
		},
		{
			name:    "an empty entry is rejected rather than silently dropped",
			refs:    []string{""},
			wantErr: "user_ids[0] is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveUserRefs(context.Background(), userRefClient(), tt.refs, "user_ids")
			if tt.wantErr != "" {
				require.EqualError(t, err, tt.wantErr)
				assert.Nil(t, got)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestToolsResolveUsernameArguments covers every tool that takes a user
// reference: passing "@bob" must put bobUserID in the request the tool sends,
// so a model never has to know an opaque ID.
func TestToolsResolveUsernameArguments(t *testing.T) {
	runWithSection := playbookRunDetail{
		ID:          testRunID,
		OwnerUserID: testCurrentUser,
		Checklists:  []checklist{{Title: "Triage", Items: []checklistItem{{Title: "Page on-call"}}}},
	}
	playbookWithSection := map[string]any{
		"id":         testPlaybookID,
		"title":      "Sev1",
		"team_id":    testTeamID,
		"checklists": []any{map[string]any{"title": "Triage", "items": []any{map[string]any{"title": "Page on-call"}}}},
	}

	tests := []struct {
		name string
		// client seeds any run/playbook state the tool reads back.
		client *fakeAPIClient
		run    func(client *fakeAPIClient) error
		// assert inspects the request the tool sent.
		assert func(t *testing.T, client *fakeAPIClient)
	}{
		{
			name: "add_run_participants",
			run: func(client *fakeAPIClient) error {
				_, err := toolAddRunParticipants(context.Background(), client, AddRunParticipantsArgs{RunID: testRunID, UserIDs: []string{"@bob"}})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				assert.Equal(t, []string{bobUserID}, body["user_ids"])
			},
		},
		{
			name:   "remove_run_participant",
			client: &fakeAPIClient{run: playbookRunDetail{ID: testRunID, OwnerUserID: testCurrentUser, ParticipantIDs: []string{bobUserID}}},
			run: func(client *fakeAPIClient) error {
				_, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID, UserID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				assert.Equal(t, "runs/"+testRunID+"/participants/"+bobUserID, client.deleteEndpoint)
			},
		},
		{
			name: "change_run_owner",
			run: func(client *fakeAPIClient) error {
				_, err := toolChangeRunOwner(context.Background(), client, ChangeRunOwnerArgs{RunID: testRunID, OwnerID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]string)
				require.True(t, ok)
				assert.Equal(t, bobUserID, body["owner_id"])
			},
		},
		{
			name:   "run_playbook",
			client: &fakeAPIClient{runPlaybook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID, ChannelMode: channelModeCreateNew}, run: playbookRunDetail{ID: testRunID}},
			run: func(client *fakeAPIClient) error {
				_, err := toolRunPlaybook(context.Background(), client, RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Sev1", OwnerUserID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				assert.Equal(t, bobUserID, body["owner_user_id"])
			},
		},
		{
			name:   "add_checklist_item",
			client: &fakeAPIClient{run: runWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddChecklistItem(context.Background(), client, AddChecklistItemArgs{RunID: testRunID, ChecklistNumber: 0, Title: "Verify fix", AssigneeID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				assert.Equal(t, bobUserID, body["assignee_id"])
			},
		},
		{
			name:   "set_checklist_item_assignee",
			client: &fakeAPIClient{run: runWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolSetChecklistItemAssignee(context.Background(), client, SetChecklistItemAssigneeArgs{RunID: testRunID, ChecklistNumber: 0, ItemNumber: 0, AssigneeID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.putBody.(map[string]string)
				require.True(t, ok)
				assert.Equal(t, bobUserID, body["assignee_id"])
			},
		},
		{
			name: "add_section initial items",
			run: func(client *fakeAPIClient) error {
				_, err := toolAddSection(context.Background(), client, AddSectionArgs{RunID: testRunID, Title: "Recovery", Items: []CreateChecklistItem{{Title: "Verify fix", AssigneeID: "@bob"}}})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				items, ok := body["items"].([]CreateChecklistItem)
				require.True(t, ok)
				require.Len(t, items, 1)
				assert.Equal(t, bobUserID, items[0].AssigneeID)
			},
		},
		{
			name:   "create_checklist section items",
			client: &fakeAPIClient{run: playbookRunDetail{ID: testRunID}},
			run: func(client *fakeAPIClient) error {
				_, err := toolCreateChecklist(context.Background(), client, CreateChecklistArgs{
					Name:      "Release",
					ChannelID: testRunChannelID,
					Sections:  []CreateChecklistSection{{Title: "Pre-release", Items: []CreateChecklistItem{{Title: "Confirm changelog", AssigneeID: "@bob"}}}},
				})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				// postBody holds the last POST, which is the section.
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				items, ok := body["items"].([]CreateChecklistItem)
				require.True(t, ok)
				require.Len(t, items, 1)
				assert.Equal(t, bobUserID, items[0].AssigneeID)
			},
		},
		{
			name:   "add_playbook_task",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: testPlaybookID, ChecklistNumber: 0, Title: "Verify fix", AssigneeID: "@bob"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				assert.Equal(t, bobUserID, lastPlaybookTaskAssignee(t, client, 0, 1))
				assert.Contains(t, playbookInvitedUserIDs(t, client), bobUserID)
			},
		},
		{
			name:   "edit_playbook_task",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				assignee := "@bob"
				_, err := toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: testPlaybookID, ChecklistNumber: 0, ItemNumber: 0, AssigneeID: &assignee})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				assert.Equal(t, bobUserID, lastPlaybookTaskAssignee(t, client, 0, 0))
				assert.Contains(t, playbookInvitedUserIDs(t, client), bobUserID)
			},
		},
		{
			name:   "add_playbook_section initial items",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddPlaybookSection(context.Background(), client, AddPlaybookSectionArgs{
					PlaybookID: testPlaybookID,
					Title:      "Recovery",
					Items:      []CreatePlaybookItem{{Title: "Verify fix", AssigneeID: "@bob"}},
				})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				assert.Equal(t, bobUserID, lastPlaybookTaskAssignee(t, client, 1, 0))
			},
		},
		{
			name: "create_playbook default owner, invitees, members and assignees",
			run: func(client *fakeAPIClient) error {
				_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{
					Title:          "Sev1",
					TeamID:         testTeamID,
					DefaultOwnerID: "@bob",
					InvitedUserIDs: []string{"@bob"},
					Members:        []CreatePlaybookMember{{UserID: "@bob", Roles: []string{"playbook_member"}}},
					Checklists:     []CreatePlaybookChecklist{{Title: "Triage", Items: []CreatePlaybookItem{{Title: "Page on-call", AssigneeID: "@bob"}}}},
				})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				body, ok := client.postBody.(map[string]any)
				require.True(t, ok)
				assert.Equal(t, bobUserID, body["default_owner_id"])
				assert.Contains(t, body["invited_user_ids"], bobUserID)

				members, ok := body["members"].([]CreatePlaybookMember)
				require.True(t, ok)
				require.Len(t, members, 1)
				assert.Equal(t, bobUserID, members[0].UserID)

				checklists, ok := body["checklists"].([]map[string]any)
				require.True(t, ok)
				require.Len(t, checklists, 1)
				items, ok := checklists[0]["items"].([]map[string]any)
				require.True(t, ok)
				require.Len(t, items, 1)
				assert.Equal(t, bobUserID, items[0]["assignee_id"])
			},
		},
		{
			name: "list_runs user filters",
			run: func(client *fakeAPIClient) error {
				_, err := toolListRuns(context.Background(), client, ListRunsArgs{OwnerUserID: "@bob", ParticipantID: "me"})
				return err
			},
			assert: func(t *testing.T, client *fakeAPIClient) {
				assert.Equal(t, bobUserID, client.getParams.Get("owner_user_id"))
				assert.Equal(t, testCurrentUser, client.getParams.Get("participant_id"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := tt.client
			if client == nil {
				client = &fakeAPIClient{}
			}
			client.usersByUsername = map[string]string{"bob": bobUserID}

			require.NoError(t, tt.run(client))
			assert.Contains(t, client.resolvedRefs, "@bob", "expected the tool to resolve the username reference")
			tt.assert(t, client)
		})
	}
}

// TestToolsRejectUnknownUsernameWithoutMutating pairs with the test above: a
// username that does not exist has to fail with the actionable error and leave
// the run or template untouched, rather than sending "@nobody" to the API.
func TestToolsRejectUnknownUsernameWithoutMutating(t *testing.T) {
	runWithSection := playbookRunDetail{
		ID:         testRunID,
		Checklists: []checklist{{Title: "Triage", Items: []checklistItem{{Title: "Page on-call"}}}},
	}
	playbookWithSection := map[string]any{
		"id":         testPlaybookID,
		"title":      "Sev1",
		"team_id":    testTeamID,
		"checklists": []any{map[string]any{"title": "Triage", "items": []any{map[string]any{"title": "Page on-call"}}}},
	}

	tests := []struct {
		name    string
		client  *fakeAPIClient
		run     func(client *fakeAPIClient) error
		wantErr string
	}{
		{
			name: "add_run_participants",
			run: func(client *fakeAPIClient) error {
				_, err := toolAddRunParticipants(context.Background(), client, AddRunParticipantsArgs{RunID: testRunID, UserIDs: []string{"@nobody"}})
				return err
			},
			wantErr: `user_ids[0]: no user found with username "nobody"`,
		},
		{
			name: "remove_run_participant",
			run: func(client *fakeAPIClient) error {
				_, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID, UserID: "@nobody"})
				return err
			},
			wantErr: `user_id: no user found with username "nobody"`,
		},
		{
			name: "change_run_owner",
			run: func(client *fakeAPIClient) error {
				_, err := toolChangeRunOwner(context.Background(), client, ChangeRunOwnerArgs{RunID: testRunID, OwnerID: "@nobody"})
				return err
			},
			wantErr: `owner_id: no user found with username "nobody"`,
		},
		{
			name:   "run_playbook",
			client: &fakeAPIClient{runPlaybook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID, ChannelMode: channelModeCreateNew}},
			run: func(client *fakeAPIClient) error {
				_, err := toolRunPlaybook(context.Background(), client, RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Sev1", OwnerUserID: "@nobody"})
				return err
			},
			wantErr: `owner_user_id: no user found with username "nobody"`,
		},
		{
			name:   "add_checklist_item",
			client: &fakeAPIClient{run: runWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddChecklistItem(context.Background(), client, AddChecklistItemArgs{RunID: testRunID, ChecklistNumber: 0, Title: "Verify fix", AssigneeID: "@nobody"})
				return err
			},
			wantErr: `assignee_id: no user found with username "nobody"`,
		},
		{
			name:   "set_checklist_item_assignee",
			client: &fakeAPIClient{run: runWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolSetChecklistItemAssignee(context.Background(), client, SetChecklistItemAssigneeArgs{RunID: testRunID, ChecklistNumber: 0, ItemNumber: 0, AssigneeID: "@nobody"})
				return err
			},
			wantErr: `assignee_id: no user found with username "nobody"`,
		},
		{
			name: "add_section",
			run: func(client *fakeAPIClient) error {
				_, err := toolAddSection(context.Background(), client, AddSectionArgs{RunID: testRunID, Title: "Recovery", Items: []CreateChecklistItem{{Title: "Verify fix", AssigneeID: "@nobody"}}})
				return err
			},
			wantErr: `items[0].assignee_id: no user found with username "nobody"`,
		},
		{
			name: "create_checklist",
			run: func(client *fakeAPIClient) error {
				_, err := toolCreateChecklist(context.Background(), client, CreateChecklistArgs{
					Name:      "Release",
					ChannelID: testRunChannelID,
					Sections:  []CreateChecklistSection{{Title: "Pre-release", Items: []CreateChecklistItem{{Title: "Confirm changelog", AssigneeID: "@nobody"}}}},
				})
				return err
			},
			wantErr: `sections[0].items[0].assignee_id: no user found with username "nobody"`,
		},
		{
			name:   "add_playbook_task",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddPlaybookTask(context.Background(), client, AddPlaybookTaskArgs{PlaybookID: testPlaybookID, ChecklistNumber: 0, Title: "Verify fix", AssigneeID: "@nobody"})
				return err
			},
			wantErr: `assignee_id: no user found with username "nobody"`,
		},
		{
			name:   "edit_playbook_task",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				assignee := "@nobody"
				_, err := toolEditPlaybookTask(context.Background(), client, EditPlaybookTaskArgs{PlaybookID: testPlaybookID, ChecklistNumber: 0, ItemNumber: 0, AssigneeID: &assignee})
				return err
			},
			wantErr: `assignee_id: no user found with username "nobody"`,
		},
		{
			name:   "add_playbook_section",
			client: &fakeAPIClient{playbook: playbookWithSection},
			run: func(client *fakeAPIClient) error {
				_, err := toolAddPlaybookSection(context.Background(), client, AddPlaybookSectionArgs{
					PlaybookID: testPlaybookID,
					Title:      "Recovery",
					Items:      []CreatePlaybookItem{{Title: "Verify fix", AssigneeID: "@nobody"}},
				})
				return err
			},
			wantErr: `items[0].assignee_id: no user found with username "nobody"`,
		},
		{
			name: "create_playbook",
			run: func(client *fakeAPIClient) error {
				_, err := toolCreatePlaybook(context.Background(), client, CreatePlaybookArgs{Title: "Sev1", TeamID: testTeamID, DefaultOwnerID: "@nobody"})
				return err
			},
			wantErr: `default_owner_id: no user found with username "nobody"`,
		},
		{
			name: "list_runs",
			run: func(client *fakeAPIClient) error {
				_, err := toolListRuns(context.Background(), client, ListRunsArgs{ParticipantID: "@nobody"})
				return err
			},
			wantErr: `participant_id: no user found with username "nobody"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := tt.client
			if client == nil {
				client = &fakeAPIClient{}
			}
			client.usersByUsername = map[string]string{"bob": bobUserID}

			err := tt.run(client)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
			assert.Contains(t, err.Error(), "check the spelling")

			assert.Empty(t, client.postEndpoint, "expected no POST")
			assert.Empty(t, client.putEndpoint, "expected no PUT")
			assert.Empty(t, client.patchEndpoint, "expected no PATCH")
			assert.Empty(t, client.deleteEndpoint, "expected no DELETE")
		})
	}
}

// userRefPropertyNames are the argument names that carry a user reference.
// Any property with one of these names, at any nesting depth, must tell the
// model that a username works — otherwise it falls back to hunting for an ID.
var userRefPropertyNames = map[string]bool{
	"assignee_id":      true,
	"default_owner_id": true,
	"invited_user_ids": true,
	"owner_id":         true,
	"owner_user_id":    true,
	"participant_id":   true,
	"user_id":          true,
	"user_ids":         true,
}

func TestUserRefSchemasAdvertiseUsernames(t *testing.T) {
	// The hint is the canonical wording; these are the load-bearing phrases
	// every user-ref description has to carry, however it is worded.
	for _, phrase := range []string{"user ID", "'me'", "username"} {
		require.Contains(t, userRefSchemaHint, phrase)
	}

	for _, tool := range registerToolsForTest(t, &fakeAPIClient{}) {
		t.Run(tool.Name, func(t *testing.T) {
			raw, err := json.Marshal(tool.InputSchema)
			require.NoError(t, err)

			var schema any
			require.NoError(t, json.Unmarshal(raw, &schema))

			found := false
			walkSchemaProperties(schema, func(name string, property map[string]any) {
				if !userRefPropertyNames[name] {
					return
				}
				found = true
				description, _ := property["description"].(string)
				assert.Contains(t, description, "user ID", "%s must say a user ID is accepted", name)
				assert.Contains(t, description, "'me'", "%s must say 'me' is accepted", name)
				assert.Contains(t, description, "username", "%s must say a username is accepted", name)
			})
			if !found {
				t.Skip("no user-reference arguments")
			}
		})
	}
}

// walkSchemaProperties visits every named property in a JSON schema, including
// those nested in object properties and array items, so a user reference
// buried in a checklist item is checked too.
func walkSchemaProperties(node any, visit func(name string, property map[string]any)) {
	object, ok := node.(map[string]any)
	if !ok {
		return
	}
	if properties, ok := object["properties"].(map[string]any); ok {
		for name, raw := range properties {
			property, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			visit(name, property)
			walkSchemaProperties(property, visit)
			if items, ok := property["items"].(map[string]any); ok {
				// An array of user references describes them on the array
				// itself, so re-check the item schema under the same name.
				visit(name, mergeDescriptions(property, items))
				walkSchemaProperties(items, visit)
			}
		}
	}
	if items, ok := object["items"].(map[string]any); ok {
		walkSchemaProperties(items, visit)
	}
}

// mergeDescriptions lets an array's own description satisfy the convention for
// its items, since that is where the guidance naturally goes.
func mergeDescriptions(array, items map[string]any) map[string]any {
	arrayDescription, _ := array["description"].(string)
	itemDescription, _ := items["description"].(string)
	merged := map[string]any{"description": arrayDescription + " " + itemDescription}
	return merged
}

func lastPlaybookTaskAssignee(t *testing.T, client *fakeAPIClient, checklistIdx, itemIdx int) string {
	t.Helper()

	saved, ok := client.putBody.(map[string]any)
	require.True(t, ok, "expected the playbook to be saved")
	checklists, ok := saved["checklists"].([]any)
	require.True(t, ok)
	require.Greater(t, len(checklists), checklistIdx)
	checklist, ok := checklists[checklistIdx].(map[string]any)
	require.True(t, ok)
	items, ok := checklist["items"].([]any)
	require.True(t, ok)
	require.Greater(t, len(items), itemIdx)
	item, ok := items[itemIdx].(map[string]any)
	require.True(t, ok)
	assignee, _ := item["assignee_id"].(string)
	return assignee
}

func playbookInvitedUserIDs(t *testing.T, client *fakeAPIClient) []string {
	t.Helper()

	saved, ok := client.putBody.(map[string]any)
	require.True(t, ok, "expected the playbook to be saved")
	raw, ok := saved["invited_user_ids"].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
