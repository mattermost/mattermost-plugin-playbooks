// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// helpers for building PropertyField values used across subtests.

func textField(id, name string) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeText,
		},
	}
}

func selectField(id, name string, options ...*model.PluginPropertyOption) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeSelect,
		},
		Attrs: Attrs{Options: options},
	}
}

func multiselectField(id, name string, options ...*model.PluginPropertyOption) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeMultiselect,
		},
		Attrs: Attrs{Options: options},
	}
}

func dateField(id, name string) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeDate,
		},
	}
}

func userField(id, name string) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeUser,
		},
	}
}

func multiuserField(id, name string) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: model.PropertyFieldTypeMultiuser,
		},
	}
}

func mustJSON(v interface{}) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return json.RawMessage(b)
}

// ---------------------------------------------------------------------------
// ResolveTemplate
// ---------------------------------------------------------------------------

func TestResolveTemplate(t *testing.T) {
	t.Run("empty template returns empty", func(t *testing.T) {
		result, unresolved := ResolveTemplate("", ResolveOptions{})
		require.Equal(t, "", result)
		require.Nil(t, unresolved)
	})

	t.Run("template with no tokens is unchanged", func(t *testing.T) {
		result, unresolved := ResolveTemplate("INC-00001", ResolveOptions{})
		require.Equal(t, "INC-00001", result)
		require.Nil(t, unresolved)
	})

	t.Run("SEQ system token resolved from SystemTokens", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{SEQ}", ResolveOptions{
			SystemTokens: map[string]string{"SEQ": "INC-00042"},
		})
		require.Equal(t, "INC-00042", result)
		require.Nil(t, unresolved)
	})

	t.Run("SEQ token case-insensitive resolution", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{seq}", ResolveOptions{
			SystemTokens: map[string]string{"SEQ": "INC-00001"},
		})
		require.Equal(t, "INC-00001", result)
		require.Nil(t, unresolved)
	})

	t.Run("OWNER token resolved", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{OWNER}", ResolveOptions{
			SystemTokens: map[string]string{"OWNER": "alice"},
		})
		require.Equal(t, "alice", result)
		require.Nil(t, unresolved)
	})

	t.Run("CREATOR token resolved", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{CREATOR}", ResolveOptions{
			SystemTokens: map[string]string{"CREATOR": "bob"},
		})
		require.Equal(t, "bob", result)
		require.Nil(t, unresolved)
	})

	t.Run("unresolved system token added to unresolved list", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{SEQ}", ResolveOptions{
			SystemTokens: map[string]string{"SEQ": ""},
		})
		require.Equal(t, "{SEQ}", result)
		require.Equal(t, []string{"SEQ"}, unresolved)
	})

	t.Run("missing system token (not in map) is unresolved", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{SEQ}", ResolveOptions{})
		require.Equal(t, "{SEQ}", result)
		require.Equal(t, []string{"SEQ"}, unresolved)
	})

	t.Run("custom field resolved by ID lookup", func(t *testing.T) {
		f := textField("fid1", "Project")
		result, unresolved := ResolveTemplate("{Project}", ResolveOptions{
			Fields: []PropertyField{f},
			Values: map[string]json.RawMessage{
				"fid1": mustJSON("Payments"),
			},
		})
		require.Equal(t, "Payments", result)
		require.Nil(t, unresolved)
	})

	t.Run("custom field name lookup is case-insensitive", func(t *testing.T) {
		f := textField("fid1", "Project")
		result, unresolved := ResolveTemplate("{project}", ResolveOptions{
			Fields: []PropertyField{f},
			Values: map[string]json.RawMessage{
				"fid1": mustJSON("Auth"),
			},
		})
		require.Equal(t, "Auth", result)
		require.Nil(t, unresolved)
	})

	t.Run("custom field with no value is unresolved", func(t *testing.T) {
		f := textField("fid1", "Project")
		result, unresolved := ResolveTemplate("{Project}", ResolveOptions{
			Fields: []PropertyField{f},
			Values: map[string]json.RawMessage{},
		})
		require.Equal(t, "{Project}", result)
		require.Equal(t, []string{"Project"}, unresolved)
	})

	t.Run("custom field with nil values map is unresolved", func(t *testing.T) {
		f := textField("fid1", "Project")
		result, unresolved := ResolveTemplate("{Project}", ResolveOptions{
			Fields: []PropertyField{f},
		})
		require.Equal(t, "{Project}", result)
		require.Equal(t, []string{"Project"}, unresolved)
	})

	t.Run("unknown token is unresolved", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{Unknown}", ResolveOptions{})
		require.Equal(t, "{Unknown}", result)
		require.Equal(t, []string{"Unknown"}, unresolved)
	})

	t.Run("whitespace inside braces is trimmed", func(t *testing.T) {
		result, unresolved := ResolveTemplate("{ SEQ }", ResolveOptions{
			SystemTokens: map[string]string{"SEQ": "INC-00005"},
		})
		require.Equal(t, "INC-00005", result)
		require.Nil(t, unresolved)
	})

	t.Run("multiple tokens in one template", func(t *testing.T) {
		f := textField("fid1", "Project")
		result, unresolved := ResolveTemplate("{SEQ} - {Project} - {OWNER}", ResolveOptions{
			Fields: []PropertyField{f},
			Values: map[string]json.RawMessage{
				"fid1": mustJSON("Infra"),
			},
			SystemTokens: map[string]string{
				"SEQ":   "INC-00003",
				"OWNER": "carol",
			},
		})
		require.Equal(t, "INC-00003 - Infra - carol", result)
		require.Nil(t, unresolved)
	})

	t.Run("system token takes precedence over field with same name", func(t *testing.T) {
		f := textField("fid1", "SEQ")
		result, unresolved := ResolveTemplate("{SEQ}", ResolveOptions{
			Fields: []PropertyField{f},
			Values: map[string]json.RawMessage{
				"fid1": mustJSON("should-not-appear"),
			},
			SystemTokens: map[string]string{"SEQ": "INC-00099"},
		})
		require.Equal(t, "INC-00099", result)
		require.Nil(t, unresolved)
	})
}

