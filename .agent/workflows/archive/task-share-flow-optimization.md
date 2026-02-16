---
description:
    Implementation of the "Invitation Factory" sharing flow with card-based UI, smart sharing logic,
    and gamified animations.
---

# 💎 Workflow: Invitation Factory & Gamification

This workflow guides the transformation of the guest sharing process into a premium, high-speed
interface optimized for mobile viewports, adhering to the "Jewelry Box" aesthetic.

## 1. UI Transformation (Mobile Cards)

- **File**: `src/components/dashboard/guests/GuestTable.tsx`
    - **Change**: Refactor the mobile view (under 992px) to use a dedicated `GuestCard`
      sub-component or significantly enhanced table row cards.
    - **Proportions**: Ensure cards have clear separation and large tap targets for buttons.
- **File**: `src/styles/invitation/_dashboard-guests.scss`
    - **Refinement**: Improve `.dashboard-guests__table tbody tr` styles for mobile. Add
      glassmorphism and Jewelry Box shadows.
    - **Animations**: Implement `.celebrate-success` and `.wa-icon--delivered` keyframes.

## 2. Smart Sharing Controller

- **File**: `src/components/dashboard/guests/WhatsAppInviteButton.tsx` (Consider renaming to
  `ShareAction.tsx`)
    - **Smart Logic**:
        - **If `phone` exists**: Default to WhatsApp API (`wa.me`) for 1-click direct message.
        - **If `phone` is empty**: Trigger `navigator.share()` (Web Share API) for a native OS share
          sheet.
        - **Fallback**: Implement a simple menu for "Copy Link" or "Open Web".
- **File**: `src/lib/rsvp-v2/service.ts`
    - **Link Builder**: Ensure `buildWhatsAppShareUrl` and `generateInvitationLink` (in
      `src/utils/invitationLink.ts`) are synchronized.

## 3. Gamification & Feedback

- **File**: `src/components/dashboard/guests/GuestDashboardApp.tsx`
    - **Event Loop**: Ensure `onMarkShared` triggers a visual celebration on the corresponding
      card/row.
- **File**: `src/components/dashboard/guests/Toast.tsx`
    - **Visuals**: Use the Jewelry Box aesthetic for the success toast ("¡Enlace copiado!").
- **Asset**: Generate or use sparkles/glow assets for the "Success" state.

## 4. Verification & WCAG

- **Tool**: `browser_subagent`
    - **Check**: Test tap target sizes (min 44x44px) and color contrast on confirmed/pending pills.
    - **Functionality**: Verify that clicking share marked the guest as "Shared" in the UI
      immediately (Optimistic UI).

// turbo

1. Move this workflow to `.agent/workflows/archive/` once fully implemented.

> [!IMPORTANT] **Critical Reflection**: The "Invitation Factory" should minimize friction. The "Next
> Up" button in `GuestDashboardApp.tsx` is the key to velocity—ensure it always scrolls the next
> pending guest into view before opening the share action.

---

**Next Step**: Refactor the `GuestTable.tsx` row to have more distinguishable buttons on mobile.
