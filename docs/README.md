# Docs index

Where each rule lives. Start from [AGENTS.md](../AGENTS.md) for the authority hierarchy and
non-negotiable boundaries; open a doc only when the task touches its area.

## One source per concern

Keep durable documentation in this repository's `docs/`, not in GitHub Wiki. This index is a
navigation aid, not another policy layer. The [ownership matrix](../.agent/ownership.yaml) owns the
mapping of concerns to canonical files; the [routing matrix](../.agent/routing-matrix.yaml) selects
task context. The tables below summarize those sources without replacing them.

Change a rule in its owning file and link to it from guides, skills, plans, and invitation notes
instead of copying its requirements. Read overlapping documents by their stated scope; follow the
authority hierarchy in `AGENTS.md` if they conflict. Completed plans and point-in-time reports are
historical evidence, not current policy.

## Governance sources

| Concern                                   | Source and scope                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent operating procedure                 | [Agent routing](../.agent/rules/agent-routing.md)                                                                                                                                    |
| Task Contract, plans, goals, handoffs     | [Plans contract](../.agent/plans/README.md)                                                                                                                                          |
| Git authorization and checkout safety     | [Git Safety rule](../.agent/rules/git-safety.md); session mechanics in [Git Safety session](core/git-safety-session.md)                                                              |
| Review contract and validation tiers      | [Gatekeeper](../.agent/rules/gatekeeper.md); detailed checks in [validation procedures](core/validation-procedures.md)                                                               |
| Database safety boundaries                | [Database rule](../.agent/rules/database.md); operational procedure in [database workflow](database-workflow.md)                                                                     |
| Native command approval policy            | [Permissions rule](../.agent/rules/permissions.md); adapter usage in [agent permissions](core/agent-permissions.md)                                                                  |
| Board protocol and project additions      | [Board rule](../.agent/rules/board.md) links the generic protocol in the `tablero` repository; [coordinator guide](core/coordinator-board.md) owns Celebra-me setup and coordination |
| Available commands and lane configuration | [package.json](../package.json) owns scripts; [tablero.config.json](../tablero.config.json) owns registered projects, lanes, and ports                                               |

## Documentation map

| Topic                                           | Doc                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task prompt reference                           | [core/agent-interaction.md](core/agent-interaction.md) (inherits governance above)                                                                                                                           |
| Branches, PRs, release policy                   | [core/git-governance.md](core/git-governance.md), [core/release-process.md](core/release-process.md)                                                                                                         |
| Running a release (owner-only production steps) | [core/release-execution.md](core/release-execution.md)                                                                                                                                                       |
| Session safety, worktrees                       | [core/git-safety-session.md](core/git-safety-session.md), [core/worktrees/](core/worktrees/)                                                                                                                 |
| Coordinator and board                           | [core/coordinator-board.md](core/coordinator-board.md); board protocol in the `tablero` repo, `docs/agent-rules.md`                                                                                          |
| Validation procedures                           | [core/validation-procedures.md](core/validation-procedures.md) (implements Gatekeeper)                                                                                                                       |
| Architecture, conventions                       | [core/architecture.md](core/architecture.md), [core/project-conventions.md](core/project-conventions.md)                                                                                                     |
| Content schema, invitations                     | [core/content-schema.md](core/content-schema.md), [core/invitation-creation-contract.md](core/invitation-creation-contract.md), [invitations/README.md](invitations/README.md)                               |
| Content parity and RSVP isolation               | [core/content-parity-rsvp-isolation.md](core/content-parity-rsvp-isolation.md)                                                                                                                               |
| Screenshots, visual compare                     | [core/screenshot-tool-contract.md](core/screenshot-tool-contract.md), [core/local-render-corpus.md](core/local-render-corpus.md), [operations/remote-visual-compare.md](operations/remote-visual-compare.md) |
| Sensitive data                                  | [core/sensitive-data-guide.md](core/sensitive-data-guide.md)                                                                                                                                                 |
| Database, env                                   | [database-workflow.md](database-workflow.md), [env-workflow.md](env-workflow.md)                                                                                                                             |
| Cloudflare platform                             | [operations/cloudflare-platform.md](operations/cloudflare-platform.md)                                                                                                                                       |
| Domain notes                                    | [domains/](domains/)                                                                                                                                                                                         |
| Draft data prerequisites inventory              | [core/data-prerequisites-json-shapes-inventory.md](core/data-prerequisites-json-shapes-inventory.md) (proposal for owner decision, not an enforced contract)                                                 |
| Proposals and reviews                           | [propuestas/](propuestas/) (proposed decisions, not governing rules)                                                                                                                                         |

Domain documents own their specific contracts and runbooks; per-client files under `invitations/`
describe preparation and state for that invitation and must not redefine system rules. Release
policy, code delivery, database operations, and environment sourcing have separate owners listed
above; none of these guides grants operational authority.
