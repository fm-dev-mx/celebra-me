---
title: Invitation Reveal Gate — Automation Contract
lifecycle: evergreen
domain: invitation-delivery
last_reviewed: 2026-07-27
---

# Invitation reveal gate — automation contract

Every public invitation route renders a **reveal gate** in front of the invitation body: the sealed
envelope (`src/components/invitation/EnvelopeReveal.astro`) or the editorial cover
(`src/components/invitation/EditorialCoverReveal.astro`). Until the gate completes, the invitation
sections are present in the DOM but visually gated, and scroll-driven motion has not started.

This document is the source of truth for **driving or bypassing that gate from automation**
(Playwright probes, screenshot runs, QA scripts, agent-driven browser verification). It does not
define motion tokens (`docs/domains/theme/motion.md`) or the screenshot capture pipeline
(`scripts/screenshot/README.md`); those docs own their own concerns and link here.

## Why this exists

Hand-rolled `click()` automation against the seal is the single most common source of hung and
silently wrong invitation runs. Two failure modes recur:

1. **Apparent hang.** The real click path is intentionally slow — roughly **3.2–3.4 s** between the
   click and `data-reveal-state="revealed"`. A probe that samples for 2–3 s concludes the page is
   stuck.
2. **Silently wrong measurement.** The probe keeps going against an unopened page. Nothing throws —
   the invitation sections are in the DOM and are queryable — so motion, layout, and accessibility
   numbers are collected from a gated page and reported as if they were real. A slow probe then
   trips the 8 s fail-open timer described below, which strips `.has-motion` and makes the same page
   report zero motion.

Prefer a **server-side bypass** over clicking. Click only when the open transition itself is what
you are testing.

## Reveal state machine

The state lives in the `data-reveal-state` attribute on the invitation root,
`.event-theme-wrapper[data-event-slug]`. Read it from that element — never from the reveal
component.

| Value            | Meaning                                                               | Invitation body usable  |
| ---------------- | --------------------------------------------------------------------- | ----------------------- |
| `sealed`         | Initial server-rendered state; gate is closed                         | No                      |
| `revealed`       | Gate completed (click, stored flag, `skipEnvelope`, editorial `open`) | Yes                     |
| `preview-opened` | `?screenshot=1&reveal=open` on an **envelope** invitation             | Yes                     |
| `letter-held`    | `?screenshot=1&reveal=letter`; envelope and card held for capture     | No (gate still painted) |

`preview-opened` and `revealed` are both "open" outcomes. The value depends on which reveal variant
the invitation uses, so **automation must accept both**:

- Envelope variant + `?screenshot=1&reveal=open` → `preview-opened`
- Editorial-cover variant + `?screenshot=1&reveal=open` → `revealed`

Waiting only for `revealed` is a known way to hang forever on an envelope invitation.

## Supported URL contract

`reveal=` is only honoured when the `screenshot` parameter is also present
(`src/pages/[eventType]/[slug].astro` gates `previewState` on `screenshotMode`). `?reveal=open`
alone is a no-op.

| URL                                              | Server behaviour                                      | Resulting state               | Gate in DOM      |
| ------------------------------------------------ | ----------------------------------------------------- | ----------------------------- | ---------------- |
| _(no parameters)_                                | Gate rendered, closed                                 | `sealed`                      | Yes, interactive |
| `?skipEnvelope=true`                             | Gate **not rendered**; root ships pre-opened from SSR | `revealed`                    | No               |
| `?screenshot=1&reveal=open`                      | Gate rendered but stood down on hydration             | `preview-opened` / `revealed` | Yes, inert       |
| `?screenshot=1&reveal=letter&forceEnvelope=true` | Card painted and held, no teardown                    | `letter-held`                 | Yes, measurable  |
| `?screenshot=1&reveal=closed&forceEnvelope=true` | Gate rendered closed, stored-open flag ignored        | `sealed`                      | Yes, interactive |
| `?forceEnvelope=true`                            | Ignores the stored "already opened" flag              | `sealed`                      | Yes, interactive |

