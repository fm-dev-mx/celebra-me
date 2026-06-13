---
title: Client Intake Flow — Phased Implementation Plan
status: active
created: unknown
updated: 2026-05-31
---

# Client Intake Flow — Phased Implementation Plan

## 1. Objective

Introduce a professional client intake workflow that allows an admin to create an invitation
project, select a compatible base demo, configure which information blocks the client must provide,
generate a private intake link, and review the client's structured submission before producing the
final invitation.

The long-term target is DB-driven public rendering, but the rendering migration is deferred to a
later release.

## 2. Scope

### In Scope

- Admin invitation project creation and management
- `DemoPreset` catalog (versioned TypeScript module)
- Configurable intake blocks with Spanish UI labels
- Private token-based client intake form at `/captura/[token]`
- Multi-step dynamic form with per-step auto-save
- Text-only photo handling (WhatsApp instructions, no file uploads)
- Admin review page with approve/request-changes actions
- Status tracking for projects, requests, and submissions
- Basic email notification on client submission
- New Supabase tables for intake domain

### Out of Scope (All Releases)

- Visual invitation builder or client layout editor
- Client theme or section reordering
- File/image uploads in the intake form
- Client login or account system
- Payment flow
- Advanced guest management within intake
- Full RSVP backend within intake
- AI content generation inside the form
- Webhook integrations or third-party automations

### Out of Scope (Release 1 Only)

- Public rendering migration
- DB-backed invitation pages
- Automatic publishing from submission
- `InvitationContentDraft` or `PublishedInvitationContent` tables

## 3. Non-Goals

- Do not modify the current public invitation rendering path in Release 1.
- Do not treat `IntakeSubmission` as final published content.
- Do not introduce Tailwind or any styling framework other than SCSS.
- Do not create a manifest-based planning or archive system.

## 4. Fixed Decisions

| Decision            | Choice                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| Image handling      | No upload. WhatsApp-based collection with text instructions and notes.        |
| Post-submit editing | Client can edit until admin starts review. Admin can reopen.                  |
| Token expiration    | 30-day default, admin-configurable.                                           |
| Client auth         | Token-only. No login system.                                                  |
| Token storage       | Hash stored in DB (`token_hash`), raw token sent to client only once.         |
| Partial save        | Per-step auto-save to DB.                                                     |
| UI language         | Spanish for all client-facing and admin-facing visible text.                  |
| Code language       | English for code, types, variables, comments.                                 |
| Catalog location    | Versioned TypeScript file (`src/lib/intake/demo-preset-catalog.ts`).          |
| Rendering target    | DB-driven (Release 3), JSON content collections remain active in Release 1–2. |

## 5. Assumptions

- Supabase is available and configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`).
- The existing Supabase REST client pattern (`src/lib/rsvp/repositories/supabase.ts`) is reusable.
- The existing admin session/auth (`requireAdminSession`) protects new admin routes.
- The existing email infrastructure (`src/lib/server/email.ts`) supports notification extension.
- Vercel serverless functions have a 30-second max duration.
- No persistent filesystem writes at runtime.
- Existing content collections (`events`, `event-demos`, `event-templates`) remain unchanged.
- Existing public invitation routes (`/[eventType]/[slug]`) are not modified in Release 1.

## 6. Entity Model

```
InvitationProject
  id, slug (optional, for future DB-driven rendering),
  title, eventType, status, baseDemoId, themeId,
  snapshot (DemoPreset snapshot at creation),
  clientName, clientEmail, clientWhatsapp,
  photosReceived (boolean, admin-tracked),
  createdBy, timestamps

IntakeRequest
  id, invitationProjectId, tokenHash, status,
  enabledBlocks (IntakeBlockType[]),
  expiresAt, timestamps
  -- unique partial index: one active submission per request

IntakeSubmission
  id, intakeRequestId (unique, one per request), status,
  blockData (jsonb), photoNotes (jsonb),
  clientComments, submittedAt, reviewedAt,
  reviewNotes, timestamps

(Future — Release 2)
InvitationContentDraft
  id, invitationProjectId, submissionId,
  content (jsonb, eventContentSchema-compatible),
  status, timestamps

(Future — Release 3)
PublishedInvitationContent
  id, invitationProjectId, slug, eventType,
  isDemo, content (jsonb), version, timestamps
```

### Status Enums

```
InvitationProjectStatus:
  'draft' | 'waiting_for_client' | 'client_submitted' |
  'in_review' | 'in_production' | 'preview_sent' |
  'approved' | 'published' | 'archived'

IntakeRequestStatus:
  'draft' | 'active' | 'submitted' | 'closed' | 'expired'

IntakeSubmissionStatus:
  'in_progress' | 'submitted' | 'needs_changes' | 'approved'
