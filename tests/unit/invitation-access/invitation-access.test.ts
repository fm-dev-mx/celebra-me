import {
	MISSING_INVITATION_ACCESS,
	isInvitationPubliclyDisabled,
	parseInvitationAccessRow,
	resolvePublicInvitationMode,
} from '@/lib/invitation/access/invitation-access';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	findEventInvitationAccess,
	isEventInvitationUnavailable,
	readEmbeddedInvitationAccess,
} from '@/lib/invitation/access/invitation-access.repository';

const mockSupabaseRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('invitation access policy', () => {
	it('renders paid invitations live and unpaid ones as preview', () => {
		expect(
			resolvePublicInvitationMode({ paymentStatus: 'paid', publicAccess: 'enabled' }),
		).toBe('live');
		expect(
			resolvePublicInvitationMode({ paymentStatus: 'unpaid', publicAccess: 'enabled' }),
		).toBe('preview');
	});

	it('treats only an explicit disabled value as disabled', () => {
		expect(
			isInvitationPubliclyDisabled({ paymentStatus: 'paid', publicAccess: 'disabled' }),
		).toBe(true);
		expect(isInvitationPubliclyDisabled(MISSING_INVITATION_ACCESS)).toBe(false);
	});

	it('falls back to the unpaid preview, never the clean invitation', () => {
		expect(resolvePublicInvitationMode(MISSING_INVITATION_ACCESS)).toBe('preview');
		expect(Object.isFrozen(MISSING_INVITATION_ACCESS)).toBe(true);
	});

	it.each([
		[{ payment_status: 'paid', public_access: 'enabled' }],
		[[{ payment_status: 'paid', public_access: 'enabled' }]],
	])('parses the embedded row %#', (row) => {
		expect(parseInvitationAccessRow(row)).toEqual({
			paymentStatus: 'paid',
			publicAccess: 'enabled',
		});
	});

	it.each([null, undefined, [], 'paid', { payment_status: 'free', public_access: 'enabled' }])(
		'rejects unusable rows (%p)',
		(row) => {
			expect(parseInvitationAccessRow(row)).toBeNull();
		},
	);
});

describe('invitation access repository', () => {
	beforeEach(() => jest.clearAllMocks());

	it('reads the access state nested under the invitation relation', () => {
		expect(
			readEmbeddedInvitationAccess({
				invitation: [{ access: { payment_status: 'unpaid', public_access: 'disabled' } }],
			}),
		).toEqual({ paymentStatus: 'unpaid', publicAccess: 'disabled' });
		expect(readEmbeddedInvitationAccess({ invitation: null })).toBeNull();
		expect(readEmbeddedInvitationAccess(undefined)).toBeNull();
	});

	it('looks up an event invitation access with the service role in one read', async () => {
		mockSupabaseRequest.mockResolvedValue([
			{ invitation: { access: { payment_status: 'paid', public_access: 'disabled' } } },
		]);

		await expect(findEventInvitationAccess('event-1')).resolves.toEqual({
			paymentStatus: 'paid',
			publicAccess: 'disabled',
		});
		expect(mockSupabaseRequest).toHaveBeenCalledTimes(1);
		const [request] = mockSupabaseRequest.mock.calls[0];
		expect(request.useServiceRole).toBe(true);
		expect(request.pathWithQuery).toContain('events?select=invitation:invitations(');
		expect(request.pathWithQuery).toContain('id=eq.event-1');
	});

	it('reports disabled only for an explicit disabled row', async () => {
		mockSupabaseRequest.mockResolvedValueOnce([
			{ invitation: { access: { payment_status: 'unpaid', public_access: 'disabled' } } },
		]);
		await expect(isEventInvitationUnavailable('event-1')).resolves.toBe(true);
		expect(mockSupabaseRequest).toHaveBeenCalledTimes(1);

		mockSupabaseRequest.mockResolvedValueOnce([{ invitation: null }]);
		await expect(isEventInvitationUnavailable('event-2')).resolves.toBe(false);

		mockSupabaseRequest.mockResolvedValueOnce([]);
		await expect(isEventInvitationUnavailable('event-3')).resolves.toBe(false);
	});

	const enabledEvent = {
		invitation_project_id: 'inv-1',
		invitation: { access: { payment_status: 'paid', public_access: 'enabled' } },
	};
	const timing = (localDateTime: string) => ({
		is_demo: false,
		eventTiming: { localDateTime, timeZone: 'America/Mazatlan' },
		heroDate: null,
	});

	it('reports an enabled invitation past its validity window as unavailable', async () => {
		mockSupabaseRequest
			.mockResolvedValueOnce([enabledEvent])
			.mockResolvedValueOnce([timing('2025-10-01T18:00')]);
		await expect(
			isEventInvitationUnavailable('event-1', new Date('2026-10-13T12:00:00Z')),
		).resolves.toBe(true);
		const [request] = mockSupabaseRequest.mock.calls[1];
		expect(request.useServiceRole).toBe(true);
		expect(request.pathWithQuery).toContain('published_invitation_content?select=is_demo,');
		expect(request.pathWithQuery).toContain('invitation_project_id=eq.inv-1');
		expect(request.pathWithQuery).toContain('deleted_at=is.null');
	});

	it('keeps an enabled invitation inside its window, a demo and an undated one reachable', async () => {
		const now = new Date('2026-10-13T12:00:00Z');
		mockSupabaseRequest
			.mockResolvedValueOnce([enabledEvent])
			.mockResolvedValueOnce([timing('2025-10-13T18:00')]);
		await expect(isEventInvitationUnavailable('event-1', now)).resolves.toBe(false);

		mockSupabaseRequest
			.mockResolvedValueOnce([enabledEvent])
			.mockResolvedValueOnce([{ ...timing('2020-01-01T18:00'), is_demo: true }]);
		await expect(isEventInvitationUnavailable('event-1', now)).resolves.toBe(false);

		mockSupabaseRequest
			.mockResolvedValueOnce([enabledEvent])
			.mockResolvedValueOnce([{ is_demo: false, eventTiming: null, heroDate: null }]);
		await expect(isEventInvitationUnavailable('event-1', now)).resolves.toBe(false);

		mockSupabaseRequest.mockResolvedValueOnce([enabledEvent]).mockResolvedValueOnce([]);
		await expect(isEventInvitationUnavailable('event-1', now)).resolves.toBe(false);
	});
});