Adding `screenshot` also disables all CSS animation and transition durations page-wide, which is
what makes the screenshot states settle in tens of milliseconds.

### Which one to use

| Goal                                                      | Use                                              |
| --------------------------------------------------------- | ------------------------------------------------ |
| Reach invitation content as fast and reliably as possible | `?skipEnvelope=true`                             |
| Measure real scroll motion on the open invitation         | `?skipEnvelope=true`                             |
| Capture the closed gate                                   | `?screenshot=1&reveal=closed&forceEnvelope=true` |
| Capture the letter/card                                   | `?screenshot=1&reveal=letter&forceEnvelope=true` |
| Capture the open invitation for the screenshot pipeline   | `?screenshot=1&reveal=open`                      |
| Test the open transition itself                           | Real click (see below)                           |

`?skipEnvelope=true` is the recommended default. It is handled entirely server-side: the reveal
component is not rendered and the wrapper is emitted with `data-reveal-state="revealed"`, so there
is no hydration race, no animation dependency, and no localStorage state to manage. It is **not**
dev-gated and behaves identically against a preview or production deployment. Measured cost: ~45–70
ms to reach `revealed`.

## Playwright snippet (cannot hang, cannot silently mis-measure)

Copy this instead of writing a bare `click()` plus `waitForTimeout()`.

```js
const OPEN_STATES = ['revealed', 'preview-opened'];

/**
 * Navigate to an invitation with the gate already open.
 * Throws on timeout so a gated page can never be measured as if it were open.
 */
async function openInvitation(page, path, { timeout = 15000 } = {}) {
  const url = new URL(path, 'http://localhost:4321');
  url.searchParams.set('skipEnvelope', 'true');

  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout });

  try {
    await page.waitForFunction(
      (states) => {
        const root = document.querySelector('.event-theme-wrapper[data-event-slug]');
        return states.includes(root?.getAttribute('data-reveal-state') ?? '');
      },
      OPEN_STATES,
      { timeout },
    );
  } catch {
    const actual = await page.evaluate(
      () =>
        document
          .querySelector('.event-theme-wrapper[data-event-slug]')
          ?.getAttribute('data-reveal-state') ?? '(no invitation root)',
    );
    throw new Error(
      `Reveal gate never opened for ${url.pathname}; data-reveal-state="${actual}". ` +
        'Do not continue: any measurement taken now describes a gated page.',
    );
  }
}
```

The `catch` block is the important part. A bare `waitForFunction` that is allowed to reject with a
generic Playwright timeout tends to get "fixed" by lowering the timeout or dropping the wait, which
is exactly how silently-wrong runs are produced.

### When you must exercise the real click

Only for testing the transition itself. Wait for the custom element to be defined first — clicking
before hydration lands on inert markup and looks identical to a hang.

```js
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => customElements.get('ds-envelope-reveal') !== undefined);
await page.click('[data-envelope-open]');

// Real timing budget: ~3.2-3.4 s. Never sample below ~5 s; 10 s is the safe bound.
await page.waitForFunction(
  () =>
    document
      .querySelector('.event-theme-wrapper[data-event-slug]')
      ?.getAttribute('data-reveal-state') === 'revealed',
  undefined,
  { timeout: 10000 },
);
```

The budget comes from CSS: the card rise runs with `animation-delay: var(--duration-reveal)`
followed by a duration of the same order (`src/styles/invitation/_reveal-card.scss`).
`--duration-reveal` defaults to `1.6s` and presets may raise it, so the total is theme-dependent.
Under `prefers-reduced-motion: reduce` the same click completes in ~2 ms, which is a useful
cross-check that a suspected hang is really an animation-timing problem.

## Stored-open flag and the demo exception

`RevealManager` (`src/lib/invitation/reveal-manager.ts`) persists
`localStorage["envelope-opened-<eventSlug>"] = "true"` after a successful open, and skips the gate
on later visits. Automation can seed that key, but there are three constraints:

- `<eventSlug>` is the value of `data-event-slug` on the invitation root. Read it from the DOM.
  Route slug, content slug, `previewSlug`, and `_assetSlug` are allowed to differ.
