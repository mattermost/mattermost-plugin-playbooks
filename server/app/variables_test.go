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

// mockUserResolver is a test implementation of UserResolver that returns
// users from an in-memory map.
type mockUserResolver struct {
	users map[string]*model.User
}

func (m *mockUserResolver) Get(userID string) (*model.User, error) {
	if user, ok := m.users[userID]; ok {
		return user, nil
	}
	return nil, &model.AppError{Message: "user not found"}
}

func makeTestField(id, name string, fieldType model.PropertyFieldType, options ...*model.PluginPropertyOption) PropertyField {
	return PropertyField{
		PropertyField: model.PropertyField{
			ID:   id,
			Name: name,
			Type: fieldType,
		},
		Attrs: Attrs{
			Options: options,
		},
	}
}

func makeTestValue(fieldID string, value json.RawMessage) PropertyValue {
	return PropertyValue(model.PropertyValue{
		FieldID: fieldID,
		Value:   value,
	})
}

func TestParseVariablesAndValues(t *testing.T) {
	t.Run("Simple", func(t *testing.T) {
		res := parseVariablesAndValues(`
			$bar=one
			$five=star
		`)
		require.Equal(t, 2, len(res))
		require.Equal(t, "one", res["$bar"])
		require.Equal(t, "star", res["$five"])
	})

	t.Run("Variable Names: Match only lower case, upper case and underscore", func(t *testing.T) {
		res := parseVariablesAndValues(`
		 	This is a summary. This part of the summary will not be matched.
			My variables are:
			$a-to-z=NoMatch
			$a space=NoMatch
			$1_one=Match
			$a_2_z=Match
		`)
		require.Equal(t, 2, len(res))
		require.Equal(t, "Match", res["$1_one"])
		require.Equal(t, "Match", res["$a_2_z"])
	})

	t.Run("Variable Values", func(t *testing.T) {
		res := parseVariablesAndValues(`
		 	This is a summary. This part of the summary will not be matched.
			My variables are:
			$1_one=This is a match
			$a_2_z=This-is-also-a-match
			$version=v7.1.1
			$BRANCH=release/v7.1.1
		`)
		require.Equal(t, 4, len(res))
		require.Equal(t, "This is a match", res["$1_one"])
		require.Equal(t, "This-is-also-a-match", res["$a_2_z"])
		require.Equal(t, "v7.1.1", res["$version"])
		require.Equal(t, "release/v7.1.1", res["$BRANCH"])
	})
}

func TestParseVariables(t *testing.T) {
	t.Run("Simple", func(t *testing.T) {
		res := parseVariables(`/agenda queue $topic-$DATE`)
		require.Equal(t, []string{"$topic", "$DATE"}, res)
	})

	t.Run("Variable Names: Match only lower case, upper case and underscore", func(t *testing.T) {
		res := parseVariables(`/echo $a-to-$z extra $1_one$a_2_z`)
		require.Equal(t, []string{"$a", "$z", "$1_one", "$a_2_z"}, res)
	})
}

func TestBuiltinRunVariables(t *testing.T) {
	run := &PlaybookRun{
		ID:          "run-id-123",
		Name:        "Incident #42",
		ChannelID:   "channel-id-456",
		TeamID:      "team-id-789",
		OwnerUserID: "owner-id-abc",
		PlaybookID:  "playbook-id-def",
	}

	vars := builtinRunVariables(run)

	assert.Equal(t, "run-id-123", vars["$PB_RUN_ID"])
	assert.Equal(t, "Incident #42", vars["$PB_RUN_NAME"])
	assert.Equal(t, "channel-id-456", vars["$PB_CHANNEL_ID"])
	assert.Equal(t, "team-id-789", vars["$PB_TEAM_ID"])
	assert.Equal(t, "owner-id-abc", vars["$PB_OWNER_USER_ID"])
	assert.Equal(t, "playbook-id-def", vars["$PB_PLAYBOOK_ID"])
	assert.Len(t, vars, 6, "builtinRunVariables should return exactly 6 variables")
}

