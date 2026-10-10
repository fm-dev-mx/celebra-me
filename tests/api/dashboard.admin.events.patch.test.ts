import type { APIContext } from 'astro';
import { PATCH as updateEvent } from '@/pages/api/dashboard/admin/events/[eventId]';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { EventRow } from '@/lib/rsvp/repositories/shared/rows';
import { UpdateEventSchema } from '@/lib/schemas';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	...jest.requireActual('@/lib/rsvp/repositories/supabase'),
	supabaseRestRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

const auth = jest.mocked(requireAdminMutationAccess);
const rest = jest.mocked(supabaseRestRequest);

const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const STORED_EVENT: EventRow = {
	id: EVENT_ID,
	owner_user_id: '550e8400-e29b-41d4-a716-446655440001',
	slug: 'daniela-y-martin',
	event_type: 'boda',
	title: 'Boda de Daniela y Martín',
	status: 'published',
	published_at: '2026-09-01T00:00:00.000Z',
	invitation_project_id: null,
	created_at: '2026-08-01T00:00:00.000Z',
	updated_at: '2026-09-01T00:00:00.000Z',
};
const INVITATION_ID = '550e8400-e29b-41d4-a716-446655440002';
// PostgREST serializes timestamptz with an explicit offset and microseconds.
const POSTGREST_UPDATED_AT = '2026-09-01T00:00:00.123456+00:00';

let storedEvent: EventRow;

function patchContext(payload: unknown): APIContext {
	return {
		params: { eventId: EVENT_ID },
		request: createMockRequest(
			payload,
			undefined,
			`http://localhost/api/dashboard/admin/events/${EVENT_ID}`,
		),
		cookies: {},
	} as unknown as APIContext;
}

function patchCalls() {
	return rest.mock.calls
		.map(([options]) => options)
		.filter((options) => options.method === 'PATCH');
}

function patchBodies(): unknown[] {
	return patchCalls().map((options) => options.body);
}

/** Mirrors PostgREST: a PATCH filtered by a stale `updated_at` matches no rows. */
function mockEventsTable() {
	rest.mockImplementation(async (options) => {
		if (options.method === 'PATCH') {
			const query = new URLSearchParams(options.pathWithQuery.split('?')[1]);
			const versionFilter = query.get('updated_at');
			if (versionFilter !== null && versionFilter !== `eq.${storedEvent.updated_at}`) {
				return [] as never;
			}
			return [{ ...storedEvent, ...(options.body as Partial<EventRow>) }] as never;
		}
		const invitations = storedEvent.invitation_project_id ? { archived_at: null } : null;
		return [{ ...storedEvent, invitations }] as never;
	});
}

describe('UpdateEventSchema', () => {
	it('does not fill omitted fields with create defaults', () => {
		expect(UpdateEventSchema.parse({ status: 'archived' })).toEqual({ status: 'archived' });
		expect(UpdateEventSchema.parse({ title: 'Nuevo título' })).toEqual({
			title: 'Nuevo título',
		});
	});

	it('rejects whitespace-only titles, unknown keys and empty updates', () => {
		expect(UpdateEventSchema.safeParse({ title: '   ' }).success).toBe(false);
		expect(UpdateEventSchema.safeParse({ status: 'archived', location: 'x' }).success).toBe(
			false,
		);
		expect(UpdateEventSchema.safeParse({}).success).toBe(false);
		expect(
			UpdateEventSchema.safeParse({ status: 'archived', _version: '2026-09-01' }).success,
		).toBe(false);
		expect(UpdateEventSchema.safeParse({ _version: '2026-09-01T00:00:00.000Z' }).success).toBe(
			false,
		);
	});
});

