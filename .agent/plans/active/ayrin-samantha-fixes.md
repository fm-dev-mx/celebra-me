---
title: Ayrin Samantha XV Invitation Fixes
status: implemented
created: 2026-06-08
updated: 2026-06-08
related_skills: []
related_docs:
  - src/hooks/use-rsvp-submission.ts
  - src/lib/api-client-shared.ts
  - src/components/invitation/PhotoGallery.astro
  - src/styles/invitation/_gallery.scss
  - src/styles/invitation/_rsvp.scss
  - src/styles/invitation/_envelope-reveal.scss
  - astro.config.mjs
supersedes: []
superseded_by: []
---

# Ayrin Samantha XV Invitation Fixes

## Status

Active — Evidence-based diagnosis complete. Implementation pending.

## Problem

Four issues affecting the Ayrin Samantha XV invitation:

1. RSVP submit button can remain stuck in "ENVIANDO..."
2. Gallery loads too many images on mobile
3. Vite dev server returns 504 for framer-motion.js
4. Mobile/responsive behavior needs verification at 375-414px widths

## Root Causes (Evidence-Based)

### Issue 1: RSVP Stuck Loading

**Confirmed root cause**: `fetchJSON` in `src/lib/api-client-shared.ts` has no timeout. If `fetch()`
never resolves (network hang, Vercel cold start, Supabase latency), `submitStatus` stays `'loading'`
indefinitely.

**Evidence**:

- Trace of all code paths from `setSubmitStatus('loading')` confirms: if fetch completes (success or
  error), state always transitions correctly via try/catch
- No post-response state bug exists
- Double-submit guard is hardening, not root cause

**Additional finding**: `handleSubmit` has no internal concurrency guard. Enter key in text inputs
can trigger form submission in some browsers even when button is disabled.

### Issue 2: Gallery Image Loading

**Confirmed behavior**: All `<img>` tags in `PhotoGallery.astro` have `src` set immediately with
`loading="lazy"`. No `srcset`/`sizes` — full-resolution images downloaded.

**Evidence**:

- Browser native lazy loading threshold is ~1250px from viewport
- On mobile single-column layout, images 4-6 may be eagerly fetched
- No duplicate component instances or duplicate URLs found
- Lightbox sets `src` only on open (no preloading)
- Full-resolution images without responsive `srcset` is the primary performance issue

**Decision**: Implement `fetchpriority="low"` signal for below-fold images. `data-src` +
IntersectionObserver is a larger refactor out of scope.

### Issue 3: framer-motion 504

**Confirmed**: Dev-only issue. framer-motion is ~45KB gzipped, imported in 8 React components. Vite
dev server times out transforming it on first request.

**Evidence**:

- Production builds pre-bundle dependencies (no production issue)
- 6 of 8 files could use CSS instead, but replacing framer-motion is a broad refactor
- Missing `optimizeDeps.include` in Vite config causes dev-server timeout

**Decision**: Add `vite.optimizeDeps.include = ['framer-motion']`. Framer-motion removal is out of
scope.

### Issue 4: Mobile Responsive

**Audit at 375px, 390px, 414px widths found**:

| Priority | Issue                                     | File:Line                       | Severity                        |
| -------- | ----------------------------------------- | ------------------------------- | ------------------------------- |
| P0       | Envelope seal button 30x30px touch target | `_envelope-reveal.scss:637-638` | Below 44px minimum              |
| P1       | RSVP radio cards 2-col at 375px           | `_rsvp.scss:648`                | Breakpoint 340px too aggressive |
| P2       | Lightbox padding 2rem on mobile           | `_gallery.scss:211`             | Wastes 17% of 375px viewport    |
| P2       | Lightbox close button ignores safe areas  | `_gallery.scss:221-222`         | Could sit under notch           |
| P3       | Music player button 44px (borderline)     | `_music-player.scss:148-149`    | Meets minimum but no margin     |
| P3       | Hero label text clipping                  | `_hero.scss:77-79`              | Long labels may overflow        |

## Implementation Plan

### Fix 1: RSVP Stuck Loading (HIGH)

**Files**: `src/lib/api-client-shared.ts`, `src/hooks/use-rsvp-submission.ts`

1. Add `AbortController` with 15s timeout to `fetchJSON`
   - Only apply timeout if caller hasn't provided their own `signal`
   - On abort: return user-friendly error `"La conexión tardó demasiado. Intenta de nuevo."`

2. Add double-submit guard to `handleSubmit`
   - Add `useRef<boolean>` (`isInFlightRef`)
   - At top of `handleSubmit`: `if (isInFlightRef.current) return;`
   - Set `isInFlightRef.current = true` at start, `false` in `finally` block
   - Add `finally` block: if status still `'loading'`, set to `'error'` as safety net

### Fix 2: Gallery Image Loading (MEDIUM)

**File**: `src/components/invitation/PhotoGallery.astro`

1. Add `fetchpriority="low"` to all images except the first 2
2. Add `decoding="async"` to all gallery images
3. Keep `loading="lazy"` (browser heuristic acceptable with `fetchpriority` signal)

### Fix 3: framer-motion 504 (LOW)

**File**: `astro.config.mjs`

1. Add `vite.optimizeDeps.include = ['framer-motion']` to pre-bundle during dev

### Fix 4: Mobile Responsive (LOW)

**Files**: `src/styles/invitation/_gallery.scss`, `src/styles/invitation/_rsvp.scss`,
`src/styles/invitation/_envelope-reveal.scss`

1. **Lightbox** (`_gallery.scss`):
   - Add `@media (width <= 480px)`:
     - Reduce padding from `2rem` to `1rem`
     - Adjust close button: `top: calc(1rem + env(safe-area-inset-top, 0px)); right: 1rem`
     - Reduce close button SVG from 32px to 28px (touch target remains 44px with padding)

2. **RSVP radio cards** (`_rsvp.scss`):
   - Change breakpoint from `340px` to `400px`:
     - `@media (width <= 400px) { --rsvp-radio-columns: 1fr; }`

3. **Envelope seal button** (`_envelope-reveal.scss`):
   - At `@media (width <= 480px)`, increase `--env-seal-size` to `44px`
   - Or add `padding: 7px` to `.envelope-seal-button` to expand hit area

## Verification

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm lint:styles
pnpm build
```

Manual verification (if dev server available):

- RSVP: submit form, verify button transitions correctly; test with network throttling
- Gallery: scroll on mobile, verify images load with lower priority
- Mobile: check 375px, 390px, 414px widths for touch targets and overflow

## Files to Change

| File                                           | Fix |
| ---------------------------------------------- | --- |
| `src/lib/api-client-shared.ts`                 | 1   |
| `src/hooks/use-rsvp-submission.ts`             | 1   |
| `src/components/invitation/PhotoGallery.astro` | 2   |
| `src/styles/invitation/_gallery.scss`          | 4   |
| `src/styles/invitation/_rsvp.scss`             | 4   |
| `src/styles/invitation/_envelope-reveal.scss`  | 4   |
| `astro.config.mjs`                             | 3   |

## Out of Scope

- **Responsive images**: Gallery images lack `srcset`/`sizes`. Full-resolution downloads on mobile.
  Requires Astro `<Image>` component integration.
- **Framer-motion removal**: 6 of 8 files could use CSS. Requires component-by-component migration.
- **Gallery deduplication**: No deduplication in `buildGallerySectionData()`. Low risk if content is
  curated.
- **Content consistency audit**: Lower priority per original request.
