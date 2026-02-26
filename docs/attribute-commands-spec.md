# Slash Commands for Playbook Run Attributes — Technical Spec

**Status:** Implementation complete (with known limitation — see §3)
**Date:** 2026-02-25

## 1. Problem Statement

Playbook run properties (custom fields like "Severity", "Build Status", etc.)
can currently only be managed through the webapp UI or the REST API. There is no
way to inspect or update property values from inside a Mattermost channel without
leaving the conversation.

The goal is to add `/playbook attribute` slash commands that let users list
fields and get/set values on playbook runs directly from the channel, following
the same UX conventions as the `mmctl user attributes` commands.

## 2. Goals

1. Allow users to **list** the property fields defined on a playbook run.
2. Allow users to **get** the current value of a property field on a run.
3. Allow users to **set** the value of a property field on a run.
4. Accept field references by **name or ID** (name is the common case).
5. For `select`/`multiselect` fields, accept option **names** (resolved to IDs
   transparently), following the `mmctl` pattern.
6. Require a `--run <id>` flag to identify the target run. This avoids
   ambiguity when a channel has multiple active runs and ensures the command
   behaves consistently regardless of context.

## 3. Non-Goals and Known Limitations (first iteration)

- Managing property field definitions (create/edit/delete fields). Those are
  playbook-level operations done through the webapp.
- Supporting `date`, `user`, and `multiuser` property types. The backend's
  `sanitizeAndValidatePropertyValue` does not support them yet. The commands
  will return a clear error for these types.
- Tab-completion of field names or option values (can be added later via
  dynamic autocomplete).
- **Multi-word `--value` arguments are not supported.** The plugin's command
  infrastructure splits the command text using `strings.Fields`, which does not
  respect quotes. A value like `--value "hello world"` is split into separate
  tokens (`"hello` and `world"`), and only the first token is captured as the
  flag value — the rest leaks into the field name argument. Single-word values
  work correctly. Users who need to set multi-word text values should use the
  REST API. (Multi-word *field names* are supported via the `joinFieldArg`
  mechanism described in §5.5, because the field name is the only positional
  argument and all positional tokens can be safely joined.)

## 4. Research Summary

### 4.1 mmctl `user attributes` Pattern

The `mmctl user attributes value set` command follows this pattern:

```
mmctl user attributes value set <user> <field> --value <value> [--value <value2> ...]
```

- `<field>` accepts either the field ID or name. ID is tried first if it looks
  like a valid Mattermost ID (26-char), then name.
- `--value` is a repeatable flag. For `multiselect`/`multiuser` fields,
  multiple `--value` flags collect into an array.
- For `select`/`multiselect` fields, option **names** are accepted and
  transparently resolved to option IDs before storage.
- Display output resolves option IDs back to names.

### 4.2 Playbook Run Property System

- Property fields are defined on playbooks and **copied** to each run at
  creation time with fresh IDs and fresh option IDs.
- Supported types for setting values: `text`, `select`, `multiselect`.
  (`date`, `user`, `multiuser` exist as types but the backend's
  `sanitizeAndValidatePropertyValue` rejects them.)
- Values are set via `PlaybookRunService.SetRunPropertyValue(userID, runID,
  fieldID, json.RawMessage)`, which triggers condition evaluation, timeline
  events, and WebSocket notifications.
- Select/multiselect validation requires **option IDs**, not names. Name-to-ID
  resolution must happen before calling the service.

### 4.3 Current Slash Command Infrastructure

- Commands are routed through `command.Runner` which has access to
  `playbookRunService`, `propertyService`, and `permissions`.
- The current channel's run is resolved via
  `playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)`.
  This can return multiple runs if several are active on the same channel.
- Permission checks use `permissions.RunView(userID, runID)` and
  `permissions.RunManageProperties(userID, runID)`.
- Property fields on a run are fetched via
  `propertyService.GetRunPropertyFields(runID)`.
- Property values on a run are fetched via
  `propertyService.GetRunPropertyValues(runID)`.

## 5. Design

### 5.1 Command Tree

```
/playbook attribute
  list --run <id>                          — List all property fields and their current values
  get <field> --run <id>                   — Get the current value of a property field
  set <field> --value <value> --run <id>   — Set the value of a property field
```

