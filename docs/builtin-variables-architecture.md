# Proposal A Implementation Plan — Built-in Variables for Slash Commands

**Date:** 2026-02-26
**Spec:** [attribute-commands-spec.md](./attribute-commands-spec.md) (§10)
**Proposals:** [pass-run-id-to-slash-command-proposals.md](./pass-run-id-to-slash-command-proposals.md)

---

## Overview

Inject built-in playbook run variables into the variable map used by
`RunChecklistItemSlashCommand` before user-defined variables are resolved. This
covers two categories of variables:

1. **Run metadata variables** — static properties of the run itself (`$PB_RUN_ID`,
   `$PB_CHANNEL_ID`, etc.).
2. **Property field variables** — dynamic variables derived from the run's
   attribute fields and their current values (`$PB_Severity`, `$PB_Severity_ID`,
   `$PB_Assignee_FULLNAME`, etc.).

This allows command templates like:

```
/playbook attribute set Severity --value High --run $PB_RUN_ID
/notify --severity $PB_Severity --user $PB_Assignee_ID
```

where variables are automatically replaced with actual values at execution time.

---

## Phase 1: Run Metadata Variables — Helper and Unit Tests

**Goal:** Implement the function that produces built-in run metadata variables
from a `PlaybookRun`, and test it in isolation. No wiring into
`RunChecklistItemSlashCommand` yet.

### 1.1 New function in `server/app/variables.go`

Add `builtinRunVariables`:

```go
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
```

**Why a separate function instead of inlining?**
- Testable in isolation.
- Single place to add more built-in variables in the future.
- Can be reused if other features need the same variable set (e.g., webhook
  payloads, outgoing webhook templates).

### 1.2 Unit tests in `server/app/variables_test.go`

**Test: all fields are populated correctly**

```go
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
}
```

**Test: built-in variables override user-defined ones**

```go
func TestBuiltinVariablesOverrideUserDefined(t *testing.T) {
    userVars := parseVariablesAndValues("$PB_RUN_ID=user-value")

    run := &PlaybookRun{ID: "real-run-id"}
    for k, v := range builtinRunVariables(run) {
        userVars[k] = v
    }

    assert.Equal(t, "real-run-id", userVars["$PB_RUN_ID"])
}
```

**Test: all variable names are matched by the existing regex**

```go
func TestBuiltinVariableNamesMatchRegex(t *testing.T) {
    run := &PlaybookRun{
        ID: "x", Name: "x", ChannelID: "x",
        TeamID: "x", OwnerUserID: "x", PlaybookID: "x",
    }
    for varName := range builtinRunVariables(run) {
        matches := parseVariables(varName)
        assert.Equal(t, []string{varName}, matches,
            "built-in variable %s should be matched by the variable regex", varName)
    }
}
```

### Acceptance Criteria

- [ ] `builtinRunVariables` returns a map with all six `$PB_` variables.
- [ ] Each variable maps to the correct `PlaybookRun` field.
- [ ] When merged into a user-defined variable map, built-ins override
      user-defined variables with the same name.
- [ ] All `$PB_` variable names are matched by the existing `reVars` regex.
- [ ] All unit tests pass.

---

## Phase 2: Wire Run Metadata Variables into `RunChecklistItemSlashCommand`

**Goal:** Modify `RunChecklistItemSlashCommand` to inject run metadata
variables into the variable map before the substitution loop. After this phase,
commands using `$PB_RUN_ID` etc. will work end-to-end.

### 2.1 Modify `server/app/playbook_run_service.go`

**Current code** (lines 2284–2296):

```go
// parse playbook summary for variables and values
varsAndVals := parseVariablesAndValues(playbookRun.Summary)

// parse slash command for variables
varsInCmd := parseVariables(itemToRun.Command)

command := itemToRun.Command
for _, v := range varsInCmd {
    if val, ok := varsAndVals[v]; !ok || val == "" {
        s.poster.EphemeralPost(userID, playbookRun.ChannelID, &model.Post{Message: fmt.Sprintf("Found undefined or empty variable in slash command: %s", v)})
        return "", errors.Errorf("Found undefined or empty variable in slash command: %s", v)
    }
    command = strings.ReplaceAll(command, v, varsAndVals[v])
}
```

**New code:**

```go
// parse playbook summary for variables and values
varsAndVals := parseVariablesAndValues(playbookRun.Summary)

// inject built-in run metadata variables (these take precedence over
// user-defined variables with the same name)
for k, v := range builtinRunVariables(playbookRun) {
    varsAndVals[k] = v
}

// parse slash command for variables
varsInCmd := parseVariables(itemToRun.Command)

command := itemToRun.Command
for _, v := range varsInCmd {
    if val, ok := varsAndVals[v]; !ok || val == "" {
        s.poster.EphemeralPost(userID, playbookRun.ChannelID, &model.Post{Message: fmt.Sprintf("Found undefined or empty variable in slash command: %s", v)})
        return "", errors.Errorf("Found undefined or empty variable in slash command: %s", v)
    }
    command = strings.ReplaceAll(command, v, varsAndVals[v])
}
```

The change is 4 lines: a `for` loop that merges the built-in variables into
`varsAndVals` after parsing user-defined variables from the summary. Built-ins
are written last, so they take precedence over any user-defined variable with
the same name.

**No other changes to this method.** The rest of the variable substitution
loop, the `SlashCommand.Execute` call, the error handling, the timeline event
creation — all remain identical.

### Acceptance Criteria

- [ ] A checklist item command containing `$PB_RUN_ID` is substituted with the
      actual run ID before execution.
- [ ] A checklist item command containing `$PB_CHANNEL_ID`, `$PB_TEAM_ID`,
      `$PB_OWNER_USER_ID`, `$PB_PLAYBOOK_ID`, or `$PB_RUN_NAME` is substituted
      correctly.
- [ ] A command with no `$PB_` variables behaves identically to before (no
      regression).
- [ ] A command mixing user-defined and built-in variables substitutes both
      correctly.
- [ ] If a user defines `$PB_RUN_ID=custom` in the summary, the built-in value
      (the actual run ID) takes precedence.

---

## Phase 3: Property Field Variables — Name Normalization and Variable Generation

**Goal:** Implement the function that generates variables from a run's property
fields and their current values. This includes name normalization, type-specific
variable generation, and dual-key registration (by field name and field ID).
Test in isolation without wiring.

### 3.1 Name normalization helper in `server/app/variables.go`

Add `normalizeFieldName`:

```go
var reNonVarChar = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// normalizeFieldName converts a property field name into a string that is
// valid as part of a variable name. Any character not in [a-zA-Z0-9_] is
// replaced with "_".
//
// Examples:
//   "Build Status" → "Build_Status"
//   "my-field"     → "my_field"
//   "Tags (v2)"    → "Tags__v2_"
func normalizeFieldName(name string) string {
    return reNonVarChar.ReplaceAllString(name, "_")
}
```

### 3.2 User resolver type

The property variable builder needs to resolve user IDs to usernames and full
names for `user`/`multiuser` fields. To keep the function testable, define a
small interface rather than depending on `pluginapi.Client` directly:

```go
// UserResolver looks up a user by ID. In production this is backed by
// pluginAPI.User.Get; in tests it can be a simple map.
type UserResolver interface {
    GetUser(userID string) (*model.User, error)
}
```

### 3.3 Property variable builder in `server/app/variables.go`

Add `builtinPropertyVariables`:

```go
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
) map[string]string
```

**Internal logic:**

1. Build a `fieldID → json.RawMessage` map from `values`.
2. For each field, compute two prefixes: `"$PB_" + normalizeFieldName(field.Name)`
   and `"$PB_" + field.ID`.
3. For each prefix, generate the appropriate variables based on field type:

| Type | Variables per prefix | Value source |
|------|---------------------|--------------|
| `text` | `PREFIX` | JSON-unmarshal as string |
| `select` | `PREFIX` (option name), `PREFIX_ID` (option ID) | JSON-unmarshal as string (option ID), resolve to name via `field.Attrs.Options` |
| `multiselect` | `PREFIX` (first option name), `PREFIX_ID` (first option ID) | JSON-unmarshal as `[]string`, take first element, resolve to name |
| `user` | `PREFIX` (username), `PREFIX_FULLNAME` (full name), `PREFIX_ID` (user ID) | JSON-unmarshal as string (user ID), resolve via `userResolver` |
| `multiuser` | `PREFIX` (first username), `PREFIX_FULLNAME` (first full name), `PREFIX_ID` (first user ID) | JSON-unmarshal as `[]string`, take first element, resolve via `userResolver` |
| `date` | `PREFIX` | Raw stored value as string |

