// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
)

// --- Argument structs ---

type CheckItemArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the item within the checklist"`
	NewState        string `json:"new_state,omitempty" jsonschema:"The new state for the item: open, in_progress, closed, or skipped (default: closed)"`
}

type AddChecklistItemArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist to add the item to"`
	Title           string `json:"title" jsonschema:"Title of the new checklist item"`
	Description     string `json:"description,omitempty" jsonschema:"Optional description for the item (supports Markdown)"`
	AssigneeID      string `json:"assignee_id,omitempty" jsonschema:"Optional user ID to assign the item to"`
	DueDate         int64  `json:"due_date,omitempty" jsonschema:"Optional due date as Unix timestamp in milliseconds"`
}

type SetChecklistItemDueDateArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the item within the checklist"`
	DueDate         int64  `json:"due_date" jsonschema:"Due date as Unix timestamp in milliseconds; use 0 to clear"`
}

type EditChecklistItemArgs struct {
	RunID           string  `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int     `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int     `json:"item_number" jsonschema:"The zero-based index of the item within the checklist"`
	Title           *string `json:"title,omitempty" jsonschema:"New title for the item"`
	Description     *string `json:"description,omitempty" jsonschema:"New description for the item (supports Markdown)"`
	Command         *string `json:"command,omitempty" jsonschema:"Slash command to associate with the item"`
	DueDate         *int64  `json:"due_date,omitempty" jsonschema:"Due date as Unix timestamp in milliseconds; use 0 to clear"`
}

type SetChecklistItemAssigneeArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the item within the checklist"`
	AssigneeID      string `json:"assignee_id,omitempty" jsonschema:"Optional user ID to assign the item to; omit or send an empty string to clear the assignee"`
}

type RemoveChecklistItemArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the item to remove"`
}

type MoveChecklistItemArgs struct {
	RunID              string `json:"run_id" jsonschema:"The ID of the playbook run"`
	SourceChecklistIdx int    `json:"source_checklist_idx" jsonschema:"The zero-based source checklist index"`
	SourceItemIdx      int    `json:"source_item_idx" jsonschema:"The zero-based index of the existing item to move within the source checklist"`
	DestChecklistIdx   int    `json:"dest_checklist_idx" jsonschema:"The zero-based destination checklist index"`
	DestItemIdx        int    `json:"dest_item_idx" jsonschema:"The zero-based insertion position within the destination checklist (0 = prepend, destination item count = append when moving between checklists)"`
}

type AddSectionArgs struct {
	RunID string                `json:"run_id" jsonschema:"The ID of the playbook run"`
	Title string                `json:"title" jsonschema:"Title of the new section"`
	Items []CreateChecklistItem `json:"items,omitempty" jsonschema:"Optional initial tasks for the section, same shape as create_checklist section items. Item due_date is an absolute Unix timestamp in milliseconds because this is a run, not a template."`
}

type SkipSectionArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to skip"`
}

type RestoreSectionArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to un-skip"`
}

type RenameSectionArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to rename"`
	Title           string `json:"title" jsonschema:"New title for the section"`
}

type RemoveSectionArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to remove"`
}

type MoveSectionArgs struct {
	RunID              string `json:"run_id" jsonschema:"The ID of the playbook run"`
	SourceChecklistIdx int    `json:"source_checklist_idx" jsonschema:"The zero-based source section index"`
	DestChecklistIdx   int    `json:"dest_checklist_idx" jsonschema:"The zero-based destination section index"`
}

// --- Tool registration ---

