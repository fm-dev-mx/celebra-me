# Phase 05: Asset Type-Safety Hardening

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
