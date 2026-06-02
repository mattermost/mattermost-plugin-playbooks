// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// TestPropertyOperations covers property-field CRUD on a playbook and property-value
// operations on a run. Both subtests share a single Setup call to avoid spinning up
// two separate MM servers (which pushed the test suite past the 10-minute timeout).
func TestPropertyOperations(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("playbook property fields CRUD", func(t *testing.T) {
		playbookID := e.BasicPlaybook.ID

		// Step 2: Create a property field
		createFieldRequest := client.PropertyFieldRequest{
			Name: "Initial Field",
			Type: "text",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("when_set"),
				SortOrder:  testPtr(1.0),
			},
		}

		createdField, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, createFieldRequest)
		require.NoError(t, err)
		require.Equal(t, "Initial Field", createdField.Name)
		require.Equal(t, "text", createdField.Type)
		fieldID := createdField.ID

		// Step 3: List property fields - should contain our new field
		fields1, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
		require.NoError(t, err)
		require.Len(t, fields1, 1)
		require.Equal(t, "Initial Field", fields1[0].Name)
		require.Equal(t, fieldID, fields1[0].ID)

		// Step 4a: Update the field name
		updateNameRequest := client.PropertyFieldRequest{
			Name: "Updated Field Name",
			Type: "text",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("when_set"),
				SortOrder:  testPtr(1.0),
			},
		}

		updatedField1, err := e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateNameRequest)
		require.NoError(t, err)
		require.Equal(t, "Updated Field Name", updatedField1.Name)
		require.Equal(t, fieldID, updatedField1.ID)

		// List and verify name update
		fields2, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
		require.NoError(t, err)
		require.Len(t, fields2, 1)
		require.Equal(t, "Updated Field Name", fields2[0].Name)

		// Step 4b: Update the field type (select requires options)
		updateTypeRequest := client.PropertyFieldRequest{
			Name: "Updated Field Name",
			Type: "select",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("when_set"),
				SortOrder:  testPtr(1.0),
				Options: &[]client.PropertyOptionInput{
					{
						Name:  "Basic Option",
						Color: testPtr("#0000ff"),
					},
				},
			},
		}

		updatedField2, err := e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateTypeRequest)
		require.NoError(t, err)
		require.Equal(t, "select", updatedField2.Type)

		// List and verify type update
		fields3, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
		require.NoError(t, err)
		require.Len(t, fields3, 1)
		require.Equal(t, "select", fields3[0].Type)

		// Step 4c: Update to add attributes (options for select field)
		updateAttrsRequest := client.PropertyFieldRequest{
			Name: "Updated Field Name",
			Type: "select",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("always"),
				SortOrder:  testPtr(2.0),
				Options: &[]client.PropertyOptionInput{
					{
						Name:  "Option 1",
						Color: testPtr("#ff0000"),
					},
					{
						Name:  "Option 2",
						Color: testPtr("#00ff00"),
					},
				},
			},
		}

		_, err = e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateAttrsRequest)
		require.NoError(t, err)

		// List and verify attributes update
		fields4, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
		require.NoError(t, err)
		require.Len(t, fields4, 1)

		// Step 5: Delete the property field
		err = e.PlaybooksClient.Playbooks.DeletePropertyField(context.Background(), playbookID, fieldID)
		require.NoError(t, err)

		// Step 6: List property fields - should be empty now
		fields5, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
		require.NoError(t, err)
		require.Len(t, fields5, 0, "Property field should be deleted and not appear in the list")
	})

	t.Run("run property operations", func(t *testing.T) {
		// Create a dedicated playbook so this subtest is independent of the CRUD subtest above.
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Run Properties Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{"playbook_member"}},
			},
		})
		require.NoError(t, err)

		// Field 1: Jira Ticket (text)
		_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), pbID, client.PropertyFieldRequest{
			Name: "Jira Ticket",
			Type: "text",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("when_set"),
				SortOrder:  testPtr(1.0),
			},
		})
		require.NoError(t, err)

		// Field 2: Priority (select: Low, Med, High)
		_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), pbID, client.PropertyFieldRequest{
			Name: "Priority",
			Type: "select",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("always"),
				SortOrder:  testPtr(2.0),
				Options: &[]client.PropertyOptionInput{
					{Name: "Low", Color: testPtr("#00ff00")},
					{Name: "Med", Color: testPtr("#ffff00")},
					{Name: "High", Color: testPtr("#ff0000")},
				},
			},
		})
		require.NoError(t, err)

		// Field 3: Tags (multiselect: Frontend, Backend, CI)
		_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), pbID, client.PropertyFieldRequest{
			Name: "Tags",
			Type: "multiselect",
			Attrs: &client.PropertyFieldAttrsInput{
				Visibility: testPtr("when_set"),
				SortOrder:  testPtr(3.0),
				Options: &[]client.PropertyOptionInput{
					{Name: "Frontend", Color: testPtr("#0066cc")},
					{Name: "Backend", Color: testPtr("#cc6600")},
					{Name: "CI", Color: testPtr("#660066")},
				},
			},
		})
		require.NoError(t, err)

		// Step 2: Create a run from the playbook
		createdRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			PlaybookID:  pbID,
			Name:        "Test Run with Properties",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		runID := createdRun.ID

		// Step 3: List property fields from the run and verify by name
		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), runID)
		require.NoError(t, err)
		require.Len(t, runFields, 3, "Should have 3 property fields")

		fieldsByName := make(map[string]client.PropertyField)
		for _, field := range runFields {
			fieldsByName[field.Name] = field
		}

		jiraRunField, exists := fieldsByName["Jira Ticket"]
		require.True(t, exists, "Jira Ticket field should exist")
		require.Equal(t, "text", jiraRunField.Type)

		priorityRunField, exists := fieldsByName["Priority"]
		require.True(t, exists, "Priority field should exist")
		require.Equal(t, "select", priorityRunField.Type)

		tagsRunField, exists := fieldsByName["Tags"]
		require.True(t, exists, "Tags field should exist")
		require.Equal(t, "multiselect", tagsRunField.Type)

		// Step 4: Set values for all three property fields
		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, jiraRunField.ID, client.PropertyValueRequest{
			Value: []byte(`"PROJ-123"`),
		})
		require.NoError(t, err)

		var highOptionID string
		if options, ok := priorityRunField.Attrs["options"].([]any); ok {
			for _, option := range options {
				if optMap, ok := option.(map[string]any); ok {
					if name, ok := optMap["name"].(string); ok && name == "High" {
						if id, ok := optMap["id"].(string); ok {
							highOptionID = id
							break
						}
					}
				}
			}
		}
		require.NotEmpty(t, highOptionID, "High option ID should exist")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, priorityRunField.ID, client.PropertyValueRequest{
			Value: []byte(`"` + highOptionID + `"`),
		})
		require.NoError(t, err)

		var frontendOptionID, ciOptionID string
		if options, ok := tagsRunField.Attrs["options"].([]any); ok {
			for _, option := range options {
				if optMap, ok := option.(map[string]any); ok {
					if name, ok := optMap["name"].(string); ok {
						if id, ok := optMap["id"].(string); ok {
							switch name {
							case "Frontend":
								frontendOptionID = id
							case "CI":
								ciOptionID = id
							}
						}
					}
				}
			}
		}
		require.NotEmpty(t, frontendOptionID, "Frontend option ID should exist")
		require.NotEmpty(t, ciOptionID, "CI option ID should exist")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, tagsRunField.ID, client.PropertyValueRequest{
			Value: []byte(`["` + frontendOptionID + `", "` + ciOptionID + `"]`),
		})
		require.NoError(t, err)

		// Step 5: List property values and verify they were set correctly
		propertyValues, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), runID)
		require.NoError(t, err)
		require.Len(t, propertyValues, 3, "Should have 3 property values")

		valuesByFieldID := make(map[string]client.PropertyValue)
		for _, value := range propertyValues {
			valuesByFieldID[value.FieldID] = value
		}

		jiraValue, exists := valuesByFieldID[jiraRunField.ID]
		require.True(t, exists, "Jira Ticket value should exist")
		var jiraStringValue string
		err = json.Unmarshal(jiraValue.Value, &jiraStringValue)
		require.NoError(t, err)
		require.Equal(t, "PROJ-123", jiraStringValue)

		priorityValue, exists := valuesByFieldID[priorityRunField.ID]
		require.True(t, exists, "Priority value should exist")
		var priorityStringValue string
		err = json.Unmarshal(priorityValue.Value, &priorityStringValue)
		require.NoError(t, err)
		require.Equal(t, highOptionID, priorityStringValue)

		tagsValue, exists := valuesByFieldID[tagsRunField.ID]
		require.True(t, exists, "Tags value should exist")
		var tagsArrayValue []string
		err = json.Unmarshal(tagsValue.Value, &tagsArrayValue)
		require.NoError(t, err)
		require.Len(t, tagsArrayValue, 2)
		require.Contains(t, tagsArrayValue, frontendOptionID)
		require.Contains(t, tagsArrayValue, ciOptionID)
	})
}
