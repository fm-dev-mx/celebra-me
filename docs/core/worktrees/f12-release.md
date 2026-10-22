# F12 Release worktree

Path: `<worktrees-root>/f12-release`. Runtime: Preview. Astro port: 4332.

F12 hosts assigned release preparation tasks on ephemeral branches. Its runtime requirements are the
same as [F11](f11-preview.md): a required Preview overlay, never Production runtime defaults. The
release role grants no database, publication, deployment or Production authority.

Prepare version/changelog and any approved reference commits here; Integration merges task branches
and promotes `develop` through the protected `main` pull request. Follow
[release execution](../release-execution.md) and [Git governance](../git-governance.md).

Production operator configuration remains in its owning Integration/operator workflow. Do not copy
it to F12 through generic synchronization or infer authority from a release task assignment.
