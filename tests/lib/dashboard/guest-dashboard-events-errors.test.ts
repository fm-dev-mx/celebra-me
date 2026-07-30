import type { DashboardEventListDebug } from '@/interfaces/dashboard/admin.interface';
import {
	GUEST_DASHBOARD_EVENT_UNAVAILABLE_MESSAGE,
	GUEST_DASHBOARD_MEMBERSHIP_UNRESOLVED_MESSAGE,
	GUEST_DASHBOARD_NO_EVENTS_MESSAGE,
	GUEST_DASHBOARD_NO_OWNERSHIP_MESSAGE,
	GUEST_DASHBOARD_SESSION_INVALID_MESSAGE,
	getEventLoadFailureMessage,
	resolveEventsLoadError,
} from '@/lib/dashboard/guest-dashboard-events-errors';

const resolvedSessionDebug = (
	overrides: Partial<DashboardEventListDebug> = {},
): DashboardEventListDebug => ({
	session: {
		hasAccessToken: true,
		tokenSource: 'cookie',
		reason: 'session_role_resolved',
		userId: 'host-1',
		email: 'host@test.com',
		role: 'host_client',
		isSuperAdmin: false,
	},
	ownerEvents: [],
	visibleEvents: [],
	memberships: [],
	membershipResolvedEvents: [],
	unresolvedMembershipEventIds: [],
	requestedSlugCheck: null,
	...overrides,
});

describe('resolveEventsLoadError', () => {
	describe('happy paths', () => {
		it('returns empty string when events are available', () => {
			expect(resolveEventsLoadError('', [{ id: 'event-1' }], undefined)).toBe('');
		});

		it('returns empty string when the requested event is in the host list', () => {
			expect(
				resolveEventsLoadError('event-1', [{ id: 'event-1' }, { id: 'event-2' }], null),
			).toBe('');
		});

		it('treats successful empty list without debug as no assigned events', () => {
			expect(resolveEventsLoadError('', [], undefined)).toBe(
				GUEST_DASHBOARD_NO_EVENTS_MESSAGE,
			);
			expect(resolveEventsLoadError('', [], null)).toBe(GUEST_DASHBOARD_NO_EVENTS_MESSAGE);
		});

		it('treats successful empty list with resolved session debug as no assigned events', () => {
			expect(resolveEventsLoadError('', [], resolvedSessionDebug())).toBe(
				GUEST_DASHBOARD_NO_EVENTS_MESSAGE,
			);
		});
	});

	describe('sad paths with successful response', () => {
		it('reports unresolved memberships when debug is present', () => {
			expect(
				resolveEventsLoadError(
					'',
					[],
					resolvedSessionDebug({
						memberships: [
							{
								id: 'm-1',
								eventId: 'evt-hidden',
								userId: 'host-1',
								membershipRole: 'manager',
							},
						],
						unresolvedMembershipEventIds: ['evt-hidden'],
					}),
				),
			).toBe(GUEST_DASHBOARD_MEMBERSHIP_UNRESOLVED_MESSAGE);
		});

		it('reports missing slug when debug proves the slug is absent', () => {
			expect(
				resolveEventsLoadError(
					'',
					[],
					resolvedSessionDebug({
						requestedSlugCheck: {
							requestedSlug: 'mi-evento',
							slugExistsInDb: false,
							eventId: null,
							ownerUserId: null,
							title: null,
						},
					}),
				),
			).toContain('mi-evento');
		});

		it('reports ownership gap when slug exists but is not visible', () => {
			expect(
				resolveEventsLoadError(
					'',
					[],
					resolvedSessionDebug({
						requestedSlugCheck: {
							requestedSlug: 'mi-evento',
							slugExistsInDb: true,
							eventId: 'evt-1',
							ownerUserId: 'other',
							title: 'Mi Evento',
						},
					}),
				),
			).toBe(GUEST_DASHBOARD_NO_OWNERSHIP_MESSAGE);
		});

		it('reports unavailable requested event when it is not in the host list', () => {
			expect(resolveEventsLoadError('missing', [{ id: 'event-1' }], undefined)).toBe(
				GUEST_DASHBOARD_EVENT_UNAVAILABLE_MESSAGE,
			);
		});

		it('only treats auth failure on empty list when debug explicitly says so', () => {
			expect(
				resolveEventsLoadError(
					'',
					[],
					resolvedSessionDebug({
						session: {
							hasAccessToken: false,
							tokenSource: 'none',
							reason: 'missing_access_token',
							userId: null,
							email: null,
							role: null,
							isSuperAdmin: false,
						},
					}),
				),
			).toBe(GUEST_DASHBOARD_SESSION_INVALID_MESSAGE);
		});
	});
});

describe('getEventLoadFailureMessage', () => {
	describe('sad paths with thrown failures', () => {
		it('maps missing_access_token debug details to the session message', () => {
			expect(
				getEventLoadFailureMessage(
					{
						message: 'Unauthorized.',
						status: 401,
						code: 'unauthorized',
						details: { debug: { reason: 'missing_access_token' } },
					},
					'fallback',
				),
			).toBe(GUEST_DASHBOARD_SESSION_INVALID_MESSAGE);
		});

		it('maps invalid_supabase_user debug details to the session message', () => {
			expect(
				getEventLoadFailureMessage(
					{
						message: 'Unauthorized.',
						details: { debug: { reason: 'invalid_supabase_user' } },
					},
					'fallback',
				),
			).toBe(GUEST_DASHBOARD_SESSION_INVALID_MESSAGE);
		});

		it('maps bare 401 unauthorized errors without debug to the session message', () => {
			expect(
				getEventLoadFailureMessage(
					{ message: 'Unauthorized.', status: 401, code: 'unauthorized' },
					'fallback',
				),
			).toBe(GUEST_DASHBOARD_SESSION_INVALID_MESSAGE);
		});

		it('keeps non-auth Error messages', () => {
			expect(getEventLoadFailureMessage(new Error('Red caida'), 'fallback')).toBe(
				'Red caida',
			);
		});

		it('uses fallback for unknown non-Error values', () => {
			expect(getEventLoadFailureMessage('boom', 'No se pudieron cargar eventos.')).toBe(
				'No se pudieron cargar eventos.',
			);
		});
	});
});
