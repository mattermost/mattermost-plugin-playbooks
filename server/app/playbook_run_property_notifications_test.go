// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPlaybookRunServiceImpl_propertyValuesEqual(t *testing.T) {
	service := &PlaybookRunServiceImpl{}

	t.Run("text field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		// Both nil values are equal
		result := service.propertyValuesEqual(field, nil, nil)
		require.True(t, result)

		// Both empty values are equal
		result = service.propertyValuesEqual(field, json.RawMessage(""), json.RawMessage(""))
		require.True(t, result)

		// Null strings are treated as empty
		result = service.propertyValuesEqual(field, json.RawMessage("null"), json.RawMessage(""))
		require.True(t, result)

		result = service.propertyValuesEqual(field, json.RawMessage(""), json.RawMessage("null"))
		require.True(t, result)

		// Identical non-empty values are equal
		val1 := json.RawMessage(`"test value"`)
		val2 := json.RawMessage(`"test value"`)
		result = service.propertyValuesEqual(field, val1, val2)
		require.True(t, result)

		// Different non-empty values are not equal
		val3 := json.RawMessage(`"value1"`)
		val4 := json.RawMessage(`"value2"`)
		result = service.propertyValuesEqual(field, val3, val4)
		require.False(t, result)

		// Empty quoted string vs null
		val5 := json.RawMessage(`""`)
		val6 := json.RawMessage("null")
		result = service.propertyValuesEqual(field, val5, val6)
		require.True(t, result) // Both are treated as empty for text fields
	})

	t.Run("select field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "select"}}

		// Same option IDs
		val1 := json.RawMessage(`"option1"`)
		val2 := json.RawMessage(`"option1"`)
		result := service.propertyValuesEqual(field, val1, val2)
		require.True(t, result)

		// Different option IDs
		val3 := json.RawMessage(`"option1"`)
		val4 := json.RawMessage(`"option2"`)
		result = service.propertyValuesEqual(field, val3, val4)
		require.False(t, result)
	})

	t.Run("multiselect field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "multiselect"}}

		// Same arrays
		val1 := json.RawMessage(`["item1", "item2"]`)
		val2 := json.RawMessage(`["item1", "item2"]`)
		result := service.propertyValuesEqual(field, val1, val2)
		require.True(t, result)

		// Different arrays
		val3 := json.RawMessage(`["item1", "item3"]`)
		result = service.propertyValuesEqual(field, val1, val3)
		require.False(t, result)

		// Different order (should be equal for multiselect)
		val4 := json.RawMessage(`["item2", "item1"]`)
		result = service.propertyValuesEqual(field, val1, val4)
		require.True(t, result)

		// Empty arrays
		val5 := json.RawMessage(`[]`)
		val6 := json.RawMessage(`[]`)
		result = service.propertyValuesEqual(field, val5, val6)
		require.True(t, result)

		// Null vs empty array
		val7 := json.RawMessage("null")
		result = service.propertyValuesEqual(field, val5, val7)
		require.True(t, result)
	})
}

func TestPlaybookRunServiceImpl_formatPropertyValueForDisplay(t *testing.T) {
	service := &PlaybookRunServiceImpl{}

	t.Run("handles empty/null values", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result := service.formatPropertyValueForDisplay(field, nil)
		require.Equal(t, "(empty)", result)

		result = service.formatPropertyValueForDisplay(field, json.RawMessage(""))
		require.Equal(t, "(empty)", result)

		result = service.formatPropertyValueForDisplay(field, json.RawMessage("null"))
		require.Equal(t, "(empty)", result)

		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`""`))
		require.Equal(t, "(empty)", result)
	})

	t.Run("text field formatting", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		// Normal text
		result := service.formatPropertyValueForDisplay(field, json.RawMessage(`"Hello World"`))
		require.Equal(t, "Hello World", result)

		// Long text gets truncated
		longText := string(make([]byte, 60)) // 60 character string
		for i := range longText {
			longText = longText[:i] + "a" + longText[i+1:]
		}
		longValue, _ := json.Marshal(longText)
		result = service.formatPropertyValueForDisplay(field, longValue)
		require.Len(t, result, 50) // 47 chars + "..."
		require.True(t, len(result) > 47 && result[47:] == "...")

		// Invalid JSON falls back to raw string
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid json`))
		require.Equal(t, "invalid json", result)
	})

	t.Run("select field formatting", func(t *testing.T) {
		option1 := model.NewPluginPropertyOption("opt1", "High Priority")
		option2 := model.NewPluginPropertyOption("opt2", "Low Priority")

		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "select"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option1, option2},
			},
		}

		// Valid option ID shows label
		result := service.formatPropertyValueForDisplay(field, json.RawMessage(`"opt1"`))
		require.Equal(t, "High Priority", result)

		// Invalid option ID shows the ID itself
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`"unknown"`))
		require.Equal(t, "unknown", result)

		// Invalid JSON falls back to raw string
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid`))
		require.Equal(t, "invalid", result)
	})

	t.Run("multiselect field formatting", func(t *testing.T) {
		option1 := model.NewPluginPropertyOption("opt1", "Security")
		option2 := model.NewPluginPropertyOption("opt2", "Performance")
		option3 := model.NewPluginPropertyOption("opt3", "Bug Fix")

		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "multiselect"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{option1, option2, option3},
			},
		}

		// Multiple valid options
		result := service.formatPropertyValueForDisplay(field, json.RawMessage(`["opt1", "opt3"]`))
		require.Equal(t, "Security, Bug Fix", result)

		// Empty array
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`[]`))
		require.Equal(t, "(empty)", result)

		// Mix of valid and invalid options
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`["opt1", "unknown", "opt2"]`))
		require.Equal(t, "Security, unknown, Performance", result)

		// Invalid JSON falls back to raw string
		result = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid`))
		require.Equal(t, "invalid", result)
	})

	t.Run("unknown field type falls back to raw value", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "unknown"}}

		result := service.formatPropertyValueForDisplay(field, json.RawMessage(`{"complex": "object"}`))
		require.Equal(t, `{"complex": "object"}`, result)
	})
}
