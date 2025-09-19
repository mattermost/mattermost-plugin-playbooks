// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCondition_Evaluate(t *testing.T) {
	propertyFields, propertyValues := createTestFieldsAndValues(t)

	t.Run("is condition - match", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("is condition - no match", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["low_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("is condition - field not exists", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "nonexistent_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - match", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - no match", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("isNot condition - field not exists", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "nonexistent_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("and condition - all true", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("and condition - one false", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("or condition - one true", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("or condition - all false", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id"]`),
					},
				},
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("nested conditions", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							Is: &ComparisonCondition{
								FieldID: "priority_id",
								Value:   json.RawMessage(`["high_priority_id"]`),
							},
						},
					},
				},
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - is condition matches one of values", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_b_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - is condition no match", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_z_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - isNot condition when value not in array", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_z_id"]`),
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("multiselect - isNot condition when value in array", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_b_id"]`),
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("empty condition", func(t *testing.T) {
		condition := &ConditionExpr{}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("text field case insensitive match", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"FALSE"`), // uppercase should match lowercase "false" in test data
			},
		}
		require.True(t, condition.Evaluate(propertyFields, propertyValues))
	})

	t.Run("text field case insensitive no match", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"FALSE"`), // uppercase should match lowercase "false" in test data, so isNot should return false
			},
		}
		require.False(t, condition.Evaluate(propertyFields, propertyValues))
	})
}

