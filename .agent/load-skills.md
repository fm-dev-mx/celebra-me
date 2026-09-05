# Skill Loading Protocol

[AGENTS.md](../AGENTS.md) and its bootstrap rules apply to every task. Read them once; consult
[routing-matrix.yaml](routing-matrix.yaml) for task/surface-specific candidates and
[index.md](index.md) for document discovery.

## Select context

- Tracked skills live in .agent/skills/*/SKILL.md and follow [SCHEMA.md](skills/SCHEMA.md).
- Apply the rules from every route matching the touched surfaces.
- Select only skills whose description and when_to_use match the current work. A route or role's
  skills list is a candidate catalog, not an instruction to load all entries.
- Preconditions describe required context/state. Reuse prerequisites already satisfied in this task;
  reread only when relevant evidence changed or a new question requires it.
- related_skills and related_docs are optional references, not recursive activation instructions.
  Load a supporting reference only for the operation it describes.
- Skills provide procedure, not additional authority. Apply the current task mode and the owning
  rules before edits, Git operations, environment access, or external actions.

## Host discovery and precedence

Repository skills remain canonical when a host exposes a skill with the same name. Local .agents/ is
gitignored installation state; configure supported host discovery outside Git. If installation is
needed, link or copy only the required skill without forking its authority. Verify the host's actual
discovery support rather than assuming an external_dirs setting exists.

Do not dump global catalogs into this repository, require global skills/remote loaders/lock files,
add provider-specific root entry files, or encode model selection and invocation APIs in role
contracts. Product-specific workflows belong here; multi-brand creative infrastructure belongs in
its own workspace. Keep brand briefs and creative templates in their existing locations.

## External tooling

- Current third-party docs: use an available official-docs lookup when dependency behavior is
  uncertain; package.json supplies the version. No duplicate Context7 skill is needed.
- Graphify: [graphify-ops](rules/graphify-ops.md) owns repository use; a global query-first
  instruction is incompatible. Graph artifacts are optional leads, never policy or required
  validation.
- External design skills: do not install a parallel design SSOT, root PRODUCT/DESIGN files, or an
  Impeccable CI gate. Existing brand, frontend-design, theme, and creative contracts own the work;
  temporary audit installations must be removed before merge.

Live implementation is evidence of current behavior, not permission to weaken a critical contract.
Report discrepancies instead of treating an implementation defect as an override.
