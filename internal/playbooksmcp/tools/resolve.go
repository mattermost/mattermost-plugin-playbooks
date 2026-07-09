// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
)

// --- Argument structs ---

type ResolveChannelContextArgs struct {
	ChannelID       string `json:"channel_id" jsonschema:"The Mattermost channel ID the agent is operating in (26-char ID). Returns the runs in this channel with their checklist items and the zero-based indexes needed by check_item and the other item tools."`
	IncludeFinished bool   `json:"include_finished,omitempty" jsonschema:"If true, also include finished runs. Defaults to false (only in-progress runs)."`
}

type FindChecklistItemArgs struct {
	Query         string `json:"query" jsonschema:"Text to match against checklist item titles (case-insensitive)."`
	ChannelID     string `json:"channel_id,omitempty" jsonschema:"If set, search runs in this channel first. Pass the channel the agent is operating in so the matching item is found without guessing a run."`
	RunID         string `json:"run_id,omitempty" jsonschema:"If set, restrict the search to this single run."`
	IncludeClosed bool   `json:"include_closed,omitempty" jsonschema:"If true, also match items that are already closed or skipped. Defaults to false (only open/in-progress items)."`
}

// --- Tool registration ---

func (p *PlaybooksToolProvider) addMCPHelperResolveTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "resolve_channel_context",
		"Resolve the runs and checklist items that live in a Mattermost channel. Use this first, passing the channel the agent is operating in, to discover the run_id and the zero-based checklist/item indexes before calling check_item (or any other item tool). Returns each run with its checklist items formatted as [checklist_number][item_number] title (state). Example: {\"channel_id\": \"abc123...\"}",
		toolResolveChannelContext)

	addMCPHelperTool(server, p.clientFactory, "find_checklist_item",
		"Find a checklist item by matching text against item titles, so you can mark it done without knowing its indexes. Pass channel_id (the channel the agent is operating in) to search that channel's runs first. Returns the matching item(s) with run_id and the zero-based checklist_number/item_number to feed into check_item. Example: {\"query\": \"deploy to staging\", \"channel_id\": \"abc123...\"}",
		toolFindChecklistItem)
}

// --- Tool implementations ---

func toolResolveChannelContext(ctx context.Context, client APIClient, args ResolveChannelContextArgs) (string, error) {
	if err := validateID(args.ChannelID, "channel_id"); err != nil {
		return "", err
	}

	runs, err := fetchChannelRuns(ctx, client, args.ChannelID, args.IncludeFinished)
	if err != nil {
		return "", err
	}

	if len(runs) == 0 {
		scope := "in-progress runs"
		if args.IncludeFinished {
			scope = "runs"
		}
		return fmt.Sprintf("No %s found in channel %s.", scope, args.ChannelID), nil
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Channel %s has %d run(s):\n", args.ChannelID, len(runs))
	for _, run := range runs {
		sb.WriteString("\n")
		writeRunChecklists(&sb, run)
	}
	sb.WriteString("\nTo change an item, call check_item with the run_id and the [checklist_number][item_number] shown above.")
	return sb.String(), nil
}

func toolFindChecklistItem(ctx context.Context, client APIClient, args FindChecklistItemArgs) (string, error) {
	query := strings.TrimSpace(args.Query)
	if query == "" {
		return "", fmt.Errorf("query is required")
	}
	if args.ChannelID != "" {
		if err := validateID(args.ChannelID, "channel_id"); err != nil {
			return "", err
		}
	}
	if args.RunID != "" {
		if err := validateID(args.RunID, "run_id"); err != nil {
			return "", err
		}
	}

	runs, err := candidateRuns(ctx, client, args.RunID, args.ChannelID)
	if err != nil {
		return "", err
	}

	matches := matchChecklistItems(runs, query, args.IncludeClosed)
	if len(matches) == 0 {
		return formatNoMatches(runs, query, args.IncludeClosed), nil
	}
	return formatMatches(matches), nil
}

// --- Candidate run resolution ---

// candidateRuns returns the runs to search, in priority order: an explicit run,
// then a channel's in-progress runs, then the current user's in-progress runs.
func candidateRuns(ctx context.Context, client APIClient, runID, channelID string) ([]playbookRunDetail, error) {
	if runID != "" {
		var run playbookRunDetail
		if err := client.Get(ctx, fmt.Sprintf("runs/%s", runID), nil, &run); err != nil {
			return nil, fmt.Errorf("failed to get run: %w", err)
		}
		return []playbookRunDetail{run}, nil
	}
	if channelID != "" {
		return fetchChannelRuns(ctx, client, channelID, false)
	}

	userID, err := client.GetCurrentUserID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get current user ID: %w", err)
	}
	return fetchRunDetails(ctx, client, listRunsParams(map[string]string{
		"statuses":      "InProgress",
		"owner_user_id": userID,
	}))
}

// fetchChannelRuns lists a channel's runs (in-progress unless includeFinished)
// and fetches full details for each so checklist items are available.
func fetchChannelRuns(ctx context.Context, client APIClient, channelID string, includeFinished bool) ([]playbookRunDetail, error) {
	params := map[string]string{"channel_id": channelID}
	if !includeFinished {
		params["statuses"] = "InProgress"
	}
	return fetchRunDetails(ctx, client, listRunsParams(params))
}