```

### Intake Block Types (MVP)

```
'event-details'      — title, date, description
'main-people'        — parents, godparents, spouse, children
'date-locations'     — ceremony + reception venues
'photos'             — text instructions + notes (no upload)
'rsvp-config'        — RSVP settings
'music'              — background music URL
'gifts'              — gift registry / bank transfer
'special-messages'   — quote, thank you message
```

## 7. DemoPreset Catalog

A versioned TypeScript module that references existing demo content entries.

```ts
interface DemoPreset {
  id: string;
  eventType: EventType;
  displayName: string;
  themeId: ThemePreset;
  defaultSections: ContentSectionKey[];
  supportedBlocks: IntakeBlockType[];
  recommendedBlocks: IntakeBlockType[];
  requiredAssets: EventAssetKey[];
  previewSlug: string;
}
```

Initial catalog entries (7 presets mapping to existing demos):

| Preset ID                        | Event Type | Theme               |
| -------------------------------- | ---------- | ------------------- |
| `demo-xv-jewelry-box`            | xv         | jewelry-box         |
| `demo-xv-editorial`              | xv         | editorial           |
| `demo-xv-enchanted-rose`         | xv         | enchanted-rose      |
| `demo-xv-celestial-blue`         | xv         | celestial-blue      |
| `demo-boda-jewelry-box-wedding`  | boda       | jewelry-box-wedding |
| `demo-bautismo-angelic-presence` | bautizo    | angelic-presence    |
| `demo-cumple-luxury-hacienda`    | cumple     | luxury-hacienda     |

When an admin creates an invitation project, the selected preset's config is **snapshotted** onto
the `invitation_projects.snapshot` column. Future catalog changes do not affect existing projects.

## 8. Token Security

- Generate: `crypto.randomBytes(32).toString('base64url')` (~43 chars, URL-safe).
- Store: SHA-256 hash in `intake_requests.token_hash`.
- The raw token is returned only once at creation time.
- Lookup: hash the incoming token and match against `token_hash`.
- Expiration: `expires_at` column, default `now() + 30 days`.
- Revocation: set `status = 'closed'`.
- Rate limiting: reuse existing `checkRateLimit()` from
  `src/lib/rsvp/security/rate-limit-provider.ts` with a new `'intake'` namespace. The provider
  already falls back to an in-memory backend when Upstash is not configured
  (`UPSTASH_REDIS_REST_URL` / `RSVP_V2_DISTRIBUTED_RATELIMIT` env vars). No hard dependency on
  Upstash.

## 9. Release Breakdown

### Release 1 — Operational Intake MVP

Admin creates invitation projects, configures intake blocks, generates private links. Client fills a
dynamic multi-step form. Admin reviews submissions. No changes to public rendering.

### Release 2 — Internal Draft Content

Generate an `InvitationContentDraft` from a reviewed submission. Admin reviews and adjusts the
draft. Publishing remains manual (admin creates/edits JSON content file).

### Release 3 — DB-Driven Rendering Migration

Introduce `PublishedInvitationContent`. Add a DB adapter alongside the existing content-collection
adapter. Migrate one demo as proof of concept, validate visual parity, then migrate remaining
demos/events in controlled steps.

---

## Release 1 — Operational Intake MVP

### Phase 1.1 — Types, Schemas, and DemoPreset Catalog

**Scope:** Pure additive TypeScript modules. No routes, no DB, no UI.

#### Files to Create

| File                                                  | Purpose                                      |
| ----------------------------------------------------- | -------------------------------------------- |
| `src/lib/intake/types.ts`                             | Entity types, status enums, block type union |
| `src/lib/intake/demo-preset-catalog.ts`               | `DemoPreset[]` catalog with 7 entries        |
| `src/lib/intake/schemas/intake-block.schema.ts`       | Zod schemas for each intake block            |
| `src/lib/intake/schemas/invitation-project.schema.ts` | Zod schemas for project CRUD                 |
| `src/lib/intake/schemas/intake-request.schema.ts`     | Zod schemas for request config               |
| `src/lib/intake/schemas/intake-submission.schema.ts`  | Zod schemas for submission                   |
| `src/lib/intake/blocks/index.ts`                      | Block registry                               |
| `src/lib/intake/blocks/event-details.block.ts`        | Block definition + field schema              |
| `src/lib/intake/blocks/main-people.block.ts`          | Block definition + field schema              |
| `src/lib/intake/blocks/date-locations.block.ts`       | Block definition + field schema              |
| `src/lib/intake/blocks/photos.block.ts`               | Block definition + field schema (text-only)  |
| `src/lib/intake/blocks/rsvp-config.block.ts`          | Block definition + field schema              |
| `src/lib/intake/blocks/music.block.ts`                | Block definition + field schema              |
| `src/lib/intake/blocks/gifts.block.ts`                | Block definition + field schema              |
| `src/lib/intake/blocks/special-messages.block.ts`     | Block definition + field schema              |

#### Files to Modify

None.

#### Acceptance Criteria

- `pnpm type-check` passes with 0 errors.
- `pnpm lint` passes.
- Unit tests pass for block schemas and catalog validation.
- All block definitions include Spanish `displayName` and `description`.
- DemoPreset catalog references only existing demo content entry IDs.

### Phase 1.2 — Database Migration

**Scope:** New Supabase tables. Additive only. No changes to existing tables.

#### Migration File

`supabase/migrations/<timestamp>_intake_core.sql`

#### Tables

```sql
-- Idempotent touch_updated_at() — already exists from 20260215000300_rsvp_v2_core.sql
-- but we ensure it is present in case of fresh or partial environments.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- Invitation projects (admin workflow)
create table public.invitation_projects (
  id uuid primary key default gen_random_uuid(),
  slug text null unique,
  title text not null,
  event_type text not null
    check (event_type in ('xv', 'boda', 'bautizo', 'cumple')),
  status text not null default 'draft'
    check (status in (
      'draft', 'waiting_for_client', 'client_submitted',
      'in_review', 'in_production', 'preview_sent',
      'approved', 'published', 'archived'
    )),
  base_demo_id text not null,
  theme_id text not null,
  snapshot jsonb not null default '{}',
  client_name text not null default '',
  client_email text not null default '',
  client_whatsapp text not null default '',
  photos_received boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Intake request configuration
create table public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid not null
    references public.invitation_projects(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'submitted', 'closed', 'expired')),
  enabled_blocks jsonb not null default '[]',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Client submissions
create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  intake_request_id uuid not null
    references public.intake_requests(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'needs_changes', 'approved')),
  block_data jsonb not null default '{}',
  photo_notes jsonb not null default '{}',
  client_comments text not null default '',
  submitted_at timestamptz null,
  reviewed_at timestamptz null,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_invitation_projects_status
  on public.invitation_projects (status);
create index idx_invitation_projects_created_by
  on public.invitation_projects (created_by);
create index idx_intake_requests_invitation_project_id
  on public.intake_requests (invitation_project_id);
create index idx_intake_requests_token_hash
  on public.intake_requests (token_hash);
create index idx_intake_submissions_intake_request_id
  on public.intake_submissions (intake_request_id);

-- Ensure exactly one submission per request (MVP: no revision history).
-- The submission row transitions through statuses: in_progress → submitted → needs_changes → submitted → approved
create unique index if not exists idx_intake_submissions_one_per_request
  on public.intake_submissions (intake_request_id);

-- Triggers
drop trigger if exists trg_invitation_projects_touch_updated_at
  on public.invitation_projects;
create trigger trg_invitation_projects_touch_updated_at
  before update on public.invitation_projects
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_intake_requests_touch_updated_at
  on public.intake_requests;
create trigger trg_intake_requests_touch_updated_at
  before update on public.intake_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_intake_submissions_touch_updated_at
  on public.intake_submissions;
create trigger trg_intake_submissions_touch_updated_at
  before update on public.intake_submissions
  for each row execute function public.touch_updated_at();
