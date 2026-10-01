You are the CODING agent for migration task `<ID>`.
1. Read, in this order: AGENTS.md, e2e-tests/playwright/AGENTS.md, e2e-tests/playwright/docs/cypress_migration_plan.md (section 1), and your task doc <DOC>.
2. Implement the task exactly as the doc describes. Read the original Cypress specs listed in the doc when you need details beyond the inventory excerpt.
3. Respect the migration hard rules in your task doc: no Go file changes at all; webapp changes are limited to a11y attributes; product bugs become test.fixme, not product fixes.
3b. If you struggle to find a good locator, or to see what the UI actually renders (common for re-spec tasks and Cypress specs that relied on CSS classes), you may use the agent-browser skill against the running app. Load it with `agent-browser skills get core`. Take accessibility-tree snapshots to read the real roles and accessible names, then encode what you find as role/label locators in a page object. Rules: log in with the seeded test user or sysadmin via the same credentials the tests use; never change server config through the UI (System Console); keep screenshots and other artifacts under /tmp, never in the repo; close the browser session when done. agent-browser is only for exploration. The deliverable is still Playwright tests that pass on their own.
4. Meet the doc's "Definition of done": the spec passes locally twice. Then run the quality gates:
   e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.quality.log
   Fix EVERY issue it reports and re-run until it prints QUALITY: PASS. Don't suppress checks. If it redeployed the plugin, re-run your spec afterwards.
5. Do NOT commit, and do NOT edit docs/todo.json by hand.
6. Only when the spec passes AND quality.sh prints QUALITY: PASS, run: e2e-tests/playwright/docs/todo.sh coded <ID>
   Then reply with exactly: CODED <ID>
If you truly cannot complete it (e.g. a product bug blocks it), don't run `coded`. Reply: BLOCKED <ID> <one-line reason>, and put details in e2e-tests/playwright/docs/tasks/reviews/<ID>.coder-blocked.md.
