// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// attributeSetup creates a playbook with text, select, and multiselect property
// fields, starts a run from it, and returns everything needed for attribute
// command tests.
type attributeFixture struct {
	RunID            string
	RunChannelID     string
	TextField        *client.PropertyField
	SelectField      *client.PropertyField
	MultiselectField *client.PropertyField
	// Option IDs keyed by name for the select field
	SelectOptionIDs map[string]string
	// Option IDs keyed by name for the multiselect field
	MultiselectOptionIDs map[string]string
}

func setupAttributeTest(t *testing.T, e *TestEnvironment) attributeFixture {
	t.Helper()

	playbookID := e.BasicPlaybook.ID

	// Create a text field.
	_, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Build Status",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(1.0),
		},
	})
	require.NoError(t, err)

	// Create a select field with options.
	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Severity",
		Type: "select",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(2.0),
			Options: &[]client.PropertyOptionInput{
				{Name: "High"},
				{Name: "Medium"},
				{Name: "Low"},
			},
		},
	})
	require.NoError(t, err)

	// Create a multiselect field with options.
	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Tags",
		Type: "multiselect",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(3.0),
			Options: &[]client.PropertyOptionInput{
				{Name: "backend"},
				{Name: "frontend"},
				{Name: "urgent"},
			},
		},
	})
	require.NoError(t, err)

	// Create a run (copies playbook fields to run fields with fresh IDs).
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Attribute Test Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	// Fetch the run's property fields to get the copied field IDs and option IDs.
	runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
	require.NoError(t, err)

	fixture := attributeFixture{
		RunID:                run.ID,
		RunChannelID:         run.ChannelID,
		SelectOptionIDs:      make(map[string]string),
		MultiselectOptionIDs: make(map[string]string),
	}

	for i, f := range runFields {
		switch f.Name {
		case "Build Status":
			fixture.TextField = &runFields[i]
		case "Severity":
			fixture.SelectField = &runFields[i]
			extractOptionIDs(t, &runFields[i], fixture.SelectOptionIDs)
		case "Tags":
			fixture.MultiselectField = &runFields[i]
			extractOptionIDs(t, &runFields[i], fixture.MultiselectOptionIDs)
		}
	}

	require.NotNil(t, fixture.TextField, "text field not found on run")
	require.NotNil(t, fixture.SelectField, "select field not found on run")
	require.NotNil(t, fixture.MultiselectField, "multiselect field not found on run")

	return fixture
}

// extractOptionIDs parses option names and IDs from the field's attrs and
// populates the provided map.
func extractOptionIDs(t *testing.T, field *client.PropertyField, m map[string]string) {
	t.Helper()

	attrs := field.Attrs
	if attrs == nil {
		return
	}

	optionsRaw, ok := attrs["options"]
	if !ok {
		return
	}

	optionsList, ok := optionsRaw.([]interface{})
	require.True(t, ok, "options is not a list")

	for _, opt := range optionsList {
		optMap, ok := opt.(map[string]interface{})
		require.True(t, ok, "option is not a map")
		name, _ := optMap["name"].(string)
		id, _ := optMap["id"].(string)
		if name != "" && id != "" {
			m[name] = id
		}
	}
}

// executeCommand runs a slash command via the Mattermost client and returns the error (if any).
func executeCommand(t *testing.T, e *TestEnvironment, channelID, command string) {
	t.Helper()
	_, _, err := e.ServerClient.ExecuteCommand(context.Background(), channelID, command)
	require.NoError(t, err)
}

func strPtr(s string) *string    { return &s }
func f64Ptr(f float64) *float64  { return &f }

// setupAttributeTestWithDateField creates a fixture that includes a date field
// in addition to the standard text/select/multiselect fields.
type attributeFixtureWithDate struct {
	attributeFixture
	DateField *client.PropertyField
}

func setupAttributeTestWithDateField(t *testing.T, e *TestEnvironment) attributeFixtureWithDate {
	t.Helper()

	playbookID := e.BasicPlaybook.ID

	// Create all the standard fields first (text, select, multiselect).
	_, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Build Status",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(1.0),
		},
	})
	require.NoError(t, err)

	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Severity",
		Type: "select",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(2.0),
			Options: &[]client.PropertyOptionInput{
				{Name: "High"},
				{Name: "Medium"},
				{Name: "Low"},
			},
		},
	})
	require.NoError(t, err)

	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Tags",
		Type: "multiselect",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(3.0),
			Options: &[]client.PropertyOptionInput{
				{Name: "backend"},
				{Name: "frontend"},
				{Name: "urgent"},
			},
		},
	})
	require.NoError(t, err)

	// Add the date field.
	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Deploy Date",
		Type: "date",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(4.0),
		},
	})
	require.NoError(t, err)

	// Create a run (copies all playbook fields including date).
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Attribute Date Test Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
	require.NoError(t, err)

	fixture := attributeFixtureWithDate{
		attributeFixture: attributeFixture{
			RunID:                run.ID,
			RunChannelID:         run.ChannelID,
			SelectOptionIDs:      make(map[string]string),
			MultiselectOptionIDs: make(map[string]string),
		},
	}

	for i, f := range runFields {
		switch f.Name {
		case "Build Status":
			fixture.TextField = &runFields[i]
		case "Severity":
			fixture.SelectField = &runFields[i]
			extractOptionIDs(t, &runFields[i], fixture.SelectOptionIDs)
		case "Tags":
			fixture.MultiselectField = &runFields[i]
			extractOptionIDs(t, &runFields[i], fixture.MultiselectOptionIDs)
		case "Deploy Date":
			fixture.DateField = &runFields[i]
		}
	}

	require.NotNil(t, fixture.DateField, "date field not found on run")

	return fixture
}

