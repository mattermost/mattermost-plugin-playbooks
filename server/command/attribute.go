// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

const attributeHelpText = `**Attribute commands:**
- ` + "`/playbook attribute list --run <id>`" + ` — List all property fields and their current values.
- ` + "`/playbook attribute get <field> --run <id>`" + ` — Get the current value of a property field.
- ` + "`/playbook attribute set <field> --value <value> --run <id>`" + ` — Set the value of a property field.`

func (r *Runner) actionAttribute(args []string) {
	if len(args) < 1 {
		r.postCommandResponse(attributeHelpText)
		return
	}

	command := strings.ToLower(args[0])
	params := []string{}
	if len(args) > 1 {
		params = args[1:]
	}

	switch command {
	case "list":
		r.actionAttributeList(params)
	case "get":
		r.actionAttributeGet(params)
	case "set":
		r.actionAttributeSet(params)
	default:
		r.postCommandResponse(attributeHelpText)
	}
}

func (r *Runner) actionAttributeList(args []string) {
	fs := flag.NewFlagSet("attribute-list", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	runID := fs.String("run", "", "Run ID (required)")

	if err := fs.Parse(args); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error parsing flags: %s", err.Error()))
		return
	}

	if *runID == "" {
		r.postCommandResponse("The `--run <id>` flag is required.")
		return
	}

	run, err := r.playbookRunService.GetPlaybookRun(*runID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Run not found: `%s`", *runID))
		return
	}

	if err := r.permissions.RunView(r.args.UserId, *runID); err != nil {
		r.postCommandResponse("You don't have permission to access this run.")
		return
	}

	fields, err := r.propertyService.GetRunPropertyFields(*runID)
	if err != nil {
		r.warnUserAndLogErrorf("Error fetching property fields: %v", err)
		return
	}

	if len(fields) == 0 {
		r.postCommandResponse("No properties defined for this run.")
		return
	}

	values, err := r.propertyService.GetRunPropertyValues(*runID)
	if err != nil {
		r.warnUserAndLogErrorf("Error fetching property values: %v", err)
		return
	}

	valueMap := make(map[string]json.RawMessage, len(values))
	for _, v := range values {
		valueMap[v.FieldID] = v.Value
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("**Properties for run \"%s\":**\n\n", run.Name))
	sb.WriteString("| Field | Type | Value |\n")
	sb.WriteString("|-------|------|-------|\n")

	for _, f := range fields {
		val := displayValue(f, valueMap[f.ID])
		sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", f.Name, string(f.Type), val))
	}

	r.postCommandResponse(sb.String())
}

func (r *Runner) actionAttributeGet(args []string) {
	// Separate positional arguments from flags so that the field name
	// can appear before or after the flags (e.g. "Severity --run <id>"
	// or "--run <id> Severity").
	flagArgs, positionalArgs := separateFlags(args)

	fs := flag.NewFlagSet("attribute-get", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	runID := fs.String("run", "", "Run ID (required)")

	if err := fs.Parse(flagArgs); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error parsing flags: %s", err.Error()))
		return
	}

	if *runID == "" {
		r.postCommandResponse("The `--run <id>` flag is required.")
		return
	}

	fieldArg := joinFieldArg(positionalArgs)
	if fieldArg == "" {
		r.postCommandResponse("Usage: `/playbook attribute get <field> --run <id>`")
		return
	}

	run, err := r.playbookRunService.GetPlaybookRun(*runID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Run not found: `%s`", *runID))
		return
	}

	if err := r.permissions.RunView(r.args.UserId, *runID); err != nil {
		r.postCommandResponse("You don't have permission to access this run.")
		return
	}

	fields, err := r.propertyService.GetRunPropertyFields(run.ID)
	if err != nil {
		r.warnUserAndLogErrorf("Error fetching property fields: %v", err)
		return
	}

	field, err := resolveField(fields, fieldArg)
	if err != nil {
		r.postCommandResponse(err.Error())
		return
	}

	values, err := r.propertyService.GetRunPropertyValues(run.ID)
	if err != nil {
		r.warnUserAndLogErrorf("Error fetching property values: %v", err)
		return
	}

	var rawValue json.RawMessage
	for _, v := range values {
		if v.FieldID == field.ID {
			rawValue = v.Value
			break
		}
	}

	val := displayValue(*field, rawValue)
	r.postCommandResponse(fmt.Sprintf("**%s** (%s): %s", field.Name, string(field.Type), val))
}

// stringSliceFlag is a custom flag.Value that collects multiple --value flags
// into a string slice.
type stringSliceFlag []string

