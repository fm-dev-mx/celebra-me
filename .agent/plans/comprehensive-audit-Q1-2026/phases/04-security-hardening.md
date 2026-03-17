# Phase 04: Backend Security & RLS Hardening

## 🔍 Finding: Security Risk: Service Role Abuse in Repositories
**Domain**: Backend Engineering
**Criticality**: Critical

### Root Cause & Impact
Repositories (e.g., `guest.repository.ts`, `findGuestByInviteIdPublic`) frequently default to `useServiceRole: true`.
*   **Root Cause**: Difficulty in passing authentication tokens through the layers or incomplete Row Level Security (RLS) policies in the database.
*   **Impact**: Bypassing RLS means the application logic is the only line of defense. Any bug in the service layer could result in wide-scale data exposure. It violates the "Principle of Least Privilege."

## 🛠️ Minimalist Viable Improvement (MVI)
1.  **RLS Audit**: Harden `guest_invitations` and `events` tables in Supabase to allow public reads via `invite_id` without needing a service role.
2.  **Context-Aware Repositories**: Refactor repository methods to strictly require an `authToken` when the context allows.
3.  **Service Role Containment**: Limit the use of `useServiceRole` to a single "Auth Bridge" module that explicitly handles transitions from public access to private data.

### ROI
Critical. Protects user data and aligns the backend with modern security best practices.