4. If a field has no value (missing from map, null, empty string, empty array),
   all its variables are set to `""` (empty string).

### 3.4 Unit tests in `server/app/variables_test.go`

**Test: `normalizeFieldName` cases**

```go
func TestNormalizeFieldName(t *testing.T) {
    assert.Equal(t, "Build_Status", normalizeFieldName("Build Status"))
    assert.Equal(t, "my_field", normalizeFieldName("my-field"))
    assert.Equal(t, "Tags__v2_", normalizeFieldName("Tags (v2)"))
    assert.Equal(t, "Severity", normalizeFieldName("Severity"))
    assert.Equal(t, "a_b_c", normalizeFieldName("a.b.c"))
}
```

**Test: text field generates `$PB_Name` and `$PB_ID` variables**

Create a text field "Build Status" (ID `fld1...`) with value `"passed"`.
Verify:
- `$PB_Build_Status` = `"passed"`
- `$PB_fld1...` = `"passed"`

**Test: select field generates name and ID variants**

Create a select field "Severity" with option "High" (ID `opt1...`), value set
to `opt1...`. Verify:
- `$PB_Severity` = `"High"`
- `$PB_Severity_ID` = `"opt1..."`
- Same for field-ID-based keys.

**Test: multiselect field uses first option only**

Create a multiselect field "Tags" with options "backend" and "urgent" selected.
Verify `$PB_Tags` = `"backend"` (first), `$PB_Tags_ID` = first option's ID.

**Test: user field generates username, fullname, and ID**

Create a mock `UserResolver` that returns `{Username: "janedoe", FirstName:
"Jane", LastName: "Doe"}`. Create a user field "Assignee" with value
`"user123"`. Verify:
- `$PB_Assignee` = `"janedoe"`
- `$PB_Assignee_FULLNAME` = `"Jane Doe"`
- `$PB_Assignee_ID` = `"user123"`

**Test: multiuser field uses first user only**

Same as above but with `["user123", "user456"]`; only `user123` is resolved.

**Test: unset field produces empty strings**

Create a text field with no value in the values list. Verify `$PB_FieldName`
= `""`.

**Test: dual-key — name and ID produce the same values**

For every variable `$PB_<NormalizedName>...`, verify that
`$PB_<FieldID>...` produces the same value.

**Test: normalized variable names match the regex**

All generated variable keys match the `reVars` regex.

### Acceptance Criteria

- [ ] `normalizeFieldName` replaces non-`[a-zA-Z0-9_]` characters with `_`.
- [ ] `builtinPropertyVariables` generates correct variables for `text` fields.
- [ ] `builtinPropertyVariables` generates `PREFIX` and `PREFIX_ID` for
      `select` fields, with name and option ID respectively.
- [ ] `builtinPropertyVariables` uses only the first option for `multiselect`.
- [ ] `builtinPropertyVariables` generates `PREFIX`, `PREFIX_FULLNAME`, and
      `PREFIX_ID` for `user` fields.
- [ ] `builtinPropertyVariables` uses only the first user for `multiuser`.
- [ ] `builtinPropertyVariables` generates raw value for `date` fields.
- [ ] Unset fields produce empty string variables.
- [ ] Both field-name-based and field-ID-based keys are registered.
- [ ] All generated variable names match the `reVars` regex.
- [ ] All unit tests pass.

---

## Phase 4: Wire Property Variables into `RunChecklistItemSlashCommand`

**Goal:** Extend the wiring added in Phase 2 to also inject property field
variables. After this phase, commands using `$PB_Severity`, `$PB_Assignee_ID`,
etc. will work end-to-end.

### 4.1 Modify `server/app/playbook_run_service.go`

The Phase 2 code injected run metadata variables. This phase adds property
variables between the run metadata injection and the substitution loop.

**New code** (additions marked with `// NEW`):

```go
// parse playbook summary for variables and values
varsAndVals := parseVariablesAndValues(playbookRun.Summary)

// inject property field variables                              // NEW
propertyFields, err := s.propertyService.GetRunPropertyFields(playbookRunID)  // NEW
if err != nil {                                                 // NEW
    logrus.WithError(err).Warn("failed to fetch property fields for variable substitution")  // NEW
}                                                               // NEW
propertyValues, err := s.propertyService.GetRunPropertyValues(playbookRunID)  // NEW
if err != nil {                                                 // NEW
    logrus.WithError(err).Warn("failed to fetch property values for variable substitution")  // NEW
}                                                               // NEW
for k, v := range builtinPropertyVariables(propertyFields, propertyValues, s.pluginAPI.User) {  // NEW
    varsAndVals[k] = v                                          // NEW
}                                                               // NEW

// inject built-in run metadata variables (these take precedence
// over property variables and user-defined variables)
for k, v := range builtinRunVariables(playbookRun) {
    varsAndVals[k] = v
}

// parse slash command for variables
varsInCmd := parseVariables(itemToRun.Command)
// ... rest unchanged
```

**Injection order (determines precedence):**

1. User-defined variables from summary (lowest priority)
2. Property field variables
3. Run metadata variables (highest priority — `$PB_RUN_ID` etc.)

Each layer overwrites keys from the previous one, so run metadata always wins.
This ensures that if a property field happens to be named "RUN_ID", the
`$PB_RUN_ID` variable still resolves to the run's actual ID. The property
field's value remains accessible via `$PB_<fieldID>`.

**Error handling:** Property fetch failures are logged as warnings but do
**not** abort the command. The command can still execute if it doesn't reference
any property variables. If it does, those variables will be missing and the
existing undefined-variable error will fire.

### 4.2 `UserResolver` adapter

`s.pluginAPI.User` is of type `pluginapi.UserService`, which has a
`Get(userID string) (*model.User, error)` method. The `UserResolver` interface
from Phase 3 needs a `GetUser(userID string)` method.

Add a thin adapter (in `server/app/variables.go`):

```go
// pluginAPIUserResolver adapts pluginapi.UserService to the UserResolver
// interface.
type pluginAPIUserResolver struct {
    userService interface {
        Get(userID string) (*model.User, error)
    }
}

func (r *pluginAPIUserResolver) GetUser(userID string) (*model.User, error) {
    return r.userService.Get(userID)
}
```

In `RunChecklistItemSlashCommand`, pass `&pluginAPIUserResolver{s.pluginAPI.User}`
as the `UserResolver`. Alternatively, since `pluginapi.UserService.Get` already
matches the signature, the interface can be defined to match it directly:

```go
type UserResolver interface {
    Get(userID string) (*model.User, error)
}
```

Then `s.pluginAPI.User` satisfies `UserResolver` without an adapter.

### Acceptance Criteria

- [ ] A command containing `$PB_Severity` is substituted with the field's
      current option name.
- [ ] A command containing `$PB_Severity_ID` is substituted with the option ID.
- [ ] A command containing `$PB_Assignee` is substituted with the username.
- [ ] A command containing `$PB_Assignee_FULLNAME` is substituted with the
      full name.
- [ ] A command containing `$PB_Assignee_ID` is substituted with the user ID.
- [ ] A command using `$PB_<fieldID>` resolves the same as `$PB_<fieldName>`.
- [ ] Unset property fields cause the expected "undefined or empty variable"
      error.
- [ ] Property fetch failure is logged but doesn't abort the command if no
      property variables are referenced.
- [ ] Run metadata variables (`$PB_RUN_ID`) still take precedence over a
      property field named `RUN_ID`.

---

## Phase 5: Integration Tests

**Goal:** End-to-end validation of both run metadata and property field
variable substitution, using the plugin's test infrastructure.

### 5.1 Run metadata variable tests

**Test: `$PB_RUN_ID` is substituted in the executed command**

Set up a playbook run with a checklist item whose command is
`/playbook attribute list --run $PB_RUN_ID`. Execute
`RunChecklistItemSlashCommand`. Verify the command that reached
`SlashCommand.Execute` contains the literal run ID, not the variable.

**Test: command with no variables still works**

Set up a checklist item with command `/echo hello`. Execute
`RunChecklistItemSlashCommand`. Verify it executes without error (regression
check).

**Test: mixed user-defined and built-in variables**

Set up a run with summary containing `$ENV=production`. Set up a checklist item
with command `/deploy --env $ENV --run $PB_RUN_ID`. Execute
`RunChecklistItemSlashCommand`. Verify both variables are substituted.

**Test: built-in overrides user-defined**

Set up a run with summary containing `$PB_RUN_ID=fake-id`. Set up a checklist
item with command `/echo $PB_RUN_ID`. Execute
`RunChecklistItemSlashCommand`. Verify the substituted value is the actual run
ID, not `fake-id`.

