# Screenshot Tool Contract

The screenshot tool is a Local-first, configuration-driven QA adapter. Invitation and demo specific
behavior belongs in the shared route, section, viewport, and render contracts; the screenshot core
must not branch on individual slugs.

## Validation boundary

`pnpm screenshot` validates the static screenshot registry and all discovered invitation/demo
identities before resolving a job. `--config` validates every page, route, viewport, section,
preset, selector label, and output identity before the first browser is launched. Duplicate routes,
identities, sections, viewports, artifact paths, unsupported page types, unsafe labels, credentials
in URLs, and incompatible scope options fail closed.

Explicit `--sections` is a closed set: it cannot add another section at runtime. Named `critical-qa`
and `all-sections` presets intentionally defer section inventory to the rendered DOM because
invitations may contain data-driven interludes. Those preset captures remain bounded by the selected
route, viewport set, and page type.

`preflight.json`, `report.json`, and diagnostic output use the resolved plan and redact query
values, credentials, cookies, tokens, signatures, and other sensitive assignments. Generated
artifact labels and viewport names are restricted to safe path segments.

## Resource policy

- Local is the routine validation environment. Preview is reserved for deployment, auth, remote
  asset, or runtime evidence that Local cannot provide. Production is not a routine screenshot
  target.
- Viewports run sequentially in one browser process, with one context per viewport. Pages, contexts,
  browser processes, CDP sessions, and temporary capture tiles are closed in `finally` paths.
- Video and tracing are disabled for screenshot capture. Diagnostic artifacts are limited to the
  planned PNG/JPEG/WebP/PDF files and the two JSON records.
- Config batches above the normal targeted budget require `--allow-large=true`. The named
  `pnpm screenshot:local-render-corpus` command is an explicit corpus operation and prints its
  complete plan before starting any browser work.

## Representative test matrix

| Layer                  | Contract                                                                                                                                        | Representative coverage                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure                   | Parsing, registry/config validation, route identity, deduplication, planning, artifact naming, redaction, cleanup ownership, budgets, manifests | `tests/scripts/screenshot/*.test.ts`                                                                                                                                  |
| Controlled integration | Real registry/corpus/config loading and all-page preflight resolution without Playwright                                                        | screenshot registry/config tests and `pnpm tsx` config validation                                                                                                     |
| Browser                | Rendered identity, reveal/no-reveal behavior, demo and managed routes, readiness failures, and partial execution                                | `tests/e2e/demo-routing-parity.spec.ts`, `tests/e2e/envelope-reveal-interaction.spec.ts`, `tests/e2e/invitation-route-isolation.spec.ts`, and the focused audit specs |

The browser layer is intentionally representative rather than one test per invitation. Full-corpus
execution is reserved for a documented global infrastructure change or an explicitly requested
corpus run.
