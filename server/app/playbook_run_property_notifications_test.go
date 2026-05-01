// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPropertyValuesEqual(t *testing.T) {
	t.Run("text field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		require.True(t, propertyValuesEqual(field, nil, nil))
		require.True(t, propertyValuesEqual(field, json.RawMessage(""), json.RawMessage("")))
		require.True(t, propertyValuesEqual(field, json.RawMessage("null"), json.RawMessage("")))
		require.True(t, propertyValuesEqual(field, json.RawMessage(""), json.RawMessage("null")))
		require.True(t, propertyValuesEqual(field, json.RawMessage(`"test value"`), json.RawMessage(`"test value"`)))
		require.False(t, propertyValuesEqual(field, json.RawMessage(`"value1"`), json.RawMessage(`"value2"`)))
		require.True(t, propertyValuesEqual(field, json.RawMessage(`""`), json.RawMessage("null")))
	})

	t.Run("select field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "select"}}

		require.True(t, propertyValuesEqual(field, json.RawMessage(`"option1"`), json.RawMessage(`"option1"`)))
		require.False(t, propertyValuesEqual(field, json.RawMessage(`"option1"`), json.RawMessage(`"option2"`)))
	})

	t.Run("multiselect field comparisons", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "multiselect"}}

		val1 := json.RawMessage(`["item1", "item2"]`)
		require.True(t, propertyValuesEqual(field, val1, json.RawMessage(`["item1", "item2"]`)))
		require.False(t, propertyValuesEqual(field, val1, json.RawMessage(`["item1", "item3"]`)))
		require.True(t, propertyValuesEqual(field, val1, json.RawMessage(`["item2", "item1"]`)))
		require.True(t, propertyValuesEqual(field, json.RawMessage(`[]`), json.RawMessage(`[]`)))
		require.True(t, propertyValuesEqual(field, json.RawMessage(`[]`), json.RawMessage("null")))
	})
}

func TestPlaybookRunServiceImpl_formatPropertyValueForDisplay(t *testing.T) {
	service := &PlaybookRunServiceImpl{}

	t.Run("handles empty/null values", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result, isEmpty := service.formatPropertyValueForDisplay(field, nil)
		require.Equal(t, "", result)
		require.True(t, isEmpty)

		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(""))
		require.Equal(t, "", result)
		require.True(t, isEmpty)

		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage("null"))
		require.Equal(t, "", result)
		require.True(t, isEmpty)

		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`""`))
		require.Equal(t, "", result)
		require.True(t, isEmpty)
	})

	t.Run("text field formatting", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		// Normal text
		result, isEmpty := service.formatPropertyValueForDisplay(field, json.RawMessage(`"Hello World"`))
		require.Equal(t, "Hello World", result)
		require.False(t, isEmpty)

		// Long text gets truncated
		longText := string(make([]byte, 60)) // 60 character string
		for i := range longText {
			longText = longText[:i] + "a" + longText[i+1:]
		}
		longValue, _ := json.Marshal(longText)
		result, isEmpty = service.formatPropertyValueForDisplay(field, longValue)
		require.Len(t, result, propertyValueMaxDisplayLength) // (propertyValueMaxDisplayLength-3) chars + "..."
		require.True(t, len(result) > propertyValueMaxDisplayLength-3 && result[propertyValueMaxDisplayLength-3:] == "...")
		require.False(t, isEmpty)

		// Invalid JSON falls back to raw string
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid json`))
		require.Equal(t, "invalid json", result)
		require.False(t, isEmpty)
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
		result, isEmpty := service.formatPropertyValueForDisplay(field, json.RawMessage(`"opt1"`))
		require.Equal(t, "High Priority", result)
		require.False(t, isEmpty)

		// Invalid option ID shows the ID itself
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`"unknown"`))
		require.Equal(t, "unknown", result)
		require.False(t, isEmpty)

		// Invalid JSON falls back to raw string
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid`))
		require.Equal(t, "invalid", result)
		require.False(t, isEmpty)
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
		result, isEmpty := service.formatPropertyValueForDisplay(field, json.RawMessage(`["opt1", "opt3"]`))
		require.Equal(t, "Security, Bug Fix", result)
		require.False(t, isEmpty)

		// Empty array
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`[]`))
		require.Equal(t, "", result)
		require.True(t, isEmpty)

		// Mix of valid and invalid options
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`["opt1", "unknown", "opt2"]`))
		require.Equal(t, "Security, unknown, Performance", result)
		require.False(t, isEmpty)

		// Invalid JSON falls back to raw string
		result, isEmpty = service.formatPropertyValueForDisplay(field, json.RawMessage(`invalid`))
		require.Equal(t, "invalid", result)
		require.False(t, isEmpty)
	})

	t.Run("unknown field type falls back to raw value", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "unknown"}}

		result, isEmpty := service.formatPropertyValueForDisplay(field, json.RawMessage(`{"complex": "object"}`))
		require.Equal(t, `{"complex": "object"}`, result)
		require.False(t, isEmpty)
	})
}
