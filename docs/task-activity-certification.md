# Task activity certification rollout

Playbooks persists a run's task activity revision with checklist and consumed timeline changes. Certified full reads carry `task_activity_sync` with `complete: true`; captured transitions carry `base_revision`, `revision`, and `complete: false`. Mobile uses these fields to apply updates once and recover from gaps. Task mutation requests opt in with `task_activity_sync=1`; older requests keep their existing response shape.

Certification starts **disabled** after migration and is disabled again whenever an upgraded plugin process activates. The database row lock serializes upgraded writers with activation, but an older plugin process does not take that lock. Keep certification disabled until all older Playbooks processes have stopped, every active process runs this build, and the covered writer audit is complete. A mixed-version cluster must not serve certified responses.

After the rollout, a system administrator can use `/plugins/playbooks/api/v0/admin/task-activity-certification`:

1. `GET` the state and note `generation`. Confirm `enabled` is false.
2. `POST` JSON with `expected_generation`, `all_older_plugin_nodes_stopped: true`, and `covered_writers_audited: true`. The server checks the generation under the certification row lock, assigns a fresh opaque epoch, and enables certification. A conflict means the state changed; repeat the checks before retrying.
3. `GET` again to confirm the new `epoch` and `enabled: true`. Test a complete run read and an opted-in task mutation against that epoch.

Use `DELETE` on the same admin endpoint before downgrading or if the rollout becomes mixed. Restarting any upgraded process also disables certification and requires a fresh activation. Never reuse an earlier epoch after uncertified writes.

| Client and plugin | Behavior |
| --- | --- |
| Older mobile, upgraded plugin | Existing REST and WebSocket fields remain; non-opted-in mutation response shapes are unchanged. |
| Upgraded mobile, certification disabled or older plugin | Mobile uses legacy task activity matching and full-run refreshes; it does not treat absent metadata as a complete certificate. |
| Upgraded mobile, certification enabled | Full reads establish `(epoch, revision)`; mutation results and WebSocket deltas apply against their exact base revision. Gaps or epoch changes trigger a full-run recovery. |

This gate is an explicit operator acknowledgment, not automatic proof of cluster membership. The store alone cannot identify an older node that is still writing.
