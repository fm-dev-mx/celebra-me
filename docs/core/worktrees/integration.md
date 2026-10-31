# Integration worktree

Integration is the repository root, F5, port 4321, with Local runtime defaults. It stays on
`develop` for integration, coordination and explicitly authorized operations. It never hosts
ordinary task branches. Prepare release checkpoint commits in an assigned external lane, then
integrate them through the [task lifecycle](../git-governance.md#task-lifecycle).

Mutable-session start permits `develop` so an authorized merge can begin. Commit-time checks require
merge completion on `develop`; a passing session guard never authorizes direct task commits.

`.env.local` supplies Local runtime values. Preview and Production operator configuration is loaded
only by its owning workflow, with separate operation authority. Never put Production credentials in
ordinary runtime configuration. See [environment workflow](../../env-workflow.md).

The [lane guide](README.md) owns discovery. Other checkouts, including historical app worktrees,
remain user-owned and must not be inspected, repurposed or removed without named scope.