func (p *PlaybooksToolProvider) addMCPHelperChecklistTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "check_item",
		"Check off, uncheck, skip, or start a task in a playbook run — \"mark that task done\", \"tick it off\", \"mark it in progress\", \"skip that step\". new_state is one of closed (done, the default), open (not started), in_progress (being worked on), or skipped (does not apply). This edits a task inside a live run, not a playbook template. Checklist and item numbers are zero-based indexes; if you do not already know the run_id and the exact indexes, do NOT guess them: call resolve_channel_context (passing the channel the agent is operating in), find_checklist_item, or get_run first. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2, \"new_state\": \"closed\"}",
		toolCheckItem)

	addMCPHelperTool(server, p.clientFactory, "add_checklist_item",
		"Add a task to an existing checklist section in a playbook run (a live run, not a playbook template — use add_playbook_task for templates). The checklist_number is a zero-based index; if you don't know it, call resolve_channel_context or get_run first. due_date is an absolute Unix timestamp in milliseconds because this is a run. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Verify fix in staging\", \"due_date\": 1717200000000}",
		toolAddChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "set_checklist_item_due_date",
		"Set or clear the due date/deadline of a task in a playbook run. due_date is an absolute Unix timestamp in milliseconds (runs use absolute dates; playbook templates use relative offsets); use 0 to clear. Checklist and item numbers are zero-based indexes; if you don't know them, call resolve_channel_context, find_checklist_item, or get_run first. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"due_date\": 1717200000000}",
		toolSetChecklistItemDueDate)

	addMCPHelperTool(server, p.clientFactory, "edit_checklist_item",
		"Edit the title, description, slash command, or due date of a task in a playbook run. Only provided fields change; the rest are preserved. due_date is an absolute Unix timestamp in milliseconds; use 0 to clear. To change whether the task is done use check_item instead. If you don't know the indexes, call resolve_channel_context, find_checklist_item, or get_run first. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"title\": \"Updated task title\", \"due_date\": 1717200000000}",
		toolEditChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "set_checklist_item_assignee",
		"Assign a task in a playbook run to someone, or clear its assignee — \"give that task to Alice\", \"unassign it\". Omit assignee_id or set it to an empty string to clear. If you don't know the indexes, call resolve_channel_context, find_checklist_item, or get_run first. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"assignee_id\": \"user123...\"}",
		toolSetChecklistItemAssignee)

	addMCPHelperTool(server, p.clientFactory, "remove_checklist_item",
		"Delete a task from a playbook run permanently. Prefer check_item with new_state='skipped' when the task simply does not apply. This is destructive, so confirm the indexes first — call resolve_channel_context, find_checklist_item, or get_run if unsure. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2}",
		toolRemoveChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "move_checklist_item",
		"Reorder a task within a playbook run, or move it to a different checklist section. Source and destination indexes are zero-based. The destination item index is an insertion position: within the same section it must be an existing item index (0..item count-1); when moving to a different section you may also use the item count itself to append. If you don't know the indexes, call resolve_channel_context or get_run first. Example: {\"run_id\": \"abc123...\", \"source_checklist_idx\": 0, \"source_item_idx\": 2, \"dest_checklist_idx\": 1, \"dest_item_idx\": 0}",
		toolMoveChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "add_section",
		"Add a checklist section (task group, stage) to a playbook run, optionally with its initial tasks in the same call. Sections group tasks in a live run; to add a section to a reusable playbook template use add_playbook_section. Example: {\"run_id\": \"abc123...\", \"title\": \"Post-incident review\", \"items\": [{\"title\": \"Schedule retrospective\"}]}",
		toolAddSection)

	addMCPHelperTool(server, p.clientFactory, "rename_section",
		"Rename a checklist section in a playbook run. The checklist_number is a zero-based index; if you don't know it, call resolve_channel_context or get_run first. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Updated section name\"}",
		toolRenameSection)

	addMCPHelperTool(server, p.clientFactory, "remove_section",
		"Delete a whole checklist section and all its tasks from a playbook run permanently. Prefer skip_section when the section simply does not apply this time. This is destructive, so confirm the index first — call resolve_channel_context or get_run if unsure. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolRemoveSection)

	addMCPHelperTool(server, p.clientFactory, "skip_section",
		"Skip an entire checklist section in a playbook run — \"this whole stage doesn't apply this time\" — without deleting it. To skip one individual task instead, call check_item with new_state='skipped'. Un-skip with restore_section. The checklist_number is a zero-based index; call resolve_channel_context or get_run if you don't know it. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolSkipSection)

	addMCPHelperTool(server, p.clientFactory, "restore_section",
		"Un-skip a previously skipped checklist section in a playbook run, bringing its tasks back into play. This is the inverse of skip_section. The checklist_number is a zero-based index; call resolve_channel_context or get_run if you don't know it. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolRestoreSection)

	addMCPHelperTool(server, p.clientFactory, "move_section",
		"Reorder a checklist section within a playbook run. Source and destination indexes are zero-based existing section indexes (0 = first, section count-1 = last). If you don't know the indexes, call resolve_channel_context or get_run first. Example: {\"run_id\": \"abc123...\", \"source_checklist_idx\": 1, \"dest_checklist_idx\": 0}",
		toolMoveSection)
}

// --- Tool implementations ---

func toolCheckItem(ctx context.Context, client APIClient, args CheckItemArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}

	state := args.NewState
	if state == "" {
		state = "closed"
	}

	apiState := state
	switch state {
	case "open":
		// The Playbooks API uses an empty new_state to reopen an item. This is distinct
		// from the omitted MCP argument above, which defaults the tool action to closed.
		apiState = ""
	case "in_progress", "closed", "skipped":
	default:
		return "", fmt.Errorf("new_state must be one of open, in_progress, closed, or skipped")
	}

	// Fetch the run first so we can give an actionable error (listing the real
	// items) instead of an opaque API failure when the caller guessed indexes.
	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.ChecklistNumber, args.ItemNumber, "checklist_number", "item_number"); err != nil {
		return "", err
	}

	current := run.Checklists[args.ChecklistNumber].Items[args.ItemNumber]
	if current.State == apiState {
		return fmt.Sprintf("Checklist item [%d][%d] (%q) in run %s is already '%s'; no change made.", args.ChecklistNumber, args.ItemNumber, current.Title, args.RunID, state), nil
	}

	body := map[string]string{
		"new_state": apiState,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d/state", args.RunID, args.ChecklistNumber, args.ItemNumber)
	if err := client.Put(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to update item state: %w", err)
	}

	return fmt.Sprintf("Checklist item [%d][%d] (%q) in run %s set to '%s'.", args.ChecklistNumber, args.ItemNumber, current.Title, args.RunID, state), nil
}

// outOfRangeError builds an error that lists the run's actual checklist items so
// the caller can correct the indexes rather than guessing again.
func outOfRangeError(field string, value int, run playbookRunDetail) error {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s %d is out of range for run %s. Available items:\n", field, value, run.ID)
	writeRunChecklists(&sb, run)
	return fmt.Errorf("%s", sb.String())
}

// fetchRunForBounds retrieves the run so callers can validate indexes against
// its real checklists before mutating, giving actionable errors on a miss.
func fetchRunForBounds(ctx context.Context, client APIClient, runID string) (playbookRunDetail, error) {
	var run playbookRunDetail
	if err := client.Get(ctx, fmt.Sprintf("runs/%s", runID), nil, &run); err != nil {
		return playbookRunDetail{}, fmt.Errorf("failed to get run: %w", err)
	}
	return run, nil
}

// checkChecklistIndex verifies a checklist (section) index exists in the run.
// It rejects negatives itself rather than trusting every caller to have run
// validateIndex first, since indexing a slice with one would panic.
func checkChecklistIndex(run playbookRunDetail, idx int, field string) error {
	if idx < 0 || idx >= len(run.Checklists) {
		return outOfRangeError(field, idx, run)
	}
	return nil
}

// checkItemIndex verifies an item index exists within an existing checklist.
// checklistField/itemField name the respective arguments so the actionable
// error refers to the field the caller actually passed (e.g. move_checklist_item
// uses source_checklist_idx/source_item_idx, not checklist_number/item_number).
func checkItemIndex(run playbookRunDetail, checklistIdx, itemIdx int, checklistField, itemField string) error {
	if err := checkChecklistIndex(run, checklistIdx, checklistField); err != nil {
		return err
	}
	if itemIdx < 0 || itemIdx >= len(run.Checklists[checklistIdx].Items) {
		return outOfRangeError(itemField, itemIdx, run)
	}
	return nil
}

// checkMoveItemDest validates a move destination item index against the same
// bounds the backend enforces (MoveChecklistItem): within the same section the
// position must be an existing item index (0..count-1), while moving to a
// different section also allows the item count itself (append).
func checkMoveItemDest(run playbookRunDetail, sourceChecklistIdx, destChecklistIdx, destItemIdx int) error {
	if err := checkChecklistIndex(run, destChecklistIdx, "dest_checklist_idx"); err != nil {
		return err
	}
	lenDest := len(run.Checklists[destChecklistIdx].Items)
	if destItemIdx < 0 {
		return outOfRangeError("dest_item_idx", destItemIdx, run)
	}
	if sourceChecklistIdx == destChecklistIdx {
		if destItemIdx >= lenDest {
			return outOfRangeError("dest_item_idx", destItemIdx, run)
		}
		return nil
	}
	if destItemIdx > lenDest {
		return outOfRangeError("dest_item_idx", destItemIdx, run)
	}
	return nil
}

func toolAddChecklistItem(ctx context.Context, client APIClient, args AddChecklistItemArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	if args.AssigneeID != "" {
		if err := validateID(args.AssigneeID, "assignee_id"); err != nil {
			return "", err
		}
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkChecklistIndex(run, args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}

	body := map[string]any{
		"title": title,
	}
	if args.Description != "" {
		body["description"] = args.Description
	}
	if args.AssigneeID != "" {
		body["assignee_id"] = args.AssigneeID
	}
	if args.DueDate != 0 {
		body["due_date"] = args.DueDate
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/add", args.RunID, args.ChecklistNumber)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to add checklist item: %w", err)
	}

	return fmt.Sprintf("Added item '%s' to checklist %d in run %s.", title, args.ChecklistNumber, args.RunID), nil
}

func toolSetChecklistItemDueDate(ctx context.Context, client APIClient, args SetChecklistItemDueDateArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.ChecklistNumber, args.ItemNumber, "checklist_number", "item_number"); err != nil {
		return "", err
	}

	if err := setChecklistItemDueDate(ctx, client, args.RunID, args.ChecklistNumber, args.ItemNumber, args.DueDate); err != nil {
		return "", fmt.Errorf("failed to set checklist item due date: %w", err)
	}

	if args.DueDate == 0 {
		return fmt.Sprintf("Cleared due date for checklist item [%d][%d] in run %s.", args.ChecklistNumber, args.ItemNumber, args.RunID), nil
	}
	return fmt.Sprintf("Set due date for checklist item [%d][%d] in run %s to %d.", args.ChecklistNumber, args.ItemNumber, args.RunID, args.DueDate), nil
}

