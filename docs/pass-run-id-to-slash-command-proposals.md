# Passing Run ID to Slash Commands Executed from Task Completion

**Date:** 2026-02-26

## Problem Statement

When a slash command is executed as a consequence of completing a playbook task
(via `RunChecklistItemSlashCommand`), the command being invoked has no way of
knowing which playbook run triggered it. The run ID is a critical piece of
context: it allows the receiving command to act on the correct run — for
example, setting a property via `/playbook attribute set ... --run <id>` or
sending a webhook that references the run.

Currently, `RunChecklistItemSlashCommand` builds a `model.CommandArgs` with
only `Command`, `UserId`, `TeamId`, and `ChannelId`. The run ID is known at the
call site but is not forwarded through any mechanism to the command being
executed.

This document proposes several approaches, compares them, and recommends one.

---

## Current Execution Flow

```
API endpoint (playbook_runs.go:1460)
  → PlaybookRunServiceImpl.RunChecklistItemSlashCommand(runID, userID, checklistNum, itemNum)
    → variable substitution on command string
    → pluginAPI.SlashCommand.Execute(&model.CommandArgs{...})
      → Mattermost Server: App.ExecuteCommand(ctx, args)
        → tryExecutePluginCommand(ctx, args)
          → pluginHooks.ExecuteCommand(pluginContext(ctx), args)
            → Plugin.ExecuteCommand(c *plugin.Context, args *model.CommandArgs)
              → command.NewCommandRunner(c, args, ...).Execute()
```

The two objects available inside the plugin's `ExecuteCommand` hook are:

- **`*plugin.Context`**: contains `SessionId`, `RequestId`, `IPAddress`,
  `AcceptLanguage`, `UserAgent`. No extensible metadata.
- **`*model.CommandArgs`**: contains `UserId`, `ChannelId`, `TeamId`, `RootId`,
  `ParentId`, `TriggerId`, `Command`, `SiteURL`, plus transient
  `UserMentions`/`ChannelMentions`. No extensible metadata.

Neither struct has a `Props`, `Metadata`, or similar extensible field.

---

## Proposal A: Inject Run ID as a Variable in the Command String

### Description

Extend the existing variable substitution mechanism in
`RunChecklistItemSlashCommand` to inject a built-in variable (e.g.
`$runID` or `$PLAYBOOK_RUN_ID`) into the command string before execution. The
command text authored by the user would include this variable explicitly:

```
/playbook attribute set Severity --value High --run $runID
```

At execution time, `RunChecklistItemSlashCommand` already parses variables from
the playbook run summary and substitutes them in the command. This proposal
adds `$runID` (and potentially `$channelID`, `$teamID`, etc.) as built-in
variables that are always available, injected before the existing variable
resolution logic.

### Implementation

In `server/app/playbook_run_service.go`, inside `RunChecklistItemSlashCommand`,
after building `varsAndVals` from the summary:

```go
// Inject built-in variables
varsAndVals["$runID"] = playbookRunID
varsAndVals["$channelID"] = playbookRun.ChannelID
varsAndVals["$teamID"] = playbookRun.TeamID
```

No changes to `model.CommandArgs`, `plugin.Context`, the Mattermost server, or
the command runner. The receiving command sees the run ID as a literal string in
`args.Command`.

### Advantages

1. **Zero changes to external contracts.** No modifications to
   `model.CommandArgs`, `plugin.Context`, or the Mattermost server. Everything
   stays within the plugin.
2. **Leverages existing infrastructure.** The variable substitution mechanism
   already exists and is tested.
3. **Works for any command, not just `/playbook`.** The run ID is embedded in
   the command text, so even a third-party integration or webhook slash command
   can receive it.
4. **User-visible and explicit.** The user writing the playbook template can
   see exactly where the run ID will appear. No hidden magic.
5. **Very small code change.** ~5 lines of production code.
6. **Backwards compatible.** Existing commands that don't use `$runID` are
   unaffected; the variable simply isn't present in their command string and is
   never substituted.

### Disadvantages

1. **The user must remember to include `$runID` in the command.** If they
   forget, the command runs without it. There's no automatic injection.
