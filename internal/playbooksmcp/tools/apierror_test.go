// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiError builds the error string both APIClient implementations produce, so
// these tests break if either client changes its format out from under the
// parser.
func apiError(status int, body string) error {
	return fmt.Errorf("API error (status %d): %s", status, body)
}

func TestAPIErrorStatus(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantOK     bool
	}{
		{name: "nil error", err: nil},
		{name: "unrelated error", err: errors.New("connection refused")},
		{
			name:       "forbidden",
			err:        apiError(403, `{"error":"Not authorized"}`),
			wantStatus: 403,
			wantOK:     true,
		},
		{
			name:       "not found",
			err:        apiError(404, "not found"),
			wantStatus: 404,
			wantOK:     true,
		},
		{
			name:       "server error",
			err:        apiError(500, "boom"),
			wantStatus: 500,
			wantOK:     true,
		},
		{
			// The client uses a semicolon in this variant, so the parser must
			// not depend on the colon that follows the status in the common case.
			name:       "unreadable body variant",
			err:        fmt.Errorf("API error (status 403); failed to read response body: %w", errors.New("eof")),
			wantStatus: 403,
			wantOK:     true,
		},
		{
			name:       "wrapped by a tool",
			err:        fmt.Errorf("failed to get run: %w", apiError(403, "Not authorized")),
			wantStatus: 403,
			wantOK:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, ok := apiErrorStatus(tt.err)
			assert.Equal(t, tt.wantOK, ok)
			assert.Equal(t, tt.wantStatus, status)
		})
	}
}

func TestIsUnknownOrForbidden(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil is not ambiguous", err: nil, want: false},
		{name: "403 is ambiguous", err: apiError(403, "Not authorized"), want: true},
		{name: "404 is ambiguous", err: apiError(404, "not found"), want: true},
		{name: "400 is not", err: apiError(400, "bad request"), want: false},
		{name: "500 is not", err: apiError(500, "boom"), want: false},
		{name: "transport failure is not", err: errors.New("connection refused"), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isUnknownOrForbidden(tt.err))
		})
	}
}

func TestWrapRunError(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"

	tests := []struct {
		name        string
		err         error
		hints       []string
		wantContain []string
		wantAbsent  []string
	}{
		{
			// The case that made a model give up: a mistyped ID reads as a
			// permission wall unless the ambiguity is spelled out.
			name: "403 explains the ambiguity and names the discovery tools",
			err:  apiError(403, `{"error":"Not authorized"}`),
			wantContain: []string{
				"failed to finish run " + runID,
				"no playbook run with that ID is visible to you",
				"may be mistyped",
				"lack access",
				"resolve_channel_context",
				"list_runs",
				"Not authorized",
			},
		},
		{
			name: "404 gets the same guidance",
			err:  apiError(404, "not found"),
			wantContain: []string{
				"no playbook run with that ID is visible to you",
				"list_runs",
			},
		},
		{
			name:        "other statuses stay terse",
			err:         apiError(500, "boom"),
			wantContain: []string{"failed to finish run " + runID, "boom"},
			wantAbsent:  []string{"resolve_channel_context", "is visible to you"},
		},
		{
			name:        "hints are appended for unambiguous failures",
			err:         apiError(400, "cannot modify a finished run"),
			hints:       []string{"Finished runs cannot be edited — call restore_run first."},
			wantContain: []string{"cannot modify a finished run", "call restore_run first"},
			wantAbsent:  []string{"resolve_channel_context"},
		},
		{
			name:        "hints survive alongside the ambiguity guidance",
			err:         apiError(403, "Not authorized"),
			hints:       []string{"Finished runs cannot be edited — call restore_run first."},
			wantContain: []string{"is visible to you", "list_runs", "call restore_run first"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := wrapRunError(tt.err, runID, "finish", tt.hints...)
			require.Error(t, err)
			for _, want := range tt.wantContain {
				assert.Contains(t, err.Error(), want)
			}
			for _, absent := range tt.wantAbsent {
				assert.NotContains(t, err.Error(), absent)
			}
			assert.ErrorIs(t, err, tt.err, "the underlying error must stay unwrappable")
		})
	}
}

func TestWrapPlaybookError(t *testing.T) {
	const playbookID = "bcdefghijklmnopqrstuvwxyza"

	tests := []struct {
		name        string
		err         error
		wantContain []string
		wantAbsent  []string
	}{
		{
			name: "403 points at list_playbooks and the archived case",
			err:  apiError(403, "Not authorized"),
			wantContain: []string{
				"failed to archive playbook template " + playbookID,
				"no playbook template with that ID is visible to you",
				"list_playbooks",
				"with_archived=true",
			},
		},
		{
			name:        "other statuses stay terse",
			err:         apiError(500, "boom"),
			wantContain: []string{"boom"},
			wantAbsent:  []string{"with_archived=true"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := wrapPlaybookError(tt.err, playbookID, "archive")
			require.Error(t, err)
			for _, want := range tt.wantContain {
				assert.Contains(t, err.Error(), want)
			}
			for _, absent := range tt.wantAbsent {
				assert.NotContains(t, err.Error(), absent)
			}
		})
	}
}