// ---------------------------------------------------------------------------
// ValidateTemplate
// ---------------------------------------------------------------------------

func TestValidateTemplate(t *testing.T) {
	t.Run("empty template returns nil", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("", ResolveOptions{}))
	})

	t.Run("no tokens returns nil", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("INC-00001", ResolveOptions{}))
	})

	t.Run("SEQ system token is always valid", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("{SEQ}", ResolveOptions{}))
	})

	t.Run("seq lowercase is always valid", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("{seq}", ResolveOptions{}))
	})

	t.Run("OWNER system token is always valid", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("{OWNER}", ResolveOptions{}))
	})

	t.Run("CREATOR system token is always valid", func(t *testing.T) {
		require.Nil(t, ValidateTemplate("{CREATOR}", ResolveOptions{}))
	})

	t.Run("known field name is valid", func(t *testing.T) {
		f := textField("fid1", "Project")
		require.Nil(t, ValidateTemplate("{Project}", ResolveOptions{
			Fields: []PropertyField{f},
		}))
	})

	t.Run("known field name case-insensitive match", func(t *testing.T) {
		f := textField("fid1", "Project")
		require.Nil(t, ValidateTemplate("{project}", ResolveOptions{
			Fields: []PropertyField{f},
		}))
	})

	t.Run("unknown field name is returned", func(t *testing.T) {
		unknown := ValidateTemplate("{Unknown}", ResolveOptions{})
		require.Equal(t, []string{"Unknown"}, unknown)
	})

	t.Run("multiple unknown fields all returned", func(t *testing.T) {
		unknown := ValidateTemplate("{Foo} - {Bar}", ResolveOptions{})
		require.ElementsMatch(t, []string{"Foo", "Bar"}, unknown)
	})

	t.Run("mix of known and unknown returns only unknown", func(t *testing.T) {
		f := textField("fid1", "Project")
		unknown := ValidateTemplate("{Project} - {NoSuchField}", ResolveOptions{
			Fields: []PropertyField{f},
		})
		require.Equal(t, []string{"NoSuchField"}, unknown)
	})
}

// ---------------------------------------------------------------------------
// TemplateUsesSeqToken
// ---------------------------------------------------------------------------

