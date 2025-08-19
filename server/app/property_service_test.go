// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyService_duplicatePropertyFieldForRun(t *testing.T) {
	s := &propertyService{}
	runID := model.NewId()
	playbookID := model.NewId()

	t.Run("text field with name and type only", func(t *testing.T) {
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
	})

	t.Run("text field with name, type and sort order", func(t *testing.T) {
		sortOrder := 42.5
		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Field with Sort",
			Type:       model.PropertyFieldTypeText,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility: PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:  sortOrder,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])
	})

	t.Run("select field with options and sort order", func(t *testing.T) {
		sortOrder := 10.0
		originalOptions := model.PropertyOptions[*model.PluginPropertyOption]{
			model.NewPluginPropertyOption(model.NewId(), "Option One"),
			model.NewPluginPropertyOption(model.NewId(), "Option Two"),
		}

		playbookProperty := &model.PropertyField{
			ID:         model.NewId(),
			Name:       "Test Select Field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: PropertyTargetTypePlaybook,
			TargetID:   playbookID,
			Attrs: model.StringInterface{
				PropertyAttrsVisibility:             PropertyFieldVisibilityDefault,
				PropertyAttrsSortOrder:              sortOrder,
				model.PropertyFieldAttributeOptions: originalOptions,
			},
		}

		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		require.NoError(t, err)

		require.NotEqual(t, playbookProperty.ID, runProperty.ID)
		require.Equal(t, playbookProperty.Name, runProperty.Name)
		require.Equal(t, playbookProperty.Type, runProperty.Type)
		require.Equal(t, PropertyTargetTypeRun, runProperty.TargetType)
		require.Equal(t, runID, runProperty.TargetID)
		require.Equal(t, playbookProperty.ID, runProperty.Attrs[PropertyAttrsParentID])
		require.Equal(t, sortOrder, runProperty.Attrs[PropertyAttrsSortOrder])

		runOptions, ok := runProperty.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.PluginPropertyOption])
		require.True(t, ok)
		require.Len(t, runOptions, 2)

		require.Equal(t, originalOptions[0].GetName(), runOptions[0].GetName())
		require.Equal(t, originalOptions[1].GetName(), runOptions[1].GetName())

		require.NotEqual(t, originalOptions[0].GetID(), runOptions[0].GetID())
		require.NotEqual(t, originalOptions[1].GetID(), runOptions[1].GetID())
		require.NotEqual(t, runOptions[0].GetID(), runOptions[1].GetID())
		require.NotEmpty(t, runOptions[0].GetID())
		require.NotEmpty(t, runOptions[1].GetID())
	})
}


