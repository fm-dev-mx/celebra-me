---
name: backend-engineering
description:
    Standardize the development of server-side logic, API routes, data validation, and external
    service integration (Supabase, Email) for Celebra-me.
domain: backend
when_to_use:
    - Updating API routes, services, repositories, or server-side validation
    - Reviewing external integrations or server-only code paths
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - API handlers, service layers, repositories, schemas, and integration code
outputs:
    - Layer-safe backend guidance and implementation constraints
related_docs:
    - docs/core/architecture.md
    - docs/domains/rsvp/architecture.md
    - docs/domains/rsvp/database.md
---

# Backend Engineering

> **Related skills**: [`astro-patterns`](../astro-patterns/SKILL.md) for data fetching in unrelated
> components.

This skill governs **server-side engineering** in Celebra-me. It applies to API routes
(`src/pages/api/*`), Service layers (`src/lib/*/service.ts`), and Repository layers
(`src/lib/*/repository.ts`).

## Architecture Layers

Strictly separate concerns into these three layers:

### 1. API Layer (`src/pages/api/`)

- **Responsibility**: HTTP handling, request parsing, response formatting.
- **Rules**:
    - No business logic here.
    - Validate inputs using Zod or sanitization helpers immediately.
    - Catch errors and return standardized JSON responses.
    - Use `APIRoute` type from Astro.

```typescript
// src/pages/api/example.ts
import type { APIRoute } from 'astro';
import { doSomething } from '@/lib/domain/service';

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		// 1. Validate
		if (!body.email) throw new Error('Email required');

		// 2. Delegate to Service
		const result = await doSomething(body);

		// 3. Respond
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		// 4. Handle Error
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
			{ status: 400 },
		);
	}
};
```

### 2. Service Layer (`src/lib/*/service.ts`)

- **Responsibility**: Business logic, orchestration, validation rules, side effects (email).
- **Rules**:
    - Pure TypeScript functions (no Astro dependencies).
    - Accepts DTOs, returns DTOs (decoupled from DB structure).
    - Throws typed Errors for logic failures.
    - Sanitizes all inputs before passing to Repository.

```typescript
// src/lib/rsvp/service.ts
export async function submitRsvp(input: RsvpDTO): Promise<ConfirmationDTO> {
	const safeInput = sanitizeRsvp(input); // Sanitize

	// Logic
	if (safeInput.guests > 5) throw new Error('Max guests exceeded');

	// DB interaction via Repository
	const record = await repository.saveRsvp(safeInput);

	// Side effect
	await sendConfirmationEmail(record.email);

	return toDto(record); // Normalize output
}
```

### 3. Repository Layer (`src/lib/*/repository.ts`)

- **Responsibility**: Database access, SQL/Supabase queries, data mapping.
- **Rules**:
    - Sole place where `supabase` client is used.
    - Returns Data Models (Matches DB schema).
    - Handles RLS context (passing `accessToken` methods).

## Data Validation & Sanitization

### Runtime Sanitization

Use helper functions to ensure data integrity before processing.

```typescript
// Standard patterns
function sanitize(val: unknown, maxLen = 500): string {
	if (typeof val !== 'string') return '';
	return val.trim().slice(0, maxLen);
}

function normalizePhone(phone: string): string {
	return sanitize(phone, 20).replace(/[^\d+]/g, '');
}
```

### Schema Validation (Zod)

For complex inputs, prefer `zod`.

```typescript
import { z } from 'zod';

const RsvpSchema = z.object({
	email: z.string().email(),
	attendees: z.number().int().min(1).max(10),
});
```

## Supabase Integration

### `supabaseRestRequest` Pattern

Use the typed wrapper for Rest calls to ensure type safety and handle auth headers.

```typescript
import { supabaseRestRequest } from './supabase';

export async function findEvent(id: string, token: string) {
	const rows = await supabaseRestRequest<EventRow[]>({
		pathWithQuery: `events?id=eq.${id}&select=*`,
		authToken: token,
		// useServiceRole: true // ONLY for public/admin bypass
	});
	return rows[0] || null;
}
```

## Error Handling Standards

All API responses must follow this shape when possible, or standard HTTP codes.

### Success (200/201)

```json
{
    "data": { ... },
    "meta": { ... } // Optional
}
```

### Error (4xx/5xx)

```json
{
	"error": "Human readable message",
	"code": "ERROR_CODE" // Optional
}
```

## Anti-Patterns

- ❌ **Logic in API Routes**: Don't query the DB directly in `src/pages/api`.
- ❌ **Leaking DB Rows**: Always map DB rows to DTOs in the Service layer.
- ❌ **Trusting Client Input**: Never use `request.json()` content without sanitization.
- ❌ **Service Role Abuse**: Use `useServiceRole: true` ONLY when RLS cannot solve the problem
  (e.g., initial guest lookup by generic token).
