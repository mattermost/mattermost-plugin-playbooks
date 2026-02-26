# Attribute Commands — Implementation Architecture

**Spec:** [attribute-commands-spec.md](./attribute-commands-spec.md)
**Date:** 2026-02-25

This document describes the implementation plan for the `/playbook attribute`
slash commands, broken into testable phases. Each phase is self-contained and
can be merged independently.

---

## Phase 1: Helpers — Field Resolution, Option Resolution, Value Display

**Goal:** Implement the three shared helper functions that all attribute
subcommands depend on. Test them in isolation before any command wiring.

### Technical Description

Create `server/command/attribute.go` with the helper functions and a minimal
`actionAttribute(args)` dispatcher that returns a help message. No subcommand
logic yet.

**1.1 `resolveField`**

```go
func resolveField(fields []app.PropertyField, fieldArg string) (*app.PropertyField, error)
```

Resolution order:
1. If `model.IsValidId(fieldArg)`, try exact match on `field.ID`.
2. Try case-insensitive match on `field.Name` (using `strings.EqualFold`).
3. Return an error listing available field names:
   `"Field not found: <field>. Available fields: Severity, Build Status, Tags"`

**1.2 `resolveOptionNames`**

```go
func resolveOptionNames(field app.PropertyField, names []string) ([]string, error)
```

For each name in `names`:
1. Iterate `field.Attrs.Options`, try case-insensitive match on
   `option.GetName()`.
2. If no match and `model.IsValidId(name)`, try it as a direct option ID
   (fallback for automation).
3. If still no match, return an error listing valid option names:
   `"Invalid option <name> for field <field>. Valid options: High, Medium, Low"`

Return resolved option IDs in the same order as the input names.

**1.3 `displayValue`**

```go
func displayValue(field app.PropertyField, value json.RawMessage) string
```

- `null`, empty, `len(value) == 0`, or empty JSON string `""` → `*(not set)*`
- `text` → JSON-unmarshal as string, return unquoted (empty string → `*(not set)*`)
- `select` → JSON-unmarshal as string (option ID), resolve to option name via
  `field.Attrs.Options`; if option ID not found, return the raw ID
- `multiselect` → JSON-unmarshal as `[]string` (option IDs), resolve each to
  option name, join with `, `
- Unsupported types (`date`, `user`, `multiuser`) → `*(unsupported type)*`

**1.4 `separateFlags`**

Go's `flag` package stops parsing at the first non-flag argument, so
`/playbook attribute get Severity --run <id>` would fail if parsed directly
(the positional `Severity` stops flag parsing before `--run` is seen). A
`separateFlags` helper splits an argument list into flag arguments and
positional arguments regardless of order:

```go
func separateFlags(args []string) (flagArgs, positionalArgs []string)
```