// setupPrivateAttributeTest creates a private playbook owned by RegularUser
// with property fields, starts a run, and returns everything needed for
// permission tests. RegularUser2 is NOT a member of this playbook or run.
func setupPrivateAttributeTest(t *testing.T, e *TestEnvironment) attributeFixture {
	t.Helper()

	// Create a private playbook with only RegularUser as member.
	playbookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Private Attribute Playbook",
		TeamID: e.BasicTeam.Id,
		Public: false,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{"playbook_member"}},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(t, err)

	// Create a text field.
	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, client.PropertyFieldRequest{
		Name: "Build Status",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: strPtr("when_set"),
			SortOrder:  f64Ptr(1.0),
		},
	})
	require.NoError(t, err)

	// Create a run from this private playbook.
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Private Attribute Test Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
	require.NoError(t, err)

	fixture := attributeFixture{
		RunID:        run.ID,
		RunChannelID: run.ChannelID,
	}

	for i, f := range runFields {
		if f.Name == "Build Status" {
			fixture.TextField = &runFields[i]
		}
	}

	require.NotNil(t, fixture.TextField, "text field not found on private run")

	return fixture
}

// executeCommandAs runs a slash command via the specified Mattermost server client.
func executeCommandAs(t *testing.T, serverClient *model.Client4, channelID, command string) {
	t.Helper()
	_, _, err := serverClient.ExecuteCommand(context.Background(), channelID, command)
	require.NoError(t, err)
}

// --- Tests ---

func TestAttributeList_AllTypes(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// Set a value on the text field so we can see it in the list.
	_, err := e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
		context.Background(), f.RunID, f.TextField.ID,
		client.PropertyValueRequest{Value: json.RawMessage(`"passed"`)},
	)
	require.NoError(t, err)

	// Set a value on the select field.
	_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
		context.Background(), f.RunID, f.SelectField.ID,
		client.PropertyValueRequest{Value: json.RawMessage(fmt.Sprintf(`"%s"`, f.SelectOptionIDs["High"]))},
	)
	require.NoError(t, err)

	// Execute the list command — we can't easily capture the ephemeral
	// post text, but we verify the command does not error.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute list --run %s", f.RunID))
}

func TestAttributeList_NoFields(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create a run from a playbook with no property fields.
	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Empty Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Empty Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	executeCommand(t, e, run.ChannelID, fmt.Sprintf("/playbook attribute list --run %s", run.ID))
}

func TestAttributeList_MissingRunFlag(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Command should not error even though --run is missing (returns ephemeral error).
	executeCommand(t, e, e.BasicRun.ChannelID, "/playbook attribute list")
}

func TestAttributeList_RunNotFound(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	executeCommand(t, e, e.BasicRun.ChannelID, "/playbook attribute list --run nonexistentrunidxxxxxxxxx")
}

func TestAttributeGet_ByName(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// Set a value so get returns something meaningful.
	_, err := e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
		context.Background(), f.RunID, f.TextField.ID,
		client.PropertyValueRequest{Value: json.RawMessage(`"passed"`)},
	)
	require.NoError(t, err)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute get "Build Status" --run %s`, f.RunID))
}

func TestAttributeGet_ByNameCaseInsensitive(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute get "build status" --run %s`, f.RunID))
}

func TestAttributeGet_ByID(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute get %s --run %s", f.TextField.ID, f.RunID))
}

func TestAttributeGet_NotFound(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute get "DoesNotExist" --run %s`, f.RunID))
}

func TestAttributeGet_NotSet(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// Don't set any value — should return *(not set)*.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute get Severity --run %s`, f.RunID))
}

