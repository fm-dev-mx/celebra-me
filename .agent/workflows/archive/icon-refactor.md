---
description: Architectural Icon Refactor - Transitioning to Universal Atomic React Components
---

# Workflow: Architectural Icon Refactor

## Role

You are the **Lead Architect** for Celebra-me. Your mission is to migrate all system icons (Astro
fragments, scattered SVGs, and legacy registries) into a standardized, universal atomic component
system using React (`.tsx`).

This ensures icons can be used in both pure React components (interactive) and Astro components
(server-rendered) without duplication or hydration issues.

---

## Architectural Standards

1.  **Format**: Every icon must be a `.tsx` file.
2.  **Location**: `src/components/common/icons/[category]/[IconName].tsx`
    - Categories: `ui/` (generic), `social/` (brand), `invitation/` (event-specific).
3.  **Component API**:
    - Every icon must accept `className?: string` and `size?: number | string`.
    - Always include `aria-hidden="true"` and `role="img"` on the `<svg>` for accessibility.
    - Use `fill="currentColor"` or `stroke="currentColor"` to ensure CSS theming works.
4.  **Documentation**: Every file must include a **TSDoc** block in English explaining its intended
    use and source origin.
5.  **Naming & Exports**:
    - File: `IconName.tsx` (PascalCase).
    - Named Export: `IconNameIcon`.
    - Default Export: `IconNameIcon` (for easier dynamic imports if needed).
6.  **Barrel Files**: Each category folder MUST have an `index.ts` exporting all icons.

---

## Execution Loop

### Phase 1 — Infrastructure & Setup

1. Create the base directory structure:
    - `src/components/common/icons/ui/`
    - `src/components/common/icons/social/`
    - `src/components/common/icons/invitation/`
2. Initialize empty `index.ts` files in each.

### Phase 2 — Migration of Legacy Registries

// turbo

1. Explode `src/components/common/icons/ReactIcons.tsx` into:
    - `ui/ChevronDown.tsx`
    - `social/WhatsApp.tsx`
2. Explode `src/components/invitation/icons/react/SealIcons.tsx` into `invitation/`:
    - `invitation/BootSeal.tsx`
    - `invitation/HeartSeal.tsx`
    - `invitation/MonogramSeal.tsx`
    - `invitation/FlowerSeal.tsx`

### Phase 3 — Discovery & Migration of Astro Fragments

1. **Audit**: List all files in `src/components/invitation/icons/*.astro`.
2. **Convert**: Transform each into a `.tsx` component.
    - Pay attention to `stroke-width` (convert to `strokeWidth` for React).
    - Ensure `currentColor` is used for the primary visual path.
3. **Move**: Place in `src/components/common/icons/invitation/`.
4. **Specific Mapping Targets**:
    - `MapIcon.astro` -> `invitation/MapLocation.tsx`
    - `CrownIcon.astro` -> `invitation/Crown.tsx`
    - `DinnerIcon.astro` -> `invitation/Dinner.tsx`
    - `WaltzIcon.astro` -> `invitation/Waltz.tsx`
    - `ToastIcon.astro` -> `invitation/Toast.tsx`
    - `ForbiddenIcon.astro` -> `invitation/Forbidden.tsx`

### Phase 4 — Extraction of Inline SVGs (The "Hidden" Icons)

1. **Source Audit**: Locate and extract SVGs from:
    - `src/components/invitation/MusicPlayer.tsx` -> `ui/Play.tsx` and `ui/Pause.tsx`.
    - `src/components/invitation/Gifts.astro` -> `invitation/Gift.tsx`.
    - `src/components/invitation/TimelineList.tsx` -> Identify and extract list markers.
    - `src/components/common/icons/AppIcon.astro` -> `ui/AppLogo.tsx`.

### Phase 5 — Barrel File Generation & Refactor

1. Update all `index.ts` files to export the new components.
2. Update all imports in the system. Use the barrel imports where possible for cleaner code:
    - `import { WhatsAppIcon } from '@/components/common/icons/social';`
3. **Audit Consumers**:
    - `src/components/invitation/EnvelopeReveal.tsx`
    - `src/components/ui/FAQList.tsx` (update to path-based or barrel)
    - `src/components/ui/WhatsAppButton.tsx`
    - `src/pages/[eventType]/[slug].astro`

### Phase 6 — Verification & Cleanup

1. Run `pnpm check` (or `tsc`) to find broken imports.
2. Run `npm run dev` and visually verify 3-4 key icons.
3. Delete legacy files:
    - `src/components/common/icons/ReactIcons.tsx`
    - `src/components/invitation/icons/react/SealIcons.tsx`
    - `src/components/invitation/icons/*.astro` (once all are moved).
    - `src/components/common/icons/AppIcon.astro`

---

## Component Template (Reference)

```tsx
import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * [Description in English]
 * Source: [Legacy File Name or Original SVG Origin]
 */
export const [IconName]Icon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="currentColor"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		{/* SVG Paths Here. Ensure camelCase for props like strokeWidth */}
	</svg>
);

export default [IconName]Icon;
```

---

## Reporting Checklist

- [ ] Accessibility: All icons have `aria-hidden="true"` and `role="img"`?
- [ ] React Compliance: `stroke-width` converted to `strokeWidth`?
- [ ] Barrel Files: `index.ts` created and populated in all 3 categories?
- [ ] Inline SVGs: Extracted from MusicPlayer and Gifts?
- [ ] Cleanup: All `.astro` icon fragments deleted?
- [ ] Build: Verified with `pnpm check` or equivalent?