describe('PATCH /api/dashboard/admin/events/[eventId] partial updates', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		auth.mockResolvedValue({
			userId: STORED_EVENT.owner_user_id,
			email: 'admin@test.com',
			accessToken: 'token',
			role: 'super_admin',
			isSuperAdmin: true,
		});
		storedEvent = { ...STORED_EVENT };
		mockEventsTable();
	});

	it('archiving writes only status and keeps the stored title', async () => {
		const response = await updateEvent(patchContext({ status: 'archived' }));

		expect(response.status).toBe(200);
		expect(patchBodies()).toEqual([{ status: 'archived' }]);
		const body = await response.json();
		expect(body.item).toMatchObject({
			title: STORED_EVENT.title,
			slug: STORED_EVENT.slug,
			status: 'archived',
		});
	});

	it('renaming writes only title and keeps the stored status', async () => {
		const response = await updateEvent(patchContext({ title: 'Boda D&M' }));

		expect(response.status).toBe(200);
		expect(patchBodies()).toEqual([{ title: 'Boda D&M' }]);
		const body = await response.json();
		expect(body.item).toMatchObject({ title: 'Boda D&M', status: 'published' });
	});

	it.each([
		['a Z timestamp', STORED_EVENT.updated_at],
		['the PostgREST offset format', POSTGREST_UPDATED_AT],
	])(
		'applies a current _version (%s) as an atomic updated_at filter',
		async (_label, version) => {
			storedEvent = { ...STORED_EVENT, updated_at: version };

			const response = await updateEvent(
				patchContext({ status: 'archived', _version: version }),
			);

			expect(response.status).toBe(200);
			expect(patchBodies()).toEqual([{ status: 'archived' }]);
			expect(patchCalls()[0]?.pathWithQuery).toContain(
				`updated_at=eq.${encodeURIComponent(version)}`,
			);
		},
	);

	it('rejects a stale _version with 409', async () => {
		storedEvent = { ...STORED_EVENT, updated_at: '2026-09-02T00:00:00.000Z' };

		const response = await updateEvent(
			patchContext({ status: 'archived', _version: STORED_EVENT.updated_at }),
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error.code).toBe('conflict');
	});

	it('updates without a version filter when _version is omitted', async () => {
		await updateEvent(patchContext({ status: 'archived' }));

		expect(patchCalls()[0]?.pathWithQuery).not.toContain('updated_at=');
	});

	it.each([
		['slug', { slug: 'otro-slug' }],
		['eventType', { eventType: 'xv' }],
	])('rejects a %s change on an invitation-linked event with 409', async (_label, payload) => {
		storedEvent = { ...STORED_EVENT, invitation_project_id: INVITATION_ID };

		const response = await updateEvent(patchContext(payload));

		expect(response.status).toBe(409);
		expect(patchBodies()).toEqual([]);
	});

	it('allows status and unchanged slug on an invitation-linked event', async () => {
		storedEvent = { ...STORED_EVENT, invitation_project_id: INVITATION_ID };

		const response = await updateEvent(
			patchContext({ status: 'archived', slug: STORED_EVENT.slug, eventType: 'boda' }),
		);

		expect(response.status).toBe(200);
		expect(patchBodies()).toEqual([
			{ status: 'archived', slug: STORED_EVENT.slug, event_type: 'boda' },
		]);
	});

	it('maps a duplicate slug to 409 instead of 500', async () => {
		rest.mockImplementation(async (options) => {
			if (options.method === 'PATCH') {
				throw new SupabaseHttpError(409, JSON.stringify({ code: '23505' }), '23505');
			}
			return [{ ...storedEvent, invitations: null }] as never;
		});

		const response = await updateEvent(patchContext({ slug: 'slug-ocupado' }));

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error.message).toBe('Ya existe otro evento con ese slug.');
	});

	it.each([
		['an empty body', {}],
		['a whitespace-only title', { title: '   ' }],
		['an unknown field', { status: 'archived', location: 'Salón' }],
	])('rejects %s with 400 and writes nothing', async (_label, payload) => {
		const response = await updateEvent(patchContext(payload));

		expect(response.status).toBe(400);
		expect(patchBodies()).toEqual([]);
	});
});
