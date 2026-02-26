// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

const (
	testFieldID1  = "fld1aaaaaaaaaaaaaaaaaaaaaa"
	testFieldID2  = "fld2aaaaaaaaaaaaaaaaaaaaaa"
	testFieldID3  = "fld3aaaaaaaaaaaaaaaaaaaaaa"
	testFieldID4  = "fld4aaaaaaaaaaaaaaaaaaaaaa"
	testFieldID5  = "fld5aaaaaaaaaaaaaaaaaaaaaa"
	testFieldID6  = "fld6aaaaaaaaaaaaaaaaaaaaaa"
	testOptionID1 = "opt1aaaaaaaaaaaaaaaaaaaaaa"
	testOptionID2 = "opt2aaaaaaaaaaaaaaaaaaaaaa"
	testOptionID3 = "opt3aaaaaaaaaaaaaaaaaaaaaa"
)

func makeField(id, name string, fieldType model.PropertyFieldType, options ...[2]string) app.PropertyField {
	opts := make(model.PropertyOptions[*model.PluginPropertyOption], 0, len(options))
	for _, o := range options {
		opts = append(opts, model.NewPluginPropertyOption(o[0], o[1]))
	}
	return app.PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: fieldType,
		},
		Attrs: app.Attrs{
			Options: opts,
		},
	}
}

func TestSeparateFlags(t *testing.T) {
	t.Run("field before flags", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"Severity", "--run", "abc123"})
		assert.Equal(t, []string{"--run", "abc123"}, flagArgs)
		assert.Equal(t, []string{"Severity"}, positional)
	})

	t.Run("field after flags", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"--run", "abc123", "Severity"})
		assert.Equal(t, []string{"--run", "abc123"}, flagArgs)
		assert.Equal(t, []string{"Severity"}, positional)
	})

	t.Run("flags only", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"--run", "abc123"})
		assert.Equal(t, []string{"--run", "abc123"}, flagArgs)
		assert.Nil(t, positional)
	})

	t.Run("positional only", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"Severity"})
		assert.Nil(t, flagArgs)
		assert.Equal(t, []string{"Severity"}, positional)
	})

	t.Run("empty args", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{})
		assert.Nil(t, flagArgs)
		assert.Nil(t, positional)
	})

	t.Run("multiple flags with positional between", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"--run", "abc123", "Severity", "--value", "High"})
		assert.Equal(t, []string{"--run", "abc123", "--value", "High"}, flagArgs)
		assert.Equal(t, []string{"Severity"}, positional)
	})

	t.Run("multiple value flags for multiselect", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"Tags", "--value", "backend", "--value", "urgent", "--run", "abc123"})
		assert.Equal(t, []string{"--value", "backend", "--value", "urgent", "--run", "abc123"}, flagArgs)
		assert.Equal(t, []string{"Tags"}, positional)
	})

	t.Run("empty value flag for clearing", func(t *testing.T) {
		flagArgs, positional := separateFlags([]string{"Severity", "--value", "", "--run", "abc123"})
		assert.Equal(t, []string{"--value", "", "--run", "abc123"}, flagArgs)
		assert.Equal(t, []string{"Severity"}, positional)
	})
}

func TestJoinFieldArg(t *testing.T) {
	t.Run("single word", func(t *testing.T) {
		assert.Equal(t, "Severity", joinFieldArg([]string{"Severity"}))
	})

	t.Run("quoted multi-word split by strings.Fields", func(t *testing.T) {
		// strings.Fields(`"Build Status"`) produces ["\"Build", "Status\""]
		assert.Equal(t, "Build Status", joinFieldArg([]string{"\"Build", "Status\""}))
	})

	t.Run("unquoted multi-word", func(t *testing.T) {
		assert.Equal(t, "Build Status", joinFieldArg([]string{"Build", "Status"}))
	})

	t.Run("empty args", func(t *testing.T) {
		assert.Equal(t, "", joinFieldArg([]string{}))
	})

	t.Run("single word with quotes", func(t *testing.T) {
		// Edge case: user wraps a single word in quotes
		assert.Equal(t, "Severity", joinFieldArg([]string{"\"Severity\""}))
	})

	t.Run("three word field name", func(t *testing.T) {
		assert.Equal(t, "My Field Name", joinFieldArg([]string{"\"My", "Field", "Name\""}))
	})
}

