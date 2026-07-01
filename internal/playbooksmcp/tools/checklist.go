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
	NewState        string `json:"new_state,omitempty" jsonschema:"The new state for the item: open, closed, or skipped (default: closed)"`
}

type AddChecklistItemArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist to add the item to"`
	Title           string `json:"title" jsonschema:"Title of the new checklist item"`
	Description     string `json:"description,omitempty" jsonschema:"Optional description for the item (supports Markdown)"`
	AssigneeID      string `json:"assignee_id,omitempty" jsonschema:"Optional user ID to assign the item to"`
}

type EditChecklistItemArgs struct {
	RunID           string  `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int     `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int     `json:"item_number" jsonschema:"The zero-based index of the item within the checklist"`
	Title           *string `json:"title,omitempty" jsonschema:"New title for the item"`
	Description     *string `json:"description,omitempty" jsonschema:"New description for the item (supports Markdown)"`
	Command         *string `json:"command,omitempty" jsonschema:"Slash command to associate with the item"`
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
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run"`
	Title string `json:"title" jsonschema:"Title of the new section"`
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
		"Change the state of a checklist item in a playbook run. Use new_state='closed' to check it off or 'open' to uncheck it. Checklist and item numbers are zero-based indexes. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2, \"new_state\": \"closed\"}",
		toolCheckItem)

	addMCPHelperTool(server, p.clientFactory, "add_checklist_item",
		"Add a new item to an existing checklist in a playbook run. The checklist_number is a zero-based index. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Verify fix in staging\"}",
		toolAddChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "edit_checklist_item",
		"Edit the title, description, or slash command of an existing checklist item. Only provided fields are updated. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"title\": \"Updated task title\"}",
		toolEditChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "set_checklist_item_assignee",
		"Assign or clear the assignee for an existing checklist item. Omit assignee_id or set it to an empty string to clear the assignee. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"assignee_id\": \"user123...\"}",
		toolSetChecklistItemAssignee)

	addMCPHelperTool(server, p.clientFactory, "remove_checklist_item",
		"Remove a checklist item from a playbook run. This permanently deletes the item. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2}",
		toolRemoveChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "move_checklist_item",
		"Move a checklist item within or between sections in a playbook run. Source and destination indexes are zero-based. Example: {\"run_id\": \"abc123...\", \"source_checklist_idx\": 0, \"source_item_idx\": 2, \"dest_checklist_idx\": 1, \"dest_item_idx\": 0}",
		toolMoveChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "add_section",
		"Add a new section (checklist group) to a playbook run. Sections organize tasks into logical groups. Example: {\"run_id\": \"abc123...\", \"title\": \"Post-incident review\"}",
		toolAddSection)

	addMCPHelperTool(server, p.clientFactory, "rename_section",
		"Rename an existing section in a playbook run. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Updated section name\"}",
		toolRenameSection)

	addMCPHelperTool(server, p.clientFactory, "remove_section",
		"Remove an entire section and all its items from a playbook run. This is permanent. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolRemoveSection)

	addMCPHelperTool(server, p.clientFactory, "move_section",
		"Move a section within a playbook run. Source and destination indexes are zero-based. Example: {\"run_id\": \"abc123...\", \"source_checklist_idx\": 1, \"dest_checklist_idx\": 0}",
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
	case "closed", "skipped":
	case "in_progress":
		return "", fmt.Errorf("new_state %q is not supported by this tool; use open, closed, or skipped", state)
	default:
		return "", fmt.Errorf("new_state must be one of open, closed, or skipped")
	}

	body := map[string]string{
		"new_state": apiState,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d/state", args.RunID, args.ChecklistNumber, args.ItemNumber)
	if err := client.Put(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to update item state: %w", err)
	}

	return fmt.Sprintf("Checklist item [%d][%d] in run %s set to '%s'.", args.ChecklistNumber, args.ItemNumber, args.RunID, state), nil
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

	body := map[string]string{
		"title": title,
	}
	if args.Description != "" {
		body["description"] = args.Description
	}
	if args.AssigneeID != "" {
		if err := validateID(args.AssigneeID, "assignee_id"); err != nil {
			return "", err
		}
		body["assignee_id"] = args.AssigneeID
	}

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/add", args.RunID, args.ChecklistNumber)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to add checklist item: %w", err)
	}

	return fmt.Sprintf("Added item '%s' to checklist %d in run %s.", title, args.ChecklistNumber, args.RunID), nil
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

	if args.Title == nil && args.Description == nil && args.Command == nil {
		return "", fmt.Errorf("at least one field (title, description, or command) must be provided")
	}
	var title string
	if args.Title != nil {
		title = strings.TrimSpace(*args.Title)
		if title == "" {
			return "", fmt.Errorf("title is required")
		}
	}

	var run playbookRunDetail
	if err := client.Get(ctx, fmt.Sprintf("runs/%s", args.RunID), nil, &run); err != nil {
		return "", fmt.Errorf("failed to get current checklist item: %w", err)
	}
	if args.ChecklistNumber >= len(run.Checklists) {
		return "", fmt.Errorf("checklist_number %d is out of range", args.ChecklistNumber)
	}
	if args.ItemNumber >= len(run.Checklists[args.ChecklistNumber].Items) {
		return "", fmt.Errorf("item_number %d is out of range", args.ItemNumber)
	}

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

	endpoint := fmt.Sprintf("runs/%s/checklists/%d/item/%d", args.RunID, args.ChecklistNumber, args.ItemNumber)
	if err := client.Delete(ctx, endpoint); err != nil {
		return "", fmt.Errorf("failed to remove checklist item: %w", err)
	}

	return fmt.Sprintf("Removed checklist item [%d][%d] from run %s.", args.ChecklistNumber, args.ItemNumber, args.RunID), nil
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

	body := map[string]string{
		"title": title,
	}

	endpoint := fmt.Sprintf("runs/%s/checklists", args.RunID)
	if err := client.Post(ctx, endpoint, body, nil); err != nil {
		return "", fmt.Errorf("failed to add section: %w", err)
	}

	return fmt.Sprintf("Added section '%s' to run %s.", title, args.RunID), nil
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

	endpoint := fmt.Sprintf("runs/%s/checklists/%d", args.RunID, args.ChecklistNumber)
	if err := client.Delete(ctx, endpoint); err != nil {
		return "", fmt.Errorf("failed to remove section: %w", err)
	}

	return fmt.Sprintf("Removed section %d from run %s.", args.ChecklistNumber, args.RunID), nil
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
