# Phase 05: Asset Type-Safety Hardening

**Status:** `BLOCKED`  
**Completion:** `0%`

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

## Blocker

Execution review found that the original phase scope does not match the current implementation:

1. `src/lib/assets/asset-registry.ts` no longer relies on manual per-asset registration. Event
   assets are built from dynamic discovery via `src/lib/assets/discovery.ts`, so a governance script
   that verifies file-by-file registration entries in `asset-registry.ts` is not aligned with the
   current architecture.
2. Event content still stores asset references as legacy strings (`"hero"`, external URLs, or
   root-relative paths). The requested discriminated union would require either a full content
   migration or a compatibility layer that the plan does not currently define.
3. `Hero` and `Interlude` already consume resolved `ImageAsset` instances from the adapter layer, so
   Phase 05 must clarify whether hardening belongs in content schemas, adapter helpers, registry
   governance, or component props.

Phase 05 cannot begin until the plan is amended to define a migration-compatible asset contract and
registry verification approach.

## ✅ Verification Criteria

- [ ] `astro check` fails if an invalid event key is used in a JSON file.
- [ ] Broken image links are caught at build-time.
- [ ] Registry script correctly identifies missing registration entries.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - `AssetSchema` uses discriminated union (InternalAsset | ExternalAsset).
  - Build fails on invalid asset references (strict mode enforced).
  - Registry script scans `src/assets/images/events/` automatically.
- **Validation Steps**:
  - Run `pnpm exec astro check` - expect pass.
  - Intentionally break an asset reference in test JSON; verify build fails.
  - Execute registry script; verify all assets in folder are tracked.

## ⚠️ Risk & Mitigation

| Risk                                 | Impact | Mitigation Strategy                                                      |
| ------------------------------------ | ------ | ------------------------------------------------------------------------ |
| External asset validation too strict | Medium | Use Zod URL validation allowing known CDNs; fallback to permissive mode. |

## 🧪 Regression Testing Note

- Validate hero images render for all event themes in staging.
