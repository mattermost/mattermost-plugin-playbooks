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

func TestPropertyService_validateTextValue(t *testing.T) {
	s := &propertyService{}

	tests := []struct {
		name        string
		value       json.RawMessage
		expectError bool
	}{
		{
			name:        "valid string value",
			value:       json.RawMessage(`"hello world"`),
			expectError: false,
		},
		{
			name:        "empty string value",
			value:       json.RawMessage(`""`),
			expectError: false,
		},
		{
			name:        "null value",
			value:       json.RawMessage(`null`),
			expectError: false,
		},
		{
			name:        "empty value",
			value:       json.RawMessage(``),
			expectError: false,
		},
		{
			name:        "number value should fail",
			value:       json.RawMessage(`123`),
			expectError: true,
		},
		{
			name:        "boolean value should fail",
			value:       json.RawMessage(`true`),
			expectError: true,
		},
		{
			name:        "array value should fail",
			value:       json.RawMessage(`["test"]`),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.validateTextValue(tt.value)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
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
		value       json.RawMessage
		expectError bool
	}{
		{
			name:        "valid option ID",
			value:       json.RawMessage(`"opt1"`),
			expectError: false,
		},
		{
			name:        "another valid option ID",
			value:       json.RawMessage(`"opt2"`),
			expectError: false,
		},
		{
			name:        "null value",
			value:       json.RawMessage(`null`),
			expectError: false,
		},
		{
			name:        "empty value",
			value:       json.RawMessage(``),
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       json.RawMessage(`"invalid-option"`),
			expectError: true,
		},
		{
			name:        "number value should fail",
			value:       json.RawMessage(`123`),
			expectError: true,
		},
		{
			name:        "array value should fail",
			value:       json.RawMessage(`["opt1"]`),
			expectError: true,
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
		value       json.RawMessage
		expectError bool
	}{
		{
			name:        "single valid option",
			value:       json.RawMessage(`["opt1"]`),
			expectError: false,
		},
		{
			name:        "multiple valid options",
			value:       json.RawMessage(`["opt1", "opt3"]`),
			expectError: false,
		},
		{
			name:        "all valid options",
			value:       json.RawMessage(`["opt1", "opt2", "opt3"]`),
			expectError: false,
		},
		{
			name:        "empty array",
			value:       json.RawMessage(`[]`),
			expectError: false,
		},
		{
			name:        "null value",
			value:       json.RawMessage(`null`),
			expectError: false,
		},
		{
			name:        "empty value",
			value:       json.RawMessage(``),
			expectError: false,
		},
		{
			name:        "invalid option ID",
			value:       json.RawMessage(`["invalid-option"]`),
			expectError: true,
		},
		{
			name:        "mix of valid and invalid options",
			value:       json.RawMessage(`["opt1", "invalid-option"]`),
			expectError: true,
		},
		{
			name:        "string value should fail",
			value:       json.RawMessage(`"opt1"`),
			expectError: true,
		},
		{
			name:        "number value should fail",
			value:       json.RawMessage(`123`),
			expectError: true,
		},
		{
			name:        "array with numbers should fail",
			value:       json.RawMessage(`[123, 456]`),
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

func TestPropertyService_validatePropertyValue(t *testing.T) {
	s := &propertyService{}

	tests := []struct {
		name        string
		fieldType   model.PropertyFieldType
		value       json.RawMessage
		expectError bool
	}{
		{
			name:        "text field with string value",
			fieldType:   model.PropertyFieldTypeText,
			value:       json.RawMessage(`"test"`),
			expectError: false,
		},
		{
			name:        "text field with invalid value",
			fieldType:   model.PropertyFieldTypeText,
			value:       json.RawMessage(`123`),
			expectError: true,
		},
		{
			name:        "unsupported field type should fail",
			fieldType:   model.PropertyFieldTypeDate,
			value:       json.RawMessage(`"2023-01-01"`),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			propertyField := &model.PropertyField{
				Type: tt.fieldType,
			}

			// For select/multiselect tests, add some options
			if tt.fieldType == model.PropertyFieldTypeSelect || tt.fieldType == model.PropertyFieldTypeMultiselect {
				option1 := model.NewPluginPropertyOption("opt1", "Option 1")
				propertyField.Attrs = model.StringInterface{
					model.PropertyFieldAttributeOptions: []*model.PluginPropertyOption{option1},
				}
			}

			err := s.validatePropertyValue(propertyField, tt.value)
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
		input          json.RawMessage
		expectedOutput json.RawMessage
		expectError    bool
	}{
		{
			name:           "trim leading and trailing spaces",
			input:          json.RawMessage(`"  hello world  "`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "trim only leading spaces",
			input:          json.RawMessage(`"  hello world"`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "trim only trailing spaces",
			input:          json.RawMessage(`"hello world  "`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "no spaces to trim",
			input:          json.RawMessage(`"hello world"`),
			expectedOutput: json.RawMessage(`"hello world"`),
			expectError:    false,
		},
		{
			name:           "empty string remains empty",
			input:          json.RawMessage(`""`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:           "string with only spaces becomes empty",
			input:          json.RawMessage(`"   "`),
			expectedOutput: json.RawMessage(`""`),
			expectError:    false,
		},
		{
			name:           "null value passes through",
			input:          json.RawMessage(`null`),
			expectedOutput: json.RawMessage(`null`),
			expectError:    false,
		},
		{
			name:           "empty value passes through",
			input:          json.RawMessage(``),
			expectedOutput: json.RawMessage(``),
			expectError:    false,
		},
		{
			name:           "non-string value passes through unchanged",
			input:          json.RawMessage(`123`),
			expectedOutput: json.RawMessage(`123`),
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := s.sanitizeTextValue(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, string(tt.expectedOutput), string(result))
			}
		})
	}
}

func TestPropertyService_sanitizePropertyValue(t *testing.T) {
	s := &propertyService{}

	tests := []struct {
		name           string
		fieldType      model.PropertyFieldType
		input          json.RawMessage
		expectedOutput json.RawMessage
		expectError    bool
	}{
		{
			name:           "text field gets trimmed",
			fieldType:      model.PropertyFieldTypeText,
			input:          json.RawMessage(`"  hello  "`),
			expectedOutput: json.RawMessage(`"hello"`),
			expectError:    false,
		},
		{
			name:           "select field passes through",
			fieldType:      model.PropertyFieldTypeSelect,
			input:          json.RawMessage(`"option1"`),
			expectedOutput: json.RawMessage(`"option1"`),
			expectError:    false,
		},
		{
			name:           "multiselect field passes through",
			fieldType:      model.PropertyFieldTypeMultiselect,
			input:          json.RawMessage(`["option1", "option2"]`),
			expectedOutput: json.RawMessage(`["option1", "option2"]`),
			expectError:    false,
		},
		{
			name:           "unsupported field type passes through",
			fieldType:      model.PropertyFieldTypeDate,
			input:          json.RawMessage(`"2023-01-01"`),
			expectedOutput: json.RawMessage(`"2023-01-01"`),
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			propertyField := &model.PropertyField{
				Type: tt.fieldType,
			}

			result, err := s.sanitizePropertyValue(propertyField, tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, string(tt.expectedOutput), string(result))
			}
		})
	}
}
