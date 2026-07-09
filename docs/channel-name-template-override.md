# Channel/run name template override

## Background

`Playbook.ChannelNameTemplate` drives both the channel name and the run's
name/title when a run is created. Before this change, whenever a template
was set, it always won over any name the caller supplied — and the webapp
"Start a run" modal made the run-name field read-only to match.

This was too rigid: admins had no way to let the template act as a mere
default that users could override. This feature adds a
`channel_name_template_override_allowed` flag to control that:

| Template | Has a valid variable? | Override allowed | Result |
|---|---|---|---|
| empty | — | — | caller's name is used |
| set | no (purely literal, or only unrecognized placeholders) | forced `true` regardless of the stored flag | caller's name is used; caller **must** supply one |
| set | yes (references `{SEQ}` or a real property field) | `true` (default) | caller's name is used; caller **must** supply one — the template is only a prefill/default |
| set | yes | `false` | template always wins, exactly like the old (pre-this-feature) behavior |

A "valid variable" means a system token (`{SEQ}`, `{OWNER}`, `{CREATOR}`,
`{PROPERTY_USER}`) or the name of a property field that actually exists on
the playbook. An unrecognized placeholder — a typo, or a reference to a
field that was since deleted — does **not** count, specifically so it can
never "lock" a template that could never actually resolve. This is
implemented in `TemplateOverrideAllowed`/`templateHasValidVariable`
(`server/app/template_engine.go`), covered by `TestTemplateOverrideAllowed`
and `TestResolveAndAllocate_UnrecognizedPlaceholderDoesNotTrickOverrideAllowed`
(`server/app/template_engine_test.go`, `server/app/resolve_and_allocate_test.go`).

**Tokens also resolve in a user-supplied name, not just the template.** If
override is allowed and the caller types e.g. `Release {Version}` as the run
name, `{Version}` resolves the same way it would inside the playbook's own
template (via `ResolveTemplate` in `server/app/template_engine.go`). Unlike
the template's own resolution (which errors on an unresolved placeholder when
locked), an unresolved token in a user-supplied name is left as literal text
rather than rejected — the user typing `{` didn't necessarily intend a
placeholder. See `TestResolveAndAllocate_UserSuppliedNameResolvesSystemToken`,
`TestResolveAndAllocate_UserSuppliedNameResolvesPropertyField`, and
`TestResolveAndAllocate_UserSuppliedNameLeavesUnrecognizedTokenLiteral`
(`server/app/resolve_and_allocate_test.go`).

Both backend and frontend are implemented, along with e2e coverage.

## What was implemented

### Backend

- **New field**: `Playbook.ChannelNameTemplateOverrideAllowed bool`
  (`server/app/playbook.go`), JSON key
  `channel_name_template_override_allowed`, GraphQL field
  `channelNameTemplateOverrideAllowed`. Defaults to `true` (override
  allowed) — added via migration `0.68.0 → 0.69.0`
  (`server/sqlstore/migrations.go`), column
  `ChannelNameTemplateOverrideAllowed BOOLEAN NOT NULL DEFAULT TRUE` on
  `IR_Playbook`.
  - **Caveat for new playbooks created via a raw API call**: the DB
    `DEFAULT TRUE` only backfills *pre-existing* rows at migration time.
    `POST /playbooks` (and the GraphQL/REST create paths generally) write
    whatever value is on the submitted `Playbook` JSON object — if the
    field is omitted, Go's zero value (`false`) is what gets stored, not
    `true`. This mirrors the existing behavior of
    `run_summary_template_enabled` (also `DEFAULT TRUE` at the DB level).
    The **webapp UI already handles this correctly** —
    `emptyPlaybook()` in `webapp/src/types/playbook.ts` explicitly
    initializes the field to `true` for new playbooks, and the create
    request serializes the whole object. Only a *raw* API/integration
    caller that omits the field would get `false`; e2e tests that create
    playbooks via `cy.apiCreatePlaybook` (which doesn't set it) must patch
    it explicitly.
- **Resolution logic** (`resolveRunName`, `server/app/playbook_run_service.go`):
  the template is only authoritative when
  `TemplateOverrideAllowed(pb, template, fields)` returns `false` (i.e. the
  template has a valid variable AND the flag is explicitly `false`).
  Otherwise the caller's name is used (with its own tokens resolved — see
  above), and if the template is set but no name was supplied, run creation
  fails with a validation error instead of silently falling back to the
  template.
- **Field loading** (`loadTemplateFields`, same file): property fields are
  fetched whenever *either* the template *or* the user-supplied name
  contains a placeholder — needed so a token typed into a free-text name can
  actually resolve against a real field, not just tokens in the template.
- **Preflight validation** (`dryRunValidateTemplate`, same file): skips
  template-resolvability checks entirely when override is allowed, since a
  template that fails to resolve (e.g. a referenced property field has no
  value) no longer blocks run creation in that case — it's irrelevant once
  the caller's name is what's actually used.