- **Demo invitations ignore the stored flag entirely.** When the root carries `data-is-demo="true"`,
  the gate is always shown so the demo experience stays intact. Seeding
  `envelope-opened-demo-xv-celestial-blue` leaves the page at `sealed` indefinitely — verified.
- `?forceEnvelope=true` overrides the stored flag on non-demo invitations.

Because of the demo exception, storage seeding is not a general-purpose bypass. Use
`?skipEnvelope=true`.

`RevealManager.shouldSkipEnvelope()` also honours `?skipEnvelope=true` when `data-dev-skip="true"`
(that attribute is `import.meta.env.DEV`). On the public route this branch is redundant — the page
already strips the gate server-side. It matters on the dashboard preview route, which renders the
reveal component directly.

## Dashboard preview route

`/dashboard/invitaciones/<id>/preview` uses its own `revealState` parameter, not `reveal`:

| Parameter               | Result                                                       |
| ----------------------- | ------------------------------------------------------------ |
| `?revealState=internal` | Gate not rendered; root ships `data-reveal-state="revealed"` |
| `?revealState=closed`   | Gate rendered closed                                         |
| `?revealState=opened`   | Gate stood down on hydration                                 |

## The 8 s fail-open timer (invalidates late measurements)

Scroll-driven motion is wired by `createIntersectionObserver` in `src/utils/animations.ts`. It arms
an absolute safety timer, `DEFAULT_FAIL_OPEN_MS` (**8000 ms**), started when the observer is created
at island hydration — **not** when the gate opens. When it fires, every element that has not yet
intersected is force-revealed and **stripped of its `.has-motion` class**.

That is correct product behaviour: it guarantees a guest never sees permanently invisible content.
It is also a trap for automation, because it silently turns a real page into a force-revealed one
with no error and no console warning. Do not change the timer — it is owned by the motion system and
tracked separately. Work inside it.

### Why the reveal gate makes it worse

The two budgets overlap badly:

| Event                                       | Time from page load |
| ------------------------------------------- | ------------------- |
| Observer armed, `.has-motion` applied       | ~0 s                |
| Click-driven reveal completes               | ~3.2–3.4 s          |
| **Fail-open fires, `.has-motion` stripped** | **~8 s**            |

Clicking through the gate consumes roughly 40% of the budget and leaves under 5 s to scroll and
sample. A probe that idles, sleeps on a fixed timeout, or walks sections slowly crosses 8 s and then
measures a force-revealed page.

Measured on `/xv/demo-xv-celestial-blue` across the 28 observed elements:

| Probe timing            | `.has-motion` | `.is-visible` before scrolling |
| ----------------------- | ------------- | ------------------------------ |
| Scrolls within ~0.5 s   | 28            | 0 (correct)                    |
| Idles ~9 s, then scroll | **0**         | **28** (fail-open fired)       |

The second row is a false negative that reads as "this invitation has no motion". A motion audit
reported exactly that before the cause was understood.

### How to measure motion safely

- Enter with `?skipEnvelope=true`. Reaching `revealed` costs ~45–70 ms instead of ~3.2 s, which
  keeps the whole measurement comfortably inside the 8 s window.
- Assert `.has-motion` is non-zero **before** trusting any `.is-visible` reading. A count of `0` on
  an invitation that should animate means the fail-open already fired; fail the run instead of
  reporting the numbers. Under `prefers-reduced-motion: reduce`, `initSectionReveal` reveals
  everything up front and never creates an observer, so it produces the same `0` signature
  legitimately — pin the emulated motion preference in the probe so the two cannot be confused.
- Scroll and sample in one pass immediately after the reveal-state check. Never `waitForTimeout()`
  between opening the gate and measuring.
- If a run genuinely needs more than 8 s, reload once per section rather than stretching a single
  page visit.

## Troubleshooting: stuck at `sealed`