func setChecklistItemDueDate(ctx context.Context, client APIClient, runID string, checklistNumber, itemNumber int, dueDate int64) error {
	body := map[string]int64{
		"due_date": dueDate,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d/duedate", runID, checklistNumber, itemNumber)
	return client.Put(ctx, endpoint, body, nil)
}

func toolEditChecklistItem(ctx context.Context, client APIClient, args EditChecklistItemArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}

	if args.Title == nil && args.Description == nil && args.Command == nil && args.DueDate == nil {
		return "", fmt.Errorf("at least one field (title, description, command, or due_date) must be provided")
	}
	var title string
	if args.Title != nil {
		title = strings.TrimSpace(*args.Title)
		if title == "" {
			return "", fmt.Errorf("title is required")
		}
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.ChecklistNumber, args.ItemNumber, "checklist_number", "item_number"); err != nil {
		return "", err
	}

	if args.Title != nil || args.Description != nil || args.Command != nil {
		currentItem := run.Checklists[args.ChecklistNumber].Items[args.ItemNumber]
		body := map[string]string{
			"title":       currentItem.Title,
			"description": currentItem.Description,
			"command":     currentItem.Command,
		}
		if args.Title != nil {
			body["title"] = title
		}
		if args.Description != nil {
			body["description"] = *args.Description
		}
		if args.Command != nil {
			body["command"] = *args.Command
		}

		endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d", args.RunID, args.ChecklistNumber, args.ItemNumber)
		if err := client.Put(ctx, endpoint, body, nil); err != nil {
			return "", fmt.Errorf("failed to edit checklist item: %w", err)
		}
	}

	if args.DueDate != nil {
		if err := setChecklistItemDueDate(ctx, client, args.RunID, args.ChecklistNumber, args.ItemNumber, *args.DueDate); err != nil {
			return "", fmt.Errorf("failed to set checklist item due date: %w", err)
		}
	}

	return fmt.Sprintf("Updated checklist item [%d][%d] in run %s.", args.ChecklistNumber, args.ItemNumber, args.RunID), nil
}

