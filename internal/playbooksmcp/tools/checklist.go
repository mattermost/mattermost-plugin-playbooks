// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
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

type RemoveChecklistItemArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the item to remove"`
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

// --- Tool registration ---

func (p *PlaybooksToolProvider) addChecklistTools(server *mcp.Server) {
	addTool(server, p.clientFactory, "check_item",
		"Change the state of a checklist item in a playbook run. Use new_state='closed' to check it off or 'open' to uncheck it. Checklist and item numbers are zero-based indexes. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2, \"new_state\": \"closed\"}",
		toolCheckItem)

	addTool(server, p.clientFactory, "add_checklist_item",
		"Add a new item to an existing checklist in a playbook run. The checklist_number is a zero-based index. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Verify fix in staging\"}",
		toolAddChecklistItem)

	addTool(server, p.clientFactory, "edit_checklist_item",
		"Edit the title, description, or slash command of an existing checklist item. Only provided fields are updated. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"title\": \"Updated task title\"}",
		toolEditChecklistItem)

	addTool(server, p.clientFactory, "remove_checklist_item",
		"Remove a checklist item from a playbook run. This permanently deletes the item. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2}",
		toolRemoveChecklistItem)

	addTool(server, p.clientFactory, "add_section",
		"Add a new section (checklist group) to a playbook run. Sections organize tasks into logical groups. Example: {\"run_id\": \"abc123...\", \"title\": \"Post-incident review\"}",
		toolAddSection)

	addTool(server, p.clientFactory, "rename_section",
		"Rename an existing section in a playbook run. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Updated section name\"}",
		toolRenameSection)

	addTool(server, p.clientFactory, "remove_section",
		"Remove an entire section and all its items from a playbook run. This is permanent. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolRemoveSection)
}

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

	addMCPHelperTool(server, p.clientFactory, "remove_checklist_item",
		"Remove a checklist item from a playbook run. This permanently deletes the item. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2}",
		toolRemoveChecklistItem)

	addMCPHelperTool(server, p.clientFactory, "add_section",
		"Add a new section (checklist group) to a playbook run. Sections organize tasks into logical groups. Example: {\"run_id\": \"abc123...\", \"title\": \"Post-incident review\"}",
		toolAddSection)

	addMCPHelperTool(server, p.clientFactory, "rename_section",
		"Rename an existing section in a playbook run. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Updated section name\"}",
		toolRenameSection)

	addMCPHelperTool(server, p.clientFactory, "remove_section",
		"Remove an entire section and all its items from a playbook run. This is permanent. Example: {\"run_id\": \"abc123...\", \"checklist_number\": 1}",
		toolRemoveSection)
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