func TestBuiltinVariablesOverrideUserDefined(t *testing.T) {
	userVars := parseVariablesAndValues("$PB_RUN_ID=user-value")

	run := &PlaybookRun{ID: "real-run-id"}
	for k, v := range builtinRunVariables(run) {
		userVars[k] = v
	}

	assert.Equal(t, "real-run-id", userVars["$PB_RUN_ID"])
}

func TestBuiltinVariableNamesMatchRegex(t *testing.T) {
	run := &PlaybookRun{
		ID:          "x",
		Name:        "x",
		ChannelID:   "x",
		TeamID:      "x",
		OwnerUserID: "x",
		PlaybookID:  "x",
	}
	for varName := range builtinRunVariables(run) {
		matches := parseVariables(varName)
		assert.Equal(t, []string{varName}, matches,
			"built-in variable %s should be matched by the variable regex", varName)
	}
}

func TestNormalizeFieldName(t *testing.T) {
	assert.Equal(t, "Build_Status", normalizeFieldName("Build Status"))
	assert.Equal(t, "my_field", normalizeFieldName("my-field"))
	assert.Equal(t, "Tags__v2_", normalizeFieldName("Tags (v2)"))
	assert.Equal(t, "Severity", normalizeFieldName("Severity"))
	assert.Equal(t, "a_b_c", normalizeFieldName("a.b.c"))
}

func TestBuiltinPropertyVariables_TextField(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	fields := []PropertyField{
		makeTestField(fieldID, "Build Status", model.PropertyFieldTypeText),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"passed"`)),
	}

	vars := builtinPropertyVariables(fields, values, nil)

	// Name-based key
	assert.Equal(t, "passed", vars["$PB_Build_Status"])
	// ID-based key
	assert.Equal(t, "passed", vars["$PB_"+fieldID])
}

func TestBuiltinPropertyVariables_SelectField(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	optionID := "opt1abcdefghijklmnopqrstuv"
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
			model.NewPluginPropertyOption("opt2abcdefghijklmnopqrstuv", "Low"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+optionID+`"`)),
	}

	vars := builtinPropertyVariables(fields, values, nil)

	// Name-based keys
	assert.Equal(t, "High", vars["$PB_Severity"])
	assert.Equal(t, optionID, vars["$PB_Severity_ID"])
	// ID-based keys
	assert.Equal(t, "High", vars["$PB_"+fieldID])
	assert.Equal(t, optionID, vars["$PB_"+fieldID+"_ID"])
}

func TestBuiltinPropertyVariables_MultiselectFieldUsesFirstOption(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	opt1ID := "opt1abcdefghijklmnopqrstuv"
	opt2ID := "opt2abcdefghijklmnopqrstuv"
	fields := []PropertyField{
		makeTestField(fieldID, "Tags", model.PropertyFieldTypeMultiselect,
			model.NewPluginPropertyOption(opt1ID, "backend"),
			model.NewPluginPropertyOption(opt2ID, "urgent"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`["`+opt1ID+`","`+opt2ID+`"]`)),
	}

	vars := builtinPropertyVariables(fields, values, nil)

	// Only the first option is exposed
	assert.Equal(t, "backend", vars["$PB_Tags"])
	assert.Equal(t, opt1ID, vars["$PB_Tags_ID"])
	// Same via field ID
	assert.Equal(t, "backend", vars["$PB_"+fieldID])
	assert.Equal(t, opt1ID, vars["$PB_"+fieldID+"_ID"])
}

func TestBuiltinPropertyVariables_UserField(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	userID := "user123abcdefghijklmnopqrs"
	fields := []PropertyField{
		makeTestField(fieldID, "Assignee", model.PropertyFieldTypeUser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+userID+`"`)),
	}

	resolver := &mockUserResolver{
		users: map[string]*model.User{
			userID: {
				Username:  "janedoe",
				FirstName: "Jane",
				LastName:  "Doe",
			},
		},
	}

	vars := builtinPropertyVariables(fields, values, resolver)

	// Name-based keys
	assert.Equal(t, "janedoe", vars["$PB_Assignee"])
	assert.Equal(t, "Jane Doe", vars["$PB_Assignee_FULLNAME"])
	assert.Equal(t, userID, vars["$PB_Assignee_ID"])
	// ID-based keys
	assert.Equal(t, "janedoe", vars["$PB_"+fieldID])
	assert.Equal(t, "Jane Doe", vars["$PB_"+fieldID+"_FULLNAME"])
	assert.Equal(t, userID, vars["$PB_"+fieldID+"_ID"])
}