func toolSetChecklistItemAssignee(ctx context.Context, client APIClient, args SetChecklistItemAssigneeArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}
	if args.AssigneeID != "" {
		if err := validateID(args.AssigneeID, "assignee_id"); err != nil {
			return "", err
		}
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.ChecklistNumber, args.ItemNumber, "checklist_number", "item_number"); err != nil {
		return "", err
	}

	body := map[string]string{
		"assignee_id": args.AssigneeID,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d/assignee", args.RunID, args.ChecklistNumber, args.ItemNumber)
	if err := client.Put(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to set checklist item assignee: %w", err)
	}

	if args.AssigneeID == "" {
		return fmt.Sprintf("Cleared assignee for checklist item [%d][%d] in run %s.", args.ChecklistNumber, args.ItemNumber, args.RunID), nil
	}
	return fmt.Sprintf("Set assignee for checklist item [%d][%d] in run %s to user %s.", args.ChecklistNumber, args.ItemNumber, args.RunID, args.AssigneeID), nil
}

func toolRemoveChecklistItem(ctx context.Context, client APIClient, args RemoveChecklistItemArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.ChecklistNumber, args.ItemNumber, "checklist_number", "item_number"); err != nil {
		return "", err
	}
	removed := run.Checklists[args.ChecklistNumber].Items[args.ItemNumber].Title

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d", args.RunID, args.ChecklistNumber, args.ItemNumber)
	if err := client.Delete(ctx, endpoint); err != nil {
		return "", fmt.Errorf("failed to remove checklist item: %w", err)
	}

	return fmt.Sprintf("Removed checklist item [%d][%d] (%q) from run %s.", args.ChecklistNumber, args.ItemNumber, removed, args.RunID), nil
}