| Symptom                                                            | Cause                                                                                           | Fix                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Click reports success, state stays `sealed` for 2–3 s              | Normal: the open transition takes ~3.2–3.4 s                                                    | Wait with a bounded `waitForFunction`, not a fixed sleep                              |
| State reaches `preview-opened`, wait for `revealed` never resolves | `?screenshot=1&reveal=open` on an envelope invitation                                           | Accept both `revealed` and `preview-opened`                                           |
| `?reveal=open` alone does nothing                                  | `reveal` is only read when `screenshot` is present                                              | Use `?screenshot=1&reveal=open`                                                       |
| Seeded `envelope-opened-*`, page still `sealed`                    | Target is a demo (`data-is-demo="true"`), which ignores the stored flag                         | Use `?skipEnvelope=true`                                                              |
| Click lands but nothing happens at all                             | Clicked before `ds-envelope-reveal` was defined                                                 | Wait on `customElements.get('ds-envelope-reveal')`                                    |
| State never leaves `sealed` even after 10 s                        | The `envCardRise` animation never ran (stylesheet failed, animation interrupted, tab throttled) | The component now falls back to a bounded safety timer; if it still hangs, file a bug |
| `.has-motion` count is `0`, everything already `.is-visible`       | The 8 s fail-open fired, or the context emulates `prefers-reduced-motion: reduce`               | Re-run with `?skipEnvelope=true` inside 8 s and with `reducedMotion: 'no-preference'` |
| `.has-motion` count is `0`, nothing is `.is-visible`               | The observed elements never mounted, so no observer was ever created                            | Verify the reveal state and the selectors before blaming motion                       |

### Safety timer

`EnvelopeReveal.astro` completes the reveal on the `animationend` of `envCardRise`. That event is
not guaranteed, so the component arms a bounded fallback timer derived from the card's computed
`animation-delay` plus `animation-duration` (1.2 s margin, 4 s floor) and completes the reveal if
the event never arrives. `EditorialCoverReveal.astro` has an equivalent fallback. Without these, a
non-firing animation permanently bricks the invitation for real guests, not just automation.

In practice this means a healthy open still completes on `animationend` at ~3.2–3.4 s, and a broken
one recovers at ~4–5 s instead of never. Bound automation waits at 10 s and treat anything longer as
a real defect.

## Verification

Canonical CI includes a stable subset of `tests/e2e/envelope-reveal-interaction.spec.ts`: real
open/reveal, Enter/Space keyboard behavior, focus transfer, and reduced motion on static demos.
Expensive matrix/focus-ring variants, representative invitation matrix cases, and the Alba Rosa
managed-invitation regression (DB-published content required) are tagged `@extended` and remain
available outside `pnpm test:e2e:ci` on Local/Preview environments that can resolve published
invitations. The Alba `FALTAN` countdown copy contract stays asserted in
`tests/content/alba-rosa-quinones-payload.test.ts`.

On Windows, run canonical E2E with no pre-existing listener on port 4321. The default Playwright
config supplies `ASTRO_DEV_BACKGROUND=1`, keeping Astro in the foreground so Playwright owns and
stops it. Reusing a deliberately managed server requires the explicit
`PLAYWRIGHT_REUSE_EXISTING_SERVER=true` opt-in; release validation must not use that opt-in.

The contract above was verified against a running dev server with a headless Playwright probe
covering: `?skipEnvelope=true` on a demo and a real invitation, `?screenshot=1&reveal=open`,
`?screenshot=1&reveal=letter&forceEnvelope=true`, storage seeding on a real invitation, storage
seeding on a demo (correctly ignored), and the click path under both default and reduced motion.

Measured across two runs: the server bypass reached `revealed` in 44–65 ms; the screenshot states
settled in 15–44 ms; the real click path reached `revealed` in 3243–3403 ms; the same click under
reduced motion completed in 1–3 ms. With `envCardRise` forcibly disabled to simulate a stylesheet or
animation failure, the safety timer still reached `revealed` at ~4.0 s instead of never. A follow-up
probe confirmed `?forceEnvelope=true` and `?screenshot=1&reveal=closed&forceEnvelope=true` both hold
at `sealed` even with `envelope-opened-*` seeded. The 8 s fail-open figures come from a separate
probe that compared a ~0.5 s and a ~9 s linger before scrolling.
