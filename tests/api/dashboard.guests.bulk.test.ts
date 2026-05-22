import { POST } from '@/pages/api/dashboard/guests/bulk';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { supabaseRestRequest, type SupabaseRequestOptions } from '@/lib/rsvp/repositories/supabase';
import { findEventById, findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { createMockRequest } from '../helpers/api-mocks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireHostSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventById: jest.fn(),
	findEventByIdService: jest.fn(),
}));

const requireHostSessionMock = requireHostSession as jest.MockedFunction<typeof requireHostSession>;
const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;
const findEventByIdMock = findEventById as jest.MockedFunction<typeof findEventById>;
const findEventByIdServiceMock = findEventByIdService as jest.MockedFunction<
	typeof findEventByIdService
>;

const TEST_EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_EVENT = {
	id: TEST_EVENT_ID,
	ownerUserId: 'host-1',
	slug: 'test-event',
	eventType: 'xv' as const,
	title: 'Test Event',
	status: 'published' as const,
	publishedAt: null,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

function mockEventAccess() {
	findEventByIdMock.mockResolvedValue(MOCK_EVENT);
}

function mockNoEvent() {
	findEventByIdMock.mockResolvedValue(null);
	findEventByIdServiceMock.mockResolvedValue(null);
}

function mockUnauthorizedAccess() {
	findEventByIdMock.mockResolvedValue(null);
	findEventByIdServiceMock.mockResolvedValue(MOCK_EVENT);
}

function buildRequest(guests: unknown[]) {
	return POST({
		request: createMockRequest({
			eventId: TEST_EVENT_ID,
			guests,
		}),
	} as never);
}

describe('POST /api/dashboard/guests/bulk', () => {
	beforeEach(() => {
		requireHostSessionMock.mockResolvedValue({
			userId: 'host-1',
			email: 'host@test.com',
			accessToken: 'token',
		});
		supabaseRestRequestMock.mockReset();
		findEventByIdMock.mockReset();
		findEventByIdServiceMock.mockReset();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('valid rows', () => {
		it('accepts guest with local phone and country code', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.data.created).toBe(1);
			expect(body.data.updated).toBe(0);
			expect(body.message).toContain('correctamente');
		});

		it('accepts guest with international phone and no country code', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([{ full_name: 'Carlos', phone: '+526691234567' }]);

			expect(response.status).toBe(200);
		});

		it('accepts guest with international phone and matching country code', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Carlos', phone: '+526691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(200);
		});

		it('accepts guest without phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([{ full_name: 'Invitado Sin Teléfono' }]);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.data.created).toBe(1);
		});

		it('surfaces normalized phone conflicts without reporting updates', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 0,
				updated: 0,
				skipped: 0,
				conflicts: 1,
				errors: ['Fila 1: el teléfono ya existe para este evento.'],
				status: 'partial',
			});

			const response = await buildRequest([
				{ full_name: 'Ana Duplicada', phone: '6691234567', country_code: '+52' },
			]);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.data).toEqual(
				expect.objectContaining({
					created: 0,
					updated: 0,
					conflicts: 1,
					status: 'partial',
				}),
			);
			expect(body.data.errors[0]).toContain('teléfono');
		});

		it('accepts guest with US phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'John Smith', phone: '5551234567', country_code: '+1' },
			]);

			expect(response.status).toBe(200);
		});

		it('accepts guest with formatted US phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'John Smith', phone: '555-123-4567', country_code: '+1' },
			]);

			expect(response.status).toBe(200);
		});

		it('accepts guest with Spanish phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'María García', phone: '612345678', country_code: '+34' },
			]);

			expect(response.status).toBe(200);
		});
	});

	describe('mixed valid payload', () => {
		it('accepts mixed payload: some guests with phone+country_code, some without phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 3,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{
					full_name: 'tist',
					phone: '6563769461',
					country_code: '+52',
					email: null,
					tags: [],
				},
				{ full_name: 'tist1', email: null, tags: [] },
				{
					full_name: 'tist2',
					phone: '6681167477',
					country_code: '+52',
					email: null,
					tags: [],
				},
				{ full_name: 'tist3', email: null, tags: [] },
				{ full_name: 'tist4', email: null, tags: [] },
			]);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.data.status).toBe('success');
		});

		it('accepts mixed payload with international phone and no-country-code guests', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 2,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Carlos', phone: '+526691234567' },
				{ full_name: 'María', email: null, tags: [] },
			]);

			expect(response.status).toBe(200);
		});

		it('allows member/manager to import mixed payload', async () => {
			findEventByIdMock.mockResolvedValue(MOCK_EVENT);
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 3,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana', phone: '6691234567', country_code: '+52' },
				{ full_name: 'Luis', email: null },
				{ full_name: 'Sofía', phone: '+526691234567', email: null, tags: ['vip'] },
			]);

			expect(response.status).toBe(200);
		});

		it('allows super_admin to import mixed payload', async () => {
			findEventByIdMock.mockResolvedValue(MOCK_EVENT);
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 2,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Admin Test', phone: '5551234567', country_code: '+1' },
				{ full_name: 'No Phone Guest' },
			]);

			expect(response.status).toBe(200);
		});
	});

	describe('invalid rows', () => {
		function getRowErrors(body: Record<string, unknown>): string[] {
			const err = body.error as Record<string, unknown> | undefined;
			const det = err?.details as Record<string, unknown> | undefined;
			const rows = det?.rows as string[] | undefined;
			return rows ?? [];
		}

		it('rejects local phone without country code', async () => {
			mockEventAccess();

			const response = await buildRequest([{ full_name: 'Ana López', phone: '6691234567' }]);
			const body = await response.json();

			expect(response.status).toBe(400);
			const errors = getRowErrors(body);
			expect(errors[0]).toContain('Fila 1');
			expect(errors[0]).toContain('código de país');
		});

		it('rejects formatted local phone without country code', async () => {
			mockEventAccess();

			const response = await buildRequest([
				{ full_name: 'John Smith', phone: '555-123-4567' },
			]);
			const body = await response.json();

			expect(response.status).toBe(400);
			const errors = getRowErrors(body);
			expect(errors[0]).toContain('Fila 1');
		});

		it('rejects international phone with conflicting country code', async () => {
			mockEventAccess();

			const response = await buildRequest([
				{ full_name: 'Carlos', phone: '+526691234567', country_code: '+1' },
			]);
			const body = await response.json();

			expect(response.status).toBe(400);
			const errors = getRowErrors(body);
			expect(errors[0]).toContain('no coincide');
		});

		it('collects multiple row errors', async () => {
			mockEventAccess();

			const response = await buildRequest([
				{ full_name: 'Ana', phone: '6691234567' },
				{ full_name: 'Juan', phone: '5551234567' },
			]);
			const body = await response.json();

			expect(response.status).toBe(400);
			const errors = getRowErrors(body);
			expect(errors[0]).toContain('Fila 1');
			expect(errors[1]).toContain('Fila 2');
		});

		it('rejects empty name', async () => {
			const response = await buildRequest([
				{ full_name: '', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(400);
		});
	});

	describe('RPC payload integrity', () => {
		function getRpcBody() {
			const args = supabaseRestRequestMock.mock.calls[0] as [SupabaseRequestOptions];
			return args[0].body as { p_guests: Array<Record<string, unknown>> };
		}

		const KNOWN_RPC_KEYS = ['full_name', 'phone', 'email', 'tags', 'max_allowed_attendees'];

		it('sends only known RPC columns (no phone_e164 or other unknowns)', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([
				{
					full_name: 'Ana López',
					phone: '6691234567',
					country_code: '+52',
					email: 'ana@test.com',
					tags: ['vip'],
				},
			]);

			const body = getRpcBody();
			const guestKeys = Object.keys(body.p_guests[0]).sort();
			expect(guestKeys).toEqual(KNOWN_RPC_KEYS.sort());
		});

		it('excludes country_code from RPC payload', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			const body = getRpcBody();
			expect(body.p_guests[0]).not.toHaveProperty('country_code');
		});

		it('sends only known columns even when guest has no phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Sin Teléfono' }]);

			const body = getRpcBody();
			const guestKeys = Object.keys(body.p_guests[0]).sort();
			expect(guestKeys).toEqual(KNOWN_RPC_KEYS.sort());
		});

		it('sends only known columns for mixed payload', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 3,
				updated: 0,
				status: 'success',
			});

			await buildRequest([
				{
					full_name: 'tist',
					phone: '6563769461',
					country_code: '+52',
					email: null,
					tags: [],
				},
				{ full_name: 'tist1', email: null, tags: [] },
				{
					full_name: 'tist2',
					phone: '6681167477',
					country_code: '+52',
					email: null,
					tags: [],
				},
			]);

			const body = getRpcBody();
			for (const guest of body.p_guests) {
				const guestKeys = Object.keys(guest).sort();
				expect(guestKeys).toEqual(KNOWN_RPC_KEYS.sort());
			}
		});
	});

	describe('phone normalization', () => {
		function getRpcBody() {
			const args = supabaseRestRequestMock.mock.calls[0] as [SupabaseRequestOptions];
			return args[0].body as { p_guests: Array<{ phone: string }> };
		}

		it('preserves correctly normalized phone', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(200);

			const body = getRpcBody();
			expect(body.p_guests[0].phone).toBe('+526691234567');
		});

		it('normalizes Mexican phone correctly', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Ana', phone: '6691234567', country_code: '+52' }]);

			const body = getRpcBody();
			expect(body.p_guests[0].phone).toBe('+526691234567');
		});

		it('preserves international phone without country code', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Carlos', phone: '+526691234567' }]);

			const body = getRpcBody();
			expect(body.p_guests[0].phone).toBe('+526691234567');
		});

		it('passes empty phone for guest without phone number', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Sin Teléfono' }]);

			const body = getRpcBody();
			expect(body.p_guests[0].phone).toBe('');
		});
	});

	describe('bulk RPC SQL contract', () => {
		it('keeps the latest bulk RPC migration create-only', () => {
			const migration = readFileSync(
				join(
					process.cwd(),
					'supabase/migrations/20260522000001_make_bulk_guests_create_only.sql',
				),
				'utf8',
			).toLowerCase();

			expect(migration).toContain('create or replace function public.upsert_guests_v1');
			expect(migration).toContain('on conflict (event_id, phone)');
			expect(migration).toContain('do nothing');
			expect(migration).not.toContain('do update set');
		});
	});

	describe('authorization', () => {
		it('allows event owner to import', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(200);
		});

		it('allows event member/manager to import', async () => {
			findEventByIdMock.mockResolvedValue(MOCK_EVENT);
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(200);
		});

		it('allows super_admin to import', async () => {
			findEventByIdMock.mockResolvedValue(MOCK_EVENT);
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(200);
		});

		it('denies import when event exists but user has no access', async () => {
			mockUnauthorizedAccess();

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(403);
			const body = await response.text();
			expect(body).toContain('Event not found or access denied.');
		});

		it('returns 404 when event does not exist', async () => {
			mockNoEvent();

			const response = await buildRequest([
				{ full_name: 'Ana López', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(404);
		});
	});

	describe('access parity with guest CRUD', () => {
		it('uses findEventById (RLS-based) for access check', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Ana', phone: '6691234567', country_code: '+52' }]);

			expect(findEventByIdMock).toHaveBeenCalledWith(TEST_EVENT_ID, 'token');
		});

		it('does not call findEventByIdService when access is granted', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockResolvedValueOnce({
				created: 1,
				updated: 0,
				status: 'success',
			});

			await buildRequest([{ full_name: 'Ana', phone: '6691234567', country_code: '+52' }]);

			expect(findEventByIdServiceMock).not.toHaveBeenCalled();
		});
	});

	describe('Supabase error handling', () => {
		it('returns 400 for Supabase 400 errors (bad request/data shape)', async () => {
			mockEventAccess();
			const supabaseError = new Error(
				'Supabase error (400): {"code":"42703","message":"column "phone_e164" does not exist"}',
			);
			supabaseRestRequestMock.mockRejectedValueOnce(supabaseError);

			const response = await buildRequest([
				{ full_name: 'Ana', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(400);
		});

		it('returns 500 for Supabase 5xx errors', async () => {
			mockEventAccess();
			const supabaseError = new Error(
				'Supabase error (500): {"code":"internal","message":"Internal server error"}',
			);
			supabaseRestRequestMock.mockRejectedValueOnce(supabaseError);

			const response = await buildRequest([
				{ full_name: 'Ana', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(500);
		});

		it('returns 500 for non-Supabase errors', async () => {
			mockEventAccess();
			supabaseRestRequestMock.mockRejectedValueOnce(new Error('Network failure'));

			const response = await buildRequest([
				{ full_name: 'Ana', phone: '6691234567', country_code: '+52' },
			]);

			expect(response.status).toBe(500);
		});
	});
});
