# F11 Preview worktree

Path: `<worktrees-root>/f11-preview`. Runtime: Preview. Astro port: 4331.

The local Astro process requires `.env.local` plus the `.env.preview.local` overlay with matching
Preview server/public identities. Missing or Production-valued Preview configuration fails closed.
This local process is distinct from the hosted Cloudflare Preview deployment.

Preview migrations, content updates, hosted test provisioning and publication each require their own
scoped authorization. `.env.e2e.local` is used only for an explicitly assigned hosted test. Never
distribute Production configuration to this lane through generic synchronization.

Assignment, branch lifecycle and guard rules follow the [lane guide](README.md) and
[Git governance](../git-governance.md). No path grants administrative privilege.