func TestCondition_JSON(t *testing.T) {
	t.Run("marshal and unmarshal simple is condition", func(t *testing.T) {
		original := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["Critical"]`),
			},
		}

		data, err := json.Marshal(original)
		require.NoError(t, err)

		var unmarshaled ConditionExpr
		err = json.Unmarshal(data, &unmarshaled)
		require.NoError(t, err)

		require.NotNil(t, unmarshaled.Is)
		require.Equal(t, "severity_id", unmarshaled.Is.FieldID)
		require.Equal(t, json.RawMessage(`["Critical"]`), unmarshaled.Is.Value)
		require.Nil(t, unmarshaled.IsNot)
		require.Nil(t, unmarshaled.And)
		require.Nil(t, unmarshaled.Or)
	})

	t.Run("marshal and unmarshal nested conditions", func(t *testing.T) {
		original := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}

		data, err := json.Marshal(original)
		require.NoError(t, err)

		var unmarshaled ConditionExpr
		err = json.Unmarshal(data, &unmarshaled)
		require.NoError(t, err)

		require.Len(t, unmarshaled.And, 2)
		require.NotNil(t, unmarshaled.And[0].Is)
		require.Equal(t, "severity_id", unmarshaled.And[0].Is.FieldID)
		require.Len(t, unmarshaled.And[1].Or, 2)
		require.NotNil(t, unmarshaled.And[1].Or[0].Is)
		require.Equal(t, "status_id", unmarshaled.And[1].Or[0].Is.FieldID)
		require.NotNil(t, unmarshaled.And[1].Or[1].IsNot)
		require.Equal(t, "acknowledged_id", unmarshaled.And[1].Or[1].IsNot.FieldID)
	})

	t.Run("unmarshal from JSON string", func(t *testing.T) {
		jsonStr := `{
			"and": [
				{
					"is": {
						"field_id": "severity_id",
						"value": ["Critical"]
					}
				},
				{
					"isNot": {
						"field_id": "acknowledged_id",
						"value": "true"
					}
				}
			]
		}`

		var condition ConditionExpr
		err := json.Unmarshal([]byte(jsonStr), &condition)
		require.NoError(t, err)

		require.Len(t, condition.And, 2)
		require.NotNil(t, condition.And[0].Is)
		require.Equal(t, "severity_id", condition.And[0].Is.FieldID)
		require.Equal(t, json.RawMessage(`["Critical"]`), condition.And[0].Is.Value)
		require.NotNil(t, condition.And[1].IsNot)
		require.Equal(t, "acknowledged_id", condition.And[1].IsNot.FieldID)
		require.Equal(t, json.RawMessage(`"true"`), condition.And[1].IsNot.Value)
	})
}

func TestIsFunction(t *testing.T) {
	t.Run("text field - match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := is(field, pv, json.RawMessage(`"Hello World"`))
		require.True(t, result)
	})

	t.Run("text field - no match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := is(field, pv, json.RawMessage(`"Goodbye"`))
		require.False(t, result)
	})

	t.Run("text field - case insensitive match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := is(field, pv, json.RawMessage(`"hello world"`))
		require.True(t, result)
	})

	t.Run("text field - case insensitive with mixed case", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := is(field, pv, json.RawMessage(`"HeLLo WoRLd"`))
		require.True(t, result)
	})

	t.Run("select field - match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "select_field",
				Type: model.PropertyFieldTypeSelect,
			},
		}
		pv := PropertyValue{
			FieldID: "select_field",
			Value:   json.RawMessage(`"Option1"`),
		}
		result := is(field, pv, json.RawMessage(`["Option1"]`))
		require.True(t, result)
	})

	t.Run("select field - case sensitive no match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "select_field",
				Type: model.PropertyFieldTypeSelect,
			},
		}
		pv := PropertyValue{
			FieldID: "select_field",
			Value:   json.RawMessage(`"Option1"`),
		}
		result := is(field, pv, json.RawMessage(`["option1"]`))
		require.False(t, result)
	})

	t.Run("multiselect field - contains value", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "multiselect_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "multiselect_field",
			Value:   json.RawMessage(`["A", "B", "C"]`),
		}
		result := is(field, pv, json.RawMessage(`["B"]`))
		require.True(t, result)
	})

	t.Run("multiselect field - does not contain value", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "multiselect_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "multiselect_field",
			Value:   json.RawMessage(`["A", "B", "C"]`),
		}
		result := is(field, pv, json.RawMessage(`["D"]`))
		require.False(t, result)
	})

	t.Run("multiselect field - empty array", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "multiselect_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "multiselect_field",
			Value:   json.RawMessage(`[]`),
		}
		result := is(field, pv, json.RawMessage(`["A"]`))
		require.False(t, result)
	})

	t.Run("nil value", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "empty_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "empty_field",
			Value:   nil,
		}
		result := is(field, pv, json.RawMessage(`"anything"`))
		require.False(t, result)
	})

	t.Run("invalid json for text field", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "invalid_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "invalid_field",
			Value:   json.RawMessage(`invalid json`),
		}
		result := is(field, pv, json.RawMessage(`"anything"`))
		require.False(t, result)
	})

	t.Run("invalid json for multiselect field", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "invalid_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "invalid_field",
			Value:   json.RawMessage(`invalid json`),
		}
		result := is(field, pv, json.RawMessage(`"anything"`))
		require.False(t, result)
	})
}

func TestIsNotFunction(t *testing.T) {
	t.Run("text field - not match", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := isNot(field, pv, json.RawMessage(`"Goodbye"`))
		require.True(t, result)
	})

	t.Run("text field - match (should return false)", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := isNot(field, pv, json.RawMessage(`"Hello World"`))
		require.False(t, result)
	})

	t.Run("text field - case insensitive match (should return false)", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "text_field",
				Type: model.PropertyFieldTypeText,
			},
		}
		pv := PropertyValue{
			FieldID: "text_field",
			Value:   json.RawMessage(`"Hello World"`),
		}
		result := isNot(field, pv, json.RawMessage(`"hello world"`))
		require.False(t, result)
	})

	t.Run("multiselect field - does not contain value", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "multiselect_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "multiselect_field",
			Value:   json.RawMessage(`["A", "B", "C"]`),
		}
		result := isNot(field, pv, json.RawMessage(`["D"]`))
		require.True(t, result)
	})

	t.Run("multiselect field - contains value (should return false)", func(t *testing.T) {
		field := PropertyField{
			PropertyField: model.PropertyField{
				ID:   "multiselect_field",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}
		pv := PropertyValue{
			FieldID: "multiselect_field",
			Value:   json.RawMessage(`["A", "B", "C"]`),
		}
		result := isNot(field, pv, json.RawMessage(`["B"]`))
		require.False(t, result)
	})
}

func TestCondition_Validate(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("valid is condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid isNot condition", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid and condition", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("valid or condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("empty condition fails", func(t *testing.T) {
		condition := &ConditionExpr{}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition must have at least one operation")
	})

	t.Run("multiple operations fails", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition can only have one operation")
	})

	t.Run("empty and condition fails", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "and condition must have at least one nested condition")
	})

	t.Run("empty or condition fails", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "or condition must have at least one nested condition")
	})

	t.Run("nested condition validation fails", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})

	t.Run("depth limit validation - valid depth", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"value1"`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"value2"`),
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.NoError(t, err)
	})

	t.Run("depth limit validation - exceeds depth", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Or: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "field1",
								Value:   json.RawMessage(`"value1"`),
							},
						},
					},
				},
			},
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition nesting depth exceeds maximum allowed")
	})
}

func TestComparisonCondition_Validate(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("valid comparison condition", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "severity_id",
			Value:   json.RawMessage(`["critical_id"]`),
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("empty field_id fails", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "",
			Value:   json.RawMessage(`["critical_id"]`),
		}
		err := condition.Validate(propertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})

	t.Run("empty value is allowed", func(t *testing.T) {
		condition := &ComparisonCondition{
			FieldID: "acknowledged_id",
			Value:   json.RawMessage(`""`),
		}
		require.NoError(t, condition.Validate(propertyFields))
	})

	t.Run("select field with no options should fail", func(t *testing.T) {
		// Create a select field with no options
		emptySelectFields := []PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "empty_select_id",
					Type: model.PropertyFieldTypeSelect,
				},
				Attrs: Attrs{
					Options: model.PropertyOptions[*model.PluginPropertyOption]{},
				},
			},
		}

		condition := &ComparisonCondition{
			FieldID: "empty_select_id",
			Value:   json.RawMessage(`["any_value"]`),
		}
		err := condition.Validate(emptySelectFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition value does not match any valid option for select field")
	})

	t.Run("multiselect field with no options should fail", func(t *testing.T) {
		// Create a multiselect field with no options
		emptyMultiselectFields := []PropertyField{
			{
				PropertyField: model.PropertyField{
					ID:   "empty_multiselect_id",
					Type: model.PropertyFieldTypeMultiselect,
				},
				Attrs: Attrs{
					Options: model.PropertyOptions[*model.PluginPropertyOption]{},
				},
			},
		}

		condition := &ComparisonCondition{
			FieldID: "empty_multiselect_id",
			Value:   json.RawMessage(`["any_value"]`),
		}
		err := condition.Validate(emptyMultiselectFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition value does not match any valid option for multiselect field")
	})
}

func TestCondition_Sanitize(t *testing.T) {
	t.Run("sanitize is condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "field1",
				Value:   json.RawMessage(`"  trimmed value  "`),
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"trimmed value"`), condition.Is.Value)
	})

	t.Run("sanitize isNot condition", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "field1",
				Value:   json.RawMessage(`"\t  spaced\n  "`),
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"spaced"`), condition.IsNot.Value)
	})

	t.Run("sanitize nested and conditions", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"  value1  "`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"  value2  "`),
					},
				},
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"value1"`), condition.And[0].Is.Value)
		require.Equal(t, json.RawMessage(`"value2"`), condition.And[1].IsNot.Value)
	})

	t.Run("sanitize nested or conditions", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "field1",
						Value:   json.RawMessage(`"  or_value1  "`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "field2",
						Value:   json.RawMessage(`"  or_value2  "`),
					},
				},
			},
		}
		condition.Sanitize()
		require.Equal(t, json.RawMessage(`"or_value1"`), condition.Or[0].Is.Value)
		require.Equal(t, json.RawMessage(`"or_value2"`), condition.Or[1].IsNot.Value)
	})
}

