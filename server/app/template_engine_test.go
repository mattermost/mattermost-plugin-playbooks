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

func mustMarshal(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

func strValuesMap(m map[string]string) map[string]json.RawMessage {
	if m == nil {
		return nil
	}
	out := make(map[string]json.RawMessage, len(m))
	for k, v := range m {
		out[k] = mustMarshal(v)
	}
	return out
}

func TestResolveTemplate(t *testing.T) {
	tests := []struct {
		name           string
		template       string
		fields         []PropertyField
		values         map[string]string
		systemTokens   map[string]string
		wantResolved   string
		wantUnresolved []string
	}{
		{
			name:           "empty template returns empty string",
			template:       "",
			wantResolved:   "",
			wantUnresolved: nil,
		},
		{
			name:           "template with no placeholders returns verbatim",
			template:       "Hello World",
			wantResolved:   "Hello World",
			wantUnresolved: nil,
		},
		{
			name:     "single field placeholder resolved",
			template: "{Zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			wantResolved:   "Alpha",
			wantUnresolved: nil,
		},
		{
			name:     "multiple placeholders resolved",
			template: "{Zone}-{Team}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
				makePropertyField("f2", "Team"),
			},
			values: map[string]string{
				"f1": "Alpha",
				"f2": "Red",
			},
			wantResolved:   "Alpha-Red",
			wantUnresolved: nil,
		},
		{
			name:           "SEQ system token resolved",
			template:       "{SEQ} - Incident",
			systemTokens:   map[string]string{"SEQ": "INC-42"},
			wantResolved:   "INC-42 - Incident",
			wantUnresolved: nil,
		},
		{
			name:     "system token takes precedence over field with same name",
			template: "{SEQ}",
			fields: []PropertyField{
				makePropertyField("f1", "SEQ"),
			},
			values:         map[string]string{"f1": "should-not-appear"},
			systemTokens:   map[string]string{"SEQ": "INC-1"},
			wantResolved:   "INC-1",
			wantUnresolved: nil,
		},
		{
			name:     "case-insensitive field matching lowercase placeholder",
			template: "{zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			wantResolved:   "Alpha",
			wantUnresolved: nil,
		},
		{
			name:     "case-insensitive field matching uppercase placeholder",
			template: "{ZONE}",
			fields: []PropertyField{
				makePropertyField("f1", "zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			wantResolved:   "Alpha",
			wantUnresolved: nil,
		},
		{
			name:     "unresolved placeholder returned in list when zone resolved but unknown not",
			template: "{Zone}-{Unknown}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			wantResolved:   "Alpha-{Unknown}",
			wantUnresolved: []string{"Unknown"},
		},
		{
			name:           "multiple unresolved placeholders",
			template:       "{A}-{B}",
			wantResolved:   "{A}-{B}",
			wantUnresolved: []string{"A", "B"},
		},
		{
			name:     "empty field value resolves to empty string — field treated as unresolved",
			template: "{Zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": ""},
			wantResolved:   "{Zone}",
			wantUnresolved: []string{"Zone"},
		},
		{
			name:           "SEQ empty when system token value is empty string",
			template:       "{SEQ}",
			systemTokens:   map[string]string{"SEQ": ""},
			wantResolved:   "{SEQ}",
			wantUnresolved: []string{"SEQ"},
		},
		{
			name:     "mixed SEQ and field placeholders both resolved",
			template: "{SEQ}-{Zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			systemTokens:   map[string]string{"SEQ": "INC-7"},
			wantResolved:   "INC-7-Alpha",
			wantUnresolved: nil,
		},
		{
			name:           "literal braces not matching pattern pass through unchanged",
			template:       "Hello {}",
			wantResolved:   "Hello {}",
			wantUnresolved: nil,
		},
		{
			name:     "adjacent placeholders both resolved",
			template: "{A}{B}",
			fields: []PropertyField{
				makePropertyField("f1", "A"),
				makePropertyField("f2", "B"),
			},
			values: map[string]string{
				"f1": "foo",
				"f2": "bar",
			},
			wantResolved:   "foobar",
			wantUnresolved: nil,
		},
		{
			name:     "whitespace inside placeholder braces is trimmed and matched",
			template: "{ Zone }",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{"f1": "Alpha"},
			wantResolved:   "Alpha",
			wantUnresolved: nil,
		},
		{
			name:     "nil values map with matching field treated as unresolved",
			template: "{Zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         nil,
			wantResolved:   "{Zone}",
			wantUnresolved: []string{"Zone"},
		},
		{
			name:     "special characters in field value are preserved verbatim",
			template: "{Alert}",
			fields: []PropertyField{
				makePropertyField("f1", "Alert"),
			},
			values:         map[string]string{"f1": "sev1 / P0 & \"critical\""},
			wantResolved:   "sev1 / P0 & \"critical\"",
			wantUnresolved: nil,
		},
		{
			name:     "field value with unicode characters is preserved",
			template: "{Region}",
			fields: []PropertyField{
				makePropertyField("f1", "Region"),
			},
			values:         map[string]string{"f1": "北京-Asia"},
			wantResolved:   "北京-Asia",
			wantUnresolved: nil,
		},
		{
			name:     "values map missing entry for matching field treated as unresolved",
			template: "{Zone}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			values:         map[string]string{},
			wantResolved:   "{Zone}",
			wantUnresolved: []string{"Zone"},
		},
		{
			name:           "SEQ with prefix rendered via system token",
			template:       "INC prefix: {SEQ}",
			systemTokens:   map[string]string{"SEQ": "PLAY-7"},
			wantResolved:   "INC prefix: PLAY-7",
			wantUnresolved: nil,
		},
		// New tests for OWNER and CREATOR system tokens
		{
			name:           "OWNER system token resolved",
			template:       "{OWNER} - Incident",
			systemTokens:   map[string]string{"OWNER": "Jane Smith"},
			wantResolved:   "Jane Smith - Incident",
			wantUnresolved: nil,
		},
		{
			name:           "CREATOR system token resolved",
			template:       "Created by {CREATOR}",
			systemTokens:   map[string]string{"CREATOR": "John Doe"},
			wantResolved:   "Created by John Doe",
			wantUnresolved: nil,
		},
		{
			name:         "all system tokens resolved together",
			template:     "{SEQ} - {OWNER} ({CREATOR})",
			systemTokens: map[string]string{"SEQ": "INC-1", "OWNER": "Jane", "CREATOR": "John"},
			wantResolved: "INC-1 - Jane (John)",
		},
		{
			name:     "OWNER token takes precedence over field named OWNER",
			template: "{OWNER}",
			fields: []PropertyField{
				makePropertyField("f1", "OWNER"),
			},
			values:       map[string]string{"f1": "should-not-appear"},
			systemTokens: map[string]string{"OWNER": "Real Owner"},
			wantResolved: "Real Owner",
		},
		{
			name:           "system token case-insensitive",
			template:       "{owner} and {Creator}",
			systemTokens:   map[string]string{"OWNER": "Jane", "CREATOR": "John"},
			wantResolved:   "Jane and John",
			wantUnresolved: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, unresolved := ResolveTemplate(tt.template, ResolveOptions{
				Fields:       tt.fields,
				Values:       strValuesMap(tt.values),
				SystemTokens: tt.systemTokens,
			})
			assert.Equal(t, tt.wantResolved, resolved)
			if tt.wantUnresolved == nil {
				assert.Nil(t, unresolved)
			} else {
				require.NotNil(t, unresolved)
				assert.Equal(t, tt.wantUnresolved, unresolved)
			}
		})
	}
}