- **API-level guard** (`server/api/playbook_runs.go`, `createPlaybookRun`):
  rejects an empty name up front with "missing name of playbook run"
  whenever override is allowed (empty template, no valid variable, or the
  flag is `true`). This pre-check loads the playbook's property fields
  itself (mirroring `loadTemplateFields`) so it applies the exact same
  valid-variable rule as the deeper resolution logic.
- **Settable via**:
  - GraphQL `updatePlaybook` mutation —
    `Updates.channelNameTemplateOverrideAllowed`
    (`server/api/graphql_root_playbook.go`, `server/api/schema.graphqls`).
  - REST `PATCH /playbooks/{id}` —
    `channel_name_template_override_allowed` in the request body
    (`server/api/playbooks.go`, `patchPlaybook`).
  - REST `PUT /playbooks/{id}` — round-trips automatically as a plain field
    on the `Playbook` JSON body (subject to the same-zero-value caveat as
    above for callers that omit it).
  - No extra permission check: toggling the setting uses the same
    permission as editing `channel_name_template` today
    (`PlaybookEdit`/`PlaybookManageProperties`), not an admin-only gate.
- **API docs**: `channel_name_template` and
  `channel_name_template_override_allowed` documented on the `Playbook`
  schema in `server/api/api.yaml`.

### Frontend

- **Playbook editor** (`webapp/src/components/backstage/playbook_edit/automation/channel_access.tsx`):
  a checkbox — *"Allow users to change run name"* — below the run-name
  template input (`data-testid="channel-access-run-name-template-override-allowed"`),
  checked by default. Disabled and force-checked whenever the template has
  no valid variable (mirroring the backend rule via
  `templateHasValidVariable` in `webapp/src/utils/template_utils.ts`), and
  self-heals a stale stored `false` back to `true` in that case so the
  displayed and stored values never diverge. Persisted via a new REST call,
  `updatePlaybookChannelNameTemplateOverrideAllowed`
  (`webapp/src/client.ts`), wired through a debounce-free save handler in
  `webapp/src/components/backstage/playbook_editor/outline/section_actions.tsx`
  (treated as REST-only, like `run_number_prefix`, since it isn't wired into
  the GraphQL query).
- **"Start a run" modal** (`webapp/src/components/modals/run_playbook_modal.tsx`):
  - `locked = hasTemplate && !overrideAllowed` now drives `readOnly` on the
    run-name field (previously just `hasTemplate`).
  - The field always prefills with the raw `channel_name_template` when one
    exists, whether locked (read-only) or not (editable, as a suggestion).
    Submitting it unedited still resolves correctly even when unlocked,
    since the backend resolves tokens in a user-supplied name the same way
    it resolves the template itself (see above) — so there's no more risk
    of a raw `{SEQ}` ending up literally in the created run's name. The name
    is still required: clearing the field (locked or not) blocks submit.
  - `namePreview` is computed from the **current run-name field content**
    (`runName`), not the playbook's stored template, and shown whenever
    that content contains a `{token}` — regardless of lock state. This
    means typing a token into a free-text name (e.g. `Release {Version}`)
    shows a live resolved preview, matching what the backend will actually
    produce, exactly like a locked template's preview always has.
  - `namePreviewTooLong` follows the same `runNameHasToken`-based
    condition, so the 64-character warning applies to any resolved
    preview, not just the locked case.

## E2E tests (implemented)

Coverage is organized around the three core scenarios (no valid variable /
valid variable + locked / valid variable + override allowed), each with a
full run-creation assertion, not just field-state checks:

- `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/run_naming_spec.js`
  (playbook editor): checkbox existence/default-checked, unchecking persists
  across reload, force-checked-and-disabled for a literal template, and a
  locked-SEQ-template run-creation test (resolved sequential ID ends up in
  the run name).
- `e2e-tests/cypress/tests/integration/playbooks/playbooks/start_run_template_spec.js`
  ("Start a run" modal), one describe block per scenario:
  - **Locked** (`name field is not required when template is locked`):
    read-only field prefilled with the raw template, submit enabled, and the
    created run's name is the template's resolved value — including an
    API-level test that calls the create-run endpoint directly with a name
    that differs from the template, proving the backend actually ignores a
    client-supplied name when locked (a UI-driven submission alone can't
    prove this, since the read-only field always submits the same text the
    template would resolve to anyway).
  - **Override allowed / default** (`name field is required when template
    exists but override is allowed`): editable field prefilled with the
    template as a suggestion, live preview of the resolved value, clearing
    it disables submit, submitting the typed name uses it verbatim, and a
    token typed freehand (`Kickoff by {OWNER}`) resolves in both the preview
    and the created run's stored name.
  - **No valid variable** (`literal template (no variable) always allows
    override, even when explicitly locked`): a literal template with
    `channel_name_template_override_allowed: false` explicitly set still
    shows an editable field (force-allow rule), and the created run uses
    the user's edited name, not the stored template.
  - Plus the pre-existing "template name too long" and "many property
    fields" tests, updated to explicitly lock/unlock as their scenarios
    require.