func TestComparisonCondition_Sanitize(t *testing.T) {
	t.Run("trim spaces from value", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"  test value  "`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`"test value"`), cc.Value)
	})

	t.Run("trim tabs and newlines", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"\t\n  test  \n\t"`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`"test"`), cc.Value)
	})

	t.Run("empty value after trimming", func(t *testing.T) {
		cc := &ComparisonCondition{
			FieldID: "field1",
			Value:   json.RawMessage(`"   "`),
		}
		cc.Sanitize()
		require.Equal(t, json.RawMessage(`""`), cc.Value)
	})
}

// Test helper function that creates property fields with corresponding values
func createTestFieldsAndValues(t *testing.T) ([]PropertyField, []PropertyValue) {
	t.Helper()

	fields := []PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "severity_id",
				Name: "Severity",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("critical_id", "Critical"),
					model.NewPluginPropertyOption("high_id", "High"),
					model.NewPluginPropertyOption("medium_id", "Medium"),
					model.NewPluginPropertyOption("low_id", "Low"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "acknowledged_id",
				Name: "Acknowledged",
				Type: model.PropertyFieldTypeText,
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "status_id",
				Name: "Status",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("open_id", "Open"),
					model.NewPluginPropertyOption("closed_id", "Closed"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "priority_id",
				Name: "Priority",
				Type: model.PropertyFieldTypeSelect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("urgent_id", "Urgent"),
					model.NewPluginPropertyOption("high_priority_id", "High"),
					model.NewPluginPropertyOption("normal_id", "Normal"),
				},
			},
		},
		{
			PropertyField: model.PropertyField{
				ID:   "categories_id",
				Name: "Categories",
				Type: model.PropertyFieldTypeMultiselect,
			},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{
					model.NewPluginPropertyOption("cat_a_id", "Category A"),
					model.NewPluginPropertyOption("cat_b_id", "Category B"),
					model.NewPluginPropertyOption("cat_c_id", "Category C"),
				},
			},
		},
	}

	values := []PropertyValue{
		{
			FieldID: "severity_id",
			Value:   json.RawMessage(`"critical_id"`),
		},
		{
			FieldID: "acknowledged_id",
			Value:   json.RawMessage(`"false"`),
		},
		{
			FieldID: "status_id",
			Value:   json.RawMessage(`"open_id"`),
		},
		{
			FieldID: "priority_id",
			Value:   json.RawMessage(`"high_priority_id"`),
		},
		{
			FieldID: "categories_id",
			Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
		},
	}

	return fields, values
}