func TestTemplateUsesSeqToken(t *testing.T) {
	t.Run("{SEQ} uppercase matches", func(t *testing.T) {
		require.True(t, TemplateUsesSeqToken("{SEQ}"))
	})

	t.Run("{seq} lowercase matches", func(t *testing.T) {
		require.True(t, TemplateUsesSeqToken("{seq}"))
	})

	t.Run("{Seq} mixed case matches", func(t *testing.T) {
		require.True(t, TemplateUsesSeqToken("{Seq}"))
	})

	t.Run("{SEQ} embedded in larger template matches", func(t *testing.T) {
		require.True(t, TemplateUsesSeqToken("INC-{SEQ}-suffix"))
	})

	t.Run("no SEQ token returns false", func(t *testing.T) {
		require.False(t, TemplateUsesSeqToken("INC-00001"))
	})

	t.Run("{SEQUENCE} does not match partial token", func(t *testing.T) {
		require.False(t, TemplateUsesSeqToken("{SEQUENCE}"))
	})

	t.Run("empty string returns false", func(t *testing.T) {
		require.False(t, TemplateUsesSeqToken(""))
	})

	t.Run("whitespace inside braces still matches", func(t *testing.T) {
		require.True(t, TemplateUsesSeqToken("{ SEQ }"))
	})
}

// ---------------------------------------------------------------------------
// StripFieldFromTemplate
// ---------------------------------------------------------------------------

func TestStripFieldFromTemplate(t *testing.T) {
	t.Run("empty template returns empty", func(t *testing.T) {
		require.Equal(t, "", StripFieldFromTemplate("", "Project"))
	})

	t.Run("trailing separator cleaned after stripping", func(t *testing.T) {
		require.Equal(t, "INC", StripFieldFromTemplate("INC - {Project}", "Project"))
	})

	t.Run("leading separator cleaned after stripping", func(t *testing.T) {
		require.Equal(t, "INC", StripFieldFromTemplate("{Project} - INC", "Project"))
	})

	t.Run("only the named field is stripped", func(t *testing.T) {
		result := StripFieldFromTemplate("{A} - {B}", "A")
		require.Equal(t, "{B}", result)
	})

	t.Run("field not present in template is unchanged", func(t *testing.T) {
		require.Equal(t, "INC - {Other}", StripFieldFromTemplate("INC - {Other}", "Project"))
	})

	t.Run("case-insensitive stripping", func(t *testing.T) {
		require.Equal(t, "INC", StripFieldFromTemplate("INC - {project}", "Project"))
	})

	t.Run("template with only the field becomes empty", func(t *testing.T) {
		require.Equal(t, "", StripFieldFromTemplate("{Project}", "Project"))
	})

	t.Run("multiple occurrences are all stripped", func(t *testing.T) {
		require.Equal(t, "INC", StripFieldFromTemplate("{Project} - INC - {Project}", "Project"))
	})
}

// ---------------------------------------------------------------------------
// ReplaceFieldInTemplate
// ---------------------------------------------------------------------------

func TestReplaceFieldInTemplate(t *testing.T) {
	t.Run("empty template returns empty", func(t *testing.T) {
		require.Equal(t, "", ReplaceFieldInTemplate("", "Old", "New"))
	})

	t.Run("basic replacement", func(t *testing.T) {
		require.Equal(t, "{New}", ReplaceFieldInTemplate("{Old}", "Old", "New"))
	})

	t.Run("case-insensitive replacement", func(t *testing.T) {
		require.Equal(t, "{NewName}", ReplaceFieldInTemplate("{oldname}", "OldName", "NewName"))
	})

	t.Run("non-existing field is unchanged", func(t *testing.T) {
		require.Equal(t, "{Other}", ReplaceFieldInTemplate("{Other}", "NotHere", "Replacement"))
	})

	t.Run("multiple occurrences are all replaced", func(t *testing.T) {
		require.Equal(t, "{New} - {New}", ReplaceFieldInTemplate("{Old} - {Old}", "Old", "New"))
	})

	t.Run("surrounding text is preserved", func(t *testing.T) {
		require.Equal(t, "prefix-{NewField}-suffix", ReplaceFieldInTemplate("prefix-{OldField}-suffix", "OldField", "NewField"))
	})
}

// ---------------------------------------------------------------------------
// DefaultFormatPropertyValue
// ---------------------------------------------------------------------------