2. **It's part of the command text.** The run ID is visible in logs, timeline
   events, and the channel (in the "ran slash command" message). This is
   typically acceptable but could be noisy.
3. **Not available if the command doesn't use `$runID` explicitly.** There's no
   way for a command to programmatically detect "I was invoked from a task
   completion" unless the variable was placed in the template.
4. **Variable collisions.** If a user defines a variable called `$runID` in
   their playbook summary, the built-in takes precedence (or vice versa,
   depending on injection order). This needs a clear convention (e.g. built-ins
   override, or use a `$_runID` prefix to prevent collisions).

---

## Proposal B: Add a `Props` Map to `model.CommandArgs`

### Description

Add a `Props map[string]string` (or `map[string]any`) field to the
`model.CommandArgs` struct in the Mattermost server's `model` package. The
plugin would populate `Props["playbook_run_id"]` when calling
`pluginAPI.SlashCommand.Execute()`, and the receiving plugin's
`ExecuteCommand` hook would read it from `args.Props`.

### Implementation

**Mattermost server** (`server/public/model/command_args.go`):

```go
type CommandArgs struct {
    // ... existing fields ...
    Props map[string]string `json:"props,omitempty"`
}
```

**Plugin** (`server/app/playbook_run_service.go`):

```go
cmdResponse, err := s.pluginAPI.SlashCommand.Execute(&model.CommandArgs{
    Command:   command,
    UserId:    userID,
    TeamId:    playbookRun.TeamID,
    ChannelId: playbookRun.ChannelID,
    Props: map[string]string{
        "playbook_run_id": playbookRunID,
    },
})
```

**Command runner** (`server/command/command.go`):

```go
func (r *Runner) getPlaybookRunIDFromProps() string {
    if r.args.Props != nil {
        return r.args.Props["playbook_run_id"]
    }
    return ""
}
```

### Advantages

1. **Clean, structured API.** The run ID is carried as typed metadata, not
   embedded in the command text.
2. **Programmatically accessible.** The receiving command can detect it was
   triggered from a task completion and branch its logic accordingly.
3. **Extensible.** Additional context (checklist number, item number, playbook
   ID, etc.) can be added without further changes.
4. **Not visible in command text.** The run ID doesn't appear in logs/timeline
   as part of the command string.

### Disadvantages

1. **Requires a change to the Mattermost server's `model` package.** This is a
   cross-repository change (`mattermost/mattermost`). It needs a PR, review,
   and a new server version. The plugin cannot use this until the server
   dependency is updated.
2. **RPC serialization.** `model.CommandArgs` is serialized over the plugin RPC
   boundary. Adding a `Props` field requires verifying that the RPC layer
   (gob/msgpack) handles it correctly, and that older servers receiving the
   field don't break.
3. **Only works for plugin-to-plugin calls** (via `pluginAPI.SlashCommand.Execute`).
   If the server handles the command dispatch (e.g., for built-in or custom
   commands), the `Props` field may be ignored or dropped.
4. **Coordination cost.** Two repositories, two release cycles.
5. **Only available to commands that run inside this plugin.** Third-party
   slash commands (external webhooks) would not see `Props` — the outgoing
   webhook payload is derived from the `model.Post`, not `model.CommandArgs`.

---

## Proposal C: Use the `RootId` Field as a Side-Channel

### Description

The `model.CommandArgs` struct has a `RootId` field (intended for threaded
replies). When executing a slash command from a task, the `RootId` is not
typically set. This proposal repurposes it (or the `ParentId` field) to carry
the run ID.

### Implementation

```go
cmdResponse, err := s.pluginAPI.SlashCommand.Execute(&model.CommandArgs{
    Command:   command,
    UserId:    userID,
    TeamId:    playbookRun.TeamID,
    ChannelId: playbookRun.ChannelID,
    RootId:    playbookRunID, // repurposed
})
```

### Advantages

1. **No server changes required.** Uses an existing field.
2. **Immediate availability.** Works with the current server version.

### Disadvantages

1. **Semantic abuse.** `RootId` has a defined meaning (thread root post ID).
   Repurposing it creates confusion and potential conflicts.
2. **Fragile.** The server or other middleware might validate `RootId` as a
   post ID and reject or mishandle non-post-ID values.