func TestCondition_ToString(t *testing.T) {
	propertyFields, _ := createTestFieldsAndValues(t)

	t.Run("simple is condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Severity is Critical", result)
	})

	t.Run("simple isNot condition", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"false"`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Acknowledged is not false", result)
	})

	t.Run("single value array condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "status_id",
				Value:   json.RawMessage(`["open_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Status is Open", result)
	})

	t.Run("multi value array condition", func(t *testing.T) {
		condition := &ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "categories_id",
				Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Categories is not [Category A,Category B]", result)
	})

	t.Run("and condition", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Severity is Critical AND Acknowledged is not true", result)
	})

	t.Run("or condition", func(t *testing.T) {
		condition := &ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Severity is Low OR Priority is High", result)
	})

	t.Run("nested conditions", func(t *testing.T) {
		condition := &ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}
		result := condition.ToString(propertyFields)
		require.Equal(t, "Severity is Critical AND (Status is Open OR Acknowledged is not true)", result)
	})

}

func TestCondition_IsValid(t *testing.T) {
	validConditionExpr := ConditionExpr{
		Is: &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`"test_value"`),
		},
	}

	// Create basic property fields for testing
	testPropertyFields := []PropertyField{
		{
			PropertyField: model.PropertyField{
				ID:   "test_field",
				Type: model.PropertyFieldTypeText,
			},
		},
	}

	t.Run("creation validation - valid condition", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.NoError(t, err)
	})

	t.Run("creation validation - ID should not be specified", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID should not be specified for creation")
	})

	t.Run("creation validation - playbook ID required", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExpr,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "playbook ID is required")
	})

	t.Run("creation validation - run conditions cannot be created directly", func(t *testing.T) {
		condition := Condition{
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "run_123",
		}
		err := condition.IsValid(true, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "run conditions cannot be created directly")
	})

	t.Run("update validation - valid condition", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.NoError(t, err)
	})

	t.Run("update validation - ID required for updates", func(t *testing.T) {
		condition := Condition{
			ID:            "",
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID is required for updates")
	})

	t.Run("update validation - playbook ID required", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExpr,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "playbook ID is required")
	})

	t.Run("update validation - run conditions cannot be modified", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: validConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "run_123",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "run conditions cannot be modified")
	})

	t.Run("validation - invalid condition expression", func(t *testing.T) {
		invalidConditionExpr := ConditionExpr{
			// Empty condition - should fail validation
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: invalidConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
	})

	t.Run("validation - multiple validation errors prioritize by order", func(t *testing.T) {
		invalidConditionExpr := ConditionExpr{}
		condition := Condition{
			ID:            "",
			ConditionExpr: invalidConditionExpr,
			PlaybookID:    "",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "condition ID is required for updates")
	})

	t.Run("validation - condition expression with invalid field type", func(t *testing.T) {
		invalidConditionExpr := ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "test_field",
				Value:   json.RawMessage(`["array", "value"]`),
			},
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: invalidConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}

		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
		require.Contains(t, err.Error(), "text field condition value must be a string")
	})

	t.Run("validation - condition expression structural validation works", func(t *testing.T) {
		invalidConditionExpr := ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "",
				Value:   json.RawMessage(`"test"`),
			},
		}
		condition := Condition{
			ID:            "condition_123",
			ConditionExpr: invalidConditionExpr,
			PlaybookID:    "playbook_123",
			RunID:         "",
		}
		err := condition.IsValid(false, testPropertyFields)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid condition expression")
		require.Contains(t, err.Error(), "field_id cannot be empty")
	})
}