func TestValueQuoteStripping(t *testing.T) {
	// Simulates the quote stripping logic applied to --value arguments
	// after flag parsing in actionAttributeSet.
	strip := func(v string) string { return strings.Trim(v, "\"") }

	t.Run("empty quotes become empty string", func(t *testing.T) {
		// strings.Fields splits --value "" into the token "" (two literal quote chars)
		assert.Equal(t, "", strip(`""`))
	})

	t.Run("quoted value becomes unquoted", func(t *testing.T) {
		// strings.Fields splits --value "High" into the token "High" (with literal quotes)
		assert.Equal(t, "High", strip(`"High"`))
	})

	t.Run("unquoted value unchanged", func(t *testing.T) {
		assert.Equal(t, "High", strip("High"))
	})

	t.Run("already empty string unchanged", func(t *testing.T) {
		assert.Equal(t, "", strip(""))
	})
}

func TestResolveField(t *testing.T) {
	fields := []app.PropertyField{
		makeField(testFieldID1, "Severity", model.PropertyFieldTypeSelect),
		makeField(testFieldID2, "Build Status", model.PropertyFieldTypeText),
		makeField(testFieldID3, "Tags", model.PropertyFieldTypeMultiselect),
	}

	t.Run("resolve by ID", func(t *testing.T) {
		f, err := resolveField(fields, testFieldID1)
		require.NoError(t, err)
		assert.Equal(t, "Severity", f.Name)
	})

	t.Run("resolve by name exact case", func(t *testing.T) {
		f, err := resolveField(fields, "Severity")
		require.NoError(t, err)
		assert.Equal(t, testFieldID1, f.ID)
	})

	t.Run("resolve by name case-insensitive", func(t *testing.T) {
		f, err := resolveField(fields, "severity")
		require.NoError(t, err)
		assert.Equal(t, "Severity", f.Name)
	})

	t.Run("resolve by name with spaces", func(t *testing.T) {
		f, err := resolveField(fields, "build status")
		require.NoError(t, err)
		assert.Equal(t, "Build Status", f.Name)
	})

	t.Run("not found returns error with available names", func(t *testing.T) {
		_, err := resolveField(fields, "DoesNotExist")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Field not found")
		assert.Contains(t, err.Error(), "Severity")
		assert.Contains(t, err.Error(), "Build Status")
		assert.Contains(t, err.Error(), "Tags")
	})

	t.Run("empty fields list", func(t *testing.T) {
		_, err := resolveField([]app.PropertyField{}, "Severity")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Field not found")
	})
}