func (f *stringSliceFlag) String() string { return strings.Join(*f, ", ") }
func (f *stringSliceFlag) Set(val string) error {
	*f = append(*f, val)
	return nil
}

func (r *Runner) actionAttributeSet(args []string) {
	flagArgs, positionalArgs := separateFlags(args)

	fs := flag.NewFlagSet("attribute-set", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	runID := fs.String("run", "", "Run ID (required)")
	var values stringSliceFlag
	fs.Var(&values, "value", "Value to set (repeatable for multiselect)")

	if err := fs.Parse(flagArgs); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error parsing flags: %s", err.Error()))
		return
	}

	if *runID == "" {
		r.postCommandResponse("The `--run <id>` flag is required.")
		return
	}

	fieldArg := joinFieldArg(positionalArgs)
	if fieldArg == "" {
		r.postCommandResponse("Usage: `/playbook attribute set <field> --value <value> --run <id>`")
		return
	}

	if len(values) == 0 {
		r.postCommandResponse("The `--value` flag is required.")
		return
	}

	// Strip surrounding quotes from each --value argument. The plugin's
	// Execute() splits the command with strings.Fields, which does not
	// respect quotes — so --value "" arrives as the two-character string
	// "" (two literal quote chars), and --value "High" arrives as "High"
	// with literal quotes. Stripping ensures clearing and option name
	// resolution work correctly.
	for i, v := range values {
		values[i] = strings.Trim(v, "\"")
	}

	run, err := r.playbookRunService.GetPlaybookRun(*runID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Run not found: `%s`", *runID))
		return
	}

	if err := r.permissions.RunManageProperties(r.args.UserId, *runID); err != nil {
		r.postCommandResponse("You don't have permission to manage properties on this run.")
		return
	}

	fields, err := r.propertyService.GetRunPropertyFields(run.ID)
	if err != nil {
		r.warnUserAndLogErrorf("Error fetching property fields: %v", err)
		return
	}

	field, err := resolveField(fields, fieldArg)
	if err != nil {
		r.postCommandResponse(err.Error())
		return
	}

	// Check for clearing: single --value ""
	clearing := len(values) == 1 && values[0] == ""

	var marshaledValue json.RawMessage
	var displayStr string

	switch field.Type {
	case model.PropertyFieldTypeText:
		if len(values) > 1 {
			r.postCommandResponse(fmt.Sprintf("Field `%s` (text) only accepts a single value.", field.Name))
			return
		}
		if clearing {
			marshaledValue = json.RawMessage(`""`)
		} else {
			b, _ := json.Marshal(values[0])
			marshaledValue = b
			displayStr = values[0]
		}

	case model.PropertyFieldTypeSelect:
		if len(values) > 1 {
			r.postCommandResponse(fmt.Sprintf("Field `%s` (select) only accepts a single value.", field.Name))
			return
		}
		if clearing {
			marshaledValue = json.RawMessage(`""`)
		} else {
			resolvedIDs, err := resolveOptionNames(*field, values)
			if err != nil {
				r.postCommandResponse(err.Error())
				return
			}
			b, _ := json.Marshal(resolvedIDs[0])
			marshaledValue = b
			// Display the resolved option name
			for _, option := range field.Attrs.Options {
				if option.GetID() == resolvedIDs[0] {
					displayStr = option.GetName()
					break
				}
			}
		}

	case model.PropertyFieldTypeMultiselect:
		if clearing {
			marshaledValue = json.RawMessage(`[]`)
		} else {
			resolvedIDs, err := resolveOptionNames(*field, values)
			if err != nil {
				r.postCommandResponse(err.Error())
				return
			}
			b, _ := json.Marshal(resolvedIDs)
			marshaledValue = b
			// Display resolved option names
			names := make([]string, 0, len(resolvedIDs))
			for _, id := range resolvedIDs {
				for _, option := range field.Attrs.Options {
					if option.GetID() == id {
						names = append(names, option.GetName())
						break
					}
				}
			}
			displayStr = strings.Join(names, ", ")
		}

	default:
		r.postCommandResponse(fmt.Sprintf("Setting values for `%s` fields is not yet supported.", string(field.Type)))
		return
	}

	if _, err := r.playbookRunService.SetRunPropertyValue(r.args.UserId, run.ID, field.ID, marshaledValue); err != nil {
		r.warnUserAndLogErrorf("Error setting property value: %v", err)
		return
	}

	if clearing {
		r.postCommandResponse(fmt.Sprintf("Cleared **%s** on run \"%s\".", field.Name, run.Name))
	} else {
		r.postCommandResponse(fmt.Sprintf("Set **%s** to **%s** on run \"%s\".", field.Name, displayStr, run.Name))
	}
}