func TestExtractPropertyOptionsIDs(t *testing.T) {
	t.Run("simple is condition with select field", func(t *testing.T) {
		condition := ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id", "high_id"]`),
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 2)
		require.Contains(t, optionsIDs, "critical_id")
		require.Contains(t, optionsIDs, "high_id")
	})

	t.Run("simple isNot condition with single option", func(t *testing.T) {
		condition := ConditionExpr{
			IsNot: &ComparisonCondition{
				FieldID: "status_id",
				Value:   json.RawMessage(`["open_id"]`),
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 1)
		require.Contains(t, optionsIDs, "open_id")
	})

	t.Run("text field condition should return empty", func(t *testing.T) {
		condition := ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 0)
	})

	t.Run("and condition with multiple select fields", func(t *testing.T) {
		condition := ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["closed_id", "open_id"]`),
					},
				},
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 3)
		require.Contains(t, optionsIDs, "critical_id")
		require.Contains(t, optionsIDs, "closed_id")
		require.Contains(t, optionsIDs, "open_id")
	})

	t.Run("or condition with multiselect field", func(t *testing.T) {
		condition := ConditionExpr{
			Or: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "categories_id",
						Value:   json.RawMessage(`["cat_a_id", "cat_b_id"]`),
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 3)
		require.Contains(t, optionsIDs, "cat_a_id")
		require.Contains(t, optionsIDs, "cat_b_id")
		require.Contains(t, optionsIDs, "high_priority_id")
	})

	t.Run("nested conditions with mixed field types", func(t *testing.T) {
		condition := ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 2)
		require.Contains(t, optionsIDs, "critical_id")
		require.Contains(t, optionsIDs, "open_id")
	})

	t.Run("duplicate options IDs are deduplicated", func(t *testing.T) {
		condition := ConditionExpr{
			And: []ConditionExpr{
				{
					Is: &ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id", "high_id"]`),
					},
				},
				{
					IsNot: &ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 2)
		require.Contains(t, optionsIDs, "critical_id")
		require.Contains(t, optionsIDs, "high_id")
	})

	t.Run("empty condition returns empty slice", func(t *testing.T) {
		condition := ConditionExpr{}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 0)
	})

	t.Run("invalid JSON values are ignored", func(t *testing.T) {
		condition := ConditionExpr{
			Is: &ComparisonCondition{
				FieldID: "invalid_field",
				Value:   json.RawMessage(`invalid json`),
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 0)
	})

	t.Run("complex nested structure with duplicates", func(t *testing.T) {
		condition := ConditionExpr{
			Or: []ConditionExpr{
				{
					And: []ConditionExpr{
						{
							Is: &ComparisonCondition{
								FieldID: "field1",
								Value:   json.RawMessage(`["option1", "option2"]`),
							},
						},
						{
							IsNot: &ComparisonCondition{
								FieldID: "field2",
								Value:   json.RawMessage(`["option3"]`),
							},
						},
					},
				},
				{
					Is: &ComparisonCondition{
						FieldID: "field3",
						Value:   json.RawMessage(`["option1"]`),
					},
				},
			},
		}
		optionsIDs := extractPropertyOptionsIDs(condition)
		require.Len(t, optionsIDs, 3)
		require.Contains(t, optionsIDs, "option1")
		require.Contains(t, optionsIDs, "option2")
		require.Contains(t, optionsIDs, "option3")
	})
}

