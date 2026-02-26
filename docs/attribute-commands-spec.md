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

## 10. Built-in Variables for Slash Command Substitution

### 10.1 Problem

When a slash command is executed from a checklist item (via
`RunChecklistItemSlashCommand`), the command has no automatic access to the
playbook run's context. The existing variable substitution system (see
`server/app/variables.go`) only resolves variables defined manually in the run
summary. There is no way to reference the run ID, property values, or other
run metadata without the user explicitly defining them.

### 10.2 Run Metadata Variables

A set of built-in variables prefixed with `$PB_` are injected into the variable
map before user-defined variables are resolved. These are always available in
checklist item slash commands.

| Variable | Source | Description |
|----------|--------|-------------|
| `$PB_RUN_ID` | `run.ID` | The playbook run ID |
| `$PB_RUN_NAME` | `run.Name` | The playbook run name |
| `$PB_CHANNEL_ID` | `run.ChannelID` | The run's channel ID |
| `$PB_TEAM_ID` | `run.TeamID` | The run's team ID |
| `$PB_OWNER_USER_ID` | `run.OwnerUserID` | The run owner's user ID |
| `$PB_PLAYBOOK_ID` | `run.PlaybookID` | The playbook ID |

Built-in variables take precedence over user-defined variables with the same
name. The `$PB_` prefix is reserved for built-in variables.

### 10.3 Property Field Variables

In addition to run metadata, variables are generated from the run's property
fields and their current values. This allows slash commands to reference
attribute values dynamically — e.g., a command template can include
`$PB_Severity` and it will be replaced with the current value of the
"Severity" field at execution time.

#### 10.3.1 Variable Naming

Each property field produces variables using **both** its name and its ID as
the key, so that either can be used interchangeably in command templates.

Given a field with name `DEFCON` and ID `abc123def456ghi789jkl012mn`:
- `$PB_DEFCON` and `$PB_abc123def456ghi789jkl012mn` resolve to the same value.

**Name normalization:** Field names are converted to valid variable names by
replacing any character that is not `[a-zA-Z0-9_]` with `_`. For example:
- `Build Status` → `$PB_Build_Status`
- `my-field` → `$PB_my_field`
- `Tags (v2)` → `$PB_Tags__v2_`

Field IDs, being 26-character alphanumeric Mattermost IDs, are always valid
without normalization.

#### 10.3.2 Variables by Field Type

**`text` fields:**

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The raw text value. Empty string if not set. |

**`select` fields:**

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The option **name** (human-readable). Empty string if not set. |
| `$PB_FIELDNAME_ID` / `$PB_FIELDID_ID` | The option **ID**. Empty string if not set. |

**`multiselect` fields (first iteration):**

Only the **first** selected option is exposed:

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The **name** of the first selected option. Empty string if none selected. |
| `$PB_FIELDNAME_ID` / `$PB_FIELDID_ID` | The **ID** of the first selected option. Empty string if none selected. |

**`user` fields:**

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The **username** (e.g. `johndoe`). Empty string if not set. |
| `$PB_FIELDNAME_FULLNAME` / `$PB_FIELDID_FULLNAME` | The user's full name (`FirstName LastName`). Empty string if not set. |
| `$PB_FIELDNAME_ID` / `$PB_FIELDID_ID` | The **user ID**. Empty string if not set. |

**`multiuser` fields (first iteration):**

Only the **first** user is exposed:

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The **username** of the first user. Empty string if none set. |
| `$PB_FIELDNAME_FULLNAME` / `$PB_FIELDID_FULLNAME` | The full name of the first user. Empty string if none set. |
| `$PB_FIELDNAME_ID` / `$PB_FIELDID_ID` | The **user ID** of the first user. Empty string if none set. |

**`date` fields:**

| Variable | Value |
|----------|-------|
| `$PB_FIELDNAME` / `$PB_FIELDID` | The raw stored value (timestamp as string). Empty string if not set. |

#### 10.3.3 Unset Fields

When a property field has no value set (null, empty, or missing from the
values list), all its variables resolve to an empty string `""`. Because the
existing substitution loop rejects empty variables with an error, a command
that references an unset field will fail with:
`"Found undefined or empty variable in slash command: $PB_Severity"`

This is intentional — it prevents commands from silently executing with
missing data and gives the user a clear signal that the field must be set
before the command can run.