### 5.2 Property field variable tests

**Test: text field variable substitution**

Create a run with a text field "Build Status" set to `"passed"`. Set up a
checklist item with command `/echo $PB_Build_Status`. Verify substitution.

**Test: select field name and ID variables**

Create a run with a select field "Severity" set to option "High". Set up a
command using both `$PB_Severity` and `$PB_Severity_ID`. Verify the name
resolves to `"High"` and the ID resolves to the option ID.

**Test: user field username, fullname, and ID variables**

Create a run with a user field "Assignee" set to a known user. Verify
`$PB_Assignee`, `$PB_Assignee_FULLNAME`, and `$PB_Assignee_ID` are all
substituted correctly.

**Test: field-ID-based variable matches field-name-based**

Use `$PB_<fieldID>` in a command. Verify it resolves to the same value as
`$PB_<normalizedFieldName>`.

**Test: unset property field causes error**

Create a run with a field that has no value. Use `$PB_<fieldName>` in a
command. Verify the "undefined or empty variable" error fires.

**Test: run metadata takes precedence over property named RUN_ID**

Create a property field literally named `RUN_ID`. Verify `$PB_RUN_ID` still
resolves to the run's actual ID.

### Acceptance Criteria

- [ ] Integration test for `$PB_RUN_ID` substitution passes.
- [ ] Regression test for commands without variables passes.
- [ ] Test for mixed user-defined and built-in variables passes.
- [ ] Test for built-in override precedence passes.
- [ ] Test for text field variable substitution passes.
- [ ] Test for select field name/ID variable substitution passes.
- [ ] Test for user field username/fullname/ID substitution passes.
- [ ] Test for field-ID-based variables passes.
- [ ] Test for unset property field error passes.
- [ ] Test for run metadata precedence over equally-named property passes.

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `server/app/variables.go` | Add `builtinRunVariables`, `normalizeFieldName`, `builtinPropertyVariables`, `UserResolver` interface |
| `server/app/variables_test.go` | Unit tests for all new functions |
| `server/app/playbook_run_service.go` | ~15 lines in `RunChecklistItemSlashCommand` to inject both run metadata and property variables |

## Files NOT Changed

| File | Why not |
|------|---------|
| `server/command/command.go` | The command runner doesn't need to know about built-in variables. It receives the already-substituted command string via `args.Command`. |
| `server/command/attribute.go` | The `--run` flag parsing is unchanged. It receives a literal run ID in the command text. |
| `server/app/playbook_run.go` | No interface changes. `RunChecklistItemSlashCommand` signature is unchanged. |
| `server/api/playbook_runs.go` | The API endpoint calls `RunChecklistItemSlashCommand` with the same arguments. |
| `server/plugin.go` | `ExecuteCommand` hook is unchanged. |
| `model.CommandArgs` / `plugin.Context` | No server-side changes. |

---

## Behavior Summary

| Scenario | Before | After |
|----------|--------|-------|
| `/playbook attribute set Sev --value High --run $PB_RUN_ID` | Error: undefined variable | Substituted with run ID and executed |
| `/echo hello` (no variables) | Executed as-is | Executed as-is (no change) |
| `/webhook fire --id $PB_RUN_ID` | Error: undefined variable | Substituted and executed |
| `/notify --severity $PB_Severity` | Error: undefined variable | Substituted with option name (e.g. `High`) |
| `/assign --user $PB_Assignee_ID` | Error: undefined variable | Substituted with user ID |
| `/echo $PB_Assignee_FULLNAME` | Error: undefined variable | Substituted with full name (e.g. `Jane Doe`) |
| Summary defines `$PB_RUN_ID=custom` | `$PB_RUN_ID` → `custom` | `$PB_RUN_ID` → actual run ID (built-in wins) |
| Summary defines `$myVar=foo`, command uses `$myVar` | `$myVar` → `foo` | `$myVar` → `foo` (unchanged) |
| Property field "Severity" not set, command uses `$PB_Severity` | N/A | Error: "Found undefined or empty variable: $PB_Severity" |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| User defines `$PB_RUN_ID` in summary, expects their value | Built-ins take precedence. Document that `$PB_` prefix is reserved. |
| `$PB_RUN_NAME` or `$PB_FIELDNAME_FULLNAME` contains spaces, breaking command parsing | Same risk as any user-defined variable. Document that values with spaces should be used carefully in flag positions. |
| Two fields normalize to the same variable name (e.g. `Build Status` and `Build-Status` both → `$PB_Build_Status`) | Last-one-wins in the map. Both are also accessible via their unique `$PB_<fieldID>` key, which is always unambiguous. |
| Property field named `RUN_ID` collides with `$PB_RUN_ID` | Run metadata variables are injected last and take precedence. The property is still accessible via `$PB_<fieldID>`. |
| User lookup fails for `user`/`multiuser` fields | Log a warning, set the user variables to empty strings. The command will fail with "undefined or empty variable" only if it references those variables. |
| Timeline event shows the substituted command (with raw IDs) | Existing behavior for all variables. No change. |
| Property service fetch failure | Logged as warning. Commands that don't reference property variables continue to work. Commands that do will get the existing "undefined variable" error. |

---

## Implementation Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Run metadata variables — `builtinRunVariables` helper + unit tests | ✅ Done |
| 2 | Wire run metadata variables into `RunChecklistItemSlashCommand` | ✅ Done |
| 3 | Property field variables — `normalizeFieldName`, `builtinPropertyVariables` + unit tests | ✅ Done |
| 4 | Wire property variables into `RunChecklistItemSlashCommand` | ✅ Done |
| 5 | Integration tests (run metadata + property variables) | ✅ Done |
| 6 | Brace syntax `${...}` — parser extension + unit tests | Not started |
| 7 | Replace normalized keys with raw-name keys, update tests + integration tests | Not started |

---

## Phase 6: Brace Syntax `${...}` — Parser Extension and Unit Tests

**Goal:** Extend the variable parser to recognize `${...}` as a variable
reference in addition to the existing `$name` syntax. This allows field names
with spaces and special characters to be referenced directly in command
templates without normalization or field IDs:

```
/notify --level ${PB_Security Level}
/deploy --status ${PB_Build Status} --run $PB_RUN_ID
```

Both syntaxes coexist. The brace syntax is **required** for names that contain
characters outside `[a-zA-Z0-9_]`. For simple names, `$PB_Severity` and
`${PB_Severity}` are equivalent.

### 6.1 Problem recap

The current regex `(\$[a-zA-Z0-9_]+)` only matches variable names composed of
alphanumeric characters and underscores. Property field names like
`"Security Level"` or `"my-field"` are normalized (spaces/hyphens → `_`) to
produce valid variable keys, but this normalization is lossy:

- `Security Level` and `Security-Level` both normalize to `$PB_Security_Level`
- The field-ID-based variable (`$PB_<fieldID>`) is always unambiguous, but not
  user-friendly

The brace syntax `${PB_Security Level}` preserves the original field name,
eliminating both the collision problem and the need to know field IDs.

### 6.2 Design

#### 6.2.1 New regex

Add a second pattern that matches `${...}` where the content inside the braces
can contain any character except `}`:

```go
var varsReStr = `(\$[a-zA-Z0-9_]+)`
var bracedVarsReStr = `(\$\{[^}]+\})`
var combinedVarsReStr = bracedVarsReStr + `|` + varsReStr
```

The combined regex tries the braced form **first** (leftmost alternative wins
in the regex engine). This ensures that `${PB_Severity}` is matched as a
single braced variable, not as `$` followed by literal `{PB_Severity}`.

The compiled regex:

```go
var reVars = regexp.MustCompile(combinedVarsReStr)
```

#### 6.2.2 Variable map keys — braces as part of the key

The fundamental rule is: **braces mark the boundary of a variable name.** An
unbraced reference like `$PB_Security Level` is parsed as the variable
`$PB_Security` followed by the literal text ` Level`. Only the braced form
`${PB_Security Level}` captures the full name including the space.

This means braced and unbraced references are distinct tokens with distinct
map keys. The map stores keys **exactly as they would be written in a
command**:

- Simple names (no special chars): stored as `$PB_Severity`
- Names with special chars: stored as `${PB_Security Level}` (with braces)
- Field IDs: stored as `$PB_fld123...` (IDs are alphanumeric, always unbraced)
- Run metadata: stored as `$PB_RUN_ID` (always unbraced)
- User-defined: stored as `$myVar` (always unbraced)

#### 6.2.3 The `needsBraces` helper

A small helper determines whether a field name requires braced keys:

```go
// needsBraces returns true if the name contains characters that are not
// valid in unbraced variable names ([a-zA-Z0-9_]).
func needsBraces(name string) bool {
    return reNonVarChar.MatchString(name)
}
```

