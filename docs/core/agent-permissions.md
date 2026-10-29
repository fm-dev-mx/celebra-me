# Agent command permissions

`.agent/permissions/policy.json` is the shared source for native command approval adapters. `allow`
contains literal command prefixes, `ask` contains commands requiring explicit interactive host
approval (such as coordinator PR merges), `deny` contains prefixes and shell wildcard patterns, and
`denyRead` contains sensitive path patterns. Code and policy contain no machine-specific paths. The
file grants no task authority: agents still need the current task's `AUTORIZO` for Git writes and
other gated operations. Board prompts remind agents to reuse that authorization.

## Preview and application

```sh
pnpm agent:permissions
pnpm agent:permissions -- --dry-run
```

These equivalent previews only read the four configuration targets below. They create neither files
nor backups, and print only generated permission additions, never existing settings, old permission
values, tokens, environment values, MCP definitions or credential files. An updated text block is
shown as the proposed generated block with existing content withheld, rather than a full raw diff.
Warnings go to stderr; stdout is the permission diff. An empty stdout diff means no changes.

The owner or an explicitly authorized coordinator reviews the preview and runs:

```sh
pnpm agent:permissions -- --apply
```

Before any configuration write, the script creates exclusive adjacent
`.celebra-backup-<timestamp>-<id>` backups of every existing file that will change. Backups may
contain private settings: they are created with owner-only file mode where supported, and must
remain local. Do not attach them to reports. Restore an exact backup manually after reviewing it if
needed. New files need no backup. All targets are planned and validated before writing; a changed
file or symlink/junction aborts. Each target is replaced atomically, but multiple files are not one
transaction: an I/O failure can leave some adapters updated, with their backups available. Fix the
cause and preview again before applying. No automatic rollback overwrites user state.

`--home=<directory>` substitutes a fixture/user-home root for all four targets. It does not change
the policy source or permit arbitrary destination filenames. Tests use temporary homes only. Unknown
options and contradictory `--apply --dry-run` fail. Invalid settings fail without echoing their
contents. The script does not load `.env`, credentials, default Codex rules or MCP files.

## Native destinations

All paths in this table are relative to the selected user home.

| Adapter         | Destination                             | Update behavior                                                                                                 |
| --------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Codex           | `.codex/rules/celebra-me.rules`         | Replace the marked generated block; preserve other text and every existing `.rules` file.                       |
| Claude Code     | `.claude/settings.json`                 | Union generated `allow`, `ask`, and `deny` entries; move entries to ask if reassigned; preserve other settings. |
| Gemini CLI      | `.gemini/policies/celebra-me.toml`      | Replace the marked generated block; preserve other text and policy files.                                       |
| Antigravity CLI | `.gemini/antigravity-cli/settings.json` | Union generated `command(...)` and `read_file(...)` permissions; preserve other settings and Ask rules.         |

After updating an agent, preview again, check its current native schema, apply only through the
owner or coordinator, and restart/reload the affected agent. Codex loads `.rules` at startup. Repeat
the preview to confirm idempotence. Custom configuration directories and managed/enterprise policies
are not discovered or rewritten; verify them separately if the agent uses them.

## Coverage and limits

- **Codex:** emits literal argv `prefix_rule` entries. The strictest matching decision wins. It
  cannot encode shell wildcard denies, file-tool paths, every reordered flag, refspec, shell alias
  or wrapper. Common force/main push spellings are denied; wildcard-only deny entries are explicitly
  not compiled. Existing one-off approvals remain. These rules govern commands outside the sandbox,
  not every process or file access. Keep filesystem/sandbox safeguards enabled.
- **Claude:** emits Bash and PowerShell command rules, ask rules, and Read denies. Deny takes
  precedence over allow. Gated operations like `gh pr merge` land in ask so the coordinator can
  merge approved PRs with owner approval; Codex and Gemini keep them denied. File tools and
  recognizable shell reads get path protection, but arbitrary scripts can still read files
  indirectly. Existing Ask rules can continue prompting. Settings are merged as JSON; unrelated
  values survive, though formatting is normalized when additions are necessary.
- **Gemini:** emits user TOML policies with allow priority 10 and deny priority 999, including
  sensitive path argument matches for read/search tools. Other user policies at equal priority,
  higher admin policies, MCP tools and indirect script reads need separate inspection. The script
  does not enable YOLO or modify `tools.allowed`/legacy settings. Compound command handling is
  host-dependent; keep commands simple and review unsupported invocations.
- **Antigravity:** targets the documented **CLI**, not App/IDE. Command regex denies use native
  token matching and cannot cover every reordered argument. File rules cover the literal workspace
  `.env` and sensitive directory roots only; the CLI documents paths, not arbitrary file globs, so
  `.env.local` and nested copies are not covered by those file rules. The CLI file may be absent, in
  which case preview shows a proposed new file. App/IDE storage and Windows legacy settings are not
  confirmed by this adapter and remain unchanged. Never claim that writing the CLI JSON configures
  App/IDE. Their settings must be inspected through their supported UI separately.

These adapters reduce repeated approval, not enforce a universal security boundary. Unknown command
forms retain the host's defaults. Prefix approvals do not understand the semantic effect of scripts,
Git config aliases, package scripts or arbitrary code. The Production and migration guards remain
authoritative; direct Supabase/SQL/deploy commands are denied conservatively and can also block safe
variants. Use protected repository workflows with task authority. Native deny lists do not replace
those guards or prove that every prohibited operation is technically impossible.

Synchronization is additive for user approvals and denies, except that managed entries transitioned
by policy from deny to ask (such as coordinator PR merges) are moved to Ask to prevent deny
precedence from silencing prompts. Removing an allow from policy does not revoke an already merged
JSON allow; review and remove obsolete grants manually with owner authority. Text blocks replace
their previous generated grants. Unmanaged conflicting rules are preserved and reported as a
coverage limit.

## Format references

- [Codex rules](https://learn.chatgpt.com/docs/agent-configuration/rules)
- [Claude permissions](https://code.claude.com/docs/en/permissions)
- [Gemini policy engine](https://geminicli.com/docs/reference/policy-engine/)
- [Antigravity settings](https://antigravity.google/docs/settings?tab=cli)
- [Antigravity permission matching](https://antigravity.google/docs/cli-permissions)

Repository authority is defined in [Git Safety](../../.agent/rules/git-safety.md),
[database safety](../../.agent/rules/database.md) and
[the adapter rule](../../.agent/rules/permissions.md).