// separateFlags splits an argument list into flag arguments (those starting
// with "-" or "--" and their values) and positional arguments. This allows
// positional arguments to appear before, after, or between flags.
func separateFlags(args []string) (flagArgs, positionalArgs []string) {
	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "-") {
			flagArgs = append(flagArgs, args[i])
			// If this flag has a value argument following it (not another flag),
			// consume it too.
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				flagArgs = append(flagArgs, args[i+1])
				i++
			}
		} else {
			positionalArgs = append(positionalArgs, args[i])
		}
	}
	return flagArgs, positionalArgs
}

// joinFieldArg joins positional arguments into a single field name string and
// strips surrounding quotes. This handles multi-word field names that get split
// by strings.Fields in the plugin's Execute() function.
//
// Examples:
//   - ["Severity"] → "Severity"
//   - ["\"Build", "Status\""] → "Build Status" (quoted in command, split by strings.Fields)
//   - ["Build", "Status"] → "Build Status" (unquoted, no ambiguity)
//   - [] → ""
func joinFieldArg(positionalArgs []string) string {
	return strings.Trim(strings.Join(positionalArgs, " "), "\"")
}

// resolveField resolves a field argument (name or ID) to a PropertyField.
// It first tries an exact ID match if the argument looks like a valid
// Mattermost ID, then falls back to a case-insensitive name match.
func resolveField(fields []app.PropertyField, fieldArg string) (*app.PropertyField, error) {
	// Try exact ID match first.
	if model.IsValidId(fieldArg) {
		for i, f := range fields {
			if f.ID == fieldArg {
				return &fields[i], nil
			}
		}
	}

	// Try case-insensitive name match.
	for i, f := range fields {
		if strings.EqualFold(f.Name, fieldArg) {
			return &fields[i], nil
		}
	}

	// Build the list of available field names for the error message.
	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}

	return nil, fmt.Errorf("Field not found: `%s`. Available fields: %s", fieldArg, strings.Join(names, ", "))
}

// resolveOptionNames resolves a list of option names (or IDs) to option IDs
// for select/multiselect fields. Each name is matched case-insensitively
// against the field's options. If no name matches but the value looks like a
// valid Mattermost ID, it is tried as an option ID directly.
func resolveOptionNames(field app.PropertyField, names []string) ([]string, error) {
	ids := make([]string, 0, len(names))

	for _, name := range names {
		resolved := false

		// Try case-insensitive name match.
		for _, option := range field.Attrs.Options {
			if strings.EqualFold(option.GetName(), name) {
				ids = append(ids, option.GetID())
				resolved = true
				break
			}
		}

		if resolved {
			continue
		}

		// Fallback: try as a direct option ID.
		if model.IsValidId(name) {
			for _, option := range field.Attrs.Options {
				if option.GetID() == name {
					ids = append(ids, name)
					resolved = true
					break
				}
			}
		}

		if !resolved {
			validNames := make([]string, 0, len(field.Attrs.Options))
			for _, option := range field.Attrs.Options {
				validNames = append(validNames, option.GetName())
			}
			return nil, fmt.Errorf("Invalid option `%s` for field `%s`. Valid options: %s", name, field.Name, strings.Join(validNames, ", "))
		}
	}

	return ids, nil
}

// displayValue converts a stored property value to a human-readable string.
// For select/multiselect fields, option IDs are resolved back to names.
func displayValue(field app.PropertyField, value json.RawMessage) string {
	if len(value) == 0 || string(value) == "null" || string(value) == `""` {
		return "*(not set)*"
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		var s string
		if err := json.Unmarshal(value, &s); err != nil {
			return string(value)
		}
		if s == "" {
			return "*(not set)*"
		}
		return s

	case model.PropertyFieldTypeSelect:
		var optionID string
		if err := json.Unmarshal(value, &optionID); err != nil {
			return string(value)
		}
		if optionID == "" {
			return "*(not set)*"
		}
		for _, option := range field.Attrs.Options {
			if option.GetID() == optionID {
				return option.GetName()
			}
		}
		return optionID

	case model.PropertyFieldTypeMultiselect:
		var optionIDs []string
		if err := json.Unmarshal(value, &optionIDs); err != nil {
			return string(value)
		}
		if len(optionIDs) == 0 {
			return "*(not set)*"
		}
		names := make([]string, 0, len(optionIDs))
		for _, id := range optionIDs {
			found := false
			for _, option := range field.Attrs.Options {
				if option.GetID() == id {
					names = append(names, option.GetName())
					found = true
					break
				}
			}
			if !found {
				names = append(names, id)
			}
		}
		return strings.Join(names, ", ")

	default:
		return "*(unsupported type)*"
	}
}
