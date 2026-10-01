# Task 01: Playbook creation (already ported)

**Task id**: `ported-create-playbook` · **Kind**: done

## Target

- `tests/playbooks/create_playbook.spec.ts`

## What to do

Already ported before task tracking started. Nothing to do.

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/creation_button_spec.js` | all tests |

### `playbooks/creation_button_spec.js`

> Scope: all tests

- **Area**: playbook creation entry points (LHS "New Playbook" button, template picker, permission gating)
- **Setup**: testUser + custom sysadmin; one pre-existing public playbook (to avoid empty-list flicker); viewport macbook-13; separate restricted-permissions scenario with custom team scheme removing `playbook_private_create`/`playbook_public_create`.
- **Tests**:
  - `playbooks > creation button > opens playbook creation page with New Playbook button` — clicking "Create playbook" (LHS list + modal confirm) opens editor outline for "Untitled Playbook" and adds it to LHS.
  - `playbooks > creation button > auto creates a playbook with "Blank" template option` — clicking "Blank" template auto-creates and opens outline for `@user's Blank`, appears in LHS.
  - `playbooks > creation button > opens Service Outage Incident page from its template option (multiple teams)` — with 2 teams, clicking "Incident Resolution" template creates/opens `@user's Incident Resolution` playbook outline scoped to current team's LHS.
  - `playbooks > creation button > user is lacking permissions to create playbooks > create playbook entry in LHS dropdown should not exist` — user without create-playbook permission sees no "Create New Playbook" entry in the create-playbook-dropdown-toggle menu.
  - `playbooks > creation button > user is lacking permissions to create playbooks > permission notice should be shown if no playbooks exist` — with no playbooks and no permission, backstage list shows "You don't have permission to create playbooks in this workspace." notice.
  - `playbooks > creation button > user is lacking permissions to create playbooks > create playbook button should not exist if playbooks exist` — once a playbook exists in the team (created by admin), restricted user's list view hides the "Create playbook" button entirely.
