// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/sirupsen/logrus"
)

var varsReStr = `(\$[a-zA-Z0-9_]+)`

var reVars = regexp.MustCompile(varsReStr)

// reVarsAndVals is the regex use to match variables and their values.
var reVarsAndVals = regexp.MustCompile(`^\s*` + varsReStr + `=(.+)\s*$`)

// parseVariables returns the variables parsed from the given text.
// Each variable must be defined on a separate line, and must match
// the `reVar` regex.
func parseVariablesAndValues(input string) map[string]string {
	lines := strings.Split(input, "\n")
	vars := make(map[string]string)
	for _, line := range lines {
		if !reVarsAndVals.MatchString(line) {
			continue
		}
		match := reVarsAndVals.FindStringSubmatch(line)
		vars[match[1]] = match[2]
	}
	return vars
}

// parseVariables returns the variable names in the given input string.
func parseVariables(input string) []string {
	return reVars.FindAllString(input, -1)
}

// builtinRunVariables returns the built-in variables derived from a playbook
// run. These variables are prefixed with $PB_ and are always available in
// checklist item slash commands, without needing to be defined in the run
// summary. Built-in variables take precedence over user-defined variables
// with the same name.
func builtinRunVariables(run *PlaybookRun) map[string]string {
	return map[string]string{
		"$PB_RUN_ID":        run.ID,
		"$PB_RUN_NAME":      run.Name,
		"$PB_CHANNEL_ID":    run.ChannelID,
		"$PB_TEAM_ID":       run.TeamID,
		"$PB_OWNER_USER_ID": run.OwnerUserID,
		"$PB_PLAYBOOK_ID":   run.PlaybookID,
	}
}

var reNonVarChar = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// normalizeFieldName converts a property field name into a string that is
// valid as part of a variable name. Any character not in [a-zA-Z0-9_] is
// replaced with "_".
//
// Examples:
//
//	"Build Status" → "Build_Status"
//	"my-field"     → "my_field"
//	"Tags (v2)"    → "Tags__v2_"
func normalizeFieldName(name string) string {
	return reNonVarChar.ReplaceAllString(name, "_")
}

// UserResolver looks up a user by ID. In production this is backed by
// pluginAPI; in tests it can be a simple map.
type UserResolver interface {
	Get(userID string) (*model.User, error)
}

// builtinPropertyVariables returns variables derived from the run's property
// fields and their current values. Each field produces variables keyed by
// both its normalized name and its ID.
//
// The function takes the fields, values, and a UserResolver (needed for
// user/multiuser fields). If userResolver is nil, user/multiuser fields
// are skipped.
func builtinPropertyVariables(
	fields []PropertyField,
	values []PropertyValue,
	userResolver UserResolver,
) map[string]string {
	vars := make(map[string]string)

	// Build fieldID → raw value map
	valuesByFieldID := make(map[string]json.RawMessage, len(values))
	for _, v := range values {
		valuesByFieldID[model.PropertyValue(v).FieldID] = model.PropertyValue(v).Value
	}

	for _, field := range fields {
		namePrefix := "$PB_" + normalizeFieldName(field.Name)
		idPrefix := "$PB_" + field.ID

		rawValue := valuesByFieldID[field.ID]

		// Generate variables for both prefixes
		fieldVars := propertyFieldVariables(field, rawValue, userResolver)
		for suffix, val := range fieldVars {
			vars[namePrefix+suffix] = val
			vars[idPrefix+suffix] = val
		}
	}

	return vars
}

