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
| 1 | Run metadata variables — `builtinRunVariables` helper + unit tests | Not started |
| 2 | Wire run metadata variables into `RunChecklistItemSlashCommand` | Not started |
| 3 | Property field variables — `normalizeFieldName`, `builtinPropertyVariables` + unit tests | Not started |
| 4 | Wire property variables into `RunChecklistItemSlashCommand` | Not started |
| 5 | Integration tests (run metadata + property variables) | Not started |