func TestResolveOptionNames(t *testing.T) {
	field := makeField(
		testFieldID1, "Severity", model.PropertyFieldTypeSelect,
		[2]string{testOptionID1, "High"},
		[2]string{testOptionID2, "Medium"},
		[2]string{testOptionID3, "Low"},
	)

	t.Run("resolve by name", func(t *testing.T) {
		ids, err := resolveOptionNames(field, []string{"High"})
		require.NoError(t, err)
		assert.Equal(t, []string{testOptionID1}, ids)
	})

	t.Run("resolve by name case-insensitive", func(t *testing.T) {
		ids, err := resolveOptionNames(field, []string{"high"})
		require.NoError(t, err)
		assert.Equal(t, []string{testOptionID1}, ids)
	})

	t.Run("resolve multiple names", func(t *testing.T) {
		ids, err := resolveOptionNames(field, []string{"High", "Low"})
		require.NoError(t, err)
		assert.Equal(t, []string{testOptionID1, testOptionID3}, ids)
	})

	t.Run("resolve by option ID fallback", func(t *testing.T) {
		ids, err := resolveOptionNames(field, []string{testOptionID2})
		require.NoError(t, err)
		assert.Equal(t, []string{testOptionID2}, ids)
	})

	t.Run("invalid name returns error with valid options", func(t *testing.T) {
		_, err := resolveOptionNames(field, []string{"Critical"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Invalid option")
		assert.Contains(t, err.Error(), "High")
		assert.Contains(t, err.Error(), "Medium")
		assert.Contains(t, err.Error(), "Low")
	})

	t.Run("invalid ID returns error", func(t *testing.T) {
		_, err := resolveOptionNames(field, []string{"notavalidmattermostidxxx"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Invalid option")
	})
}

func TestDisplayValue(t *testing.T) {
	selectField := makeField(
		testFieldID1, "Severity", model.PropertyFieldTypeSelect,
		[2]string{testOptionID1, "High"},
		[2]string{testOptionID2, "Medium"},
	)

	multiselectField := makeField(
		testFieldID2, "Tags", model.PropertyFieldTypeMultiselect,
		[2]string{testOptionID1, "backend"},
		[2]string{testOptionID2, "urgent"},
	)

	textField := makeField(testFieldID3, "Build Status", model.PropertyFieldTypeText)
	dateField := makeField(testFieldID4, "Deploy Date", model.PropertyFieldTypeDate)

	t.Run("null value", func(t *testing.T) {
		assert.Equal(t, "*(not set)*", displayValue(textField, json.RawMessage("null")))
	})

	t.Run("empty value", func(t *testing.T) {
		assert.Equal(t, "*(not set)*", displayValue(textField, nil))
	})

	t.Run("empty string value", func(t *testing.T) {
		assert.Equal(t, "*(not set)*", displayValue(textField, json.RawMessage(`""`)))
	})

	t.Run("text field", func(t *testing.T) {
		assert.Equal(t, "passed", displayValue(textField, json.RawMessage(`"passed"`)))
	})

	t.Run("select field resolves option ID to name", func(t *testing.T) {
		assert.Equal(t, "High", displayValue(selectField, json.RawMessage(fmt.Sprintf(`"%s"`, testOptionID1))))
	})

	t.Run("select field with unknown ID returns raw ID", func(t *testing.T) {
		assert.Equal(t, "unknownid", displayValue(selectField, json.RawMessage(`"unknownid"`)))
	})

	t.Run("select field with empty string", func(t *testing.T) {
		assert.Equal(t, "*(not set)*", displayValue(selectField, json.RawMessage(`""`)))
	})

	t.Run("multiselect field resolves option IDs to names", func(t *testing.T) {
		value := fmt.Sprintf(`["%s","%s"]`, testOptionID1, testOptionID2)
		assert.Equal(t, "backend, urgent", displayValue(multiselectField, json.RawMessage(value)))
	})

	t.Run("multiselect field empty array", func(t *testing.T) {
		assert.Equal(t, "*(not set)*", displayValue(multiselectField, json.RawMessage(`[]`)))
	})

	t.Run("multiselect field with unknown ID falls back to raw ID", func(t *testing.T) {
		value := fmt.Sprintf(`["%s","unknownid"]`, testOptionID1)
		assert.Equal(t, "backend, unknownid", displayValue(multiselectField, json.RawMessage(value)))
	})

	t.Run("unsupported type date", func(t *testing.T) {
		assert.Equal(t, "*(unsupported type)*", displayValue(dateField, json.RawMessage(`"2024-01-15"`)))
	})

	t.Run("unsupported type user", func(t *testing.T) {
		userField := makeField(testFieldID5, "Assignee", model.PropertyFieldTypeUser)
		assert.Equal(t, "*(unsupported type)*", displayValue(userField, json.RawMessage(`"someuserid"`)))
	})

	t.Run("unsupported type multiuser", func(t *testing.T) {
		multiuserField := makeField(testFieldID6, "Reviewers", model.PropertyFieldTypeMultiuser)
		assert.Equal(t, "*(unsupported type)*", displayValue(multiuserField, json.RawMessage(`["user1","user2"]`)))
	})
}