This reuses the existing `reNonVarChar` regex from Phase 3.

#### 6.2.4 How `builtinPropertyVariables` registers keys

For each field, the name-based key format depends on `needsBraces`:

```go
var namePrefix string
if needsBraces(field.Name) {
    namePrefix = "${PB_" + field.Name  // braced prefix, suffixes go before closing }
} else {
    namePrefix = "$PB_" + field.Name   // unbraced prefix, suffixes are appended directly
}
idPrefix := "$PB_" + field.ID         // always unbraced
```

For **braced** name prefixes, suffixes like `_ID` and `_FULLNAME` go
**inside** the braces:

| Suffix | Unbraced key (simple name) | Braced key (name with special chars) |
|--------|---------------------------|--------------------------------------|
| *(base)* | `$PB_Severity` | `${PB_Security Level}` |
| `_ID` | `$PB_Severity_ID` | `${PB_Security Level_ID}` |
| `_FULLNAME` | `$PB_Assignee_FULLNAME` | `${PB_Team Lead_FULLNAME}` |

The key construction:

```go
for suffix, val := range fieldVars {
    if needsBraces(field.Name) {
        vars["${PB_"+field.Name+suffix+"}"] = val
    } else {
        vars["$PB_"+field.Name+suffix] = val
    }
    vars["$PB_"+field.ID+suffix] = val  // ID-based key is always unbraced
}
```

#### 6.2.5 How lookup works for `${PB_Severity}`

When the parser encounters `${PB_Severity}` in a command, the regex matches
the full braced token. The substitution loop must look up this token in the
variable map. Since the field "Severity" was registered under the unbraced
key `$PB_Severity`, a direct lookup of `${PB_Severity}` would fail.

To handle this, the substitution loop tries two lookups:

1. **Direct lookup:** Use the matched token as-is (handles braced keys like
   `${PB_Security Level}` and unbraced keys like `$PB_Severity`).
2. **Unbraced fallback:** If the token is braced and the direct lookup fails,
   strip the braces and try the unbraced form. This handles `${PB_Severity}`
   → lookup `$PB_Severity`.

```go
func lookupVar(varsAndVals map[string]string, matched string) (string, bool) {
    // Direct lookup (works for unbraced keys and braced keys)
    if val, ok := varsAndVals[matched]; ok {
        return val, true
    }
    // Fallback: if braced, try the unbraced form
    if strings.HasPrefix(matched, "${") && strings.HasSuffix(matched, "}") {
        unbracedKey := "$" + matched[2:len(matched)-1]
        if val, ok := varsAndVals[unbracedKey]; ok {
            return val, true
        }
    }
    return "", false
}
```

#### 6.2.6 Variable Resolution Truth Table

This table is the definitive reference for all variable resolution behavior.
Every row must have a corresponding test case.

**Setup for the table:**

- Field `Severity` — select, simple name, option "High" (ID `opt1...`)
- Field `Security Level` — select, name has space, option "Critical" (ID `opt2...`)
- Field `Security` — text, simple name, value "low"
- Field `Security-Level` — text, name has hyphen, value "beta"
- Field `Team Lead` — user, name has space, user `janedoe` (ID `u1...`, full name "Jane Doe")
- Field `Assignee` — user, simple name, user `bobsmith` (ID `u2...`, full name "Bob Smith")
- Field ID for `Severity`: `fldSev...`
- Field ID for `Security Level`: `fldSecLvl...`
- Run metadata: `$PB_RUN_ID` = `run-abc`
- User-defined: `$ENV` = `production`

**Parsing truth table — what the regex extracts from the command text:**

| Command text | Parsed variable tokens | Notes |
|--------------|----------------------|-------|
| `$PB_Severity` | `$PB_Severity` | Simple unbraced |
| `${PB_Severity}` | `${PB_Severity}` | Braced form of simple name |
| `${PB_Security Level}` | `${PB_Security Level}` | Braced, name has space |
| `$PB_Security Level` | `$PB_Security` | Unbraced stops at space; ` Level` is literal |
| `${PB_Security-Level}` | `${PB_Security-Level}` | Braced, name has hyphen |
| `$PB_Security-Level` | `$PB_Security` | Unbraced stops at hyphen; `-Level` is literal |
| `$PB_Security_Level` | `$PB_Security_Level` | Valid unbraced token (underscore is allowed) |
| `${PB_Severity_ID}` | `${PB_Severity_ID}` | Braced suffix form |
| `$PB_Severity_ID` | `$PB_Severity_ID` | Unbraced suffix form |
| `${PB_Security Level_ID}` | `${PB_Security Level_ID}` | Braced suffix with space in name |
| `$PB_RUN_ID` | `$PB_RUN_ID` | Run metadata, unbraced |
| `${PB_RUN_ID}` | `${PB_RUN_ID}` | Run metadata, braced form |
| `$ENV` | `$ENV` | User-defined, unbraced |
| `${ENV}` | `${ENV}` | User-defined, braced form |
| `$PB_Severity ${PB_Severity}` | `$PB_Severity`, `${PB_Severity}` | Both forms in same command |
| `${PB_Team Lead_FULLNAME}` | `${PB_Team Lead_FULLNAME}` | Braced FULLNAME suffix with space |
| `$PB_Assignee_FULLNAME` | `$PB_Assignee_FULLNAME` | Unbraced FULLNAME suffix |

**Map key registration truth table — what keys `builtinPropertyVariables`,
`builtinRunVariables`, and `parseVariablesAndValues` produce:**

| Source | Field / Variable | Map key | Value |
|--------|-----------------|---------|-------|
| Property | `Severity` (base) | `$PB_Severity` | `High` |
| Property | `Severity` (_ID) | `$PB_Severity_ID` | `opt1...` |
| Property | `Severity` (by field ID, base) | `$PB_fldSev...` | `High` |
| Property | `Severity` (by field ID, _ID) | `$PB_fldSev..._ID` | `opt1...` |
| Property | `Security Level` (base) | `${PB_Security Level}` | `Critical` |
| Property | `Security Level` (_ID) | `${PB_Security Level_ID}` | `opt2...` |
| Property | `Security Level` (by field ID, base) | `$PB_fldSecLvl...` | `Critical` |
| Property | `Security Level` (by field ID, _ID) | `$PB_fldSecLvl..._ID` | `opt2...` |
| Property | `Security` (base) | `$PB_Security` | `low` |
| Property | `Security-Level` (base) | `${PB_Security-Level}` | `beta` |
| Property | `Team Lead` (base) | `${PB_Team Lead}` | `janedoe` |
| Property | `Team Lead` (_FULLNAME) | `${PB_Team Lead_FULLNAME}` | `Jane Doe` |
| Property | `Team Lead` (_ID) | `${PB_Team Lead_ID}` | `u1...` |
| Property | `Assignee` (base) | `$PB_Assignee` | `bobsmith` |
| Property | `Assignee` (_FULLNAME) | `$PB_Assignee_FULLNAME` | `Bob Smith` |
| Property | `Assignee` (_ID) | `$PB_Assignee_ID` | `u2...` |
| Run meta | `RUN_ID` | `$PB_RUN_ID` | `run-abc` |
| User-def | `ENV` | `$ENV` | `production` |

**Lookup truth table — what `lookupVar` returns for each reference:**

| Reference in command | Step 1: direct lookup | Step 2: unbraced fallback | Result |
|---------------------|----------------------|--------------------------|--------|
| `$PB_Severity` | ✅ finds `$PB_Severity` | — | `High` |
| `${PB_Severity}` | ❌ | ✅ finds `$PB_Severity` | `High` |
| `${PB_Security Level}` | ✅ finds `${PB_Security Level}` | — | `Critical` |
| `$PB_Security` | ✅ finds `$PB_Security` | — | `low` |
| `$PB_Security_Level` | ❌ (no such key) | — | ❌ error |
| `${PB_Security-Level}` | ✅ finds `${PB_Security-Level}` | — | `beta` |
| `$PB_Severity_ID` | ✅ finds `$PB_Severity_ID` | — | `opt1...` |
| `${PB_Severity_ID}` | ❌ | ✅ finds `$PB_Severity_ID` | `opt1...` |
| `${PB_Security Level_ID}` | ✅ finds `${PB_Security Level_ID}` | — | `opt2...` |
| `$PB_RUN_ID` | ✅ finds `$PB_RUN_ID` | — | `run-abc` |
| `${PB_RUN_ID}` | ❌ | ✅ finds `$PB_RUN_ID` | `run-abc` |
| `$ENV` | ✅ finds `$ENV` | — | `production` |
| `${ENV}` | ❌ | ✅ finds `$ENV` | `production` |
| `$PB_fldSev...` | ✅ finds `$PB_fldSev...` | — | `High` |
| `${PB_fldSev...}` | ❌ | ✅ finds `$PB_fldSev...` | `High` |
| `$PB_fldSecLvl...` | ✅ finds `$PB_fldSecLvl...` | — | `Critical` |
| `${PB_Team Lead_FULLNAME}` | ✅ finds `${PB_Team Lead_FULLNAME}` | — | `Jane Doe` |
| `$PB_Assignee_FULLNAME` | ✅ finds `$PB_Assignee_FULLNAME` | — | `Bob Smith` |
| `$PB_UNKNOWN` | ❌ | — | ❌ error |
| `${PB_UNKNOWN}` | ❌ | ❌ | ❌ error |