#### 10.3.4 Precedence

1. **Built-in run metadata variables** (`$PB_RUN_ID`, etc.) — highest priority.
2. **Property field variables** (`$PB_Severity`, etc.).
3. **User-defined variables** from the run summary (`$myVar=foo`) — lowest
   priority.

If a property field is named `RUN_ID`, the variable `$PB_RUN_ID` still
resolves to the run metadata, not the property value. The property is still
accessible via its field ID: `$PB_<fieldID>`.

### 10.4 Examples

Given a run with:
- ID: `r1a2b3c4d5e6f7g8h9i0j1k2l3`
- Field "Severity" (select, ID `f1a2b3c4d5e6f7g8h9i0j1k2l3`), value: "High" (option ID `o1a2...`)
- Field "Assignee" (user, ID `f2b3c4d5e6f7g8h9i0j1k2l3m4`), value: user `janedoe` (ID `u1a2...`, full name "Jane Doe")
- Field "Build Status" (text), value: `passed`

The following command templates:

```
/notify --severity $PB_Severity --run $PB_RUN_ID
/assign --user $PB_Assignee_ID --name $PB_Assignee
/deploy --status $PB_Build_Status --assignee-name $PB_Assignee_FULLNAME
```

Would be substituted to:

```
/notify --severity High --run r1a2b3c4d5e6f7g8h9i0j1k2l3
/assign --user u1a2... --name janedoe
/deploy --status passed --assignee-name Jane Doe
```

Note: `$PB_Assignee_FULLNAME` expands to `Jane Doe` (with a space). This is
the same risk as any user-defined variable — raw `strings.ReplaceAll` does not
escape values. Users should be mindful of spaces in values used as flag
arguments.

### 10.5 Known Limitations and Future Improvements

The following are known limitations of the first implementation. They are
documented here for awareness but are **not in scope for the MVP**.

#### 10.5.1 Namespace collision between run metadata and property fields

Run metadata variables and property field variables share the `$PB_` prefix.
If a property field is named `RUN_ID`, `CHANNEL_ID`, `TEAM_ID`, etc., its
name-based variable (`$PB_RUN_ID`) collides with the run metadata variable of
the same name. The run metadata variable wins (see §10.3.4), and the property
is only accessible via its field-ID-based variable (`$PB_<fieldID>`).

A future improvement could use a separate prefix for attribute variables, e.g.
`$PB_ATTRS_` (so the field would be `$PB_ATTRS_RUN_ID`), eliminating any
possibility of collision with run metadata. This would make the two namespaces
fully independent:

| Namespace | Prefix | Example |
|-----------|--------|---------|
| Run metadata | `$PB_` | `$PB_RUN_ID`, `$PB_CHANNEL_ID` |
| Property fields | `$PB_ATTRS_` | `$PB_ATTRS_Severity`, `$PB_ATTRS_Severity_ID` |

This change should be evaluated before the variable system stabilizes and
users start depending on the `$PB_` prefix for attributes.

#### 10.5.2 Field name collisions after normalization

The current name normalization (§10.3.1) replaces all non-`[a-zA-Z0-9_]`
characters with `_`. This means distinct field names can produce the same
variable name. For example, a playbook with all three of these fields:

- `Security Level` → `$PB_Security_Level`
- `Security-Level` → `$PB_Security_Level`
- `Security_Level` → `$PB_Security_Level`

All three normalize to the same variable. Only one value can be stored under
that key (last-one-wins), making the name-based variable unreliable when
collisions exist. The field-ID-based variable (`$PB_<fieldID>`) is always
unambiguous and should be used in these cases.

A future improvement could support a brace syntax for variable names that
preserves the original field name, e.g.:

```
/notify --level ${PB_Security Level}
```

This would require changes to the variable regex (`reVars`) and the
substitution loop to recognize `${...}` in addition to `$name`. It would
fully solve the collision problem and also allow field names with special
characters to be referenced directly, without relying on IDs.

The MVP should include **test cases** that document this collision behavior:
- Fields with spaces in the name (e.g. `Build Status`) are accessible via the
  normalized name (`$PB_Build_Status`) and via the field ID.
- Fields with hyphens (e.g. `my-field`) are accessible via `$PB_my_field` and
  via the field ID.
- When multiple fields normalize to the same variable name, the field-ID-based
  variables remain correct and distinct.