func TestResolveTemplateFormatFunc(t *testing.T) {
	t.Run("FormatFunc is called for property fields", func(t *testing.T) {
		called := false
		customFormat := func(field *PropertyField, raw json.RawMessage) (string, bool) {
			called = true
			return "CUSTOM", false
		}

		resolved, unresolved := ResolveTemplate("{Zone}", ResolveOptions{
			Fields:     []PropertyField{makePropertyField("f1", "Zone")},
			Values:     strValuesMap(map[string]string{"f1": "raw-value"}),
			FormatFunc: customFormat,
		})
		assert.True(t, called)
		assert.Equal(t, "CUSTOM", resolved)
		assert.Nil(t, unresolved)
	})

	t.Run("FormatFunc is NOT called for system tokens", func(t *testing.T) {
		called := false
		customFormat := func(field *PropertyField, raw json.RawMessage) (string, bool) {
			called = true
			return "CUSTOM", false
		}

		resolved, _ := ResolveTemplate("{OWNER}", ResolveOptions{
			SystemTokens: map[string]string{"OWNER": "Jane"},
			FormatFunc:   customFormat,
		})
		assert.False(t, called)
		assert.Equal(t, "Jane", resolved)
	})

	t.Run("FormatFunc returning empty marks field as unresolved", func(t *testing.T) {
		customFormat := func(field *PropertyField, raw json.RawMessage) (string, bool) {
			return "", true
		}

		resolved, unresolved := ResolveTemplate("{Zone}", ResolveOptions{
			Fields:     []PropertyField{makePropertyField("f1", "Zone")},
			Values:     strValuesMap(map[string]string{"f1": "raw-value"}),
			FormatFunc: customFormat,
		})
		assert.Equal(t, "{Zone}", resolved)
		assert.Equal(t, []string{"Zone"}, unresolved)
	})
}