**End-to-end substitution truth table — full command → result:**

| Command template | Substituted result | Notes |
|------------------|--------------------|-------|
| `/echo $PB_Severity` | `/echo High` | Simple unbraced |
| `/echo ${PB_Severity}` | `/echo High` | Braced form, fallback to unbraced key |
| `/echo ${PB_Security Level}` | `/echo Critical` | Braced, name has space |
| `/echo $PB_Security Level` | `/echo low Level` | `$PB_Security` → `low`, ` Level` is literal |
| `/echo ${PB_Security-Level}` | `/echo beta` | Braced, name has hyphen |
| `/echo $PB_Security-Level` | `/echo low-Level` | `$PB_Security` → `low`, `-Level` is literal |
| `/echo $PB_Security_Level` | ❌ error: undefined `$PB_Security_Level` | No field named `Security_Level` |
| `/echo $PB_Severity_ID` | `/echo opt1...` | Unbraced suffix |
| `/echo ${PB_Severity_ID}` | `/echo opt1...` | Braced suffix, fallback |
| `/echo ${PB_Security Level_ID}` | `/echo opt2...` | Braced suffix with space |
| `/echo $PB_RUN_ID` | `/echo run-abc` | Run metadata |
| `/echo ${PB_RUN_ID}` | `/echo run-abc` | Run metadata, braced form |
| `/echo $ENV` | `/echo production` | User-defined |
| `/echo ${ENV}` | `/echo production` | User-defined, braced form |
| `/echo $PB_Severity ${PB_Security Level}` | `/echo High Critical` | Mixed in same command |
| `/echo $PB_RUN_ID ${PB_Security Level} $ENV` | `/echo run-abc Critical production` | All three sources mixed |
| `/echo ${PB_Team Lead_FULLNAME}` | `/echo Jane Doe` | Braced FULLNAME with space |
| `/echo $PB_Assignee_FULLNAME` | `/echo Bob Smith` | Unbraced FULLNAME |
| `/echo $PB_fldSecLvl...` | `/echo Critical` | Field ID access |
| `/echo ${PB_fldSecLvl...}` | `/echo Critical` | Field ID, braced form |

#### 6.2.7 `parseVariables` behavior change

`parseVariables` currently returns `[]string` of matched variable references.
After this change, it returns both braced (`${PB_Security Level}`) and
unbraced (`$PB_Severity`) matches. The caller uses `lookupVar` for map
access and the raw matched text for `strings.ReplaceAll`.

The returned list is deduplicated — if a command contains both
`$PB_Severity` and `${PB_Severity}`, both appear in the list (they are
different textual matches even though they resolve to the same value).
This is fine because `strings.ReplaceAll` on the second occurrence will be a
no-op after the first replacement.

#### 6.2.8 `parseVariablesAndValues` — no change needed

User-defined variables in the run summary use the `$name=value` syntax on
separate lines. The brace syntax is not needed there because variable
*definitions* are controlled by the user and don't contain spaces. The
`reVarsAndVals` regex remains unchanged. If a future need arises, it can be
extended independently.

#### 6.2.9 Impact on existing behavior

- **Existing `$name` variables** — fully backward compatible. The combined
  regex still matches them identically.
- **Existing tests** — all pass without modification, because `$PB_Severity`
  is still matched by the `(\$[a-zA-Z0-9_]+)` branch.
- **Longest-first sort** — continues to work. `${PB_Severity_ID}` (21 chars)
  is longer than `${PB_Severity}` (16 chars), so it's replaced first. Braced
  variables don't have the partial-replacement problem of unbraced ones
  (because `}` terminates the match), but sorting longest-first is still
  applied uniformly for safety.

### 6.3 New helpers in `server/app/variables.go`

#### `needsBraces`

```go
// needsBraces returns true if the name contains characters that are not
// valid in unbraced variable names ([a-zA-Z0-9_]).
func needsBraces(name string) bool {
    return reNonVarChar.MatchString(name)
}
```

#### `lookupVar`

```go
// lookupVar looks up a matched variable reference in the variable map.
// It first tries a direct lookup, then (for braced references) falls back
// to the unbraced form. This allows ${PB_Severity} to find the key
// $PB_Severity, while ${PB_Security Level} finds ${PB_Security Level}.
func lookupVar(varsAndVals map[string]string, matched string) (string, bool) {
    if val, ok := varsAndVals[matched]; ok {
        return val, true
    }
    if strings.HasPrefix(matched, "${") && strings.HasSuffix(matched, "}") {
        unbracedKey := "$" + matched[2:len(matched)-1]
        if val, ok := varsAndVals[unbracedKey]; ok {
            return val, true
        }
    }
    return "", false
}
```

#### Updated `parseVariables`

```go
func parseVariables(input string) []string {
    matches := reVars.FindAllString(input, -1)
    // Deduplicate while preserving order
    seen := make(map[string]struct{}, len(matches))
    result := make([]string, 0, len(matches))
    for _, m := range matches {
        if _, ok := seen[m]; !ok {
            seen[m] = struct{}{}
            result = append(result, m)
        }
    }
    return result
}
```

Note: deduplication is by the raw matched text (including braces), not by
unbraced form. This is intentional — `$PB_Severity` and `${PB_Severity}`
are different textual references that both need to be replaced in the
command string.

#### Updated substitution loop (in both `substituteVariables` and `RunChecklistItemSlashCommand`)

```go
varsInCmd := parseVariables(command)
sort.Slice(varsInCmd, func(i, j int) bool {
    return len(varsInCmd[i]) > len(varsInCmd[j])
})
for _, v := range varsInCmd {
    val, ok := lookupVar(varsAndVals, v)
    if !ok || val == "" {
        return "", fmt.Errorf("Found undefined or empty variable in slash command: %s", v)
    }
    command = strings.ReplaceAll(command, v, val)
}
```

The change is using `lookupVar` instead of a direct map access. The
`strings.ReplaceAll` still uses `v` (the raw matched text, including braces)
so that `${PB_Security Level}` is fully replaced in the command string.

### 6.4 Unit tests in `server/app/variables_test.go`

**Test: `needsBraces` cases**

```go
func TestNeedsBraces(t *testing.T) {
    assert.False(t, needsBraces("Severity"))
    assert.False(t, needsBraces("PB_RUN_ID"))
    assert.False(t, needsBraces("fld123abc"))
    assert.True(t, needsBraces("Security Level"))
    assert.True(t, needsBraces("my-field"))
    assert.True(t, needsBraces("Tags (v2)"))
    assert.True(t, needsBraces("a.b.c"))
}
```

**Test: `lookupVar` — comprehensive, one subtest per truth table row**