func TestDefaultFormatPropertyValue(t *testing.T) {
	t.Run("nil field returns empty and true", func(t *testing.T) {
		s, empty := DefaultFormatPropertyValue(nil, mustJSON("anything"))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	t.Run("nil raw returns empty and true", func(t *testing.T) {
		f := textField("fid1", "Name")
		s, empty := DefaultFormatPropertyValue(&f, nil)
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	t.Run("json null returns empty and true", func(t *testing.T) {
		f := textField("fid1", "Name")
		s, empty := DefaultFormatPropertyValue(&f, json.RawMessage("null"))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	t.Run("empty json string returns empty and true", func(t *testing.T) {
		f := textField("fid1", "Name")
		s, empty := DefaultFormatPropertyValue(&f, json.RawMessage(`""`))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	// --- text ---

	t.Run("text field with value", func(t *testing.T) {
		f := textField("fid1", "Name")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("hello"))
		require.Equal(t, "hello", s)
		require.False(t, empty)
	})

	t.Run("text field with empty string value returns empty", func(t *testing.T) {
		f := textField("fid1", "Name")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON(""))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	// --- select ---

	t.Run("select field resolves option name", func(t *testing.T) {
		opt := model.NewPluginPropertyOption("opt-1", "Active")
		f := selectField("fid1", "Status", opt)
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("opt-1"))
		require.Equal(t, "Active", s)
		require.False(t, empty)
	})

	t.Run("select field with unknown option ID returns raw ID", func(t *testing.T) {
		opt := model.NewPluginPropertyOption("opt-1", "Active")
		f := selectField("fid1", "Status", opt)
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("unknown-id"))
		require.Equal(t, "unknown-id", s)
		require.False(t, empty)
	})

	// --- multiselect ---

	t.Run("multiselect field resolves option names joined by comma", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-1", "Bug")
		opt2 := model.NewPluginPropertyOption("opt-2", "Feature")
		f := multiselectField("fid1", "Tags", opt1, opt2)
		s, empty := DefaultFormatPropertyValue(&f, mustJSON([]string{"opt-1", "opt-2"}))
		require.Equal(t, "Bug, Feature", s)
		require.False(t, empty)
	})

	t.Run("multiselect with empty array returns empty", func(t *testing.T) {
		f := multiselectField("fid1", "Tags")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON([]string{}))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	t.Run("multiselect with unknown option ID falls back to raw ID", func(t *testing.T) {
		opt1 := model.NewPluginPropertyOption("opt-1", "Bug")
		f := multiselectField("fid1", "Tags", opt1)
		s, empty := DefaultFormatPropertyValue(&f, mustJSON([]string{"opt-1", "opt-unknown"}))
		require.Equal(t, "Bug, opt-unknown", s)
		require.False(t, empty)
	})

	// --- date ---

	t.Run("date field with RFC3339 string formats as YYYY-MM-DD", func(t *testing.T) {
		f := dateField("fid1", "Due")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("2024-03-15T00:00:00Z"))
		require.Equal(t, "2024-03-15", s)
		require.False(t, empty)
	})

	t.Run("date field with YYYY-MM-DD string is preserved", func(t *testing.T) {
		f := dateField("fid1", "Due")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("2024-03-15"))
		require.Equal(t, "2024-03-15", s)
		require.False(t, empty)
	})

	t.Run("date field with numeric epoch-milliseconds", func(t *testing.T) {
		f := dateField("fid1", "Due")
		// 2024-01-15 00:00:00 UTC in milliseconds
		epochMs := int64(1705276800000)
		s, empty := DefaultFormatPropertyValue(&f, mustJSON(epochMs))
		require.Equal(t, "2024-01-15", s)
		require.False(t, empty)
	})

	// --- user ---

	t.Run("user field returns raw user ID", func(t *testing.T) {
		f := userField("fid1", "Owner")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON("userid123"))
		require.Equal(t, "userid123", s)
		require.False(t, empty)
	})

	t.Run("user field with empty ID returns empty", func(t *testing.T) {
		f := userField("fid1", "Owner")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON(""))
		require.Equal(t, "", s)
		require.True(t, empty)
	})

	// --- multiuser ---

	t.Run("multiuser field returns user IDs joined by comma", func(t *testing.T) {
		f := multiuserField("fid1", "Participants")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON([]string{"user1", "user2"}))
		require.Equal(t, "user1, user2", s)
		require.False(t, empty)
	})

	t.Run("multiuser field with empty array returns empty", func(t *testing.T) {
		f := multiuserField("fid1", "Participants")
		s, empty := DefaultFormatPropertyValue(&f, mustJSON([]string{}))
		require.Equal(t, "", s)
		require.True(t, empty)
	})
}