func TestResolveTemplateStatusUpdateScenario(t *testing.T) {
	// This test mirrors the demo scenario from Feature 13 (SS-16):
	// "[{SEQ}] {Zone} zone update. Owner: {OWNER}. Manager: {Manager}. Created by: {CREATOR}."
	// with INC-1, Alpha, System Admin, Jane Smith, System Admin respectively.

	zoneField := makePropertyField("field-zone", "Zone")
	managerField := makePropertyField("field-mgr", "Manager")

	t.Run("demo template resolves all system tokens and attribute fields", func(t *testing.T) {
		template := "[{SEQ}] {Zone} zone update. Owner: {OWNER}. Manager: {Manager}. Created by: {CREATOR}."

		resolved, unresolved := ResolveTemplate(template, ResolveOptions{
			Fields: []PropertyField{zoneField, managerField},
			Values: strValuesMap(map[string]string{
				"field-zone": "Alpha",
				"field-mgr":  "Jane Smith",
			}),
			SystemTokens: map[string]string{
				"SEQ":     "INC-1",
				"OWNER":   "System Admin",
				"CREATOR": "System Admin",
			},
		})

		assert.Equal(t, "[INC-1] Alpha zone update. Owner: System Admin. Manager: Jane Smith. Created by: System Admin.", resolved)
		assert.Nil(t, unresolved)
	})

	t.Run("raw tokens remain when values are missing", func(t *testing.T) {
		// Zone has no value — its token stays literal in the output
		template := "[{SEQ}] {Zone} zone update. Owner: {OWNER}. Created by: {CREATOR}."

		resolved, unresolved := ResolveTemplate(template, ResolveOptions{
			Fields:       []PropertyField{zoneField},
			Values:       strValuesMap(map[string]string{}), // Zone has no value
			SystemTokens: map[string]string{"SEQ": "INC-1", "OWNER": "System Admin", "CREATOR": "System Admin"},
		})

		// System tokens are resolved; {Zone} stays because there is no value
		assert.Equal(t, "[INC-1] {Zone} zone update. Owner: System Admin. Created by: System Admin.", resolved)
		assert.Equal(t, []string{"Zone"}, unresolved)
	})

	t.Run("owner and creator resolve independently when they differ", func(t *testing.T) {
		template := "Owner: {OWNER}. Created by: {CREATOR}."

		resolved, unresolved := ResolveTemplate(template, ResolveOptions{
			SystemTokens: map[string]string{
				"OWNER":   "Alice",
				"CREATOR": "Bob",
			},
		})

		assert.Equal(t, "Owner: Alice. Created by: Bob.", resolved)
		assert.Nil(t, unresolved)
	})

	t.Run("unresolved SEQ (empty string) leaves placeholder in output", func(t *testing.T) {
		// When run_number is 0, FormatSequentialID returns "" → SEQ system token = ""
		template := "[{SEQ}] update"

		resolved, unresolved := ResolveTemplate(template, ResolveOptions{
			SystemTokens: map[string]string{"SEQ": ""},
		})

		// Empty system token is treated as unresolved — placeholder preserved
		assert.Equal(t, "[{SEQ}] update", resolved)
		assert.Equal(t, []string{"SEQ"}, unresolved)
	})
}

