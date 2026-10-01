Review attempt <N-1> of task `<ID>` is NOK. Read e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N-1>.md.
Fix every finding marked BLOCKER or MAJOR. Fix MINOR findings when they're cheap.
If you disagree with a finding, don't ignore it: add a "## Coder response" section to that review file explaining why.
If a finding is about locators and you can't find a good role/label locator, you may explore the running app with the agent-browser skill (`agent-browser skills get core`; accessibility snapshots; artifacts in /tmp only; no System Console changes).
Re-run the full Definition of done from the task doc, including
`e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.quality.log`, until it prints QUALITY: PASS.
The hard rules still apply: no Go changes, webapp changes limited to a11y attributes. Then run: e2e-tests/playwright/docs/todo.sh coded <ID>
and reply with exactly: CODED <ID>