func toolMoveChecklistItem(ctx context.Context, client APIClient, args MoveChecklistItemArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.SourceChecklistIdx, "source_checklist_idx"); err != nil {
		return "", err
	}
	if err := validateIndex(args.SourceItemIdx, "source_item_idx"); err != nil {
		return "", err
	}
	if err := validateIndex(args.DestChecklistIdx, "dest_checklist_idx"); err != nil {
		return "", err
	}
	if err := validateIndex(args.DestItemIdx, "dest_item_idx"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkItemIndex(run, args.SourceChecklistIdx, args.SourceItemIdx, "source_checklist_idx", "source_item_idx"); err != nil {
		return "", err
	}
	if err := checkMoveItemDest(run, args.SourceChecklistIdx, args.DestChecklistIdx, args.DestItemIdx); err != nil {
		return "", err
	}

	body := map[string]int{
		"source_checklist_idx": args.SourceChecklistIdx,
		"source_item_idx":      args.SourceItemIdx,
		"dest_checklist_idx":   args.DestChecklistIdx,
		"dest_item_idx":        args.DestItemIdx,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/move-item", args.RunID)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to move checklist item: %w", err)
	}

	return fmt.Sprintf("Moved checklist item [%d][%d] to [%d][%d] in run %s.", args.SourceChecklistIdx, args.SourceItemIdx, args.DestChecklistIdx, args.DestItemIdx, args.RunID), nil
}