func TestValidateTemplate(t *testing.T) {
	tests := []struct {
		name           string
		template       string
		fields         []PropertyField
		wantUnresolved []string
	}{
		{
			name:     "valid template with all fields returns nil",
			template: "{Zone}-{Team}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
				makePropertyField("f2", "Team"),
			},
			wantUnresolved: nil,
		},
		{
			name:           "SEQ is always valid as built-in placeholder",
			template:       "{SEQ}",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:           "OWNER is always valid as built-in placeholder",
			template:       "{OWNER}",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:           "CREATOR is always valid as built-in placeholder",
			template:       "{CREATOR}",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:           "unknown field returns its name",
			template:       "{Unknown}",
			fields:         nil,
			wantUnresolved: []string{"Unknown"},
		},
		{
			name:           "empty template returns nil",
			template:       "",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:     "mixed valid and invalid returns only invalid names",
			template: "{Zone}-{Bogus}",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			wantUnresolved: []string{"Bogus"},
		},
		{
			name:           "all system token case variants recognized as built-in",
			template:       "{seq}-{Seq}-{SEQ}-{owner}-{Owner}-{OWNER}-{creator}-{Creator}-{CREATOR}",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:     "whitespace inside placeholder braces trimmed before lookup",
			template: "{ Zone }",
			fields: []PropertyField{
				makePropertyField("f1", "Zone"),
			},
			wantUnresolved: nil,
		},
		{
			name:           "template with only literal text has no unknowns",
			template:       "Incident Run",
			fields:         nil,
			wantUnresolved: nil,
		},
		{
			name:           "multiple unknown placeholders all returned",
			template:       "{Alpha}-{Beta}-{Gamma}",
			fields:         nil,
			wantUnresolved: []string{"Alpha", "Beta", "Gamma"},
		},
		{
			name:           "system tokens mixed with field placeholders",
			template:       "{SEQ}-{OWNER}-{Priority}",
			fields:         nil,
			wantUnresolved: []string{"Priority"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unresolved := ValidateTemplate(tt.template, ResolveOptions{Fields: tt.fields})
			if tt.wantUnresolved == nil {
				assert.Nil(t, unresolved)
			} else {
				require.NotNil(t, unresolved)
				assert.Equal(t, tt.wantUnresolved, unresolved)
			}
		})
	}
}

