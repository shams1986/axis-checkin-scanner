# Deployment Workflow

GitHub is the source of truth for this project. The Google Apps Script deployment is a runtime copy of the backend source stored in `apps-script/`.

Do not edit production code directly in the Google Apps Script editor. Make changes in this repository, commit and push them to GitHub, and then deploy the Apps Script copy with `clasp`.

## Before making changes

Check that the working tree is in the expected state:

```sh
git status
```

Review and preserve any existing uncommitted work before continuing.

## Frontend changes

The frontend consists of the root-level scanner and PWA files. After reviewing and testing a change:

```sh
git status
git add <changed-files>
git commit -m "Describe the frontend change"
git push
git status
```

Pushing to the repository publishes the source used by the frontend hosting workflow.

## Apps Script changes

Apps Script source is stored in `apps-script/`. Commit and push it to GitHub before copying it to the Apps Script runtime:

```sh
git status
git add apps-script/
git commit -m "Describe the Apps Script change"
git push
cd apps-script
clasp push
cd ..
git status
```

Confirm the intended Apps Script project and deployment configuration before running `clasp push`.

## Deployment rules

- GitHub is the source of truth; Google Apps Script is the runtime copy.
- Never edit production code directly in the Google Apps Script editor.
- Check `git status` before starting and after completing changes.
- Review the diff before committing.
- Commit and push Apps Script changes before running `clasp push`.
- Do not deploy unrelated or uncommitted changes.