```go
func TestLookupVar(t *testing.T) {
    vars := map[string]string{
        "$PB_Severity":              "High",
        "$PB_Severity_ID":           "opt1",
        "${PB_Security Level}":      "Critical",
        "${PB_Security Level_ID}":   "opt2",
        "$PB_Security":              "low",
        "${PB_Security-Level}":      "beta",
        "${PB_Team Lead}":           "janedoe",
        "${PB_Team Lead_FULLNAME}":  "Jane Doe",
        "${PB_Team Lead_ID}":        "u1",
        "$PB_Assignee":              "bobsmith",
        "$PB_Assignee_FULLNAME":     "Bob Smith",
        "$PB_Assignee_ID":           "u2",
        "$PB_RUN_ID":                "run-abc",
        "$ENV":                      "production",
        "$PB_fldSev":                "High",
        "$PB_fldSecLvl":             "Critical",
    }

    tests := []struct {
        name     string
        ref      string
        wantVal  string
        wantOK   bool
    }{
        // Unbraced direct lookups
        {"unbraced simple field",      "$PB_Severity",                "High",      true},
        {"unbraced simple field _ID",  "$PB_Severity_ID",             "opt1",      true},
        {"unbraced field Security",    "$PB_Security",                "low",       true},
        {"unbraced run metadata",      "$PB_RUN_ID",                  "run-abc",   true},
        {"unbraced user-defined",      "$ENV",                        "production",true},
        {"unbraced field ID",          "$PB_fldSev",                  "High",      true},
        {"unbraced field ID secLvl",   "$PB_fldSecLvl",               "Critical",  true},
        {"unbraced Assignee base",     "$PB_Assignee",                "bobsmith",  true},
        {"unbraced Assignee FULLNAME", "$PB_Assignee_FULLNAME",       "Bob Smith", true},
        {"unbraced Assignee ID",       "$PB_Assignee_ID",             "u2",        true},

        // Braced direct lookups (braced-only keys)
        {"braced Security Level",      "${PB_Security Level}",        "Critical",  true},
        {"braced Security Level _ID",  "${PB_Security Level_ID}",     "opt2",      true},
        {"braced Security-Level",      "${PB_Security-Level}",        "beta",      true},
        {"braced Team Lead",           "${PB_Team Lead}",             "janedoe",   true},
        {"braced Team Lead FULLNAME",  "${PB_Team Lead_FULLNAME}",    "Jane Doe",  true},
        {"braced Team Lead ID",        "${PB_Team Lead_ID}",          "u1",        true},

        // Braced with fallback to unbraced key
        {"braced fallback Severity",     "${PB_Severity}",            "High",      true},
        {"braced fallback Severity_ID",  "${PB_Severity_ID}",         "opt1",      true},
        {"braced fallback RUN_ID",       "${PB_RUN_ID}",              "run-abc",   true},
        {"braced fallback ENV",          "${ENV}",                    "production",true},
        {"braced fallback field ID",     "${PB_fldSev}",              "High",      true},
        {"braced fallback Assignee",     "${PB_Assignee}",            "bobsmith",  true},
        {"braced fallback Assignee FN",  "${PB_Assignee_FULLNAME}",   "Bob Smith", true},

        // Misses
        {"miss unknown unbraced",        "$PB_UNKNOWN",               "",          false},
        {"miss unknown braced",          "${PB_UNKNOWN}",             "",          false},
        {"miss normalized Security_Level","$PB_Security_Level",       "",          false},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            val, ok := lookupVar(vars, tc.ref)
            assert.Equal(t, tc.wantOK, ok)
            if tc.wantOK {
                assert.Equal(t, tc.wantVal, val)
            }
        })
    }
}
```

**Test: parsing — what the regex extracts from command text**

```go
func TestParseVariables_BraceSyntax(t *testing.T) {
    tests := []struct {
        name   string
        input  string
        expect []string
    }{
        {
            "braced with space and unbraced mixed",
            `/echo ${PB_Security Level} $PB_RUN_ID`,
            []string{"${PB_Security Level}", "$PB_RUN_ID"},
        },
        {
            "braced special chars",
            `/echo ${PB_Tags (v2)} ${PB_my-field}`,
            []string{"${PB_Tags (v2)}", "${PB_my-field}"},
        },
        {
            "both forms for same simple name",
            `/echo $PB_Severity ${PB_Severity}`,
            []string{"$PB_Severity", "${PB_Severity}"},
        },
        {
            "unbraced stops at space",
            `/echo $PB_Security Level`,
            []string{"$PB_Security"},
        },
        {
            "unbraced stops at hyphen",
            `/echo $PB_Security-Level`,
            []string{"$PB_Security"},
        },
        {
            "unbraced underscore is valid",
            `/echo $PB_Security_Level`,
            []string{"$PB_Security_Level"},
        },
        {
            "braced suffix _ID with space in name",
            `/echo ${PB_Security Level_ID}`,
            []string{"${PB_Security Level_ID}"},
        },
        {
            "braced FULLNAME with space in name",
            `/echo ${PB_Team Lead_FULLNAME}`,
            []string{"${PB_Team Lead_FULLNAME}"},
        },
        {
            "unbraced suffix forms",
            `/echo $PB_Severity_ID $PB_Assignee_FULLNAME`,
            []string{"$PB_Severity_ID", "$PB_Assignee_FULLNAME"},
        },
        {
            "braced and unbraced run metadata",
            `/echo $PB_RUN_ID ${PB_RUN_ID}`,
            []string{"$PB_RUN_ID", "${PB_RUN_ID}"},
        },
        {
            "braced and unbraced user-defined",
            `/echo $ENV ${ENV}`,
            []string{"$ENV", "${ENV}"},
        },
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            result := parseVariables(tc.input)
            assert.Equal(t, tc.expect, result)
        })
    }
}
```

**Test: braced variable names match the new regex**

```go
func TestBracedVariableNamesMatchRegex(t *testing.T) {
    inputs := []string{
        "${PB_Security Level}",
        "${PB_my-field}",
        "${PB_Tags (v2)}",
        "${PB_Severity}",
        "${PB_Security Level_ID}",
        "${PB_Team Lead_FULLNAME}",
    }
    for _, input := range inputs {
        matches := parseVariables(input)
        assert.Equal(t, []string{input}, matches,
            "braced variable %s should be matched as a single token", input)
    }
}
```

**Test: existing unbraced variables still work (regression)**

Re-run existing `TestParseVariables` cases — they must all pass unchanged.

### Acceptance Criteria

- [ ] `needsBraces` correctly identifies names with special characters.
- [ ] `lookupVar` finds unbraced keys directly.
- [ ] `lookupVar` finds unbraced keys via braced-to-unbraced fallback
      (e.g., `${PB_Severity}` → `$PB_Severity`).
- [ ] `lookupVar` finds braced keys directly (e.g., `${PB_Security Level}`).
- [ ] `lookupVar` does NOT find braced-only keys via unbraced references
      (e.g., `$PB_Security` does not find `${PB_Security Level}`).
- [ ] `lookupVar` does NOT find a normalized key like `$PB_Security_Level`
      when only `$PB_Security` and `${PB_Security Level}` exist.
- [ ] `parseVariables` matches `${...}` references in command strings.
- [ ] `parseVariables` still matches `$name` references (backward compat).
- [ ] Both braced and unbraced forms are returned when both appear.
- [ ] Braced variables with spaces, hyphens, parentheses are matched.
- [ ] Unbraced `$PB_Security Level` is parsed as `$PB_Security` + literal.
- [ ] Unbraced `$PB_Security-Level` is parsed as `$PB_Security` + literal.
- [ ] Unbraced `$PB_Security_Level` is parsed as a single token (underscore
      is valid in unbraced names).
- [ ] All existing `TestParseVariables` tests pass unchanged.
- [ ] All unit tests pass.

---

## Phase 7: Replace Normalized Keys with Raw-Name Keys and Integration Tests

**Goal:** Replace the normalized-name variable keys with raw (original) field
name keys, using braces for names with special characters. Update
`builtinPropertyVariables`, existing tests, and add integration tests for the
full pipeline with braced variables.

### 7.1 Key design change: drop normalization for property variable keys

The normalized-name approach (`Security Level` → `$PB_Security_Level`) was a
workaround for the `$name` regex not supporting spaces. With `${...}` syntax,
users can reference the field by its exact name. Keeping normalized keys
creates ambiguity:

- `Security Level` → `$PB_Security_Level`
- `Security-Level` → `$PB_Security_Level`
- `Security_Level` → `$PB_Security_Level`

All three would map to the same variable, making it impossible to distinguish
them. The correct model is:

| Field name | Map key (base) | Unbraced reference | Braced reference |
|------------|---------------|-------------------|-----------------|
| `Severity` | `$PB_Severity` | `$PB_Severity` ✅ | `${PB_Severity}` ✅ |
| `Security Level` | `${PB_Security Level}` | ❌ impossible | `${PB_Security Level}` ✅ |
| `Security-Level` | `${PB_Security-Level}` | ❌ impossible | `${PB_Security-Level}` ✅ |
| `Security_Level` | `$PB_Security_Level` | `$PB_Security_Level` ✅ | `${PB_Security_Level}` ✅ |
| `Security` | `$PB_Security` | `$PB_Security` ✅ | `${PB_Security}` ✅ |

For fields whose name contains only `[a-zA-Z0-9_]`, the unbraced form works
naturally because the raw name IS a valid unbraced variable name. For all
other fields, braced syntax or the field ID must be used.

### 7.2 Modify `builtinPropertyVariables` in `server/app/variables.go`

**Replace** the normalized-name prefix with conditional braced/unbraced keys:

**Before (Phase 3):**

