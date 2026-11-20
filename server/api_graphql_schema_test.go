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

type graphQLTestResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func doTestGraphql(t *testing.T, e *TestEnvironment, operationName, query string, variables map[string]any) graphQLTestResponse {
	t.Helper()
	var response graphQLTestResponse
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: operationName,
		Variables:     variables,
	}, &response)
	require.NoError(t, err)
	return response
}

func TestGraphQLGenericError(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	response := doTestGraphql(t, e, "poc", `query poc { __typename @a@a@a }`, nil)

	require.Len(t, response.Errors, 1)
	require.Equal(t, "Error while executing your request", response.Errors[0].Message)
}

func TestGraphQLPropertyFieldSchema(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("introspection is disabled", func(t *testing.T) {
		response := doTestGraphql(t, e, "PropertyFieldTypeQuery", `
			query PropertyFieldTypeQuery {
				__type(name: "PropertyFieldType") { enumValues { name } }
			}
		`, nil)

		var result struct {
			Type *json.RawMessage `json:"__type"`
		}
		if len(response.Data) > 0 && string(response.Data) != "null" {
			require.NoError(t, json.Unmarshal(response.Data, &result))
		}
		require.Nil(t, result.Type)
	})

	t.Run("every PropertyFieldType value is accepted", func(t *testing.T) {
		fieldTypes := []struct {
			fieldType string
			options   []map[string]any
		}{
			{fieldType: "text"},
			{fieldType: "select", options: []map[string]any{{"name": "Option 1", "color": "blue"}}},
			{fieldType: "multiselect", options: []map[string]any{{"name": "Tag 1"}, {"name": "Tag 2"}}},
			{fieldType: "date"},
			{fieldType: "user"},
			{fieldType: "multiuser"},
		}

		for _, ft := range fieldTypes {
			attrs := map[string]any{"visibility": "always", "sortOrder": 1.0}
			if ft.options != nil {
				attrs["options"] = ft.options
			}
			response := doTestGraphql(t, e, "AddPlaybookPropertyField", `
				mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
					addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
				}
			`, map[string]any{
				"playbookID":    e.BasicPlaybook.ID,
				"propertyField": map[string]any{"name": ft.fieldType + " field", "type": ft.fieldType, "attrs": attrs},
			})
			require.Empty(t, response.Errors, "type %s should be accepted", ft.fieldType)
		}
	})

	t.Run("created field is consistent between playbook and single-field queries", func(t *testing.T) {
		addResponse := doTestGraphql(t, e, "AddPlaybookPropertyField", `
			mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
				addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
			}
		`, map[string]any{
			"playbookID": e.BasicPlaybook.ID,
			"propertyField": map[string]any{
				"name": "Consistency Priority",
				"type": "select",
				"attrs": map[string]any{
					"visibility": "always",
					"sortOrder":  1.0,
					"options": []map[string]any{
						{"name": "Critical", "color": "red"},
						{"name": "Normal", "color": "blue"},
						{"name": "Low", "color": "green"},
					},
				},
			},
		})
		require.Empty(t, addResponse.Errors)

		var added struct {
			AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
		}
		require.NoError(t, json.Unmarshal(addResponse.Data, &added))
		fieldID := added.AddPlaybookPropertyField
		require.NotEmpty(t, fieldID)

		type fieldResult struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Type  string `json:"type"`
			Attrs struct {
				Visibility string  `json:"visibility"`
				SortOrder  float64 `json:"sortOrder"`
				Options    []struct {
					Name  string `json:"name"`
					Color string `json:"color"`
				} `json:"options"`
			} `json:"attrs"`
		}
		const fieldSelection = `id name type attrs { visibility sortOrder options { name color } }`

		bulkResponse := doTestGraphql(t, e, "GetPlaybookWithFields", `
			query GetPlaybookWithFields($id: String!) {
				playbook(id: $id) { propertyFields { `+fieldSelection+` } }
			}
		`, map[string]any{"id": e.BasicPlaybook.ID})
		require.Empty(t, bulkResponse.Errors)

		var bulk struct {
			Playbook struct {
				PropertyFields []fieldResult `json:"propertyFields"`
			} `json:"playbook"`
		}
		require.NoError(t, json.Unmarshal(bulkResponse.Data, &bulk))

		var fromPlaybook *fieldResult
		for i := range bulk.Playbook.PropertyFields {
			if bulk.Playbook.PropertyFields[i].ID == fieldID {
				fromPlaybook = &bulk.Playbook.PropertyFields[i]
			}
		}
		require.NotNil(t, fromPlaybook, "created field should be listed on the playbook")
		require.Equal(t, "Consistency Priority", fromPlaybook.Name)
		require.Equal(t, "select", fromPlaybook.Type)
		require.Len(t, fromPlaybook.Attrs.Options, 3)

		singleResponse := doTestGraphql(t, e, "GetIndividualProperty", `
			query GetIndividualProperty($playbookID: String!, $propertyID: String!) {
				playbookProperty(playbookID: $playbookID, propertyID: $propertyID) { `+fieldSelection+` }
			}
		`, map[string]any{"playbookID": e.BasicPlaybook.ID, "propertyID": fieldID})
		require.Empty(t, singleResponse.Errors)

		var single struct {
			PlaybookProperty fieldResult `json:"playbookProperty"`
		}
		require.NoError(t, json.Unmarshal(singleResponse.Data, &single))
		require.Equal(t, *fromPlaybook, single.PlaybookProperty)
	})
}