func TestExtractOptionsFromComparison(t *testing.T) {
	t.Run("array value - single option", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`["option1"]`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 1)
		_, exists := optionsIDSet["option1"]
		require.True(t, exists)
	})

	t.Run("array value - multiple options", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`["option1", "option2", "option3"]`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 3)
		_, exists1 := optionsIDSet["option1"]
		_, exists2 := optionsIDSet["option2"]
		_, exists3 := optionsIDSet["option3"]
		require.True(t, exists1)
		require.True(t, exists2)
		require.True(t, exists3)
	})

	t.Run("empty array", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`[]`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 0)
	})

	t.Run("string value - should be ignored", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "text_field",
			Value:   json.RawMessage(`"text_value"`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 0)
	})

	t.Run("invalid JSON - should be ignored", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "invalid_field",
			Value:   json.RawMessage(`invalid json`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 0)
	})

	t.Run("number value - should be ignored", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "number_field",
			Value:   json.RawMessage(`123`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 0)
	})

	t.Run("null value - should be ignored", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "null_field",
			Value:   json.RawMessage(`null`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 0)
	})

	t.Run("array with empty strings", func(t *testing.T) {
		comparison := &ComparisonCondition{
			FieldID: "test_field",
			Value:   json.RawMessage(`["", "option1", ""]`),
		}
		optionsIDSet := make(map[string]struct{})
		extractOptionsFromComparison(comparison, optionsIDSet)

		require.Len(t, optionsIDSet, 2)
		_, existsEmpty := optionsIDSet[""]
		_, existsOption1 := optionsIDSet["option1"]
		require.True(t, existsEmpty)
		require.True(t, existsOption1)
	})
}