```go
namePrefix := "$PB_" + normalizeFieldName(field.Name)
idPrefix   := "$PB_" + field.ID

for suffix, val := range fieldVars {
    vars[namePrefix+suffix] = val
    vars[idPrefix+suffix] = val
}
```

**After (Phase 7):**

```go
idPrefix := "$PB_" + field.ID  // always unbraced

for suffix, val := range fieldVars {
    // Name-based key: braced if name has special chars, unbraced otherwise
    if needsBraces(field.Name) {
        vars["${PB_"+field.Name+suffix+"}"] = val
    } else {
        vars["$PB_"+field.Name+suffix] = val
    }
    // ID-based key: always unbraced
    vars[idPrefix+suffix] = val
}
```

The `normalizeFieldName` function is no longer called in
`builtinPropertyVariables` (it can be kept as a utility or removed).

**Consequences:**

- `$PB_Severity` still works — `Severity` contains only `[a-zA-Z0-9_]`, so
  the raw name is a valid unbraced variable name.
- `$PB_Build_Status` **stops working** for a field named `Build Status`. Users
  must switch to `${PB_Build Status}` or `$PB_<fieldID>`.
- `${PB_Security Level}` and `${PB_Security-Level}` correctly resolve to
  different fields — no ambiguity.
- All fields remain accessible via their field ID (`$PB_<fieldID>`).

### 7.3 Update existing Phase 3/5 tests

Because normalized-name keys are removed, tests that use normalized names for
fields with special characters must be updated:

- `vars["$PB_Build_Status"]` → `vars["${PB_Build Status}"]`
- `/echo $PB_Build_Status` → `/echo ${PB_Build Status}`

Tests for fields with simple names (`Severity`, `Tags`, `Assignee`, etc.)
remain unchanged — their raw name is already a valid unbraced variable name.

The `TestNormalizeFieldName` test can be kept (the function may still be
useful elsewhere) or removed.

### 7.4 Integration tests in `server/app/variables_test.go`

The following tests cover every row of the end-to-end substitution truth table
from §6.2.6. They use a shared test fixture matching the truth table setup.

#### Shared test fixture

```go
// truthTableFixture returns the fields, values, run, and user resolver
// matching the truth table setup in §6.2.6.
//
// Fields:
//   Severity       — select, simple name, option "High" (ID optSev)
//   Security Level — select, name has space, option "Critical" (ID optSecLvl)
//   Security       — text, simple name, value "low"
//   Security-Level — text, name has hyphen, value "beta"
//   Team Lead      — user, name has space, user janedoe (ID userJane)
//   Assignee       — user, simple name, user bobsmith (ID userBob)
//
// Run: ID "run-abc", summary "$ENV=production"
func truthTableFixture() (
    run *PlaybookRun,
    fields []PropertyField,
    values []PropertyValue,
    resolver *mockUserResolver,
) {
    const (
        fldSev    = "fldSevabcdefghijklmnopqrst"
        fldSecLvl = "fldSecLvlabcdefghijklmnopq"
        fldSec    = "fldSecabcdefghijklmnopqrst"
        fldSecHyp = "fldSecHypabcdefghijklmnopq"
        fldLead   = "fldLeadabcdefghijklmnopqrs"
        fldAssign = "fldAssignabcdefghijklmnopq"
        optSev    = "optSevabcdefghijklmnopqrst"
        optSecLvl = "optSecLvlabcdefghijklmnopq"
        userJane  = "userJaneabcdefghijklmnopqr"
        userBob   = "userBobabcdefghijklmnopqrs"
    )

    run = &PlaybookRun{
        ID:      "run-abc",
        Summary: "$ENV=production",
    }

    fields = []PropertyField{
        makeTestField(fldSev, "Severity", model.PropertyFieldTypeSelect,
            model.NewPluginPropertyOption(optSev, "High"),
        ),
        makeTestField(fldSecLvl, "Security Level", model.PropertyFieldTypeSelect,
            model.NewPluginPropertyOption(optSecLvl, "Critical"),
        ),
        makeTestField(fldSec, "Security", model.PropertyFieldTypeText),
        makeTestField(fldSecHyp, "Security-Level", model.PropertyFieldTypeText),
        makeTestField(fldLead, "Team Lead", model.PropertyFieldTypeUser),
        makeTestField(fldAssign, "Assignee", model.PropertyFieldTypeUser),
    }

    values = []PropertyValue{
        makeTestValue(fldSev, json.RawMessage(`"`+optSev+`"`)),
        makeTestValue(fldSecLvl, json.RawMessage(`"`+optSecLvl+`"`)),
        makeTestValue(fldSec, json.RawMessage(`"low"`)),
        makeTestValue(fldSecHyp, json.RawMessage(`"beta"`)),
        makeTestValue(fldLead, json.RawMessage(`"`+userJane+`"`)),
        makeTestValue(fldAssign, json.RawMessage(`"`+userBob+`"`)),
    }

    resolver = &mockUserResolver{
        users: map[string]*model.User{
            userJane: {Username: "janedoe", FirstName: "Jane", LastName: "Doe"},
            userBob:  {Username: "bobsmith", FirstName: "Bob", LastName: "Smith"},
        },
    }

    return run, fields, values, resolver
}
```

#### End-to-end substitution tests

Each test corresponds to one or more rows in the end-to-end truth table.

```go
func TestSubstituteVariables_TruthTable(t *testing.T) {
    run, fields, values, resolver := truthTableFixture()

    const (
        fldSecLvl = "fldSecLvlabcdefghijklmnopq"
        optSev    = "optSevabcdefghijklmnopqrst"
        optSecLvl = "optSecLvlabcdefghijklmnopq"
        userJane  = "userJaneabcdefghijklmnopqr"
        userBob   = "userBobabcdefghijklmnopqrs"
    )

    // --- Simple field (unbraced and braced) ---

    t.Run("simple field unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_Severity`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo High", result)
    })

    t.Run("simple field braced fallback", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Severity}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo High", result)
    })

    // --- Field with space ---

    t.Run("field with space braced", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Security Level}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo Critical", result)
    })

    t.Run("field with space unbraced truncates at space", func(t *testing.T) {
        // $PB_Security is parsed as the variable; " Level" is literal text
        result, err := substituteVariables(`/echo $PB_Security Level`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo low Level", result)
    })

    // --- Field with hyphen ---

    t.Run("field with hyphen braced", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Security-Level}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo beta", result)
    })

    t.Run("field with hyphen unbraced truncates at hyphen", func(t *testing.T) {
        // $PB_Security is parsed as the variable; "-Level" is literal text
        result, err := substituteVariables(`/echo $PB_Security-Level`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo low-Level", result)
    })

    // --- Normalized name does NOT match ---

    t.Run("normalized name does not match", func(t *testing.T) {
        // $PB_Security_Level is a valid unbraced token but no field has that exact name
        _, err := substituteVariables(`/echo $PB_Security_Level`, run, fields, values, resolver)
        require.Error(t, err)
        assert.Contains(t, err.Error(), "$PB_Security_Level")
    })

    // --- Suffix _ID ---

    t.Run("unbraced suffix ID", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_Severity_ID`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo "+optSev, result)
    })

    t.Run("braced suffix ID fallback", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Severity_ID}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo "+optSev, result)
    })

    t.Run("braced suffix ID with space in name", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Security Level_ID}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo "+optSecLvl, result)
    })

    // --- Suffix _FULLNAME ---

    t.Run("braced FULLNAME with space in name", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Team Lead_FULLNAME}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo Jane Doe", result)
    })

    t.Run("unbraced FULLNAME", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_Assignee_FULLNAME`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo Bob Smith", result)
    })

    // --- Run metadata ---

    t.Run("run metadata unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_RUN_ID`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo run-abc", result)
    })

    t.Run("run metadata braced fallback", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_RUN_ID}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo run-abc", result)
    })

    // --- User-defined ---

    t.Run("user-defined unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $ENV`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo production", result)
    })

    t.Run("user-defined braced fallback", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${ENV}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo production", result)
    })

    // --- Field ID access ---

    t.Run("field ID unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_`+fldSecLvl, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo Critical", result)
    })

    t.Run("field ID braced fallback", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_`+fldSecLvl+`}`, run, fields, values, resolver)
        require.NoError(t, err)
        assert.Equal(t, "/echo Critical", result)
    })

    // --- Mixed sources in same command ---

    t.Run("mixed sources in same command", func(t *testing.T) {
        result, err := substituteVariables(
            `/echo $PB_RUN_ID ${PB_Security Level} $ENV`,
            run, fields, values, resolver,
        )
        require.NoError(t, err)
        assert.Equal(t, "/echo run-abc Critical production", result)
    })

    // --- Braced and unbraced in same command for same field ---

    t.Run("both forms for same simple field", func(t *testing.T) {
        result, err := substituteVariables(
            `/echo $PB_Severity ${PB_Severity}`,
            run, fields, values, resolver,
        )
        require.NoError(t, err)
        assert.Equal(t, "/echo High High", result)
    })

    // --- Braced base + braced suffix in same command ---

    t.Run("braced base and braced suffix for spaced field", func(t *testing.T) {
        result, err := substituteVariables(
            `/echo ${PB_Security Level} ${PB_Security Level_ID}`,
            run, fields, values, resolver,
        )
        require.NoError(t, err)
        assert.Equal(t, "/echo Critical "+optSecLvl, result)
    })

    // --- User field with space: all three suffixes ---

    t.Run("braced user field all suffixes", func(t *testing.T) {
        result, err := substituteVariables(
            `/assign ${PB_Team Lead} ${PB_Team Lead_FULLNAME} ${PB_Team Lead_ID}`,
            run, fields, values, resolver,
        )
        require.NoError(t, err)
        assert.Equal(t, "/assign janedoe Jane Doe "+userJane, result)
    })

    // --- Simple user field: all three suffixes ---

    t.Run("unbraced user field all suffixes", func(t *testing.T) {
        result, err := substituteVariables(
            `/assign $PB_Assignee $PB_Assignee_FULLNAME $PB_Assignee_ID`,
            run, fields, values, resolver,
        )
        require.NoError(t, err)
        assert.Equal(t, "/assign bobsmith Bob Smith "+userBob, result)
    })

    // --- Unknown variable errors ---

    t.Run("unknown unbraced variable error", func(t *testing.T) {
        _, err := substituteVariables(`/echo $PB_UNKNOWN`, run, fields, values, resolver)
        require.Error(t, err)
        assert.Contains(t, err.Error(), "$PB_UNKNOWN")
    })

    t.Run("unknown braced variable error", func(t *testing.T) {
        _, err := substituteVariables(`/echo ${PB_UNKNOWN}`, run, fields, values, resolver)
        require.Error(t, err)
        assert.Contains(t, err.Error(), "${PB_UNKNOWN}")
    })
}
```