3. **Not self-documenting.** Future developers won't understand why `RootId`
   contains a run ID without extensive comments.
4. **Could interfere with threading.** If the slash command creates a post, the
   server would try to thread it under a non-existent root post.
5. **Breaks if the field gains stricter validation.** Any future server change
   enforcing `RootId` as a valid post ID would break this approach silently.

---

## Proposal D: Store Run Context in Plugin KV Store, Pass a Correlation Key

### Description

Before executing the slash command, store the run context (run ID, checklist
number, item number, etc.) in the plugin's KV store under a unique correlation
key (e.g., a UUID). Pass the correlation key as a query parameter or flag in
the command string. The receiving command looks up the context from the KV
store.

### Implementation

**Before execution:**

```go
contextKey := model.NewId()
contextData, _ := json.Marshal(map[string]string{
    "run_id":          playbookRunID,
    "checklist_number": strconv.Itoa(checklistNumber),
    "item_number":      strconv.Itoa(itemNumber),
})
s.pluginAPI.KVSet("cmd_ctx_"+contextKey, contextData)
// optionally set with TTL/expiry
```

**In the command string:**

```
/playbook attribute set Severity --value High --ctx <contextKey>
```

**In the receiving command:**

```go
var ctx map[string]string
data, _ := r.pluginAPI.KVGet("cmd_ctx_" + ctxKey)
json.Unmarshal(data, &ctx)
runID := ctx["run_id"]
// Clean up
r.pluginAPI.KVDelete("cmd_ctx_" + ctxKey)
```

### Advantages

1. **Rich context.** Can pass arbitrary structured data — run ID, checklist
   number, item number, playbook ID, timestamp, etc.
2. **No server changes.** Everything stays within the plugin.
3. **Clean command string.** Only a short correlation key appears in the
   command text.

### Disadvantages

1. **Complex.** Two KV operations (write + read + delete) for every command
   execution. Adds latency and failure modes.
2. **Cleanup burden.** If the receiving command fails or the command targets a
   different plugin/integration, the KV entry leaks. Needs TTL or periodic
   cleanup.
3. **Only works for commands handled by this plugin.** A third-party command
   can't read from the plugin's KV store.
4. **Race conditions.** If the command executes before the KV write completes
   (unlikely with synchronous calls, but possible under load), the context is
   missing.
5. **Over-engineered for the problem.** Passing a single string (run ID) does
   not warrant a KV round-trip.

---

## Proposal E: Add a `Metadata` Map to `plugin.Context`

### Description

Similar to Proposal B, but adds the extensible field to `plugin.Context`
instead of `model.CommandArgs`. The server's `pluginContext()` function (in
`app/context.go`) would be modified to accept and forward metadata.

### Implementation

**Mattermost server** (`server/public/plugin/context.go`):

```go
type Context struct {
    SessionId      string
    RequestId      string
    IPAddress      string
    AcceptLanguage string
    UserAgent      string
    Metadata       map[string]string // new
}
```

The `pluginAPI.SlashCommand.Execute` method would need an overload or the API
would need to accept additional metadata.

### Advantages

1. **Clean separation.** Metadata about "how" the command was triggered
   (context) is separate from "what" the command is (`CommandArgs`).
2. **Extensible.** Additional context can be added.

### Disadvantages

1. **Requires server changes** (same as Proposal B).
2. **`plugin.Context` is built by the server**, not the caller. The
   `pluginAPI.SlashCommand.Execute` method takes `*model.CommandArgs`, not
   `*plugin.Context`. There's no way for the calling plugin to influence the
   `plugin.Context` that the receiving plugin's `ExecuteCommand` hook
   receives. The server's `pluginContext()` builds it from the request
   context.
3. **Deeper architectural change.** Would require modifying the
   `ExecuteSlashCommand` API to accept metadata, then threading it through
   `App.ExecuteCommand → tryExecutePluginCommand → pluginHooks.ExecuteCommand`.
4. **Even more coordination cost than Proposal B.**

---

## Proposal F: Automatic `--run` Flag Injection in Command String

### Description

Instead of requiring the user to write `$runID` in the command template,
`RunChecklistItemSlashCommand` automatically appends `--run <runID>` to any
`/playbook attribute` command it executes. For non-playbook commands, no
injection happens.

