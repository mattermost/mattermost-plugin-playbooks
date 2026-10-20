# Task 02: Backstage navigation smoke (already ported)

**Task id**: `ported-navigation` · **Kind**: done

## Target

- `tests/smoke/navigation.spec.ts`

## What to do

Already ported before task tracking started. Nothing to do.

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/navigation_spec.js` | all tests |

### `navigation_spec.js`

> Scope: all tests

- **Area**: backstage LHS navigation between Playbooks list and Playbook Runs list
- **Setup**: one public playbook with one run; no special viewport/permissions.
- **Tests**:
  - `navigation > switches to playbooks list view via sidebar view all button` — clicking "playbooksLHSButton" from `/playbooks` shows the Playbooks backstage list (`titlePlaybook` header visible).
  - `navigation > switches to playbook runs list view via sidebar view all button` — after switching to playbooks, clicking "playbookRunsLHSButton" shows the Playbook Runs list (`#playbookRunList` exists).