func TestPropertyService_validateSelectValue(t *testing.T) {
	s := &propertyService{}

	// Create a test property field with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")

	propertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	tests := []struct {
		name        string
		value       string
		expectError bool
	}{
		{
			name:        "valid option ID",
			value:       "opt1",
			expectError: false,
		},
		{
			name:        "another valid option ID",
			value:       "opt2",
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       "invalid-option",
			expectError: true,
		},
		{
			name:        "empty string is allowed",
			value:       "",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.validateSelectValue(propertyField, tt.value)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPropertyService_validateMultiselectValue(t *testing.T) {
	s := &propertyService{}

	// Create a test property field with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")
	option3 := model.NewPluginPropertyOption("opt3", "Option 3")

	propertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeMultiselect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2, option3},
		},
	}

	tests := []struct {
		name        string
		value       []string
		expectError bool
	}{
		{
			name:        "single valid option",
			value:       []string{"opt1"},
			expectError: false,
		},
		{
			name:        "multiple valid options",
			value:       []string{"opt1", "opt3"},
			expectError: false,
		},
		{
			name:        "all valid options",
			value:       []string{"opt1", "opt2", "opt3"},
			expectError: false,
		},
		{
			name:        "empty array",
			value:       []string{},
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       []string{"invalid-option"},
			expectError: true,
		},
		{
			name:        "mix of valid and invalid options",
			value:       []string{"opt1", "invalid-option"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.validateMultiselectValue(propertyField, tt.value)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}


func TestPropertyService_sanitizeTextValue(t *testing.T) {
	s := &propertyService{}

	tests := []struct {
		name           string
		input          string
		expectedOutput string
	}{
		{
			name:           "trim leading and trailing spaces",
			input:          "  hello world  ",
			expectedOutput: "hello world",
		},
		{
			name:           "trim only leading spaces",
			input:          "  hello world",
			expectedOutput: "hello world",
		},
		{
			name:           "trim only trailing spaces",
			input:          "hello world  ",
			expectedOutput: "hello world",
		},
		{
			name:           "no spaces to trim",
			input:          "hello world",
			expectedOutput: "hello world",
		},
		{
			name:           "empty string remains empty",
			input:          "",
			expectedOutput: "",
		},
		{
			name:           "string with only spaces becomes empty",
			input:          "   ",
			expectedOutput: "",
		},
		{
			name:           "empty string is allowed",
			input:          "",
			expectedOutput: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := s.sanitizeTextValue(tt.input)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedOutput, result)
		})
	}
}

func TestPropertyService_sanitizeAndValidatePropertyValue(t *testing.T) {
	s := &propertyService{}

	// Create test property fields with options
	option1 := model.NewPluginPropertyOption("opt1", "Option 1")
	option2 := model.NewPluginPropertyOption("opt2", "Option 2")

	selectPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	multiselectPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeMultiselect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1, option2},
		},
	}

	textPropertyField := &model.PropertyField{
		Type: model.PropertyFieldTypeText,
	}

	tests := []struct {
		name           string
		propertyField  *model.PropertyField
		input          json.RawMessage
		expectedOutput json.RawMessage
		expectError    bool
	}{
		// Text field tests
		{
			name:           "text field trims spaces",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`"  hello world  "`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "text field allows empty string",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`""`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:          "text field rejects non-string",
			propertyField: textPropertyField,
			input:         json.RawMessage(`123`),
			expectError:   true,
		},
		{
			name:           "text field allows null",
			propertyField:  textPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Select field tests
		{
			name:           "select field allows valid option",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`"opt1"`),
			expectedOutput: json.RawMessage(`"opt1"`),
			expectError:    false,
		},
		{
			name:           "select field allows empty string",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`""`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:          "select field rejects invalid option",
			propertyField: selectPropertyField,
			input:         json.RawMessage(`"invalid-option"`),
			expectError:   true,
		},
		{
			name:          "select field rejects non-string",
			propertyField: selectPropertyField,
			input:         json.RawMessage(`123`),
			expectError:   true,
		},
		{
			name:           "select field allows null",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Multiselect field tests
		{
			name:           "multiselect field allows valid options",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`["opt1", "opt2"]`),
			expectedOutput: json.RawMessage(`["opt1", "opt2"]`),
			expectError:    false,
		},
		{
			name:           "multiselect field allows empty array",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`[]`),
			expectedOutput: json.RawMessage(`[]`),
			expectError:    false,
		},
		{
			name:          "multiselect field rejects invalid option",
			propertyField: multiselectPropertyField,
			input:         json.RawMessage(`["invalid-option"]`),
			expectError:   true,
		},
		{
			name:          "multiselect field rejects non-array",
			propertyField: multiselectPropertyField,
			input:         json.RawMessage(`"opt1"`),
			expectError:   true,
		},
		{
			name:           "multiselect field allows null",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		// Empty value tests
		{
			name:           "text field allows empty RawMessage",
			propertyField:  textPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
		{
			name:           "select field allows empty RawMessage",
			propertyField:  selectPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
		{
			name:           "multiselect field allows empty RawMessage",
			propertyField:  multiselectPropertyField,
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := s.sanitizeAndValidatePropertyValue(tt.propertyField, tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, string(tt.expectedOutput), string(result))
			}
		})
	}
}

