// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// apiErrorStatusPattern matches the status code in the errors every APIClient
// implementation produces. Both the plugin client (server/mcp.go) and the eval
// harness client format failures as "API error (status %d): body", and the
// APIClient interface passes plain errors, so the text is the only place the
// status survives. Parsing it here keeps that coupling in one tested spot
// instead of spreading string matching through the tools.
var apiErrorStatusPattern = regexp.MustCompile(`API error \(status (\d+)\)`)

func apiErrorStatus(err error) (int, bool) {
	if err == nil {
		return 0, false
	}
	match := apiErrorStatusPattern.FindStringSubmatch(err.Error())
	if match == nil {
		return 0, false
	}
	status, convErr := strconv.Atoi(match[1])
	if convErr != nil {
		return 0, false
	}
	return status, true
}

// isUnknownOrForbidden reports whether an error is the response the Playbooks
// API gives for an object that either does not exist or is not visible to the
// caller. It deliberately answers 403 for both, so these two cases cannot be
// told apart from the outside.
func isUnknownOrForbidden(err error) bool {
	status, ok := apiErrorStatus(err)
	return ok && (status == 403 || status == 404)
}

// wrapRunError explains an ambiguous run failure instead of passing the API's
// bare "Not authorized" through. A model that mistypes one character of a
// run_id otherwise reads that as a permission wall and abandons the task, when
// re-running discovery would have fixed it. action is a verb phrase such as
// "finish" or "post a status update to"; hints add tool-specific causes worth
// mentioning, such as an operation only being valid on an in-progress run.
func wrapRunError(err error, runID, action string, hints ...string) error {
	if !isUnknownOrForbidden(err) {
		return fmt.Errorf("failed to %s run %s: %w%s", action, runID, err, joinHints(hints))
	}
	return fmt.Errorf("failed to %s run %s: no playbook run with that ID is visible to you. "+
		"The run_id may be mistyped or the run may not exist, or you may lack access to it — the API cannot tell these apart. "+
		"Do not retry the same ID: call resolve_channel_context with the channel you are working in, or list_runs, to find the correct run_id.%s "+
		"Underlying error: %w", action, runID, joinHints(hints), err)
}

// wrapPlaybookError is the playbook-template counterpart of wrapRunError.
// Archived templates are hidden from list_playbooks by default, which is a
// common reason a valid-looking playbook_id appears to be forbidden.
func wrapPlaybookError(err error, playbookID, action string, hints ...string) error {
	if !isUnknownOrForbidden(err) {
		return fmt.Errorf("failed to %s playbook template %s: %w%s", action, playbookID, err, joinHints(hints))
	}
	return fmt.Errorf("failed to %s playbook template %s: no playbook template with that ID is visible to you. "+
		"The playbook_id may be mistyped or the template may not exist, or you may lack access to it — the API cannot tell these apart. "+
		"Do not retry the same ID: call list_playbooks to find the correct playbook_id, passing with_archived=true if the template may have been archived.%s "+
		"Underlying error: %w", action, playbookID, joinHints(hints), err)
}

func joinHints(hints []string) string {
	if len(hints) == 0 {
		return ""
	}
	return " " + strings.Join(hints, " ")
}