// The wrapping only helps if it is actually reached, so drive it through the
// tools: the ones that fetch a run first, the ones that mutate without
// fetching, and the playbook side.
func TestToolsExplainAmbiguous403(t *testing.T) {
	const runID = "abcdefghijklmnopqrstuvwxyz"
	const playbookID = "bcdefghijklmnopqrstuvwxyza"
	forbidden := apiError(403, `{"error":"Not authorized"}`)

	runTests := []struct {
		name   string
		invoke func(context.Context, APIClient) (string, error)
	}{
		{
			name: "get_run",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolGetRun(ctx, c, GetRunArgs{RunID: runID})
			},
		},
		{
			name: "check_item (fetches for bounds first)",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolCheckItem(ctx, c, CheckItemArgs{RunID: runID, ChecklistNumber: 0, ItemNumber: 0})
			},
		},
		{
			name: "finish_run (mutates without fetching)",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolFinishRun(ctx, c, FinishRunArgs{RunID: runID})
			},
		},
		{
			name: "follow_run",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolFollowRun(ctx, c, RunIDArgs{RunID: runID})
			},
		},
		{
			name: "unfollow_run",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolUnfollowRun(ctx, c, RunIDArgs{RunID: runID})
			},
		},
		{
			name: "update_run_status",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolUpdateRunStatus(ctx, c, UpdateRunStatusArgs{RunID: runID, Message: "Update", ReminderSeconds: 3600})
			},
		},
		{
			name: "update_run",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				name := "Renamed"
				return toolUpdateRun(ctx, c, UpdateRunArgs{RunID: runID, Name: &name})
			},
		},
		{
			name: "get_status_updates",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolGetStatusUpdates(ctx, c, GetStatusUpdatesArgs{RunID: runID})
			},
		},
		{
			name: "get_run_metadata",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolGetRunMetadata(ctx, c, RunIDArgs{RunID: runID})
			},
		},
		{
			name: "add_run_participants",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolAddRunParticipants(ctx, c, AddRunParticipantsArgs{RunID: runID, UserIDs: []string{"me"}})
			},
		},
		{
			name: "add_section",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolAddSection(ctx, c, AddSectionArgs{RunID: runID, Title: "New section"})
			},
		},
		{
			name: "resolve run via find_checklist_item",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolFindChecklistItem(ctx, c, FindChecklistItemArgs{Query: "deploy", RunID: runID})
			},
		},
	}

	for _, tt := range runTests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{getErr: forbidden, postErr: forbidden, putErr: forbidden, patchErr: forbidden, deleteErr: forbidden}

			_, err := tt.invoke(context.Background(), client)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "no playbook run with that ID is visible to you")
			assert.Contains(t, err.Error(), "list_runs")
			assert.NotContains(t, err.Error(), "you lack permission to")
		})
	}

	playbookTests := []struct {
		name   string
		invoke func(context.Context, APIClient) (string, error)
	}{
		{
			name: "run_playbook's template fetch",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolRunPlaybook(ctx, c, RunPlaybookArgs{PlaybookID: playbookID, Name: "Attempt"})
			},
		},
		{
			name: "get_playbook",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolGetPlaybook(ctx, c, GetPlaybookArgs{PlaybookID: playbookID})
			},
		},
		{
			name: "archive_playbook",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolArchivePlaybook(ctx, c, PlaybookIDArgs{PlaybookID: playbookID})
			},
		},
		{
			name: "restore_playbook",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolRestorePlaybook(ctx, c, PlaybookIDArgs{PlaybookID: playbookID})
			},
		},
		{
			name: "duplicate_playbook",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolDuplicatePlaybook(ctx, c, PlaybookIDArgs{PlaybookID: playbookID})
			},
		},
		{
			name: "add_playbook_task",
			invoke: func(ctx context.Context, c APIClient) (string, error) {
				return toolAddPlaybookTask(ctx, c, AddPlaybookTaskArgs{PlaybookID: playbookID, ChecklistNumber: 0, Title: "Task"})
			},
		},
	}

	for _, tt := range playbookTests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{getErr: forbidden, postErr: forbidden, putErr: forbidden, patchErr: forbidden, deleteErr: forbidden}

			_, err := tt.invoke(context.Background(), client)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "no playbook template with that ID is visible to you")
			assert.Contains(t, err.Error(), "list_playbooks")
		})
	}
}