### Implementation

In `RunChecklistItemSlashCommand`, after variable substitution:

```go
if strings.HasPrefix(command, "/playbook attribute") {
    command += " --run " + playbookRunID
}
```

### Advantages

1. **Zero user effort.** The user writes `/playbook attribute set Severity
   --value High` and the run ID is added automatically.
2. **No server changes.**
3. **Tiny code change.**

### Disadvantages

1. **Tightly coupled.** Only works for `/playbook attribute` commands.
   Every new command that needs the run ID requires another special case.
2. **Surprising behavior.** The command stored in the checklist item is
   different from the command that actually executes. Debugging is harder.
3. **Fragile.** If the user already included `--run`, you get a duplicate.
   Needs detection logic.
4. **Doesn't help third-party commands.** A webhook-based slash command
   wouldn't benefit.
5. **Not generalizable.** This is a band-aid, not an architecture.

---

## Comparison Matrix

| Criterion | A: Variables | B: Props on CommandArgs | C: RootId Hack | D: KV Store | E: Metadata on Context | F: Auto-inject |
|-----------|:-----------:|:----------------------:|:--------------:|:-----------:|:---------------------:|:-------------:|
| No server changes | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Minimal code change | ✅ | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| Works for any command | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ |
| No semantic abuse | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| User-visible & explicit | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Programmatic detection | ❌ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| Extensible to more context | ⚠️ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Backwards compatible | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ |
| No cleanup/side-effects | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ |

---

## Recommendation: Proposal A (Built-in Variables)

**Proposal A** is the recommended approach for the following reasons:

1. **Pragmatism.** The problem is passing a run ID to a command. The existing
   variable substitution system already solves the general case of injecting
   dynamic values into commands. Adding `$runID` as a built-in variable is a
   natural, minimal extension of proven infrastructure.

2. **No cross-repo dependencies.** Proposals B and E require changes to the
   Mattermost server, which means a PR to `mattermost/mattermost`, a new
   server release, and an updated dependency in the plugin. This adds weeks to
   the timeline and creates a hard version dependency. Proposal A ships
   entirely within the plugin.

3. **Universality.** The variable works in any command string, not just
   `/playbook attribute`. If a user configures a task to run
   `/webhook fire --run-id $runID`, it works. Proposals F and C are limited to
   specific commands or semantically inappropriate.

4. **Explicitness.** The user sees `$runID` in the command template and
   understands that it will be replaced. There's no hidden injection (F) or
   invisible metadata (B, E). This follows the principle of least surprise.

5. **Low risk.** The change is ~5 lines in `RunChecklistItemSlashCommand`. It
   doesn't touch the data model, the RPC boundary, or the server. It's trivial
   to test, review, and revert.

6. **Foundation for future work.** If a structured metadata approach (Proposal
   B) is eventually implemented in the server, Proposal A still works and
   complements it. The variable substitution provides the user-facing UX while
   structured metadata provides the programmatic API. They're not mutually
   exclusive.

### Mitigations for Disadvantages

- **Variable collision:** Use a distinctive prefix. Define built-in variables as
  `$PB_RUN_ID`, `$PB_CHANNEL_ID`, `$PB_TEAM_ID`, etc. Document that variables
  starting with `$PB_` are reserved for built-in playbook context. Override any
  user-defined variable with the same name (built-ins take precedence).

- **"User must remember to include it":** This is a feature, not a bug. Not
  every command needs the run ID. The user opts in explicitly.

### Suggested Built-in Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `$PB_RUN_ID` | `playbookRunID` | The ID of the playbook run |
| `$PB_RUN_NAME` | `playbookRun.Name` | The name of the playbook run |
| `$PB_CHANNEL_ID` | `playbookRun.ChannelID` | The run's channel ID |
| `$PB_TEAM_ID` | `playbookRun.TeamID` | The run's team ID |
| `$PB_OWNER_USER_ID` | `playbookRun.OwnerUserID` | The run owner's user ID |

These are injected into `varsAndVals` before the user-defined variable
resolution loop, so they are available in any command template without needing
to define them in the playbook summary.