func toolAddSection(ctx context.Context, client APIClient, args AddSectionArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	if err := validateChecklistItems(args.Items, "items"); err != nil {
		return "", err
	}

	// The endpoint decodes a full app.Checklist, so the section and its tasks
	// can be created in one round trip.
	items := make([]CreateChecklistItem, 0, len(args.Items))
	for _, item := range args.Items {
		item.Title = strings.TrimSpace(item.Title)
		items = append(items, item)
	}
	body := map[string]any{
		"title": title,
		"items": items,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists", args.RunID)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to add section: %w", err)
	}

	if len(items) > 0 {
		return fmt.Sprintf("Added section '%s' with %d task(s) to run %s.", title, len(items), args.RunID), nil
	}
	return fmt.Sprintf("Added section '%s' to run %s.", title, args.RunID), nil
}

func toolSkipSection(ctx context.Context, client APIClient, args SkipSectionArgs) (string, error) {
	return setSectionSkipped(ctx, client, args.RunID, args.ChecklistNumber, true)
}

func toolRestoreSection(ctx context.Context, client APIClient, args RestoreSectionArgs) (string, error) {
	return setSectionSkipped(ctx, client, args.RunID, args.ChecklistNumber, false)
}

func setSectionSkipped(ctx context.Context, client APIClient, runID string, checklistNumber int, skip bool) (string, error) {
	if err := validateID(runID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(checklistNumber, "checklist_number"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, runID)
	if err != nil {
		return "", err
	}
	if err := checkChecklistIndex(run, checklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	title := run.Checklists[checklistNumber].Title

	action, verb := "restore", "restored"
	if skip {
		action, verb = "skip", "skipped"
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/%s", runID, checklistNumber, action)
	if err := client.Put(ctx, endpoint, nil, nil); err != nil {
		return "", fmt.Errorf("failed to %s section %d in run %s: %w", action, checklistNumber, runID, err)
	}

	return fmt.Sprintf("Section %d (%q) in run %s %s.", checklistNumber, title, runID, verb), nil
}

func toolRenameSection(ctx context.Context, client APIClient, args RenameSectionArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkChecklistIndex(run, args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}

	body := map[string]string{
		"title": title,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/rename", args.RunID, args.ChecklistNumber)
	if err := client.Put(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to rename section: %w", err)
	}

	return fmt.Sprintf("Renamed section %d in run %s to '%s'.", args.ChecklistNumber, args.RunID, title), nil
}

func toolRemoveSection(ctx context.Context, client APIClient, args RemoveSectionArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkChecklistIndex(run, args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	removed := run.Checklists[args.ChecklistNumber].Title

	endpoint := fmt.Sprintf("runs/%s/checklists/%d", args.RunID, args.ChecklistNumber)
	if err := client.Delete(ctx, endpoint); err != nil {
		return "", fmt.Errorf("failed to remove section: %w", err)
	}

	return fmt.Sprintf("Removed section %d (%q) from run %s.", args.ChecklistNumber, removed, args.RunID), nil
}

func toolMoveSection(ctx context.Context, client APIClient, args MoveSectionArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.SourceChecklistIdx, "source_checklist_idx"); err != nil {
		return "", err
	}
	if err := validateIndex(args.DestChecklistIdx, "dest_checklist_idx"); err != nil {
		return "", err
	}

	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if err := checkChecklistIndex(run, args.SourceChecklistIdx, "source_checklist_idx"); err != nil {
		return "", err
	}
	// MoveChecklist rejects a destination >= section count; the last valid slot
	// is count-1, not an append at count.
	if err := checkChecklistIndex(run, args.DestChecklistIdx, "dest_checklist_idx"); err != nil {
		return "", err
	}

	body := map[string]int{
		"source_checklist_idx": args.SourceChecklistIdx,
		"dest_checklist_idx":   args.DestChecklistIdx,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/move", args.RunID)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to move section: %w", err)
	}

	return fmt.Sprintf("Moved section %d to %d in run %s.", args.SourceChecklistIdx, args.DestChecklistIdx, args.RunID), nil
}