Walk through `args`: anything starting with `-` is a flag (and consume the next
token as its value if it doesn't also start with `-`); everything else is a
positional argument. This lets users write the field name before or after the
flags.

**Note:** This helper assumes every flag takes a value (no boolean flags). All
attribute command flags (`--run`, `--value`) take values, so this is fine.

**1.5 `joinFieldArg`**

The plugin's `Execute()` function uses `strings.Fields(r.args.Command)` to
split the command, which does not respect quotes. A field name like
`"Build Status"` is split into `["\"Build", "Status\""]` — two separate
tokens with literal quote characters.

To support multi-word field names, the `get` and `set` subcommands join all
positional arguments (from `separateFlags`) into a single string and strip
surrounding quotes:

```go
func joinFieldArg(positionalArgs []string) string {
    return strings.Trim(strings.Join(positionalArgs, " "), "\"")
}
```

This handles three cases transparently:
- Single word: `Severity` → `"Severity"`
- Quoted multi-word: `"Build Status"` → after `strings.Fields` split →
  `["\"Build", "Status\""]` → joined `"\"Build Status\""` → trimmed
  `"Build Status"`
- Unquoted multi-word: `Build Status` → `["Build", "Status"]` → joined
  `"Build Status"`

**1.6 Dispatcher stub**

```go
func (r *Runner) actionAttribute(args []string) {
    if len(args) < 1 {
        r.postCommandResponse(attributeHelpText)
        return
    }
    switch strings.ToLower(args[0]) {
    case "list":
        r.actionAttributeList(args[1:])
    case "get":
        r.actionAttributeGet(args[1:])
    case "set":
        r.actionAttributeSet(args[1:])
    default:
        r.postCommandResponse(attributeHelpText)
    }
}
```

The `list`, `get`, `set` methods are stubs that return "not implemented yet" in
this phase.

**1.7 Command routing**

In `server/command/command.go`, add `case "attribute"` to the `Execute()`
switch, dispatching to `r.actionAttribute(parameters)`.

### Acceptance Criteria

- [x] `resolveField` resolves by ID when the argument is a valid Mattermost ID.
- [x] `resolveField` resolves by name (case-insensitive).
- [x] `resolveField` returns an error listing available names when not found.
- [x] `resolveOptionNames` resolves option names case-insensitively.
- [x] `resolveOptionNames` falls back to option ID when the value is a valid ID.
- [x] `resolveOptionNames` returns an error listing valid options when not found.
- [x] `displayValue` returns `*(not set)*` for null/empty values.
- [x] `displayValue` returns the unquoted string for `text` fields.
- [x] `displayValue` resolves option IDs to names for `select` fields.
- [x] `displayValue` resolves and joins option IDs for `multiselect` fields.
- [x] `displayValue` returns `*(unsupported type)*` for `date`/`user`/`multiuser`.
- [x] `separateFlags` correctly splits positional args from flags regardless of ordering.
- [x] `joinFieldArg` joins multi-word tokens and strips surrounding quotes.
- [x] `joinFieldArg` passes single-word tokens through unchanged.
- [x] `actionAttribute` dispatches to stub methods without panicking.
- [x] `Execute()` routes `/playbook attribute` to `actionAttribute`.
- [x] Unit tests for `joinFieldArg` cover the cases above.

---

## Phase 2: `/playbook attribute list`

**Goal:** Implement the `list` subcommand that displays all property fields and
their current values for a run.

### Technical Description

**2.1 Flag parsing**

Use `flag.NewFlagSet("attribute-list", flag.ContinueOnError)` with:
- `--run <id>` (required)

If `--run` is missing, return: `"The --run <id> flag is required."`

**2.2 Run resolution and permissions**

1. Fetch the run via `playbookRunService.GetPlaybookRun(runID)`. Return
   `"Run not found: <id>"` if not found.
2. Check `permissions.RunView(userID, runID)`. Return
   `"You don't have permission to access this run."` if denied.

**2.3 Data fetching**

1. Fetch fields via `propertyService.GetRunPropertyFields(runID)`.
2. Fetch values via `propertyService.GetRunPropertyValues(runID)`.
3. Build a map of `fieldID → json.RawMessage` from the values slice (using
   `PropertyValue.FieldID` and `PropertyValue.Value`).

**2.4 Output formatting**

Build a Markdown table:

```
**Properties for run "<run.Name>":**

| Field | Type | Value |
|-------|------|-------|
| Severity | select | High |
| Build Status | text | passed |
| Tags | multiselect | backend, urgent |
| Deploy Date | date | *(unsupported type)* |
```

For each field:
- Look up the value from the map. If missing, pass `nil` to `displayValue`.
- Use `displayValue(field, value)` for the Value column.
- Use `string(field.Type)` for the Type column.

If there are no fields, return: `"No properties defined for this run."`

### Acceptance Criteria

- [x] Missing `--run` returns an error message.
- [x] Non-existent run ID returns an error message.
- [x] User without `RunView` permission gets a permission error.
- [x] Lists all fields with their types and current values.
- [x] Select/multiselect values display option names, not IDs.
- [x] Fields with no value display `*(not set)*`.
- [x] Unsupported types display `*(unsupported type)*`.
- [x] A run with no property fields returns "No properties defined".

---

## Phase 3: `/playbook attribute get`

**Goal:** Implement the `get` subcommand that displays the value of a single
property field.

### Technical Description

**3.1 Argument and flag parsing**

Use `separateFlags(args)` to split the arguments into flag arguments and
positional arguments (see Phase 1.4). Parse `--run <id>` (required) via
`flag.NewFlagSet` on the flag arguments only.

The `<field>` argument is derived from the positional arguments using
`joinFieldArg(positionalArgs)` (see Phase 1.5), which joins multi-word tokens
and strips surrounding quotes to support field names with spaces.

If `<field>` is missing, return: `"Usage: /playbook attribute get <field> --run <id>"`

**3.2 Run resolution and permissions**

Same as Phase 2: fetch run, check `RunView`.

**3.3 Field resolution**

1. Fetch fields via `propertyService.GetRunPropertyFields(runID)`.
2. Call `resolveField(fields, fieldArg)`. Return its error if resolution fails.

**3.4 Value lookup**

1. Fetch values via `propertyService.GetRunPropertyValues(runID)`.
2. Find the value matching `field.ID` in the values slice.

**3.5 Output**

```
**Severity** (select): High
```

Or when not set:

```
**Severity** (select): *(not set)*
```

Use `displayValue` for the value portion.

### Acceptance Criteria

- [x] Missing `--run` returns an error.
- [x] Missing `<field>` argument returns usage help.
- [x] Field resolved by name (case-insensitive).
- [x] Field resolved by ID.
- [x] Field not found returns error with available field names.
- [x] Displays the value in `**Name** (type): value` format.
- [x] Unset values display `*(not set)*`.
- [x] Multi-word field names (e.g. `"Build Status"`) resolve correctly via `joinFieldArg`.

---

## Phase 4: `/playbook attribute set`

**Goal:** Implement the `set` subcommand that updates a property field value on
a run.

### Technical Description

**4.1 Flag parsing**

Use `flag.NewFlagSet("attribute-set", flag.ContinueOnError)` with:
- `--run <id>` (required)
- `--value <string>` (required, repeatable)

For the repeatable `--value` flag, use a custom `flag.Value` implementation
that collects multiple values into a `[]string`:

```go
type stringSliceFlag []string

func (f *stringSliceFlag) String() string { return strings.Join(*f, ", ") }
func (f *stringSliceFlag) Set(val string) error {
    *f = append(*f, val)
    return nil
}
```

Use `separateFlags(args)` to split arguments into flag and positional parts
(see Phase 1.4). Parse flags with `flag.NewFlagSet` on the flag arguments only.
The `<field>` argument is derived from the positional arguments using
`joinFieldArg(positionalArgs)` (see Phase 1.5).

After collecting values from the flag parser, strip surrounding quotes from
each value. This is necessary because `strings.Fields` in `Execute()` does not
respect quotes — `--value ""` arrives as the two-character string `""` (two
literal quote chars, not an empty string), and `--value "High"` arrives as
`"High"` with literal quote characters that would break option name resolution:

```go
for i, v := range values {
    values[i] = strings.Trim(v, "\"")
}
```

This ensures:
- `--value ""` → empty string → triggers clearing logic.
- `--value "High"` → `High` → matches option names correctly.
- `--value High` → `High` → unchanged (no quotes to strip).

**Note on multi-word values:** Since `strings.Fields` splits the command,
multi-word values like `--value "hello world"` are split into separate tokens
(`"hello` and `world"`). `separateFlags` only captures the first token as the
flag value; the remaining tokens leak into the positional arguments and corrupt
the field name. Multi-word `--value` arguments are not supported in the first
iteration — users should use the REST API for values containing spaces. Single
words (with or without quotes) work correctly after quote stripping.

**4.2 Validation**

- If `--run` is missing: `"The --run <id> flag is required."`
- If `<field>` is missing: `"Usage: /playbook attribute set <field> --value <value> --run <id>"`
- If `--value` is missing: `"The --value flag is required."`

**4.3 Run resolution and permissions**

1. Fetch the run via `playbookRunService.GetPlaybookRun(runID)`.
2. Check `permissions.RunManageProperties(userID, runID)`. Return
   `"You don't have permission to manage properties on this run."` if denied.

**4.4 Field resolution**

Same as Phase 3: fetch fields, call `resolveField`.

**4.5 Value construction by type**

| Type | Logic |
|------|-------|
| `text` | If multiple `--value` flags: return error `"Field <name> (text) only accepts a single value."`. Marshal the single value as a JSON string. |
| `select` | If multiple `--value` flags: return error `"Field <name> (select) only accepts a single value."`. Call `resolveOptionNames(field, values)`. Marshal the single resolved ID as a JSON string. |
| `multiselect` | Call `resolveOptionNames(field, values)`. Marshal the resolved IDs as a JSON array of strings. |
| `date`, `user`, `multiuser` | Return error: `"Setting values for <type> fields is not yet supported."` |

**Clearing a value:** If the single `--value` is `""`:
- For `text` and `select`: marshal as `json.RawMessage("\"\"")`.
- For `multiselect`: marshal as `json.RawMessage("[]")`.

**4.6 Set the value**

Call `playbookRunService.SetRunPropertyValue(userID, runID, field.ID, value)`.

This triggers all existing side effects: condition evaluation, timeline event,
WebSocket notification.

**4.7 Output**

For text/select:
```
Set **Severity** to **High** on run "Incident #42".
```

For multiselect:
```
Set **Tags** to **backend, urgent** on run "Incident #42".
```

For clearing:
```
Cleared **Build Status** on run "Incident #42".
```

The display value uses option names (not IDs) for select/multiselect.

### Acceptance Criteria

- [x] Missing `--run`, `<field>`, or `--value` returns an appropriate error.
- [x] Setting a `text` field stores the string value.
- [x] Setting a `select` field by option name resolves to the option ID.
- [x] Setting a `multiselect` field with multiple `--value` flags stores an
      array of option IDs.
- [x] Attempting to set a `date`/`user`/`multiuser` field returns an
      unsupported type error.
- [x] Multiple `--value` flags on a `text` or `select` field returns an error.
- [x] Invalid option name returns an error listing valid options.
- [x] `--value ""` clears the field value (requires quote stripping — see 4.1).
- [x] Side effects fire: condition evaluation, timeline event, WebSocket.
- [x] Output shows human-readable names (not IDs).
- [x] User without `RunManageProperties` gets a permission error.
- [x] Multi-word field names (e.g. `"Build Status"`) resolve correctly via `joinFieldArg`.
- [x] Surrounding quotes are stripped from `--value` arguments after flag parsing.
- [x] `--value "High"` (with quotes from `strings.Fields`) resolves the same as `--value High`.

---

## Phase 5: Autocomplete

**Goal:** Register autocomplete data for the `attribute` subcommand tree so
that users get hints in the Mattermost UI.

### Technical Description

**5.1 Autocomplete registration**

In `getAutocompleteData()` in `server/command/command.go`, add:

```go
attribute := model.NewAutocompleteData("attribute", "[list|get|set]",
    "Manage property values on a playbook run")

attributeList := model.NewAutocompleteData("list", "--run <id>",
    "List all property fields and their current values")
attribute.AddCommand(attributeList)

attributeGet := model.NewAutocompleteData("get", "<field> --run <id>",
    "Get the current value of a property field")
attribute.AddCommand(attributeGet)

attributeSet := model.NewAutocompleteData("set",
    "<field> --value <value> --run <id>",
    "Set the value of a property field")
attribute.AddCommand(attributeSet)

command.AddCommand(attribute)
```

### Acceptance Criteria

- [x] Autocomplete shows `attribute` as a subcommand of `/playbook`.
- [x] `attribute` shows `list`, `get`, `set` as children.
- [x] Each child shows its argument and flag hints.

---

## Phase 6: Integration Tests

**Goal:** End-to-end validation of the attribute commands through the slash
command infrastructure.

### Technical Description

Add tests to a new file `server/api_attribute_commands_test.go` (in
`package main`, alongside the existing integration tests). These tests use the
plugin's test infrastructure to set up a running instance, create a playbook
with property fields, start a run, and execute commands.

**6.1 Test infrastructure**

Each test:
1. Creates a playbook with property fields of different types (`text`,
   `select`, `multiselect`).
2. Creates a run from that playbook.
3. Executes `/playbook attribute ...` via
   `ServerClient.ExecuteCommand(channelID, command)`.
4. Verifies the property value in the store via the playbooks client API.

**Note on ephemeral responses:** The `ExecuteCommand` API returns an empty
`CommandResponse` — the actual output is sent as an ephemeral post via
WebSocket. Integration tests cannot easily capture ephemeral post text, so
mutation tests (`set`) verify stored property values via the REST API, and
error-path tests verify that no value was written.

**6.2 Test cases**

| Test | Description | Status |
|------|-------------|--------|
| `TestAttributeList_AllTypes` | Create fields of each type, set some values, run `list`, verify the command executes without error. | ✅ |
| `TestAttributeList_NoFields` | Run with no property fields executes without error. | ✅ |
| `TestAttributeList_MissingRunFlag` | Omitting `--run` executes without error (returns ephemeral error to user). | ✅ |
| `TestAttributeList_RunNotFound` | Non-existent run ID executes without error. | ✅ |
| `TestAttributeList_NoPermission` | User without `RunView` gets a permission error. | ✅ |
| `TestAttributeGet_ByName` | Get a field by name, verify command executes without error. | ✅ |
| `TestAttributeGet_ByNameCaseInsensitive` | Get a field using different casing. | ✅ |
| `TestAttributeGet_ByID` | Get a field by its ID. | ✅ |
| `TestAttributeGet_NotFound` | Non-existent field executes without error. | ✅ |
| `TestAttributeGet_NotSet` | Get a field that has no value set. | ✅ |
| `TestAttributeSet_Text` | Set a text field, verify value stored via API. | ✅ |
| `TestAttributeSet_Select` | Set a select field by option name, verify option ID stored. | ✅ |
| `TestAttributeSet_SelectCaseInsensitive` | Set with different-cased option name, verify option ID stored. | ✅ |
| `TestAttributeSet_Multiselect` | Set with multiple `--value` flags, verify array of IDs stored. | ✅ |
| `TestAttributeSet_InvalidOption` | Invalid option name, verify no value stored. | ✅ |
| `TestAttributeSet_MultipleValuesOnText` | Multiple `--value` on a text field, verify no value stored. | ✅ |
| `TestAttributeSet_UnsupportedType` | Setting a `date` field, verify no value stored. | ✅ |
| `TestAttributeSet_ClearValue` | `--value ""` clears the field, verify via API. | ✅ |
| `TestAttributeSet_NoPermission` | User without `RunManageProperties` gets error, verify no value stored. | ✅ |
| `TestAttributeSet_GetRoundTrip` | Set a value then get it; verify stored value via API. | ✅ |

### Acceptance Criteria

- [x] All test cases listed above pass.
- [x] Tests cover the full command execution cycle through `ExecuteCommand`.
- [x] Mutation tests (`set`) verify the stored property value via the REST API.
- [x] Error-path tests verify that no value was incorrectly written.

---

## Implementation Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Helpers — field resolution, option resolution, value display | Done |
| 1+ | `joinFieldArg` — multi-word field name support | Done |
| 2 | `/playbook attribute list` | Done |
| 3 | `/playbook attribute get` | Done |
| 4 | `/playbook attribute set` | Done |
| 5 | Autocomplete | Done |
| 6 | Integration tests | Done |

### Outstanding TODOs

All tasks complete.
