import type { APIContext } from 'astro';
import { PATCH as updateEvent } from '@/pages/api/dashboard/admin/events/[eventId]';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { EventRow } from '@/lib/rsvp/repositories/shared/rows';
import { UpdateEventSchema } from '@/lib/schemas';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

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

function patchBodies(): unknown[] {
	return rest.mock.calls
		.map(([options]) => options)
		.filter((options) => options.method === 'PATCH')
		.map((options) => options.body);
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
		rest.mockImplementation(async (options) => {
			if (options.method === 'PATCH') {
				return [{ ...STORED_EVENT, ...(options.body as Partial<EventRow>) }] as never;
			}
			return [{ ...STORED_EVENT, invitations: null }] as never;
		});
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

	it('accepts _version without changing the written fields', async () => {
		const response = await updateEvent(
			patchContext({ status: 'archived', _version: STORED_EVENT.updated_at }),
		);

		expect(response.status).toBe(200);
		expect(patchBodies()).toEqual([{ status: 'archived' }]);
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