func TestBuiltinPropertyVariables_MultiuserFieldUsesFirstUser(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	user1ID := "user123abcdefghijklmnopqrs"
	user2ID := "user456abcdefghijklmnopqrs"
	fields := []PropertyField{
		makeTestField(fieldID, "Reviewers", model.PropertyFieldTypeMultiuser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`["`+user1ID+`","`+user2ID+`"]`)),
	}

	resolver := &mockUserResolver{
		users: map[string]*model.User{
			user1ID: {
				Username:  "janedoe",
				FirstName: "Jane",
				LastName:  "Doe",
			},
			user2ID: {
				Username:  "bobsmith",
				FirstName: "Bob",
				LastName:  "Smith",
			},
		},
	}

	vars := builtinPropertyVariables(fields, values, resolver)

	// Only the first user is exposed
	assert.Equal(t, "janedoe", vars["$PB_Reviewers"])
	assert.Equal(t, "Jane Doe", vars["$PB_Reviewers_FULLNAME"])
	assert.Equal(t, user1ID, vars["$PB_Reviewers_ID"])
}

func TestBuiltinPropertyVariables_DateField(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	fields := []PropertyField{
		makeTestField(fieldID, "DeployDate", model.PropertyFieldTypeDate),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"2026-02-26"`)),
	}

	vars := builtinPropertyVariables(fields, values, nil)

	assert.Equal(t, "2026-02-26", vars["$PB_DeployDate"])
	assert.Equal(t, "2026-02-26", vars["$PB_"+fieldID])
}

func TestBuiltinPropertyVariables_UnsetFieldProducesEmptyStrings(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"

	t.Run("text field missing from values", func(t *testing.T) {
		fields := []PropertyField{
			makeTestField(fieldID, "Notes", model.PropertyFieldTypeText),
		}
		vars := builtinPropertyVariables(fields, nil, nil)
		assert.Equal(t, "", vars["$PB_Notes"])
		assert.Equal(t, "", vars["$PB_"+fieldID])
	})

	t.Run("select field with null value", func(t *testing.T) {
		fields := []PropertyField{
			makeTestField(fieldID, "Priority", model.PropertyFieldTypeSelect,
				model.NewPluginPropertyOption("opt1abcdefghijklmnopqrstuv", "High"),
			),
		}
		values := []PropertyValue{
			makeTestValue(fieldID, json.RawMessage(`null`)),
		}
		vars := builtinPropertyVariables(fields, values, nil)
		assert.Equal(t, "", vars["$PB_Priority"])
		assert.Equal(t, "", vars["$PB_Priority_ID"])
	})

	t.Run("multiselect field with empty array", func(t *testing.T) {
		fields := []PropertyField{
			makeTestField(fieldID, "Tags", model.PropertyFieldTypeMultiselect,
				model.NewPluginPropertyOption("opt1abcdefghijklmnopqrstuv", "backend"),
			),
		}
		values := []PropertyValue{
			makeTestValue(fieldID, json.RawMessage(`[]`)),
		}
		vars := builtinPropertyVariables(fields, values, nil)
		assert.Equal(t, "", vars["$PB_Tags"])
		assert.Equal(t, "", vars["$PB_Tags_ID"])
	})

	t.Run("user field with empty string", func(t *testing.T) {
		fields := []PropertyField{
			makeTestField(fieldID, "Assignee", model.PropertyFieldTypeUser),
		}
		values := []PropertyValue{
			makeTestValue(fieldID, json.RawMessage(`""`)),
		}
		vars := builtinPropertyVariables(fields, values, nil)
		assert.Equal(t, "", vars["$PB_Assignee"])
		assert.Equal(t, "", vars["$PB_Assignee_FULLNAME"])
		assert.Equal(t, "", vars["$PB_Assignee_ID"])
	})
}

func TestBuiltinPropertyVariables_DualKeySameValues(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	optionID := "opt1abcdefghijklmnopqrstuv"
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+optionID+`"`)),
	}

	vars := builtinPropertyVariables(fields, values, nil)

	// Name-based and ID-based variables produce the same values
	assert.Equal(t, vars["$PB_Severity"], vars["$PB_"+fieldID])
	assert.Equal(t, vars["$PB_Severity_ID"], vars["$PB_"+fieldID+"_ID"])
}