func TestAttributeSet_Text(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value passed --run %s`, f.RunID))

	// Verify the value was stored.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	found := false
	for _, v := range values {
		if v.FieldID == f.TextField.ID {
			assert.Equal(t, json.RawMessage(`"passed"`), v.Value)
			found = true
			break
		}
	}
	assert.True(t, found, "text field value not found after set")
}

func TestAttributeSet_Select(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute set Severity --value High --run %s", f.RunID))

	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	found := false
	for _, v := range values {
		if v.FieldID == f.SelectField.ID {
			// The stored value should be the option ID, not the name.
			expectedID := f.SelectOptionIDs["High"]
			assert.Equal(t, json.RawMessage(fmt.Sprintf(`"%s"`, expectedID)), v.Value)
			found = true
			break
		}
	}
	assert.True(t, found, "select field value not found after set")
}

func TestAttributeSet_SelectCaseInsensitive(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute set Severity --value high --run %s", f.RunID))

	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	found := false
	for _, v := range values {
		if v.FieldID == f.SelectField.ID {
			expectedID := f.SelectOptionIDs["High"]
			assert.Equal(t, json.RawMessage(fmt.Sprintf(`"%s"`, expectedID)), v.Value)
			found = true
			break
		}
	}
	assert.True(t, found, "select field value not found after case-insensitive set")
}

func TestAttributeSet_Multiselect(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute set Tags --value backend --value urgent --run %s", f.RunID))

	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	found := false
	for _, v := range values {
		if v.FieldID == f.MultiselectField.ID {
			var storedIDs []string
			require.NoError(t, json.Unmarshal(v.Value, &storedIDs))
			assert.Contains(t, storedIDs, f.MultiselectOptionIDs["backend"])
			assert.Contains(t, storedIDs, f.MultiselectOptionIDs["urgent"])
			assert.Len(t, storedIDs, 2)
			found = true
			break
		}
	}
	assert.True(t, found, "multiselect field value not found after set")
}

func TestAttributeSet_InvalidOption(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// This should not error at the HTTP level — it returns an ephemeral error.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf("/playbook attribute set Severity --value Critical --run %s", f.RunID))

	// Verify no value was stored for the select field.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	for _, v := range values {
		assert.NotEqual(t, f.SelectField.ID, v.FieldID, "select field should not have a value after invalid option set")
	}
}

func TestAttributeSet_MultipleValuesOnText(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// Multiple --value on a text field should fail (ephemeral error), no value stored.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value one --value two --run %s`, f.RunID))

	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	for _, v := range values {
		assert.NotEqual(t, f.TextField.ID, v.FieldID, "text field should not have a value after multiple --value set")
	}
}

func TestAttributeSet_ClearValue(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// First set a value.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value passed --run %s`, f.RunID))

	// Verify it was set.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)
	found := false
	for _, v := range values {
		if v.FieldID == f.TextField.ID {
			assert.Equal(t, json.RawMessage(`"passed"`), v.Value)
			found = true
			break
		}
	}
	require.True(t, found, "text field should have a value before clearing")

	// Now clear it.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value "" --run %s`, f.RunID))

	// Verify it was cleared.
	values, err = e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)
	found = false
	for _, v := range values {
		if v.FieldID == f.TextField.ID {
			require.Equal(t, json.RawMessage(`""`), v.Value)
			found = true
			break
		}
	}
	require.True(t, found, "text field should still exist with empty value after clearing")
}

func TestAttributeSet_GetRoundTrip(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTest(t, e)

	// Set a text value, then get it — verify no error on the round trip.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value deployed --run %s`, f.RunID))
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute get "Build Status" --run %s`, f.RunID))

	// Verify the value is correct via API.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)
	found := false
	for _, v := range values {
		if v.FieldID == f.TextField.ID {
			assert.Equal(t, json.RawMessage(`"deployed"`), v.Value)
			found = true
			break
		}
	}
	assert.True(t, found, "text field value not found in round trip")
}

func TestAttributeList_NoPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupPrivateAttributeTest(t, e)

	// Execute as RegularUser2 who is NOT a member of the private playbook or run.
	// The command should execute without HTTP error (returns ephemeral permission error).
	executeCommandAs(t, e.ServerClient2, f.RunChannelID, fmt.Sprintf("/playbook attribute list --run %s", f.RunID))
}

func TestAttributeSet_UnsupportedType(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupAttributeTestWithDateField(t, e)

	// Try to set the date field — should return an ephemeral error about unsupported type.
	executeCommand(t, e, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Deploy Date" --value "2024-01-15" --run %s`, f.RunID))

	// Verify no value was stored for the date field.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	for _, v := range values {
		assert.NotEqual(t, f.DateField.ID, v.FieldID, "date field should not have a value after unsupported type set")
	}
}

func TestAttributeSet_NoPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	f := setupPrivateAttributeTest(t, e)

	// Execute as RegularUser2 who is NOT a member of the private playbook or run.
	// The command should execute without HTTP error (returns ephemeral permission error).
	executeCommandAs(t, e.ServerClient2, f.RunChannelID, fmt.Sprintf(`/playbook attribute set "Build Status" --value hacked --run %s`, f.RunID))

	// Verify no value was stored — permission should have been denied.
	values, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), f.RunID)
	require.NoError(t, err)

	for _, v := range values {
		assert.NotEqual(t, f.TextField.ID, v.FieldID, "text field should not have a value after no-permission set")
	}
}
