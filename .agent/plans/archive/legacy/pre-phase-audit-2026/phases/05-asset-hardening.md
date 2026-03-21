# Phase 05: Asset Type-Safety Hardening

**Status:** `COMPLETED`  
**Completion:** `100%`

## 🎯 Objective

Harden the Asset Registry system by enforcing strict type-safety for internal assets and providing a
clear validation path for external images.

## 🛠️ Step-by-Step Implementation

1.  **Refine Asset Schema**:
    - Implement a discriminated union in Zod:
      - `InternalAsset`: Validated against `AssetRegistry` keys.
      - `ExternalAsset`: Validated as a secure URL or static public path.

2.  **Registry Automation Proposal**:
    - Add a `governance` script to verify that all images in `src/assets/images/events/...` are
      registered in `asset-registry.ts`.

3.  **Component Integration**:
    - Refactor `Hero` and `Interlude` components to utilize the new strict schemas, ensuring they
      handle both internal (optimized) and external (raw) image paths safely.

## Implemented

- Replaced the permissive string-only `AssetSchema` with a migration-compatible normalized contract in
  `src/lib/schemas/content/shared.schema.ts`. Legacy strings are converted into:
  - `internal` asset references backed by registry/discovery keys
  - `external` asset references backed by secure `https://` URLs or root-relative public paths
- Added asset source types and key guards in `src/lib/assets/asset-registry.ts`.
- Hardened `src/lib/adapters/event-helpers.ts` to:
  - resolve common and event assets explicitly
  - throw on invalid internal asset references
  - reject insecure/unknown legacy asset strings
- Added the discovery-aware audit CLI `scripts/check-event-assets.cjs`.
- Added tests covering:
  - schema rejection for invalid internal asset keys and insecure URLs
  - adapter compatibility with normalized object asset references
  - audit-script pass/fail behavior for event asset folders
- Updated dynamic asset modules for `demo-xv`, `noir-premiere-xv`, and `ximena-meza-trasvina` so all
  existing image files are tracked by the discovery audit.
- Updated asset governance documentation in `docs/domains/assets/management.md` and corrected the
  event onboarding instructions in `docs/core/project-conventions.md`.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - `AssetSchema` normalizes legacy strings into a discriminated internal/external asset contract.
  - Build fails on invalid asset references (strict mode enforced).
  - Registry script scans `src/assets/images/events/` automatically via dynamic-discovery audit.
- **Validation Steps**:
  - Run `pnpm exec astro check` - expect pass.
  - Verify schema tests reject invalid internal keys and insecure external URLs.
  - Execute registry script; verify all assets in event folders are tracked.

## ✅ Verification Criteria

- [x] `astro check` fails if an invalid event key is used in a JSON file.
- [x] Broken internal image links are caught before render/build completion.
- [x] Registry script correctly identifies missing discovery tracking entries.

## Validation Run

- `pnpm exec astro check` passed on 2026-03-16.
- `npx astro build` passed on 2026-03-16.
- `npx jest tests/content/schema.test.ts tests/unit/event.adapter.test.ts tests/unit/event-assets-audit.test.ts --runInBand` passed on 2026-03-16.
- `npm run assets:check-registry` passed on 2026-03-16.

## Plan Amendment

The original Phase 05 plan assumed manual registry entries in `asset-registry.ts` and a full
content migration to object-based asset references. Per approval on 2026-03-16, the phase now
closes against the live architecture with deterministic checks:

1. Legacy string asset references remain supported but normalize into a typed internal/external
   asset contract at schema time.
2. Dynamic discovery is audited by checking event folders against their `index.ts` asset modules.
3. Invalid internal keys and insecure external URLs are rejected by tests and Astro schema
   validation.
4. Missing tracked internal assets fail during adapter resolution instead of silently degrading.

## ⚠️ Risk & Mitigation

| Risk                                 | Impact | Mitigation Strategy                                                      |
| ------------------------------------ | ------ | ------------------------------------------------------------------------ |
| External asset validation too strict | Medium | Use Zod URL validation allowing known CDNs; fallback to permissive mode. |

## 🧪 Regression Testing Note

- Validate hero images render for all event themes in staging.