```

#### RLS Policies

- `invitation_projects`: admin-only read/write (via `auth.uid()` + role check).
- `intake_requests`: admin-only read/write. Token-hash lookup uses service role from server API.
- `intake_submissions`: admin-only read/write. Client writes go through server API with service
  role.

#### Files to Create

| File                                                           | Purpose                               |
| -------------------------------------------------------------- | ------------------------------------- |
| `supabase/migrations/<ts>_intake_core.sql`                     | Migration                             |
| `src/lib/intake/repositories/invitation-project.repository.ts` | CRUD operations                       |
| `src/lib/intake/repositories/intake-request.repository.ts`     | CRUD + token lookup                   |
| `src/lib/intake/repositories/intake-submission.repository.ts`  | CRUD + status updates                 |
| `src/lib/intake/services/intake-token.service.ts`              | Token generation, hashing, validation |

#### Files to Modify

None (existing tables untouched).

#### Acceptance Criteria

- Local Supabase migration validation succeeds through the current database workflow.
- All three tables exist with correct constraints and indexes.
- `touch_updated_at` triggers fire on update.
- Repository functions pass unit tests with mocked Supabase responses.
- Token service generates unique tokens, hashes correctly, and validates lookups.

### Phase 1.3 — Admin API and Service Layer

**Scope:** Server-side API endpoints and business logic. No UI yet.

#### API Endpoints

| Method  | Path                                                  | Purpose                      |
| ------- | ----------------------------------------------------- | ---------------------------- |
| `GET`   | `/api/dashboard/intake`                               | List invitation projects     |
| `POST`  | `/api/dashboard/intake`                               | Create invitation project    |
| `GET`   | `/api/dashboard/intake/[id]`                          | Get project detail           |
| `PATCH` | `/api/dashboard/intake/[id]`                          | Update project               |
| `POST`  | `/api/dashboard/intake/[id]/request`                  | Create/update intake request |
| `GET`   | `/api/dashboard/intake/[id]/request`                  | Get intake request config    |
| `POST`  | `/api/dashboard/intake/[id]/request/regenerate-token` | Regenerate token             |

#### Files to Create

| File                                                              | Purpose                |
| ----------------------------------------------------------------- | ---------------------- |
| `src/pages/api/dashboard/intake/index.ts`                         | List + create projects |
| `src/pages/api/dashboard/intake/[id]/index.ts`                    | Get + update project   |
| `src/pages/api/dashboard/intake/[id]/request.ts`                  | Intake request CRUD    |
| `src/pages/api/dashboard/intake/[id]/request/regenerate-token.ts` | Token regeneration     |
| `src/lib/intake/services/invitation-project.service.ts`           | Business logic         |
| `src/lib/intake/services/intake-request.service.ts`               | Request config logic   |
| `src/lib/dashboard/dto/intake.ts`                                 | DTOs for intake API    |

#### Files to Modify

| File                             | Change                                 |
| -------------------------------- | -------------------------------------- |
| `src/lib/dashboard/admin-api.ts` | Add intake methods to `AdminApi` class |

#### Acceptance Criteria

- All endpoints require admin session (reuse `requireAdminSession`).
- Creating a project snapshots the selected `DemoPreset` into `invitation_projects.snapshot`.
- Creating an intake request generates a token, stores the hash, and returns the raw token once.
- Token regeneration invalidates the old token and generates a new one.
- `pnpm type-check` passes.
- `pnpm lint` passes.

### Phase 1.4 — Admin UI (Invitation List and Detail)

**Scope:** Dashboard pages and React components for admin intake management.

#### Routes

| Route                          | Type       | Purpose                            |
| ------------------------------ | ---------- | ---------------------------------- |
| `/dashboard/invitaciones`      | Astro page | Invitation project list            |
| `/dashboard/invitaciones/[id]` | Astro page | Project detail, block config, link |

#### Files to Create

| File                                                   | Purpose                                |
| ------------------------------------------------------ | -------------------------------------- |
| `src/pages/dashboard/invitaciones.astro`               | List page                              |
| `src/pages/dashboard/invitaciones/[id].astro`          | Detail page                            |
| `src/components/dashboard/intake/InvitationList.tsx`   | React island: project list             |
| `src/components/dashboard/intake/InvitationDetail.tsx` | React island: project detail           |
| `src/components/dashboard/intake/DemoSelector.tsx`     | React island: event type + demo picker |
| `src/components/dashboard/intake/BlockSelector.tsx`    | React island: block toggle UI          |
| `src/components/dashboard/intake/IntakeLinkPanel.tsx`  | React island: copyable link + status   |
| `src/hooks/use-invitation-admin.ts`                    | Hook for admin API calls               |
| `src/styles/dashboard/_intake.scss`                    | Dashboard intake styles                |

#### Files to Modify

| File                                | Change                                              |
| ----------------------------------- | --------------------------------------------------- |
| `src/layouts/DashboardLayout.astro` | Add "Invitaciones" nav link                         |
| `src/middleware.ts`                 | Add `/dashboard/invitaciones` to `ADMIN_ONLY_PATHS` |

#### Acceptance Criteria

- Admin can create a project: select event type, select compatible demo, select blocks.
- Admin can enter client WhatsApp contact (`client_whatsapp`).
- Admin can generate and copy the private intake link.
- Admin can see project status and intake request status.
- Admin can toggle `photos_received` to track whether WhatsApp photos arrived.
- Admin can regenerate the intake token.
- All visible UI text is in Spanish.
- `pnpm build` passes.
- `pnpm lint:styles` passes.

### Phase 1.5 — Client Intake Form

**Scope:** Token-authenticated client form at `/captura/[token]`. Multi-step, dynamic, auto-save.

#### Routes

| Route                  | Type             | Purpose                      |
| ---------------------- | ---------------- | ---------------------------- |
| `/captura/[token]`     | Astro page (SSR) | Client intake form           |
| `/api/captura/[token]` | API              | Save draft step, submit form |

#### Token Resolution (Server-Side)

1. Hash the incoming token.
2. Look up `intake_requests` by `token_hash`.
3. Validate: status is `active`, not expired.
4. Load the parent `invitation_projects` for context.
5. Load existing `intake_submissions` for partial data.
6. If invalid/expired: render a Spanish error page.

#### Form Architecture

- React island (`client:load`) for the multi-step form.
- Each enabled block renders as one step.
- Per-step auto-save: `PATCH /api/captura/[token]` with `{ step, blockData }`.
- Final step: summary review before submission.
- Client can mark fields as "pendiente" (to be defined later).
- All UI copy in Spanish.

#### Photos Block (Text-Only)

The photos block does **not** upload files. It captures:

- Whether the client has sent photos via WhatsApp (checkbox).
- Intended hero/main photo description.
- Gallery photo notes (textarea).
- Family photo notes (textarea).
- Special section photo notes (textarea, optional).
- General photo instructions (textarea, optional).

Visible instructions tell the client in Spanish:

> "Envía tus fotos por WhatsApp como documento (calidad original) cuando sea posible. Indica aquí el
> uso previsto para cada foto o grupo de fotos."

#### Files to Create

| File                                                    | Purpose                           |
| ------------------------------------------------------- | --------------------------------- |
| `src/pages/captura/[token].astro`                       | Client form page (SSR)            |
| `src/pages/api/captura/[token].ts`                      | Save draft + submit               |
| `src/components/intake/IntakeForm.tsx`                  | Multi-step form shell             |
| `src/components/intake/IntakeStepNav.tsx`               | Step navigation + progress        |
| `src/components/intake/IntakeSummary.tsx`               | Pre-submit summary                |
| `src/components/intake/blocks/EventDetailsBlock.tsx`    | Block component                   |
| `src/components/intake/blocks/MainPeopleBlock.tsx`      | Block component                   |
| `src/components/intake/blocks/DateLocationsBlock.tsx`   | Block component                   |
| `src/components/intake/blocks/PhotosBlock.tsx`          | Block component (text-only)       |
| `src/components/intake/blocks/RsvpConfigBlock.tsx`      | Block component                   |
| `src/components/intake/blocks/MusicBlock.tsx`           | Block component                   |
| `src/components/intake/blocks/GiftsBlock.tsx`           | Block component                   |
| `src/components/intake/blocks/SpecialMessagesBlock.tsx` | Block component                   |
| `src/hooks/use-intake-form.ts`                          | Form state, validation, auto-save |
| `src/lib/intake/services/intake-submission.service.ts`  | Submission business logic         |
| `src/styles/intake/_intake-form.scss`                   | Intake form styles                |

#### Files to Modify

None (all new routes and components).

#### Acceptance Criteria

- Client opens `/captura/{token}` and sees a multi-step form.
- Only enabled blocks (from `intake_requests.enabled_blocks`) render as steps.
- Each step validates independently using block Zod schemas.
- Per-step auto-save persists `block_data` to `intake_submissions`.
- Client can mark fields as "pendiente".
- Photos block shows WhatsApp instructions in Spanish.
- Final summary step shows all entered data before submission.
- On submit: `intake_submissions.status` → `submitted`, `intake_requests.status` → `submitted`,
  `invitation_projects.status` → `client_submitted`.
- Client can edit submission until admin starts review.
- Invalid/expired tokens show a Spanish error page.
- `pnpm build` passes.
- `pnpm type-check` passes.

### Phase 1.6 — Admin Review Page

**Scope:** Admin reviews client submissions, approves or requests changes.

#### Routes

| Route                                 | Type       | Purpose           |
| ------------------------------------- | ---------- | ----------------- |
| `/dashboard/invitaciones/[id]/review` | Astro page | Review submission |

#### API Endpoints

| Method | Path                                | Purpose                    |
| ------ | ----------------------------------- | -------------------------- |
| `GET`  | `/api/dashboard/intake/[id]/review` | Get submission for review  |
| `POST` | `/api/dashboard/intake/[id]/review` | Approve or request changes |

#### Files to Create

| File                                                   | Purpose                 |
| ------------------------------------------------------ | ----------------------- |
| `src/pages/dashboard/invitaciones/[id]/review.astro`   | Review page             |
| `src/pages/api/dashboard/intake/[id]/review.ts`        | Review actions          |
| `src/components/dashboard/intake/SubmissionReview.tsx` | React island: review UI |

#### Acceptance Criteria

- Admin sees submitted data organized by block.
- Admin sees photo notes and client comments.
- Admin can approve (sets `intake_submissions.status` → `approved`, `invitation_projects.status` →
  `in_production`).
- Admin can request changes with notes (sets `intake_submissions.status` → `needs_changes`,
  `invitation_projects.status` → `waiting_for_client`).
- Once review starts, submission is locked for client editing.
- `pnpm build` passes.

### Phase 1.7 — Notifications

**Scope:** Basic email notification when client submits.

#### Files to Modify

| File                                                   | Change                                  |
| ------------------------------------------------------ | --------------------------------------- |
| `src/lib/server/email.ts`                              | Add `sendIntakeNotification()` function |
| `src/lib/intake/services/intake-submission.service.ts` | Trigger email on submit                 |

#### Acceptance Criteria

- Admin receives email when client submits.
- Email includes project title, client name, and link to review page.
- Email uses existing Gmail transport.

---

## Release 2 — Internal Draft Content

### Phase 2.1 — Approved Submission → Invitation Draft (Completed 2026-05-28)

**Scope:** Add `invitation_content_drafts` table, deterministic draft generation service, minimal
admin API, and dashboard integration point. One draft per invitation project.

#### Table

```sql
create table public.invitation_content_drafts (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid not null
    references public.invitation_projects(id) on delete cascade,
  submission_id uuid
    references public.intake_submissions(id),
  content jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_invitation_content_drafts_one_per_project
  on public.invitation_content_drafts (invitation_project_id);
```

#### Draft Generation Rules

- Allowed only when `intake_submissions.status === 'approved'`.
- Rejects `in_progress`, `submitted`, `needs_changes` with typed `ApiError` (422 + code).
- Deterministic mapping (no AI). Centralized mapper in `draft-content-mapper.ts`.
- Preserves Spanish user-facing copy.
- Regeneration upserts the single draft row per project (idempotent).
- Does not mutate project/request/submission statuses.
- Does not expose `tokenHash` or `rawToken`.

#### Files Created

| File                                                                 | Purpose                                                        |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `supabase/migrations/20260528000001_intake_drafts.sql`               | Draft table + indexes + RLS + trigger                          |
| `src/lib/intake/types.ts`                                            | Added `InvitationContentDraftStatus`, `InvitationContentDraft` |
| `src/lib/intake/schemas/invitation-content-draft.schema.ts`          | Zod schemas for draft content + generate action                |
| `src/lib/intake/repositories/invitation-content-draft.repository.ts` | `findDraftByProjectId`, `upsertDraft`                          |
| `src/lib/intake/services/draft-content-mapper.ts`                    | Centralized block-to-content mapping                           |
| `src/lib/intake/services/draft-generation.service.ts`                | Orchestrates validation + mapping + upsert                     |
| `src/pages/api/dashboard/intake/[id]/draft.ts`                       | `GET` (fetch), `POST` (generate) — admin-only                  |
| `src/lib/dashboard/dto/intake.ts`                                    | Added `InvitationContentDraftDTO`, `DraftResponse`             |
| `src/lib/dashboard/dto/intake-mapper.ts`                             | Added `toInvitationContentDraftDTO`                            |
| `src/lib/dashboard/admin-api.ts`                                     | Added `getDraft`, `generateDraft`                              |
| `src/hooks/use-invitation-admin.ts`                                  | Added `loadDraft`, `generateDraft`, `currentDraft`             |
| `src/components/dashboard/intake/InvitationDetail.tsx`               | Added draft button + status display                            |
| `src/lib/rsvp/security/admin-rate-limit.ts`                          | Added `intake:draft` rate limit entry                          |
| `tests/unit/draft-generation.service.test.ts`                        | Unit tests for service                                         |

#### Admin API

| Method | Path                               | Purpose                                            |
| ------ | ---------------------------------- | -------------------------------------------------- |
| `GET`  | `/api/dashboard/intake/[id]/draft` | Fetch existing draft (or null)                     |
| `POST` | `/api/dashboard/intake/[id]/draft` | Generate/regenerate draft from approved submission |

Both require strong admin session + rate limit. POST also requires CSRF. Response shape:
`{ draft: InvitationContentDraftDTO | null }`

#### Acceptance Criteria

- `pnpm type-check` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- `pnpm test -- tests/unit/draft-generation.service.test.ts` passes.
- Admin can generate a draft from an approved submission via dashboard or API.
- Non-approved submissions are rejected with typed error.
- Regenerating updates the same draft row (no duplicates).
- Admin can fetch draft status but cannot edit fields yet (Phase 2.2).

### Phase 2.2 — Read-Only Draft Review Page (Completed 2026-05-28)

**Scope:** Read-only admin page at `/dashboard/invitaciones/[id]/draft` to inspect generated draft
content. No editing or publishing actions. Content grouped by logical sections with Spanish labels.

#### Files Created

| File                                                | Purpose                                       |
| --------------------------------------------------- | --------------------------------------------- |
| `src/pages/dashboard/invitaciones/[id]/draft.astro` | Draft review Astro route                      |
| `src/components/dashboard/intake/DraftReview.tsx`   | React island: read-only draft content display |
| `tests/components/DraftReview.test.tsx`             | Component tests                               |

#### Files Modified

| File                                               | Change                                      |
| -------------------------------------------------- | ------------------------------------------- |
| `src/components/dashboard/intake/DraftSection.tsx` | Added "Ver borrador" link when draft exists |

#### Acceptance Criteria

- Admin can navigate to `/dashboard/invitaciones/[id]/draft` and view read-only draft content.
- If no draft exists, shows "Aún no se ha generado un borrador para esta invitación."
- Content is grouped by logical sections: hero, family, location, RSVP, music, gifts, messages,
  photo notes.
- Boolean values rendered as "Sí"/"No".
- Empty fields are omitted.
- Gift items rendered as readable list.
- No editing, no status mutation, no token exposure.
- "Ver borrador" link appears on project detail page when draft exists.
- Existing generate/regenerate behavior unchanged.

### Phase 2.3 — Draft Editing UI (Completed 2026-05-28)

**Scope:** Admin can edit generated draft content through the dashboard. Inline editing by logical
sections. Save via PATCH API. Cancel restores last saved state.

#### Files Created

| File                                              | Purpose                                 |
| ------------------------------------------------- | --------------------------------------- |
| `src/components/dashboard/intake/DraftEditor.tsx` | React island: inline editor by sections |
| `tests/unit/draft-update.service.test.ts`         | Service-level tests for draft update    |

#### Files Modified

| File                                                                 | Change                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/components/dashboard/intake/DraftReview.tsx`                    | Added "Editar borrador" button, edit mode toggle via `DraftEditor`                    |
| `src/pages/api/dashboard/intake/[id]/draft.ts`                       | Added `PATCH` handler for content update                                              |
| `src/lib/intake/repositories/invitation-content-draft.repository.ts` | Added `updateDraftContent(draftId, content)`                                          |
| `src/lib/intake/services/draft-generation.service.ts`                | Added `updateDraftContentByProject()` with status validation                          |
| `src/lib/intake/schemas/invitation-content-draft.schema.ts`          | Added `UpdateDraftContentSchema`                                                      |
| `src/lib/dashboard/admin-api.ts`                                     | Added `updateDraftContent()` method                                                   |
| `src/hooks/use-invitation-admin.ts`                                  | Added `saving` state, `updateDraft` action                                            |
| `src/lib/rsvp/core/errors.ts`                                        | Added `'invalid_draft_status'` to `ApiErrorCode`                                      |
| `src/styles/dashboard/_intake.scss`                                  | Added `.intake-editor__*` styles, `.intake-editor__edit-btn`, venue/gift/draft styles |
| `.agent/plans/client-intake-flow.md`                                 | Updated Phase 2.3 status                                                              |

#### API Changes

| Method  | Path                               | Purpose                                               |
| ------- | ---------------------------------- | ----------------------------------------------------- |
| `PATCH` | `/api/dashboard/intake/[id]/draft` | Update draft content (admin-only, CSRF, rate-limited) |

#### Editor Behavior

- "Editar borrador" button appears only when draft status is `draft`
- Editing grouped by the same 8 logical sections as read-only view
- Text inputs for strings, textareas for longer copy, number input for guest cap, checkboxes for
  booleans
- Venue fields (ceremony/reception) edited in nested fieldsets
- Godparents and children as multiline textareas
- Gift items: title/subtitle editable; items list shown as read-only (array editor deferred)
- "Guardar cambios" persists via PATCH and refreshes local state
- "Cancelar" restores last saved state and exits edit mode
- Non-`draft` status blocks editing with typed error

#### Acceptance Criteria

- Admin can enter edit mode from draft review page.
- Admin can edit all Phase 2.1 draft fields.
- Cancel restores last saved state.
- Save persists changes via PATCH API.
- Non-draft status blocks editing.
- Empty values can be filled via editor.
- All UI text in Spanish.

### Phase 2.3.1 — Data Integrity Fix Pass (Completed 2026-05-28)

**Scope:** Fixes identified in Release 2.3 Manual QA before proceeding with draft
approval/publishing.

#### Changes

**A1 — Zod schema preserves unknown keys**

- Added `.passthrough()` to `InvitationContentDraftContentSchema` so future schema extensions do not
  cause data loss during PATCH validation.

**A2 — Server-side deep merge on PATCH**

- Added `deepMerge()` utility in `draft-generation.service.ts` that merges incoming content with
  existing draft content before saving.
- Prevents partial PATCH payloads from wiping sibling sections or nested fields.
- Empty `{}` payload safely preserves existing content (no-op save).

**A3 — Visible save confirmation**

- After clicking "Guardar cambios", the editor stays open and shows "Borrador guardado
  exitosamente."
- The "Cancelar" button becomes "Cerrar" after successful save.
- User clicks "Cerrar" to exit edit mode. Success message is fully visible.

**A4 — DraftEditor component tests**

- 16 new tests: renders values, field editing, checkbox toggle, cancel, save payload verification,
  success/error feedback, Cerrar button, saving disabled state, number field, checkboxes, textarea,
  Spanish section titles.

**A5 — Mobile CSS**

- Added responsive rules for `.intake-editor` fields at 480px and 360px breakpoints.
- Inputs/textarea full-width, larger checkboxes, vertical button stacking.

#### Files Modified

| File                                                        | Change                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/intake/schemas/invitation-content-draft.schema.ts` | Added `.passthrough()` to content schema                                   |
| `src/lib/intake/services/draft-generation.service.ts`       | Added `deepMerge()`, merged before saving in `updateDraftContentByProject` |
| `src/components/dashboard/intake/DraftEditor.tsx`           | Removed `onSaved` prop, added `saved` state, Cerrar button after save      |
| `src/components/dashboard/intake/DraftReview.tsx`           | Removed `onSaved` prop from DraftEditor usage                              |
| `src/styles/dashboard/_intake.scss`                         | Added mobile rules for editor at 480px/360px                               |

#### Files Created

| File                                      | Purpose                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `tests/components/DraftEditor.test.tsx`   | 16 component tests for editor behavior                           |
| `tests/unit/draft-update.service.test.ts` | 3 new merge tests (partial update, nested fields, empty payload) |

### Phase 2.4 — Draft Approval for Publishing (Pending)

Detailed scope to be defined during Phase 2.3 implementation.

---

## Release 3 — DB-Driven Rendering Migration

### Phase 3.1 — Published Content Table and DB Adapter (Completed 2026-05-28)

**Scope:** Add `published_invitation_content` table and a DB adapter that produces
`InvitationViewModel`.

#### Table

```sql
create table public.published_invitation_content (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid
    references public.invitation_projects(id),
  slug text not null,
  event_type text not null,
  unique(event_type, slug),
  is_demo boolean not null default false,
  content jsonb not null,
  version integer not null default 1,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### DB Adapter

`src/lib/adapters/db-event-adapter.ts` — adapts `published_invitation_content.content` (jsonb) into
`InvitationViewModel`, reusing the same section-building functions from the existing adapter.
Exports `adaptDbEvent({ slug, eventType, isDemo, content }) → InvitationViewModel`. Delegates to
`adaptEvent` by constructing a pseudo-collection-entry from the DB content blob.

#### Admin API

None in Phase 3.1. Publishing API (writing to the table) deferred to Phase 2.4/3.2.

#### Public Routes

None in Phase 3.1. The DB adapter is infrastructure. Public route resolution (Phase 3.2) will read
from this table.

#### Files Created

| File                                                                  | Purpose                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `supabase/migrations/20260528000002_published_invitation_content.sql` | Migration: published_invitation_content table + indexes + RLS + trigger |
| `src/lib/adapters/db-event-adapter.ts`                                | DB adapter: adapts published content blob to InvitationViewModel        |
| `tests/unit/db-event-adapter.test.ts`                                 | Adapter tests: parity with adaptEvent, section preservation, demo flag  |

#### Acceptance Criteria

- `published_invitation_content` table exists with correct schema, indexes, RLS, and triggers.
- Admins can manage published content via RLS.
- Published content is publicly readable via RLS (select-only).
- `adaptDbEvent` produces a valid InvitationViewModel matching `adaptEvent` for identical content.
- Demo and live content flags are correctly propagated.
- `pnpm type-check` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- Adapter tests pass.

### Phase 3.2 — Unified Content Resolution

**Scope:** Update `src/lib/content/events.ts` to check DB first, then fall back to content
collections.

#### Files to Modify

| File                        | Change                                           |
| --------------------------- | ------------------------------------------------ |
| `src/lib/content/events.ts` | Add DB lookup before content collection fallback |

### Phase 3.3 — Proof of Concept Migration

**Scope:** Migrate one demo to `published_invitation_content`. Validate visual parity.

### Phase 3.4 — Public DB Rendering Full Migration (Completed 2026-05-29)

**Status:** Full migration complete. DB-published invitations render through the public route system
while preserving all existing static/demo behavior.

#### What Was Implemented

The single public invitation route `src/pages/[eventType]/[slug].astro` uses a static-first
resolution strategy with published DB fallback:

1. **`resolveInvitationContent()`** — checks static Astro content collections first (existing
   behavior via `getRoutableEventEntry`).
2. If no static content is found, falls back to `published_invitation_content` by
   `(slug, eventType)`.
3. If neither source has content, returns null → 404.
4. Existing static/demo content remains the primary source and is completely unchanged.

#### Public Content Resolution Order

1. **Static/demo content first** — `getRoutableEventEntry(slug, eventType)` checks Astro content
   collections (`events/`, `event-demos/`). If found, `adaptEvent()` produces the view model. No DB
   query is made.
2. **Published DB content fallback** — when static content is missing and `eventType` is provided,
   `findPublishedBySlugAndEventType(slug, eventType)` queries `published_invitation_content`. The
   raw content blob is adapted via `adaptDbEvent()` using `_assetSlug` for asset resolution.
3. **404 when neither exists** — resolver returns `null`, route redirects to `/404`.

**Key design decisions:**

- Published content pre-built via `adaptDbEvent()` → `InvitationViewModel`.
- Published content is enriched at publish time with demo fixture defaults (envelope, gallery,
  itinerary, countdown, interludes, sectionStyles, navigation, sharing, sectionOrder,
  theme.fontFamily, hero asset defaults).
- Draft-provided text fields (hero name/label/date, title, description, family, location, RSVP,
  music, gifts, quote, thankYou) override demo defaults.
- No existing static or demo route is modified. The fallback is additive.

#### Publishing Requirements

For a published invitation to render correctly, the following pipeline must complete:

1. **Draft must be generated** — `invitation_content_drafts` row with content mapped from an
   approved intake submission (Phase 2.1).
2. **Draft can be edited** — admin edits draft content through the dashboard editor (Phase 2.3).
3. **Publish writes `published_invitation_content`** — `publishDraft()` calls
   `mapDraftToPublished()` to merge draft content with demo fixture defaults, then
   `upsertPublishedContent()` persists the row.
4. **Publish syncs `events` row for RSVP** — `publishDraft()` creates or updates a row in the
   `events` table so the RSVP submission flow can resolve the event by slug.
5. **`_assetSlug` resolves demo preset assets** — internal non-sensitive metadata stored in
   `content._assetSlug`. Set by `mapDraftToPublished()` from `snapshot.previewSlug`. Read by
   `resolveInvitationContent()` to resolve demo preset asset registry keys (hero, portrait, gallery,
   interlude images) when the published slug differs from the demo preset slug. Not exposed in the
   rendered `InvitationViewModel`.

#### Migration Audit (Post-Enrichment)

| Component      | Published Source                              | Source          |
| -------------- | --------------------------------------------- | --------------- |
| Hero (images)  | Copied from demo fixture                      | ✅              |
| Hero (text)    | Draft fields override demo defaults           | ✅              |
| Envelope       | Copied from demo fixture                      | ✅              |
| Gallery        | Copied from demo fixture (title + items)      | ✅              |
| Itinerary      | Copied from demo fixture (title + items)      | ✅              |
| Countdown      | Copied from demo fixture                      | ✅              |
| Interludes     | Copied from demo fixture (image array)        | ✅              |
| Section styles | Copied from demo fixture                      | ✅              |
| Theme fonts    | Copied from demo fixture (`theme.fontFamily`) | ✅              |
| Navigation     | Copied from demo fixture                      | ✅              |
| Sharing/OG     | Copied from demo fixture                      | ✅              |
| RSVP           | Merged from draft → demo fallback             | ✅              |
| Location       | Mapped from draft                             | ✅              |
| Music          | Draft URL → demo fallback                     | ✅              |
| Gifts          | Merged from draft → demo fallback             | ✅              |
| Quote          | Merged from draft → demo fallback             | ✅              |
| ThankYou       | Merged from draft → demo fallback             | ✅              |
| Family         | Structured parse from draft text              | ✅ (simplified) |

#### Known Limitations

1. **Demo assets used for hero/gallery/interludes** — published content uses asset references (e.g.,
   `{ type: 'internal', key: 'hero' }`) that resolve through the demo preset's asset registry.
   Client-specific images are not supported yet.
2. **No client-specific photo pipeline** — photo notes from the intake form are recorded but not
   used for published rendering. All images come from the demo preset.
3. **Simplified family mapping** — draft family fields (fatherName, motherName, godparents, children
   as flat text) are parsed into structured format. Rich family structures (e.g., multiple godparent
   roles with separate names) are supported via `" — "` delimiters but not via a dedicated UI.
4. **No visual regression suite** — published content rendering has not been visually compared with
   equivalent static content. Theme-specific rendering quirks may exist.
5. **Static content still exists and remains fallback/primary** — existing slugs resolve to static
   content first. DB-published content is only served for slugs without a static match.
6. **Short URL redirects** — `/[eventType]/[slug]/i/[shortId]` resolves through the RSVP
   `getInvitationContextByShortId` service, which uses the `events` table. No DB-published content
   specific short URL path exists.

#### Hardening Pass (2026-05-28)

**A — eventType-safe published content resolution**

- Added `findPublishedBySlugAndEventType(slug, eventType)` to the repository — filters published
  content by both slug and event_type
- Updated `resolveInvitationContent()` to use eventType-safe lookup when `eventType` is provided
- Added composite index migration `20260528000003_published_content_event_type_index.sql`
- `/xv/foo` no longer resolves a published `/boda/foo`

**B — RSVP integration for published content**

- Publishing now creates/updates an `events` table row (via
  `createEventService`/`updateEventService`) so the existing RSVP submission flow can resolve the
  event
- The public RSVP endpoint now uses `resolveInvitationContent()` instead of
  `getRoutableEventEntry()`, supporting both static and published content
- Published content RSVP includes `accessMode` (sourced from demo defaults)
- Static/demo RSVP behavior unchanged

#### Files Changed for POC + Hardening

| File                                                                        | Change                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/pages/[eventType]/[slug].astro`                                        | Uses `resolveInvitationContent()` with published content fallback      |
| `src/pages/api/invitacion/public/[eventType]/[slug]/rsvp.ts`                | Uses resolver instead of `getRoutableEventEntry`                       |
| `src/lib/invitation/page-data.ts`                                           | Added optional `preBuiltViewModel` param                               |
| `src/lib/invitations/content-resolver.ts`                                   | Added `rawContent` to `ContentResolution`; eventType-safe lookup       |
| `src/lib/intake/mappers/draft-to-published.mapper.ts`                       | Full enrichment from demo fixture defaults; added `accessMode` to RSVP |
| `src/lib/intake/services/publishing.service.ts`                             | Loads demo content; creates/updates `events` table row at publish      |
| `src/lib/intake/repositories/published-invitation-content.repository.ts`    | Added `findPublishedBySlugAndEventType`                                |
| `supabase/migrations/20260528000003_published_content_event_type_index.sql` | Composite index (slug, event_type)                                     |
| `tests/unit/published-route-poc.test.ts`                                    | Updated for eventType-safe repo function                               |
| `tests/unit/content-resolver.test.ts`                                       | 9 tests for eventType filtering, cross-type blocking, no admin fields  |
| `tests/unit/draft-to-published.mapper.test.ts`                              | 14 enrichment tests added                                              |

#### Route Behavior Summary

| Scenario                                       | Behavior                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Static content exists for slug                 | Serves static content (unchanged)                                             |
| No static content, published DB content exists | Serves published content                                                      |
| Neither exists                                 | 404                                                                           |
| Draft (unpublished) content                    | Never accessible (resolver only reads `published_invitation_content`)         |
| Admin/private fields                           | Never exposed (`tokenHash`, `invitation_project_id` not in published content) |

#### Rollback Strategy

1. **Revert resolver to static-only** — in `src/pages/[eventType]/[slug].astro`, replace
   `resolveInvitationContent()` with `getRoutableEventEntry()` directly. The resolver module itself
   can remain without affecting behavior.
2. **Keep published tables intact** — `published_invitation_content` rows are not deleted. Existing
   data is preserved for future re-activation.
3. **No destructive DB changes** — the composite unique constraint migration is additive; the
   previous constraint check is handled safely via `drop constraint if exists`. No data is lost.
4. **All static routes continue to work** — static content is the primary resolution path and is
   never modified.

#### Deployment QA Checklist

Before deploying to production, manually verify:

- [ ] **Static route** — `/xv/ana-sofia-cota-guillen` renders correctly with all sections
- [ ] **DB-published route** — `/[eventType]/[published-slug]` renders correctly for a published
      invitation
- [ ] **RSVP on DB-published route** — `POST` to the public RSVP endpoint succeeds for a
      DB-published event
- [ ] **Short URL redirect** — `/[eventType]/[slug]/i/[shortId]` redirects to the correct URL with
      `invite` param
- [ ] **Wrong eventType route** — `/boda/ana-sofia-cota-guillen` returns 404 (eventType mismatch)
- [ ] **Missing slug route** — `/xv/non-existent` returns 404
- [ ] **Mobile width** — invitation renders correctly at 375px viewport width
- [ ] **No token/admin leakage** — inspect rendered HTML for absence of `tokenHash`,
      `invitation_project_id`, `_assetSlug` or other admin/internal fields
- [ ] **Vercel build** — `pnpm build` succeeds with Vercel adapter

---

## 10. File and Module Impact Summary (Release 1)

### New Files

```
src/lib/intake/
  types.ts
  demo-preset-catalog.ts
  schemas/
    intake-block.schema.ts
    invitation-project.schema.ts
    intake-request.schema.ts
    intake-submission.schema.ts
  blocks/
    index.ts
    event-details.block.ts
    main-people.block.ts
    date-locations.block.ts
    photos.block.ts
    rsvp-config.block.ts
    music.block.ts
    gifts.block.ts
    special-messages.block.ts
  repositories/
    invitation-project.repository.ts
    intake-request.repository.ts
    intake-submission.repository.ts
  services/
    invitation-project.service.ts
    intake-request.service.ts
    intake-submission.service.ts
    intake-token.service.ts

src/pages/
  captura/[token].astro
  api/captura/[token].ts
  api/dashboard/intake/index.ts
  api/dashboard/intake/[id]/index.ts
  api/dashboard/intake/[id]/request.ts
  api/dashboard/intake/[id]/request/regenerate-token.ts
  api/dashboard/intake/[id]/review.ts
  dashboard/invitaciones.astro
  dashboard/invitaciones/[id].astro
  dashboard/invitaciones/[id]/review.astro

src/components/
  intake/
    IntakeForm.tsx
    IntakeStepNav.tsx
    IntakeSummary.tsx
    blocks/
      EventDetailsBlock.tsx
      MainPeopleBlock.tsx
      DateLocationsBlock.tsx
      PhotosBlock.tsx
      RsvpConfigBlock.tsx
      MusicBlock.tsx
      GiftsBlock.tsx
      SpecialMessagesBlock.tsx
  dashboard/intake/
    InvitationList.tsx
    InvitationDetail.tsx
    DemoSelector.tsx
    BlockSelector.tsx
    IntakeLinkPanel.tsx
    SubmissionReview.tsx

src/hooks/
  use-intake-form.ts
  use-invitation-admin.ts

src/styles/
  dashboard/_intake.scss
  intake/_intake-form.scss

src/lib/dashboard/dto/
  intake.ts

supabase/migrations/
  <timestamp>_intake_core.sql
```

### Modified Files

| File                                | Change                                              |
| ----------------------------------- | --------------------------------------------------- |
| `src/lib/dashboard/admin-api.ts`    | Add intake methods                                  |
| `src/layouts/DashboardLayout.astro` | Add nav link                                        |
| `src/middleware.ts`                 | Add `/dashboard/invitaciones` to `ADMIN_ONLY_PATHS` |
| `src/lib/server/email.ts`           | Add intake notification function                    |
| `src/env.d.ts`                      | Add `INTAKE_TOKEN_EXPIRY_DAYS` (optional)           |

### Files That Must Not Change

- Any file under `src/content/` (content collections remain untouched).
- `src/content.config.ts` (no new collections).
- `src/lib/adapters/event.ts` (existing adapter unchanged).
- `src/lib/adapters/types.ts` (existing view model unchanged).
- `src/lib/theme/theme-contract.ts` (no new presets or section keys).
- `src/lib/assets/asset-registry.ts` (no new asset keys).
- Any existing Supabase migration file.
- Any existing RSVP repository or service.

## 11. Verification Commands

```bash
# After each phase:
pnpm type-check
pnpm lint
pnpm lint:styles

# After Phase 1.2:
pnpm db:local:validate

# After Phase 1.4 and beyond:
pnpm build

# Unit tests:
pnpm test -- tests/intake/
```

## 12. Risks and Mitigations

| Risk                                         | Severity | Mitigation                                                                                                                                     |
| -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Token brute-force                            | Low      | 256-bit tokens. Rate limiting via existing `checkRateLimit()` with `'intake'` namespace (falls back to in-memory when Upstash is unavailable). |
| Token leakage via logs                       | Medium   | Never log raw tokens. Log only project ID and request ID.                                                                                      |
| Client submission data loss                  | Medium   | Per-step auto-save. DB is the single source of truth.                                                                                          |
| Vercel 30s timeout on form save              | Low      | Each step save is a lightweight JSON patch, well under 30s.                                                                                    |
| Block schema drift from content schema       | Medium   | Each block defines `mapToContent()` targeting `eventContentSchema`. Validate in tests.                                                         |
| Admin session expiry during review           | Low      | Reuse existing session refresh logic from middleware.                                                                                          |
| Demo catalog changes break existing projects | Low      | Snapshot at creation time. Catalog changes are forward-only.                                                                                   |
| Supabase REST client errors                  | Low      | Reuse existing error handling pattern from `src/lib/rsvp/repositories/supabase-errors.ts`.                                                     |

## 13. Rollback Strategy

### Per-Phase Rollback

- **Phase 1.1**: Delete `src/lib/intake/` directory. No side effects.
- **Phase 1.2**: Drop the three new tables. No existing tables affected.
- **Phase 1.3**: Delete new API routes. Revert `admin-api.ts` changes.
- **Phase 1.4**: Delete new dashboard pages and components. Revert `DashboardLayout.astro` and
  `middleware.ts`.
- **Phase 1.5**: Delete `/captura/` route and intake components. No existing routes affected.
- **Phase 1.6**: Delete review page and API. No existing routes affected.
- **Phase 1.7**: Revert `email.ts` changes.

### Full Release 1 Rollback

1. Delete all files under `src/lib/intake/`, `src/components/intake/`,
   `src/components/dashboard/intake/`, `src/pages/captura/`, `src/pages/api/captura/`,
   `src/pages/api/dashboard/intake/`, `src/pages/dashboard/invitaciones*`.
2. Revert changes to `admin-api.ts`, `DashboardLayout.astro`, `middleware.ts`, `email.ts`.
3. Drop `invitation_projects`, `intake_requests`, `intake_submissions` tables.
4. Remove intake-related hooks and styles.

## 14. Open Questions

| #   | Question                                                                             | Impact              | Default if Unanswered                                          |
| --- | ------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------- |
| 1   | Should the intake form require a CAPTCHA or honeypot?                                | Security            | Add honeypot field (lightweight, no external dependency).      |
| 2   | Should the admin see a preview of the intake form before activating?                 | UX                  | Yes, render a read-only preview in the detail page.            |
| 3   | ~~Should `invitation_projects` have a `slug` field for future DB-driven rendering?~~ | ~~Future-proofing~~ | **Decided**: Yes, optional `slug` field added in Phase 1.2.    |
| 4   | Should the intake form support a "save and continue later" email link?               | UX                  | Defer to post-MVP. Token link is persistent until expiry.      |
| 5   | Should block order be configurable by admin, or fixed by the catalog?                | UX                  | Fixed by catalog in MVP. Admin can only enable/disable blocks. |

## 15. Completion Tracking

| Phase                                 | Status    | Completed  |
| ------------------------------------- | --------- | ---------- |
| 1.1 Types, Schemas, Catalog           | Completed | 2026-05-28 |
| 1.2 Database Migration                | Completed | 2026-05-28 |
| 1.3 Admin API + Services              | Completed | 2026-05-28 |
| 1.4 Admin UI                          | Completed | 2026-05-28 |
| 1.5 Client Intake Form                | Completed | 2026-05-28 |
| 1.6 Admin Review                      | Completed | 2026-05-28 |
| 1.7 Notifications                     | Completed | 2026-05-28 |
| 2.1 Approved Submission → Draft       | Completed | 2026-05-28 |
| 2.2 Draft Review Page                 | Completed | 2026-05-28 |
| 2.3 Draft Editing UI                  | Completed | 2026-05-28 |
| 2.3.1 Data Integrity Fix Pass         | Completed | 2026-05-28 |
| 2.4 Draft Approval / Publishing       | Completed | 2026-05-28 |
| 3.1 Published Content + DB Adapter    | Completed | 2026-05-28 |
| 3.2 Unified Content Resolution        | Completed | 2026-05-28 |
| 3.3 Proof of Concept Migration        | Completed | 2026-05-28 |
| 3.4 Public DB Rendering POC           | Completed | 2026-05-28 |
| 3.4 Hardening (eventType-safe + RSVP) | Completed | 2026-05-28 |
| 3.4 Runtime QA + Asset Resolution     | Completed | 2026-05-29 |
| 3.4 Full Migration                    | Completed | 2026-05-29 |

## 16. Release 1.x Known Limitations

### Non-Atomic Multi-Write Status Transitions

The client submit endpoint (`POST /api/captura/[token]`) performs three sequential writes:

1. `intake_submissions.status → submitted`
2. `intake_requests.status → submitted`
3. `invitation_projects.status → client_submitted`

The admin review endpoints (`POST /api/dashboard/intake/[id]/review`) perform two sequential writes
for each action:

- **Approve**: `intake_submissions.status → approved`, then
  `invitation_projects.status → in_production`
- **Request changes**: `intake_submissions.status → needs_changes`, then
  `invitation_projects.status → waiting_for_client`, then `intake_requests.status → active`

If any write in the sequence fails, the system is left in a partially-transitioned state. There is
no compensating rollback or DB-level transaction. The next read of the affected entities will
surface whichever writes succeeded.

**Mitigation**: Each write uses the same Supabase REST client and target the same DB region, so
partial failures are rare. A reconciliation/admin action can fix inconsistent states. Full atomicity
via a Supabase RPC/transaction is deferred post-MVP.

### Review GET Side Effect (Lock-on-Read)

Opening the admin review page (`GET /api/dashboard/intake/[id]/review`) transitions
`invitation_projects.status` from `client_submitted` to `in_review` as a side effect. This instantly
locks the client out of editing. There is no explicit "Start review" action — merely viewing the
page triggers the lock.

**Rationale**: This is intentional for Release 1.x. An admin opening the review page signals intent
to review, and the lock prevents concurrent edits. Future releases may introduce an explicit "Start
review" POST action for clarity.