func TestFormatSequentialID(t *testing.T) {
	tests := []struct {
		name      string
		prefix    string
		runNumber int64
		want      string
	}{
		{
			name:      "prefix with number",
			prefix:    "INC",
			runNumber: 42,
			want:      "INC-00042",
		},
		{
			name:      "empty prefix with number",
			prefix:    "",
			runNumber: 42,
			want:      "00042",
		},
		{
			name:      "prefix with runNumber 0 returns empty string sentinel",
			prefix:    "INC",
			runNumber: 0,
			want:      "",
		},
		{
			name:      "empty prefix with runNumber 0 returns empty string",
			prefix:    "",
			runNumber: 0,
			want:      "",
		},
		{
			name:      "prefix with runNumber 1",
			prefix:    "INC",
			runNumber: 1,
			want:      "INC-00001",
		},
		{
			name:      "5-digit run number",
			prefix:    "INC",
			runNumber: 99999,
			want:      "INC-99999",
		},
		{
			name:      "number exceeding 5 digits",
			prefix:    "INC",
			runNumber: 100000,
			want:      "INC-100000",
		},
		{
			name:      "large run number",
			prefix:    "INC",
			runNumber: 999999,
			want:      "INC-999999",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatSequentialID(tt.prefix, tt.runNumber)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestDefaultFormatPropertyValue(t *testing.T) {
	t.Run("null raw JSON returns empty and isEmpty true", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result, isEmpty := DefaultFormatPropertyValue(field, nil)
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)

		result, isEmpty = DefaultFormatPropertyValue(field, json.RawMessage(""))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)

		result, isEmpty = DefaultFormatPropertyValue(field, json.RawMessage("null"))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)

		result, isEmpty = DefaultFormatPropertyValue(field, json.RawMessage(`""`))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)
	})

	t.Run("text field returns string value and isEmpty false", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal("hello"))
		assert.Equal(t, "hello", result)
		assert.False(t, isEmpty)
	})

	t.Run("text field with invalid JSON falls back to raw bytes and isEmpty false", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result, isEmpty := DefaultFormatPropertyValue(field, json.RawMessage(`not-json`))
		assert.Equal(t, "not-json", result)
		assert.False(t, isEmpty)
	})

	t.Run("text field empty string value returns isEmpty true", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "text"}}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal(""))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)
	})

	t.Run("select field returns option label when ID matches", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-a", "Alpha Label")
		opt2 := model.NewPluginPropertyOption("opt-b", "Beta Label")
		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "select"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{opt1, opt2},
			},
		}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal("opt-a"))
		assert.Equal(t, "Alpha Label", result)
		assert.False(t, isEmpty)
	})

	t.Run("select field returns raw ID when option ID not found", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-a", "Alpha Label")
		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "select"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{opt1},
			},
		}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal("unknown-id"))
		assert.Equal(t, "unknown-id", result)
		assert.False(t, isEmpty)
	})

	t.Run("select field empty string value returns isEmpty true", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "select"}}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal(""))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)
	})

	t.Run("multiselect field joins option labels with comma", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-1", "First")
		opt2 := model.NewPluginPropertyOption("opt-2", "Second")
		opt3 := model.NewPluginPropertyOption("opt-3", "Third")
		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "multiselect"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{opt1, opt2, opt3},
			},
		}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal([]string{"opt-1", "opt-3"}))
		assert.Equal(t, "First, Third", result)
		assert.False(t, isEmpty)
	})

	t.Run("multiselect field with unknown option ID uses raw ID as fallback label", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-1", "First")
		field := &PropertyField{
			PropertyField: model.PropertyField{Type: "multiselect"},
			Attrs: Attrs{
				Options: model.PropertyOptions[*model.PluginPropertyOption]{opt1},
			},
		}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal([]string{"opt-1", "mystery-id"}))
		assert.Equal(t, "First, mystery-id", result)
		assert.False(t, isEmpty)
	})

	t.Run("multiselect field with empty array returns isEmpty true", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "multiselect"}}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal([]string{}))
		assert.Equal(t, "", result)
		assert.True(t, isEmpty)
	})

	t.Run("multiselect field with invalid JSON falls back to raw bytes and isEmpty false", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "multiselect"}}

		result, isEmpty := DefaultFormatPropertyValue(field, json.RawMessage(`not-an-array`))
		assert.Equal(t, "not-an-array", result)
		assert.False(t, isEmpty)
	})

	t.Run("unknown field type falls back to string unmarshal", func(t *testing.T) {
		field := &PropertyField{PropertyField: model.PropertyField{Type: "custom_unknown"}}

		result, isEmpty := DefaultFormatPropertyValue(field, mustMarshal("some-value"))
		assert.Equal(t, "some-value", result)
		assert.False(t, isEmpty)
	})
}

// makePropertyField is a test helper that builds a minimal PropertyField
// with the given ID and Name, matching the structure used throughout
// the app package tests.
func makePropertyField(id, name string) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
		},
	}
}
