---
title: Boda Daniela y Martín — Acceptance Matrix (Closure)
status: active
created: 2026-08-01
updated: 2026-08-01
related_docs:
  - docs/invitations/daniela-y-martin.md
  - .agent/plans/active/daniela-y-martin-implementation-audit.md
---

# Acceptance matrix — `daniela-y-martin`

Comparison baseline: local managed published content (version 5, IN_SYNC) + jewelry-box-wedding
shared structure. Production route `/boda/daniela-y-martin` returns **404** (not promoted); local
is the operational SoT for this closure cycle.

Classification: **C** = compliant · **L** = invitation-specific (Lane A / provision) · **S** =
shared abstraction · **A** = intentionally accepted non-blocking

| Area                                 | Verdict         | Notes                                                                          |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------ |
| Reveal sealed                        | C               | Seal-only control; `microcopy` empty; hint `Toque el sello`                    |
| Reveal letter-held                   | C               | Hero chrome gated; letter measurable                                           |
| Reveal → revealed transition         | C               | `skipEnvelope` / screenshot normalize → `revealed`                             |
| Hero hierarchy / first impression    | C (after L fix) | Solid cream names; ceremony-first venue/time via `venues[0]`                   |
| Typography / contrast / readability  | C               | Olive–beige–gold Lane A; RSVP cream-on-olive                                   |
| Vertical rhythm / section continuity | A               | Shared `svh` mins retained; Daniela densifies quote/countdown/thank-you          |
| Image proportions / focal / crop     | C               | D2 hero + D4 gallery; shared source, distinct focals                           |
| Event-information hierarchy          | C               | Dual venue cards + civil indication                                            |
| Location / maps / copy address       | C               | Distinct Maps URLs; public visibility intentional                              |
| Calendar                             | C               | RSVP calendar block with ceremony/reception/civil narrative                    |
| RSVP                                 | C               | Hybrid + api; dark olive band; labels visible                                  |
| Audio                                | A               | Omitted (OD2)                                                                  |
| Closing / thankYou                   | C               | No third photo; calligraphy names; ivory close                                 |
| Family names                         | C               | Laura/Pilar (novia); María de Jesús only (novio)                               |
| Gifts Amazon + lluvia de sobres      | C               | `store` + `cash` after gallery; interlude after gifts                          |
| Civil ceremony representation        | A               | Indication only (OD2 / B2 keep)                                                |
| Responsive predefined ranges         | C               | Full-QA mobile viewports + targeted Playwright visual checks (no corpus regen) |
| Readiness / venues[] contract        | C (after S fix) | Readiness accepts `venues[]` map URLs                                          |
| Protected-data exposure              | C               | No prep tokens in payload; no local path leak                                  |
| Production parity                    | A               | Not on Production yet; promote out of this cycle                               |

## Corrections applied this closure pass

| Change                                                     | Boundary        | File(s)                               |
| ---------------------------------------------------------- | --------------- | ------------------------------------- |
| Kill hero gradient/specular clip (invisible desktop names) | Lane A          | `daniela-y-martin.scss`            |
| Readiness honors `venues[]` + `googleMapsUrl`              | Shared          | `invitation-readiness.ts`             |
| Payload test locks solid title fill                        | Invitation test | `daniela-y-martin-payload.test.ts` |

## Verification evidence (no corpus regen)

| Check                                      | Result                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| Playwright revealed mobile                 | `revealed`; solid cream title; ceremony hero 5:30 / Catedral; 2 maps; no overflow |
| Playwright sealed                          | `sealed`; 1 open control; hint `Toque el sello`                                   |
| Playwright letter-held                     | `letter-held`; letter visible; hero title hidden                                  |
| Playwright revealed desktop                | solid fill; no specular; no overflow                                              |
| Playwright RSVP                            | olive bg; cream labels; 2 radios                                                  |
| Artifacts                                  | `output/playwright/daniela-y-martin/*.png`                                     |
| Full-QA screenshot set (pre-stabilization) | 30/30 required across mobile-narrow/standard/large                                |
| Local readiness                            | `READY` (`mapsValid: true`)                                                       |
| Payload tests                              | 6/6 passed                                                                        |
| `validate:changed`                         | passed                                                                            |

## Consciously accepted limitations

- Parent names remain soft placeholders until client confirms (OD5).
- Civil stays in indications (no third VenueCard).
- Jewelry-box wedding bundle still omits hero/rsvp/thank-you jewelry partials (B4 deferred).
- Shared platform `svh` rhythm not reduced globally (B5 deferred).
- Production publish/promote not performed (requires separate owner authorization).
- Full `pnpm ci` / `pnpm lint` may still fail on a pre-existing `ObservabilityPanel.tsx` complexity
  lint outside this invitation scope. Daniela-scoped gates (`validate:changed`, type-check after mock
  cast, payload tests, `build:app`, Playwright targeted visual) passed.