All subcommands require a `--run <id>` flag to identify the target playbook
run. This avoids ambiguity when a channel has multiple active runs.

### 5.2 `/playbook attribute list`

```
/playbook attribute list --run <id>
```

Lists all property fields for the run with their current values. Output format:

```
**Properties for run "Incident #42":**

| Field | Type | Value |
|-------|------|-------|
| Severity | select | High |
| Build Status | text | passed |
| Tags | multiselect | backend, urgent |
| Deploy Date | date | *(unsupported type)* |
```

**Behavior:**

- Fetches fields via `propertyService.GetRunPropertyFields(runID)`.
- Fetches values via `propertyService.GetRunPropertyValues(runID)`.
- For `select` fields, resolves the stored option ID to the option name.
- For `multiselect` fields, resolves each stored option ID to its name and
  joins with `, `.
- For `text` fields, displays the raw string value.
- For unsupported types (`date`, `user`, `multiuser`), displays
  `*(unsupported type)*` as the value.
- Fields with no value set display `*(not set)*`.

**Permissions:** `RunView(userID, runID)`.

### 5.3 `/playbook attribute get`

```
/playbook attribute get <field> --run <id>
```

Gets the current value of a single property field. The `<field>` argument is
matched by name (case-insensitive) or by ID.

Output format:

```
**Severity** (select): High
```

Or when not set:

```
**Severity** (select): *(not set)*
```

**Permissions:** `RunView(userID, runID)`.

### 5.4 `/playbook attribute set`

```
/playbook attribute set <field> --value <value> [--value <value2> ...] --run <id>
```

Sets the value of a property field on a run.

**Field resolution:** The `<field>` argument is resolved by trying:
1. Exact ID match (if the argument looks like a valid Mattermost ID).
2. Case-insensitive name match.

**Value handling by type:**

| Type | `--value` input | Stored as |
|------|-----------------|-----------|
| `text` | `--value "Engineering"` | `"Engineering"` |
| `select` | `--value "High"` (option name) | `"<option-id>"` |
| `multiselect` | `--value "Go" --value "React"` | `["<id1>", "<id2>"]` |
| `date` | Rejected with error | — |
| `user` | Rejected with error | — |
| `multiuser` | Rejected with error | — |

**Option name resolution** (for `select` and `multiselect`):
- Iterate the field's `Attrs.Options`.
- Match each `--value` against option names (case-insensitive).
- If no name matches but the value looks like a valid Mattermost ID, try it
  as an option ID directly (fallback for automation).
- If still not found, return an error listing the valid option names.

**Quote stripping for values:** Since `strings.Fields` does not respect
quotes, `--value "High"` arrives as the string `"High"` with literal quote
characters, and `--value ""` arrives as two literal quote characters rather than
an empty string. After collecting `--value` flags, the commands strip
surrounding double-quote characters from each value (using `strings.Trim`).
This ensures option name resolution and clearing work correctly.

**Clearing a value:** `--value ""` clears the field (after quote stripping,
this becomes an empty string). For `multiselect`, `--value ""` with a single
empty string clears all selections.

**Output:**

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

**Permissions:** `RunManageProperties(userID, runID)`.

### 5.5 Multi-Word Field Name Handling

The plugin's command infrastructure splits `CommandArgs.Command` using
`strings.Fields`, which does not respect quotes. A field name like
`"Build Status"` arrives as two separate tokens `["\"Build", "Status\""]`.

To support multi-word field names, the `get` and `set` subcommands join all
positional arguments into a single string and strip surrounding quotes.
This means users can write either `"Build Status"` (with quotes) or
`Build Status` (without quotes, since there are no other positional args
to cause ambiguity) and both will resolve correctly.

### 5.6 Field Resolution Helper

A shared helper function resolves the `<field>` argument to a `PropertyField`:

```go
func resolveField(fields []app.PropertyField, fieldArg string) (*app.PropertyField, error)
```

1. If `model.IsValidId(fieldArg)`, try exact match on `field.ID`.
2. Try case-insensitive match on `field.Name`.
3. Return error with a hint listing available field names.

### 5.7 Option Name Resolution Helper

A shared helper for `select`/`multiselect` fields:

```go
func resolveOptionNames(field app.PropertyField, names []string) ([]string, error)
```