func TestNewStoredCondition(t *testing.T) {
	t.Run("creates stored condition with field and options IDs", func(t *testing.T) {
		condition := Condition{
			ID:         "condition_123",
			PlaybookID: "playbook_456",
			RunID:      "",
			ConditionExpr: ConditionExpr{
				And: []ConditionExpr{
					{
						Is: &ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id", "high_id"]`),
						},
					},
					{
						IsNot: &ComparisonCondition{
							FieldID: "acknowledged_id",
							Value:   json.RawMessage(`"true"`),
						},
					},
					{
						Is: &ComparisonCondition{
							FieldID: "categories_id",
							Value:   json.RawMessage(`["cat_a_id"]`),
						},
					},
				},
			},
			CreateAt: 1234567890,
			UpdateAt: 1234567890,
			DeleteAt: 0,
		}

		storedCondition := NewStoredCondition(condition)

		// Check that base condition is preserved
		require.Equal(t, condition.ID, storedCondition.ID)
		require.Equal(t, condition.PlaybookID, storedCondition.PlaybookID)
		require.Equal(t, condition.RunID, storedCondition.RunID)
		require.Equal(t, condition.CreateAt, storedCondition.CreateAt)
		require.Equal(t, condition.UpdateAt, storedCondition.UpdateAt)
		require.Equal(t, condition.DeleteAt, storedCondition.DeleteAt)

		// Check property field IDs are extracted
		require.Len(t, storedCondition.PropertyFieldIDs, 3)
		require.Contains(t, storedCondition.PropertyFieldIDs, "severity_id")
		require.Contains(t, storedCondition.PropertyFieldIDs, "acknowledged_id")
		require.Contains(t, storedCondition.PropertyFieldIDs, "categories_id")

		// Check property options IDs are extracted (only from select/multiselect fields)
		require.Len(t, storedCondition.PropertyOptionsIDs, 3)
		require.Contains(t, storedCondition.PropertyOptionsIDs, "critical_id")
		require.Contains(t, storedCondition.PropertyOptionsIDs, "high_id")
		require.Contains(t, storedCondition.PropertyOptionsIDs, "cat_a_id")
	})

	t.Run("handles empty condition", func(t *testing.T) {
		condition := Condition{
			ID:            "condition_123",
			PlaybookID:    "playbook_456",
			ConditionExpr: ConditionExpr{},
		}

		storedCondition := NewStoredCondition(condition)

		require.Equal(t, condition, storedCondition.Condition)
		require.Len(t, storedCondition.PropertyFieldIDs, 0)
		require.Len(t, storedCondition.PropertyOptionsIDs, 0)
	})

	t.Run("handles condition with only text fields", func(t *testing.T) {
		condition := Condition{
			ID:         "condition_123",
			PlaybookID: "playbook_456",
			ConditionExpr: ConditionExpr{
				Is: &ComparisonCondition{
					FieldID: "text_field",
					Value:   json.RawMessage(`"text_value"`),
				},
			},
		}

		storedCondition := NewStoredCondition(condition)

		require.Equal(t, condition, storedCondition.Condition)
		require.Len(t, storedCondition.PropertyFieldIDs, 1)
		require.Contains(t, storedCondition.PropertyFieldIDs, "text_field")
		require.Len(t, storedCondition.PropertyOptionsIDs, 0)
	})

	t.Run("handles condition with duplicate field and option IDs", func(t *testing.T) {
		condition := Condition{
			ID:         "condition_123",
			PlaybookID: "playbook_456",
			ConditionExpr: ConditionExpr{
				Or: []ConditionExpr{
					{
						Is: &ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id"]`),
						},
					},
					{
						IsNot: &ComparisonCondition{
							FieldID: "severity_id",
							Value:   json.RawMessage(`["critical_id", "high_id"]`),
						},
					},
				},
			},
		}

		storedCondition := NewStoredCondition(condition)

		require.Equal(t, condition, storedCondition.Condition)
		// Field ID should be deduplicated
		require.Len(t, storedCondition.PropertyFieldIDs, 1)
		require.Contains(t, storedCondition.PropertyFieldIDs, "severity_id")
		// Options IDs should be deduplicated
		require.Len(t, storedCondition.PropertyOptionsIDs, 2)
		require.Contains(t, storedCondition.PropertyOptionsIDs, "critical_id")
		require.Contains(t, storedCondition.PropertyOptionsIDs, "high_id")
	})
}