func TestBuiltinPropertyVariableNamesMatchRegex(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	userID := "user123abcdefghijklmnopqrs"
	optionID := "opt1abcdefghijklmnopqrstuv"

	fields := []PropertyField{
		makeTestField(fieldID, "Build Status", model.PropertyFieldTypeText),
		makeTestField("fld2abcdefghijklmnopqrstuv", "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
		),
		makeTestField("fld3abcdefghijklmnopqrstuv", "Assignee", model.PropertyFieldTypeUser),
		makeTestField("fld4abcdefghijklmnopqrstuv", "DeployDate", model.PropertyFieldTypeDate),
		makeTestField("fld5abcdefghijklmnopqrstuv", "Tags", model.PropertyFieldTypeMultiselect,
			model.NewPluginPropertyOption(optionID, "backend"),
		),
		makeTestField("fld6abcdefghijklmnopqrstuv", "Reviewers", model.PropertyFieldTypeMultiuser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"passed"`)),
		makeTestValue("fld2abcdefghijklmnopqrstuv", json.RawMessage(`"`+optionID+`"`)),
		makeTestValue("fld3abcdefghijklmnopqrstuv", json.RawMessage(`"`+userID+`"`)),
		makeTestValue("fld4abcdefghijklmnopqrstuv", json.RawMessage(`"2026-02-26"`)),
		makeTestValue("fld5abcdefghijklmnopqrstuv", json.RawMessage(`["`+optionID+`"]`)),
		makeTestValue("fld6abcdefghijklmnopqrstuv", json.RawMessage(`["`+userID+`"]`)),
	}

	resolver := &mockUserResolver{
		users: map[string]*model.User{
			userID: {Username: "janedoe", FirstName: "Jane", LastName: "Doe"},
		},
	}

	vars := builtinPropertyVariables(fields, values, resolver)

	for varName := range vars {
		matches := parseVariables(varName)
		require.NotEmpty(t, matches,
			"built-in property variable %s should be matched by the variable regex", varName)
		// The regex might match sub-parts if there were non-var chars, but since
		// all our variable names only contain valid chars, the full name should match.
		assert.Contains(t, matches, varName,
			"built-in property variable %s should be matched by the variable regex", varName)
	}
}

func TestBuiltinPropertyVariables_UserResolverNil(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	userID := "user123abcdefghijklmnopqrs"
	fields := []PropertyField{
		makeTestField(fieldID, "Assignee", model.PropertyFieldTypeUser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+userID+`"`)),
	}

	// nil resolver — user fields should produce empty strings for username/fullname
	vars := builtinPropertyVariables(fields, values, nil)

	assert.Equal(t, userID, vars["$PB_Assignee_ID"])
	assert.Equal(t, "", vars["$PB_Assignee"])
	assert.Equal(t, "", vars["$PB_Assignee_FULLNAME"])
}

// ---------------------------------------------------------------------------
// Phase 5: Integration tests — end-to-end variable substitution
// ---------------------------------------------------------------------------

func TestSubstituteVariables_RunMetadataSubstitution(t *testing.T) {
	run := &PlaybookRun{
		ID:          "r1a2b3c4d5e6f7g8h9i0j1k2l3",
		Name:        "Incident #42",
		ChannelID:   "ch-abc123",
		TeamID:      "tm-def456",
		OwnerUserID: "owner-789",
		PlaybookID:  "pb-ghi012",
	}

	result, err := substituteVariables(
		"/playbook attribute list --run $PB_RUN_ID",
		run, nil, nil, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/playbook attribute list --run r1a2b3c4d5e6f7g8h9i0j1k2l3", result)
}

func TestSubstituteVariables_CommandWithNoVariables(t *testing.T) {
	run := &PlaybookRun{ID: "run1"}

	result, err := substituteVariables(
		"/echo hello",
		run, nil, nil, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/echo hello", result)
}

func TestSubstituteVariables_MixedUserDefinedAndBuiltin(t *testing.T) {
	run := &PlaybookRun{
		ID:      "run-real-id",
		Summary: "$ENV=production",
	}

	result, err := substituteVariables(
		"/deploy --env $ENV --run $PB_RUN_ID",
		run, nil, nil, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/deploy --env production --run run-real-id", result)
}

func TestSubstituteVariables_BuiltinOverridesUserDefined(t *testing.T) {
	run := &PlaybookRun{
		ID:      "real-run-id",
		Summary: "$PB_RUN_ID=fake-id",
	}

	result, err := substituteVariables(
		"/echo $PB_RUN_ID",
		run, nil, nil, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/echo real-run-id", result)
}

func TestSubstituteVariables_TextFieldSubstitution(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Build Status", model.PropertyFieldTypeText),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"passed"`)),
	}

	result, err := substituteVariables(
		"/echo $PB_Build_Status",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/echo passed", result)
}

func TestSubstituteVariables_SelectFieldNameAndID(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	optionID := "opt1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
			model.NewPluginPropertyOption("opt2abcdefghijklmnopqrstuv", "Low"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+optionID+`"`)),
	}

	result, err := substituteVariables(
		"/notify --severity $PB_Severity --severity-id $PB_Severity_ID",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/notify --severity High --severity-id "+optionID, result)
}

func TestSubstituteVariables_UserFieldUsernameFullnameID(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	userID := "user123abcdefghijklmnopqrs"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Assignee", model.PropertyFieldTypeUser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+userID+`"`)),
	}
	resolver := &mockUserResolver{
		users: map[string]*model.User{
			userID: {Username: "janedoe", FirstName: "Jane", LastName: "Doe"},
		},
	}

	result, err := substituteVariables(
		"/assign --user $PB_Assignee_ID --name $PB_Assignee --fullname $PB_Assignee_FULLNAME",
		run, fields, values, resolver,
	)
	require.NoError(t, err)
	assert.Equal(t, "/assign --user "+userID+" --name janedoe --fullname Jane Doe", result)
}

func TestSubstituteVariables_FieldIDBasedVariable(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	optionID := "opt1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+optionID+`"`)),
	}

	// Use field ID instead of field name in the command
	result, err := substituteVariables(
		"/echo $PB_"+fieldID,
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/echo High", result)
}

func TestSubstituteVariables_UnsetPropertyFieldCausesError(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption("opt1abcdefghijklmnopqrstuv", "High"),
		),
	}
	// No values — field is unset

	_, err := substituteVariables(
		"/echo $PB_Severity",
		run, fields, nil, nil,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "$PB_Severity")
}

func TestSubstituteVariables_RunMetadataPrecedenceOverPropertyNamedRUN_ID(t *testing.T) {
	// A property field literally named "RUN_ID" should NOT shadow $PB_RUN_ID
	fieldID := "fld1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "real-run-id"}
	fields := []PropertyField{
		makeTestField(fieldID, "RUN_ID", model.PropertyFieldTypeText),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"property-value"`)),
	}

	result, err := substituteVariables(
		"/echo $PB_RUN_ID",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	// Run metadata wins over the equally-named property
	assert.Equal(t, "/echo real-run-id", result)

	// But the property is still accessible via its field ID
	result2, err := substituteVariables(
		"/echo $PB_"+fieldID,
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/echo property-value", result2)
}

func TestSubstituteVariables_AllRunMetadataVariables(t *testing.T) {
	run := &PlaybookRun{
		ID:          "run-id-123",
		Name:        "Incident",
		ChannelID:   "ch-456",
		TeamID:      "tm-789",
		OwnerUserID: "owner-abc",
		PlaybookID:  "pb-def",
	}

	result, err := substituteVariables(
		"/info $PB_RUN_ID $PB_RUN_NAME $PB_CHANNEL_ID $PB_TEAM_ID $PB_OWNER_USER_ID $PB_PLAYBOOK_ID",
		run, nil, nil, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/info run-id-123 Incident ch-456 tm-789 owner-abc pb-def", result)
}

func TestSubstituteVariables_MultiselectProperty(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	opt1ID := "opt1abcdefghijklmnopqrstuv"
	opt2ID := "opt2abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Tags", model.PropertyFieldTypeMultiselect,
			model.NewPluginPropertyOption(opt1ID, "backend"),
			model.NewPluginPropertyOption(opt2ID, "urgent"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`["`+opt1ID+`","`+opt2ID+`"]`)),
	}

	result, err := substituteVariables(
		"/echo $PB_Tags $PB_Tags_ID",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	// Only first option is used
	assert.Equal(t, "/echo backend "+opt1ID, result)
}

func TestSubstituteVariables_MultiuserProperty(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	user1ID := "user123abcdefghijklmnopqrs"
	user2ID := "user456abcdefghijklmnopqrs"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "Reviewers", model.PropertyFieldTypeMultiuser),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`["`+user1ID+`","`+user2ID+`"]`)),
	}
	resolver := &mockUserResolver{
		users: map[string]*model.User{
			user1ID: {Username: "janedoe", FirstName: "Jane", LastName: "Doe"},
			user2ID: {Username: "bobsmith", FirstName: "Bob", LastName: "Smith"},
		},
	}

	result, err := substituteVariables(
		"/echo $PB_Reviewers $PB_Reviewers_FULLNAME $PB_Reviewers_ID",
		run, fields, values, resolver,
	)
	require.NoError(t, err)
	// Only first user is used
	assert.Equal(t, "/echo janedoe Jane Doe "+user1ID, result)
}

func TestSubstituteVariables_PropertyAndRunMetadataTogether(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	optionID := "opt1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{
		ID:   "r1a2b3c4d5e6f7g8h9i0j1k2l3",
		Name: "Incident #42",
	}
	fields := []PropertyField{
		makeTestField(fieldID, "Severity", model.PropertyFieldTypeSelect,
			model.NewPluginPropertyOption(optionID, "High"),
		),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"`+optionID+`"`)),
	}

	result, err := substituteVariables(
		"/notify --severity $PB_Severity --run $PB_RUN_ID",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/notify --severity High --run r1a2b3c4d5e6f7g8h9i0j1k2l3", result)
}

func TestSubstituteVariables_UserDefinedAndPropertyAndRunMetadata(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{
		ID:      "run-xyz",
		Summary: "$ENV=staging",
	}
	fields := []PropertyField{
		makeTestField(fieldID, "Build Status", model.PropertyFieldTypeText),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"passed"`)),
	}

	result, err := substituteVariables(
		"/deploy --env $ENV --status $PB_Build_Status --run $PB_RUN_ID",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/deploy --env staging --status passed --run run-xyz", result)
}

func TestSubstituteVariables_UndefinedVariableError(t *testing.T) {
	run := &PlaybookRun{ID: "run1"}

	_, err := substituteVariables(
		"/echo $UNDEFINED_VAR",
		run, nil, nil, nil,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "$UNDEFINED_VAR")
}

func TestSubstituteVariables_DateFieldSubstitution(t *testing.T) {
	fieldID := "fld1abcdefghijklmnopqrstuv"
	run := &PlaybookRun{ID: "run1"}
	fields := []PropertyField{
		makeTestField(fieldID, "DeployDate", model.PropertyFieldTypeDate),
	}
	values := []PropertyValue{
		makeTestValue(fieldID, json.RawMessage(`"2026-02-26"`)),
	}

	result, err := substituteVariables(
		"/schedule --date $PB_DeployDate",
		run, fields, values, nil,
	)
	require.NoError(t, err)
	assert.Equal(t, "/schedule --date 2026-02-26", result)
}
