import {
	resolveInvitationExpiresAt,
	resolveInvitationValidityWindow,
} from '@/lib/invitation/access/invitation-validity-window';
import { resolveInvitationContentValidity } from '@/lib/intake/invitation-validity';

const at = (iso: string) => new Date(iso);

describe('invitation validity window', () => {
	describe('America/Mazatlan (UTC-7)', () => {
		const eventDate = '2026-06-20';
		const zone = 'America/Mazatlan';

		it('closes at the end of the anniversary day in the event time zone', () => {
			expect(resolveInvitationExpiresAt(eventDate, zone)?.toISOString()).toBe(
				'2027-06-21T06:59:59.999Z',
			);
		});

		it('stays public the day before the anniversary', () => {
			expect(
				resolveInvitationValidityWindow(eventDate, zone, at('2027-06-19T18:00:00.000Z'))
					.expired,
			).toBe(false);
		});

		it('stays public at the exact last millisecond', () => {
			expect(
				resolveInvitationValidityWindow(eventDate, zone, at('2027-06-21T06:59:59.999Z'))
					.expired,
			).toBe(false);
		});

		it('expires at the first millisecond after', () => {
			expect(
				resolveInvitationValidityWindow(eventDate, zone, at('2027-06-21T07:00:00.000Z')),
			).toEqual({ expiresAt: at('2027-06-21T06:59:59.999Z'), expired: true });
		});
	});

	describe('America/Mexico_City (UTC-6)', () => {
		const zone = 'America/Mexico_City';

		it('closes one hour earlier in UTC than Mazatlan for the same local date', () => {
			expect(resolveInvitationExpiresAt('2026-06-20', zone)?.toISOString()).toBe(
				'2027-06-21T05:59:59.999Z',
			);
			expect(
				resolveInvitationValidityWindow('2026-06-20', zone, at('2027-06-21T05:59:59.999Z'))
					.expired,
			).toBe(false);
			expect(
				resolveInvitationValidityWindow('2026-06-20', zone, at('2027-06-21T06:00:00.000Z'))
					.expired,
			).toBe(true);
		});

		it('maps Feb 29 to Feb 28 of the next year', () => {
			expect(resolveInvitationExpiresAt('2028-02-29', zone)?.toISOString()).toBe(
				'2029-03-01T05:59:59.999Z',
			);
		});

		it('crosses the year boundary for a Dec 31 event', () => {
			expect(resolveInvitationExpiresAt('2026-12-31', zone)?.toISOString()).toBe(
				'2028-01-01T05:59:59.999Z',
			);
		});
	});

	it.each([null, undefined, '', '2026-02-30', '20/06/2026', '2026-06-20T18:00'])(
		'never expires without a resolvable event date (%p)',
		(eventDate) => {
			expect(
				resolveInvitationValidityWindow(
					eventDate,
					'America/Mexico_City',
					at('2099-01-01T00:00:00Z'),
				),
			).toEqual({ expiresAt: null, expired: false });
		},
	);

	it('never expires with an unknown time zone', () => {
		expect(resolveInvitationExpiresAt('2020-01-01', 'Mars/Olympus')).toBeNull();
	});

	it('never expires a demo', () => {
		expect(
			resolveInvitationValidityWindow(
				'2020-01-01',
				'America/Mexico_City',
				at('2099-01-01T00:00:00Z'),
				{ isDemo: true },
			),
		).toEqual({ expiresAt: null, expired: false });
	});

	describe('published content', () => {
		const now = at('2027-06-21T07:00:00.000Z');

		it('uses eventTiming.localDateTime and its time zone', () => {
			expect(
				resolveInvitationContentValidity(
					'client',
					{
						eventTiming: {
							localDateTime: '2026-06-20T18:00',
							timeZone: 'America/Mazatlan',
						},
					},
					now,
				),
			).toEqual({ expiresAt: at('2027-06-21T06:59:59.999Z'), expired: true });
		});

		it('falls back to the legacy hero date in the default zone', () => {
			expect(
				resolveInvitationContentValidity(
					'client',
					{ heroDate: '2026-06-20T00:00:00Z' },
					now,
				).expiresAt?.toISOString(),
			).toBe('2027-06-21T05:59:59.999Z');
		});

		it('never expires a demo or content without an event date', () => {
			expect(
				resolveInvitationContentValidity(
					'demo',
					{ eventTiming: { localDateTime: '2020-01-01T18:00' } },
					now,
				).expired,
			).toBe(false);
			expect(resolveInvitationContentValidity('client', {}, now)).toEqual({
				expiresAt: null,
				expired: false,
			});
		});
	});
});