- For each name, try case-insensitive match on `option.GetName()`.
- Fallback: if `model.IsValidId(name)`, try as option ID.
- Return resolved IDs in the same order.
- On failure, return error listing valid option names.

### 5.8 Value Display Helper

A shared helper for displaying stored values in human-readable form:

```go
func displayValue(field app.PropertyField, value json.RawMessage) string
```

- `null`, empty, `len(value) == 0`, or empty JSON string `""` → `*(not set)*`
- `text` → unquoted string (empty string → `*(not set)*`)
- `select` → resolve option ID to name (empty option ID → `*(not set)*`)
- `multiselect` → resolve each option ID to name, join with `, ` (empty array → `*(not set)*`)
- Unsupported types → `*(unsupported type)*`

## 6. Implementation Plan

### 6.1 Command routing

In `command/command.go`:
- Add `case "attribute"` to the `Execute()` switch, dispatching to
  `r.actionAttribute(parameters)`.
- Add autocomplete entries for `attribute` with `list`, `get`, `set` children.

### 6.2 Command implementation

Create `command/attribute.go` with:
- `actionAttribute(args)` — dispatcher to `list`, `get`, `set`.
- `actionAttributeList(args)` — list fields and values.
- `actionAttributeGet(args)` — get a single field value.
- `actionAttributeSet(args)` — set a field value.
- `resolveField(fields, fieldArg)` — field name/ID resolution.
- `resolveOptionNames(field, names)` — option name resolution for
  select/multiselect.
- `displayValue(field, value)` — human-readable value display.

### 6.3 Run resolution

All three subcommands require `--run <id>`. The run is fetched via
`playbookRunService.GetPlaybookRun(id)`. If the flag is missing, the command
returns an error. If the run is not found, the command returns an error.

### 6.4 Dependencies

No new dependencies are needed. The command runner already has:
- `playbookRunService` — for `GetPlaybookRun`, `SetRunPropertyValue`.
- `propertyService` — for `GetRunPropertyFields`, `GetRunPropertyValues`.
- `permissions` — for `RunView`, `RunManageProperties`.

## 7. Error Cases

| Scenario | Error message |
|----------|---------------|
| Missing `--run` flag | "The `--run <id>` flag is required." |
| Run not found by ID | "Run not found: `<id>`" |
| No permission to view run | "You don't have permission to access this run." |
| No permission to manage properties | "You don't have permission to manage properties on this run." |
| Field not found by name or ID | "Field not found: `<field>`. Available fields: Severity, Build Status, Tags" |
| Missing `--value` flag on `set` | "The `--value` flag is required." |
| Unsupported field type on `set` | "Setting values for `<type>` fields is not yet supported." |
| Invalid option name for select | "Invalid option `<name>` for field `<field>`. Valid options: High, Medium, Low" |
| Multiple `--value` flags for a single-value type | "Field `<field>` (text\|select) only accepts a single value." |

## 8. Examples

```
# List all properties on a run
/playbook attribute list --run abc123def456ghi789jkl012mn

# Get a specific field value
/playbook attribute get Severity --run abc123def456ghi789jkl012mn

# Get a field with a multi-word name (quotes optional, see §5.5)
/playbook attribute get "Build Status" --run abc123def456ghi789jkl012mn

# Set a text property
/playbook attribute set "Build Status" --value passed --run abc123def456ghi789jkl012mn

# Set a select property by option name
/playbook attribute set Severity --value High --run abc123def456ghi789jkl012mn

# Set a multiselect property
/playbook attribute set Tags --value backend --value urgent --run abc123def456ghi789jkl012mn

# Clear a property value
/playbook attribute set "Build Status" --value "" --run abc123def456ghi789jkl012mn
```

## 9. Future Extensions

- **Tab completion:** Register dynamic autocomplete endpoints for field names
  and option values.
- **`date`, `user`, `multiuser` support:** Once the backend adds validation
  for these types, extend the commands to accept them (dates as ISO 8601,
  users as @username resolved to ID).
- **Bulk set:** `/playbook attribute set Severity=High "Build Status"=passed`
  — set multiple fields in one command.
- **`unset` subcommand:** Explicitly clear a field value (alternative to
  `--value ""`).
