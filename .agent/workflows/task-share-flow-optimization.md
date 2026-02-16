---
description:
    Optimization of invitation sharing flow, dynamic link generation, intelligent social buttons,
    and host progress gamification.
---

# 💎 Workflow: Share Flow & Invitation Personalization

This workflow guides the implementation of the optimized sharing system for "Celebra-me", focusing
on Short-URLs (Short-IDs), personalized guest experiences, and high-speed dashboard execution.

## 1. Short-ID Architecture & Database

- **Migration**: Update `guest_invitations` table to include a `short_id` (VARCHAR, 8-10 chars,
  unique) generated via Base62 or NanoID.
- **Backfill**: Create a script to generate `short_id` for existing guests if necessary.
- **Indexing**: Ensure `short_id` is indexed for fast lookup.

## 2. Dynamic & Secure Link Resolution

1. **Utility**: Update `src/utils/invitationLink.ts` to prioritize `short_id`.
    - Pattern: `{baseUrl}/e/{short_id}` or `{baseUrl}/{event_type}/{event_slug}/i/{short_id}`.
    - **Environment-Aware**: Production uses the custom domain; local uses `localhost:4321`.
2. **Personalization Engine**: Modifiy the invitation route (`[slug].astro`) to:
    - Resolve `short_id` to guest data server-side (SSR).
    - Inject guest name into `<Welcome />` and `<RSVPForm />`.
    - Pre-fill number of passes and phone if available.

## 3. "Next-Up" Execution Flow

1. **Focus Mode**: Implement the "Enviar Siguiente" button.
    - **Logic**: Find the first `pending` guest in the list.
    - **Trigger**: Programmatically trigger the `share` or `whatsapp` action for that guest.
    - **Transition**: Smoothly highlight the next guest in the list using `framer-motion`.

## 4. Intelligent Action UI (Jewelry Box)

1. **Single Action Button**:
    - **Primary**: WhatsApp icon if `phone` exists; Share icon otherwise.
    - **Feedback**: Immediate visual state change to `delivered` (optimistic UI).
2. **Action Menu**:
    - Use a subtle trigger for secondary actions: _Copy Link, Edit, Delete_.
    - Aesthetics: Glassmorphism, subtle glows, and premium typography.

## 5. Automation & Notifications

1. **Auto-Update**: After a share action, update `guest_invitation_audit` and `delivery_status` in
   background.
2. **Toasts**: Implement high-end "Jewelry Box" notifications for "Link Copiado" or "Error en
   Envío".

## 6. Verification

- **E2E**: Validate that a Short-ID link resolves to the correct personalized view.
- **Mobile**: Test the "Share" API on iOS/Android browsers.
- **Privacy**: Ensure that changing a character in the `short_id` doesn't easily reveal another
  guest's data (using non-sequential IDs).

// turbo

1. Move this workflow to `.agent/workflows/archive/` once fully implemented.

> [!IMPORTANT] **Critical Reflection**: The transition from UUID to Short-ID must preserve backward
> compatibility for existing links during the migration period. Consider a redirection or
> dual-lookup strategy.
