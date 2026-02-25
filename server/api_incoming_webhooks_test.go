// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// createTestWebhook inserts an incoming webhook directly into the database.
func createTestWebhook(t *testing.T, e *TestEnvironment, webhook app.IncomingWebhook) app.IncomingWebhook {
	t.Helper()

	webhook.PreSave()
	require.NoError(t, webhook.IsValid())

	db := e.Srv.Store().GetInternalMasterDB()
	_, err := db.Exec(
		`INSERT INTO IR_IncomingWebhook (ID, Name, CreatorID, TeamID, PlaybookID, PlaybookRunID, CreateAt, UpdateAt, DeleteAt)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
		webhook.ID, webhook.Name, webhook.CreatorID, webhook.TeamID,
		webhook.PlaybookID, webhook.PlaybookRunID,
		webhook.CreateAt, webhook.UpdateAt,
	)
	require.NoError(t, err)

	return webhook
}

// webhookURL builds the full URL for calling an incoming webhook.
func webhookURL(e *TestEnvironment, webhookID string) string {
	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)
	return fmt.Sprintf("%s/plugins/playbooks/hooks/%s", siteURL, webhookID)
}

// postWebhook sends a POST request to an incoming webhook endpoint.
func postWebhook(t *testing.T, e *TestEnvironment, webhookID string, body api.IncomingWebhookRequest) *http.Response {
	t.Helper()

	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	resp, err := http.Post(webhookURL(e, webhookID), "application/json", bytes.NewReader(bodyBytes))
	require.NoError(t, err)

	return resp
}

// readResponseBody reads and closes the response body.
func readResponseBody(t *testing.T, resp *http.Response) map[string]any {
	t.Helper()

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var result map[string]any
	_ = json.Unmarshal(body, &result)
	return result
}

// setupWebhookTest creates a playbook with a text property field and a run, returning
// the IDs needed for webhook testing.
func setupWebhookTest(t *testing.T, e *TestEnvironment) (playbookID, runID, fieldID string) {
	t.Helper()

	playbookID = e.BasicPlaybook.ID

	// Create a text property field on the playbook.
	field, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Build Status",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(1.0),
		},
	})
	require.NoError(t, err)
	fieldID = field.ID

	// Create a run.
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Webhook Test Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)
	runID = run.ID

	return playbookID, runID, fieldID
}

func TestWebhookUpdateProperty_RunScoped(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, runID, fieldID := setupWebhookTest(t, e)
	_ = playbookID

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "run-scoped",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])

	// Verify property value was set.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), runID)
	require.NoError(t, err)
	require.Len(t, values, 1)
	assert.Equal(t, fieldID, values[0].FieldID)
	assert.Equal(t, json.RawMessage(`"passed"`), values[0].Value)
}

func TestWebhookUpdateProperty_PlaybookScoped(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, runID, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:       "playbook-scoped",
		CreatorID:  e.RegularUser.Id,
		TeamID:     e.BasicTeam.Id,
		PlaybookID: playbookID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PlaybookRunID:   runID,
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"deployed"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])

	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), runID)
	require.NoError(t, err)
	require.Len(t, values, 1)
	assert.Equal(t, json.RawMessage(`"deployed"`), values[0].Value)
}

func TestWebhookUpdateProperty_ByName(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, _ := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "by-name",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:       "update_property",
		PropertyName: "Build Status",
		Value:        json.RawMessage(`"passed"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])
}

func TestWebhookUpdateProperty_ByNameCaseInsensitive(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, _ := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "case-insensitive",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:       "update_property",
		PropertyName: "build status", // lowercase
		Value:        json.RawMessage(`"passed"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])
}

func TestWebhook_PlaybookScopedWrongRun(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, _, fieldID := setupWebhookTest(t, e)

	// Create a second playbook and run.
	otherPlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Other Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	otherRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Other Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  otherPlaybookID,
	})
	require.NoError(t, err)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:       "wrong-run",
		CreatorID:  e.RegularUser.Id,
		TeamID:     e.BasicTeam.Id,
		PlaybookID: playbookID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PlaybookRunID:   otherRun.ID,
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestWebhook_RunScopedIgnoresRunID(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "run-scoped-ignore",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	// Send with a different playbook_run_id — should be ignored.
	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PlaybookRunID:   "some-other-run-id",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])

	// Verify the value was set on the correct run.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), runID)
	require.NoError(t, err)
	require.Len(t, values, 1)
}

func TestWebhook_CreatorPermissionRevoked(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, fieldID := setupWebhookTest(t, e)

	// Create webhook as RegularUserNotInTeam (who doesn't have run permissions).
	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "no-perms",
		CreatorID:     e.RegularUserNotInTeam.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestWebhook_DeletedWebhook(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "deleted",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	// Soft-delete the webhook.
	db := e.Srv.Store().GetInternalMasterDB()
	_, err := db.Exec(`UPDATE IR_IncomingWebhook SET DeleteAt = $1 WHERE ID = $2`,
		model.GetMillis(), webhook.ID)
	require.NoError(t, err)

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestWebhook_NonExistentWebhook(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	resp := postWebhook(t, e, "nonexistentwh00kabcdefghij", api.IncomingWebhookRequest{
		Action: "update_property",
		Value:  json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestWebhook_InvalidAction(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, _ := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "invalid-action",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action: "unknown_action",
		Value:  json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestWebhook_MissingPropertyIdentifier(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, _ := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "no-property",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action: "update_property",
		Value:  json.RawMessage(`"passed"`),
		// Neither PropertyFieldID nor PropertyName set.
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestWebhook_PropertyNameNotFound(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, _ := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "bad-name",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:       "update_property",
		PropertyName: "Nonexistent Property",
		Value:        json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestWebhook_PlaybookScopedMissingRunID(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, _, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:       "missing-run",
		CreatorID:  e.RegularUser.Id,
		TeamID:     e.BasicTeam.Id,
		PlaybookID: playbookID,
	})

	// Playbook-scoped webhook without playbook_run_id in body.
	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"passed"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestWebhook_FinishRunCleansUp(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	_, runID, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:          "cleanup",
		CreatorID:     e.RegularUser.Id,
		TeamID:        e.BasicTeam.Id,
		PlaybookRunID: runID,
	})

	// Verify webhook works before finishing.
	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"before"`),
	})
	readResponseBody(t, resp)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Finish the run.
	err := e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), runID)
	require.NoError(t, err)

	// Webhook should now return 404.
	resp = postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"after"`),
	})
	readResponseBody(t, resp)

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestWebhook_FinishRunKeepsPlaybookScoped(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, runID, fieldID := setupWebhookTest(t, e)

	webhook := createTestWebhook(t, e, app.IncomingWebhook{
		Name:       "playbook-survives",
		CreatorID:  e.RegularUser.Id,
		TeamID:     e.BasicTeam.Id,
		PlaybookID: playbookID,
	})

	// Finish the run.
	err := e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), runID)
	require.NoError(t, err)

	// Create another run on the same playbook.
	run2, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Second Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	// Playbook-scoped webhook should still work for the new run.
	resp := postWebhook(t, e, webhook.ID, api.IncomingWebhookRequest{
		Action:          "update_property",
		PlaybookRunID:   run2.ID,
		PropertyFieldID: fieldID,
		Value:           json.RawMessage(`"still-works"`),
	})
	result := readResponseBody(t, resp)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, true, result["ok"])
}