func fetchRunDetails(ctx context.Context, client APIClient, params url.Values) ([]playbookRunDetail, error) {
	var resp listRunsResponse
	if err := client.Get(ctx, "runs", params, &resp); err != nil {
		return nil, fmt.Errorf("failed to list runs: %w", err)
	}

	runs := make([]playbookRunDetail, 0, len(resp.Items))
	for _, summary := range resp.Items {
		var run playbookRunDetail
		if err := client.Get(ctx, fmt.Sprintf("runs/%s", summary.ID), nil, &run); err != nil {
			return nil, fmt.Errorf("failed to get run %s: %w", summary.ID, err)
		}
		runs = append(runs, run)
	}
	return runs, nil
}

func listRunsParams(pairs map[string]string) url.Values {
	params := url.Values{}
	for k, v := range pairs {
		params.Set(k, v)
	}
	params.Set("page", "0")
	params.Set("per_page", "50")
	return params
}

// --- Matching ---

type itemMatch struct {
	runID           string
	runName         string
	checklistNumber int
	itemNumber      int
	title           string
	state           string
	score           int
}

func matchChecklistItems(runs []playbookRunDetail, query string, includeClosed bool) []itemMatch {
	q := strings.ToLower(query)
	qTokens := strings.Fields(q)

	var matches []itemMatch
	for _, run := range runs {
		for ci, cl := range run.Checklists {
			for ii, item := range cl.Items {
				if !includeClosed && !itemIsOpen(item.State) {
					continue
				}
				score := matchScore(strings.ToLower(item.Title), q, qTokens)
				if score == 0 {
					continue
				}
				matches = append(matches, itemMatch{
					runID:           run.ID,
					runName:         run.Name,
					checklistNumber: ci,
					itemNumber:      ii,
					title:           item.Title,
					state:           displayState(item.State),
					score:           score,
				})
			}
		}
	}

	sort.SliceStable(matches, func(i, j int) bool {
		return matches[i].score > matches[j].score
	})
	return matches
}

// matchScore ranks a title against the query: 3 exact, 2 substring, 1 all
// query tokens present, 0 no match.
func matchScore(title, query string, queryTokens []string) int {
	if title == query {
		return 3
	}
	if strings.Contains(title, query) {
		return 2
	}
	for _, tok := range queryTokens {
		if !strings.Contains(title, tok) {
			return 0
		}
	}
	if len(queryTokens) > 0 {
		return 1
	}
	return 0
}

func itemIsOpen(state string) bool {
	return state != "closed" && state != "skipped"
}

func displayState(state string) string {
	if state == "" {
		return "open"
	}
	return state
}

// --- Formatting ---

func writeRunChecklists(sb *strings.Builder, run playbookRunDetail) {
	fmt.Fprintf(sb, "**%s** (run_id: %s) — Status: %s\n", run.Name, run.ID, run.CurrentStatus)
	if len(run.Checklists) == 0 {
		sb.WriteString("  (no checklists)\n")
		return
	}
	for ci, cl := range run.Checklists {
		fmt.Fprintf(sb, "  Checklist %d: %q\n", ci, cl.Title)
		if len(cl.Items) == 0 {
			sb.WriteString("    (no items)\n")
			continue
		}
		for ii, item := range cl.Items {
			fmt.Fprintf(sb, "    [%d][%d] %s (%s)\n", ci, ii, item.Title, displayState(item.State))
		}
	}
}

func formatMatches(matches []itemMatch) string {
	if len(matches) == 1 {
		m := matches[0]
		return fmt.Sprintf(
			"Found 1 matching item:\n\n"+
				"- %q (%s) in run %q\n"+
				"  run_id: %s, checklist_number: %d, item_number: %d\n\n"+
				"Call check_item with run_id=%s, checklist_number=%d, item_number=%d.",
			m.title, m.state, m.runName, m.runID, m.checklistNumber, m.itemNumber,
			m.runID, m.checklistNumber, m.itemNumber)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Found %d matching items — pick the intended one:\n\n", len(matches))
	for _, m := range matches {
		fmt.Fprintf(&sb, "- %q (%s) in run %q\n  run_id: %s, checklist_number: %d, item_number: %d\n",
			m.title, m.state, m.runName, m.runID, m.checklistNumber, m.itemNumber)
	}
	return sb.String()
}

func formatNoMatches(runs []playbookRunDetail, query string, includeClosed bool) string {
	scope := "open "
	if includeClosed {
		scope = ""
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "No %schecklist item matching %q found.", scope, query)

	var available []itemMatch
	for _, run := range runs {
		for ci, cl := range run.Checklists {
			for ii, item := range cl.Items {
				if !includeClosed && !itemIsOpen(item.State) {
					continue
				}
				available = append(available, itemMatch{
					runID:           run.ID,
					runName:         run.Name,
					checklistNumber: ci,
					itemNumber:      ii,
					title:           item.Title,
					state:           displayState(item.State),
				})
			}
		}
	}

	if len(available) == 0 {
		sb.WriteString(" No candidate items were found in the searched runs.")
		return sb.String()
	}

	sb.WriteString("\n\nAvailable items:\n")
	for _, m := range available {
		fmt.Fprintf(&sb, "- %q (%s) in run %q — run_id: %s, checklist_number: %d, item_number: %d\n",
			m.title, m.state, m.runName, m.runID, m.checklistNumber, m.itemNumber)
	}
	return sb.String()
}