// propertyFieldVariables returns the suffix → value pairs for a single
// property field. The empty suffix "" corresponds to the base variable
// (e.g., $PB_Severity), and named suffixes like "_ID" or "_FULLNAME"
// correspond to additional variables.
func propertyFieldVariables(field PropertyField, rawValue json.RawMessage, userResolver UserResolver) map[string]string {
	vars := make(map[string]string)

	// Check if the value is empty/null/missing
	if isEmptyPropertyValue(rawValue) {
		switch field.Type {
		case model.PropertyFieldTypeText, model.PropertyFieldTypeDate:
			vars[""] = ""
		case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect:
			vars[""] = ""
			vars["_ID"] = ""
		case model.PropertyFieldTypeUser, model.PropertyFieldTypeMultiuser:
			vars[""] = ""
			vars["_FULLNAME"] = ""
			vars["_ID"] = ""
		default:
			vars[""] = ""
		}
		return vars
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		var textVal string
		if err := json.Unmarshal(rawValue, &textVal); err != nil {
			logrus.WithError(err).Warn("failed to unmarshal text property value")
			vars[""] = ""
		} else {
			vars[""] = textVal
		}

	case model.PropertyFieldTypeSelect:
		var optionID string
		if err := json.Unmarshal(rawValue, &optionID); err != nil {
			logrus.WithError(err).Warn("failed to unmarshal select property value")
			vars[""] = ""
			vars["_ID"] = ""
		} else if optionID == "" {
			vars[""] = ""
			vars["_ID"] = ""
		} else {
			vars["_ID"] = optionID
			vars[""] = resolveOptionName(field, optionID)
		}

	case model.PropertyFieldTypeMultiselect:
		var optionIDs []string
		if err := json.Unmarshal(rawValue, &optionIDs); err != nil {
			logrus.WithError(err).Warn("failed to unmarshal multiselect property value")
			vars[""] = ""
			vars["_ID"] = ""
		} else if len(optionIDs) == 0 {
			vars[""] = ""
			vars["_ID"] = ""
		} else {
			// Use only the first option
			vars["_ID"] = optionIDs[0]
			vars[""] = resolveOptionName(field, optionIDs[0])
		}

	case model.PropertyFieldTypeUser:
		var userID string
		if err := json.Unmarshal(rawValue, &userID); err != nil {
			logrus.WithError(err).Warn("failed to unmarshal user property value")
			vars[""] = ""
			vars["_FULLNAME"] = ""
			vars["_ID"] = ""
		} else if userID == "" {
			vars[""] = ""
			vars["_FULLNAME"] = ""
			vars["_ID"] = ""
		} else {
			vars["_ID"] = userID
			username, fullName := resolveUser(userResolver, userID)
			vars[""] = username
			vars["_FULLNAME"] = fullName
		}

	case model.PropertyFieldTypeMultiuser:
		var userIDs []string
		if err := json.Unmarshal(rawValue, &userIDs); err != nil {
			logrus.WithError(err).Warn("failed to unmarshal multiuser property value")
			vars[""] = ""
			vars["_FULLNAME"] = ""
			vars["_ID"] = ""
		} else if len(userIDs) == 0 {
			vars[""] = ""
			vars["_FULLNAME"] = ""
			vars["_ID"] = ""
		} else {
			// Use only the first user
			vars["_ID"] = userIDs[0]
			username, fullName := resolveUser(userResolver, userIDs[0])
			vars[""] = username
			vars["_FULLNAME"] = fullName
		}

	case model.PropertyFieldTypeDate:
		var dateVal string
		if err := json.Unmarshal(rawValue, &dateVal); err != nil {
			// Try as a number (timestamp)
			var numVal json.Number
			if err2 := json.Unmarshal(rawValue, &numVal); err2 != nil {
				logrus.WithError(err).Warn("failed to unmarshal date property value")
				vars[""] = ""
			} else {
				vars[""] = numVal.String()
			}
		} else {
			vars[""] = dateVal
		}

	default:
		vars[""] = ""
	}

	return vars
}

// isEmptyPropertyValue returns true if the raw JSON value is nil, null,
// an empty string, or an empty array.
func isEmptyPropertyValue(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return true
	}
	trimmed := strings.TrimSpace(string(raw))
	return trimmed == "null" || trimmed == `""` || trimmed == "[]"
}

// resolveOptionName looks up an option by ID in the field's options and
// returns its name. If not found, returns the option ID as a fallback.
func resolveOptionName(field PropertyField, optionID string) string {
	for _, opt := range field.Attrs.Options {
		if opt.GetID() == optionID {
			return opt.GetName()
		}
	}
	return optionID
}

// substituteVariables performs the full variable substitution pipeline on a
// command string, mirroring the logic in RunChecklistItemSlashCommand. It
// returns the substituted command or an error if any referenced variable is
// undefined or empty.
//
// The precedence order (highest to lowest) is:
//  1. Run metadata variables ($PB_RUN_ID, etc.)
//  2. Property field variables ($PB_Severity, etc.)
//  3. User-defined variables from the run summary ($myVar=foo)
func substituteVariables(
	command string,
	run *PlaybookRun,
	propertyFields []PropertyField,
	propertyValues []PropertyValue,
	userResolver UserResolver,
) (string, error) {
	// 1. User-defined variables (lowest priority)
	varsAndVals := parseVariablesAndValues(run.Summary)

	// 2. Property field variables
	for k, v := range builtinPropertyVariables(propertyFields, propertyValues, userResolver) {
		varsAndVals[k] = v
	}

	// 3. Run metadata variables (highest priority)
	for k, v := range builtinRunVariables(run) {
		varsAndVals[k] = v
	}

	// Substitute — sort variables longest-first so that e.g. $PB_Severity_ID
	// is replaced before $PB_Severity (preventing partial replacement).
	varsInCmd := parseVariables(command)
	sort.Slice(varsInCmd, func(i, j int) bool {
		return len(varsInCmd[i]) > len(varsInCmd[j])
	})
	for _, v := range varsInCmd {
		if val, ok := varsAndVals[v]; !ok || val == "" {
			return "", fmt.Errorf("Found undefined or empty variable in slash command: %s", v)
		}
		command = strings.ReplaceAll(command, v, varsAndVals[v])
	}

	return command, nil
}

// resolveUser looks up a user by ID using the UserResolver and returns
// (username, fullName). If the resolver is nil or the lookup fails, both
// values are empty strings.
func resolveUser(resolver UserResolver, userID string) (username, fullName string) {
	if resolver == nil {
		logrus.Warn("user resolver is nil, cannot resolve user for property variable")
		return "", ""
	}

	user, err := resolver.Get(userID)
	if err != nil {
		logrus.WithError(err).WithField("user_id", userID).Warn("failed to resolve user for property variable")
		return "", ""
	}

	return user.Username, fmt.Sprintf("%s %s", user.FirstName, user.LastName)
}
