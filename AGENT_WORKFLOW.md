# Developer and Reviewer Workflow

This workflow defines how Codex builds the **Gym Check-in System Template** using Developer Mode, Reviewer Mode, and Fast Build Mode.

The template is a new, non-production product workspace based on the proven AXIS Check-in system. It is not built by rewriting or deploying the live AXIS production runtime.

## 1. Developer Mode

Developer Mode is responsible for implementing the current task.

The Developer must:

1. Check `git status` and read the relevant project documents before changing files.
2. Use `PRODUCT_PLAN.md` as the product and phase blueprint.
3. Make focused changes that match the task and current phase.
4. Keep the file scope small and avoid unrelated refactors.
5. Preserve documented configuration, data, API, and scanner contracts unless the task explicitly changes them.
6. Run proportionate automated or manual checks.
7. Show a short diff summary after the change.
8. Hand the current diff to Reviewer Mode before committing.

Developer Mode must not deploy to AXIS production, a real client system, or a live Apps Script deployment unless the user explicitly authorizes that specific deployment.

## 2. Reviewer Mode

Reviewer Mode performs a read-only review of the current diff. It must not modify, stage, commit, push, or deploy files while reviewing.

The Reviewer checks:

- Does the change match the requested task and acceptance criteria?
- Were any unrelated files changed?
- Are `AGENTS.md`, `DEPLOYMENT.md`, configuration rules, and documented contracts followed?
- Is the implementation consistent with `PRODUCT_PLAN.md` and the current phase?
- Does the change accidentally touch AXIS production behavior, live systems, real data, secrets, or credentials?
- Are errors, edge cases, and backward compatibility handled in proportion to the task?
- Which automated and manual tests have run, and which manual tests remain?
- Is the diff small, understandable, and ready to commit?

The Reviewer returns:

```text
Summary: <what changed and whether it matches the task>
Files changed: <list>
Risk level: low | medium | high
Manual tests: <required checks>
Verdict: approved | request changes
```

If the verdict is `request changes`:

1. Do not commit or push.
2. Return to Developer Mode and address the review comments.
3. Run relevant checks again.
4. Run Reviewer Mode again on the updated diff.
5. Commit or push only after the verdict is `approved`.

## 3. Fast Build Mode

Fast Build Mode is the default for the new, non-production Gym Check-in System Template workspace. It provides standing approval for routine Git commits and pushes after a successful Reviewer Mode review, so the user does not need to approve each one manually.

### Workflow

1. Developer Mode makes the scoped change and runs checks.
2. Developer Mode shows a short diff summary.
3. Reviewer Mode reviews the current diff without modifying it.
4. If the verdict is `approved`, Codex may stage only the reviewed files, commit them, and push the commit to GitHub.
5. Codex reports the commit, push result, tests, and final `git status`.
6. If a later problem is found, fix it in a follow-up commit or use a safe Git revert; do not rewrite important shared history.

### Allowed after Reviewer approval

- Create files and directories in the template workspace.
- Modify template code, tests, configuration examples, and documentation.
- Stage only the reviewed files.
- Commit the approved change.
- Push the approved commit to the configured GitHub repository.

### Not allowed without explicit user approval

- Deploy to a real client production system.
- Run `clasp push` against a real live production Apps Script deployment.
- Change or deploy the AXIS production runtime.
- Read, expose, commit, or print secrets and credentials.
- Modify or delete real user/member data.
- Delete important project history or force-push shared branches.
- Make a broad architecture change that is not covered by the task and `PRODUCT_PLAN.md`.

Fast Build Mode applies only when the workspace and task are clearly non-production template work. If that status is unclear, treat the task as protected and ask before pushing or deploying.

## 4. Production Protection Rule

AXIS Check-in is a working production reference. Template development must not modify or deploy the AXIS production runtime.

If a task touches AXIS production, a live client system, a real Apps Script deployment, or real user data:

1. Stop before the production-affecting action.
2. Explain the exact target, change, and risk.
3. Confirm the repository and deployment state.
4. Ask for explicit user approval for that specific deployment or live-data action.
5. Proceed only after approval and follow `DEPLOYMENT.md`.

A successful code review or ordinary Git push is not approval for a production deployment. `clasp push` remains a separate protected action for live projects.

## 5. Template Build Principle

For the Gym Check-in System Template, prefer safe forward movement:

- Plan clearly and implement one bounded task at a time.
- Use Developer Mode and Reviewer Mode for routine quality control.
- Let an approved review unblock routine commits and GitHub pushes.
- Use Git history and follow-up commits to recover from normal mistakes.
- Avoid unnecessary copy-paste and manual approval pauses.
- Keep production boundaries strict even when template development moves quickly.

## 6. Phase-based work

Use `PRODUCT_PLAN.md` as the implementation blueprint and complete one phase at a time:

1. **Phase 1:** repository structure and configuration model.
2. **Phase 2:** Google Sheets schema and setup functions.
3. **Phase 3:** reusable scanner.
4. **Phase 4:** backend check-in API.
5. **Phase 5:** owner/admin panel.
6. **Phase 6:** member management and QR card workflow.
7. **Phase 7:** attendance views and reports.
8. **Phase 8:** demo-data testing.
9. **Phase 9:** first gym instance.

Each implementation task should identify its phase, acceptance criteria, expected file scope, required tests, and protected areas that must not change. A phase is complete only when its acceptance criteria pass and Reviewer Mode approves the final diff.