#### Collision disambiguation test

This is a separate test because it uses a different fixture with four
similarly-named fields that would all normalize to the same key under the
old scheme.

```go
func TestSubstituteVariables_DisambiguateCollidingFields(t *testing.T) {
    run := &PlaybookRun{ID: "run1"}

    fields := []PropertyField{
        makeTestField("fld1abcdefghijklmnopqrstuv", "Security Level", model.PropertyFieldTypeText),
        makeTestField("fld2abcdefghijklmnopqrstuv", "Security-Level", model.PropertyFieldTypeText),
        makeTestField("fld3abcdefghijklmnopqrstuv", "Security_Level", model.PropertyFieldTypeText),
        makeTestField("fld4abcdefghijklmnopqrstuv", "Security", model.PropertyFieldTypeText),
    }
    values := []PropertyValue{
        makeTestValue("fld1abcdefghijklmnopqrstuv", json.RawMessage(`"alpha"`)),
        makeTestValue("fld2abcdefghijklmnopqrstuv", json.RawMessage(`"beta"`)),
        makeTestValue("fld3abcdefghijklmnopqrstuv", json.RawMessage(`"gamma"`)),
        makeTestValue("fld4abcdefghijklmnopqrstuv", json.RawMessage(`"delta"`)),
    }

    t.Run("Security Level via braces", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Security Level}`, run, fields, values, nil)
        require.NoError(t, err)
        assert.Equal(t, "/echo alpha", result)
    })

    t.Run("Security-Level via braces", func(t *testing.T) {
        result, err := substituteVariables(`/echo ${PB_Security-Level}`, run, fields, values, nil)
        require.NoError(t, err)
        assert.Equal(t, "/echo beta", result)
    })

    t.Run("Security_Level unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_Security_Level`, run, fields, values, nil)
        require.NoError(t, err)
        assert.Equal(t, "/echo gamma", result)
    })

    t.Run("Security unbraced", func(t *testing.T) {
        result, err := substituteVariables(`/echo $PB_Security`, run, fields, values, nil)
        require.NoError(t, err)
        assert.Equal(t, "/echo delta", result)
    })

    t.Run("all four in same command", func(t *testing.T) {
        result, err := substituteVariables(
            `/echo ${PB_Security Level} ${PB_Security-Level} $PB_Security_Level $PB_Security`,
            run, fields, values, nil,
        )
        require.NoError(t, err)
        assert.Equal(t, "/echo alpha beta gamma delta", result)
    })
}
```

**Regression: all existing Phase 1–5 tests updated and passing.**

### 7.5 Wire into `RunChecklistItemSlashCommand`

The substitution loop in `RunChecklistItemSlashCommand` must be updated to use
`lookupVar` instead of direct map access (identical to the change in
`substituteVariables`):

**Before:**
```go
if val, ok := varsAndVals[v]; !ok || val == "" {
```

**After:**
```go
val, ok := lookupVar(varsAndVals, v)
if !ok || val == "" {
```

### Acceptance Criteria

- [ ] `builtinPropertyVariables` registers braced keys for fields with special
      characters and unbraced keys for simple fields. No normalized keys.
- [ ] `${PB_Security Level}` resolves to the correct value for a field named
      "Security Level".
- [ ] `${PB_Security Level_ID}` resolves to the option ID for a select field.
- [ ] `$PB_Severity` and `${PB_Severity}` resolve to the same value (for
      simple field names that contain only `[a-zA-Z0-9_]`).
- [ ] `$PB_Build_Status` does **not** resolve for a field named
      "Build Status" — the normalized form is no longer registered.
- [ ] `$PB_Security_Level` does **not** resolve for a field named
      "Security Level" — even though underscores are valid in variable names.
- [ ] `$PB_Security Level` resolves `$PB_Security` (field "Security") and
      leaves ` Level` as literal text.
- [ ] Braced and unbraced variables can be mixed in the same command.
- [ ] Braced syntax disambiguates fields that would have collided after
      normalization (e.g., `Security Level` vs `Security-Level` vs
      `Security_Level` vs `Security` are all distinct).
- [ ] Braced suffix forms work: `${PB_Security Level_ID}`,
      `${PB_Team Lead_FULLNAME}`.
- [ ] Field ID access works in both forms: `$PB_fldXXX` and `${PB_fldXXX}`.
- [ ] Every row of the truth tables in §6.2.6 has a passing test.
- [ ] Updated Phase 3/5 tests pass with raw-name keys.
- [ ] All unit and integration tests pass.

---

## Files Changed (Phase 6–7 Summary)

| File | Change |
|------|--------|
| `server/app/variables.go` | New `needsBraces` and `lookupVar` helpers. Updated `reVars` regex to include `${...}` pattern. Updated `parseVariables` with deduplication. Updated substitution loops to use `lookupVar`. Changed `builtinPropertyVariables` to use raw field names with conditional bracing. `normalizeFieldName` kept but no longer used by `builtinPropertyVariables`. |
| `server/app/variables_test.go` | Unit tests for `needsBraces`, `lookupVar` (one subtest per truth table row), `parseVariables` brace-syntax parsing. Updated existing tests to use raw-name keys instead of normalized. New integration tests covering every row of the end-to-end truth table: braced/unbraced, suffixes, fallback, truncation, collisions, mixed sources. |
| `server/app/playbook_run_service.go` | Updated `RunChecklistItemSlashCommand` substitution loop: use `lookupVar` instead of direct map access. |

## Risks and Mitigations (Phase 6–7)

| Risk | Mitigation |
|------|------------|
| **Breaking change:** `$PB_Build_Status` stops working for field "Build Status" | This is intentional. Phases 1–5 are unreleased, so there are no existing users. Commands must be updated to `${PB_Build Status}` or `$PB_<fieldID>`. Fields with simple names (e.g., `Severity`) are unaffected. |
| `}` character inside a field name breaks the brace syntax | Field names containing `}` are not supported in braced syntax. This is an extreme edge case. Such fields are still accessible via their field ID. |
| Raw-name keys with braces look unusual as map keys | Map keys are strings — braces are valid characters. The keys are internal lookup keys never displayed to users. |
| `${PB_Severity}` in a command authored before Phase 6 would be treated as literal text | Before Phase 6, the regex doesn't match braced syntax, so it passes through as literal. After Phase 6, it's recognized as a variable. Only affects commands containing literal `${...}` text, which is highly unlikely. |
| `reVarsAndVals` regex (summary parsing) doesn't support braces | Intentional — variable *definitions* in summaries don't need spaces. Documented in §6.2.8. Can be extended later if needed. |
