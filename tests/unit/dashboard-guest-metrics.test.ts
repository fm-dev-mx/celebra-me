import { buildDashboardTotals } from '@/lib/rsvp/services/dashboard-guests.service';
import { makeGuest } from '@tests/helpers/guest-factory';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

describe('buildDashboardTotals — guest metrics', () => {
	// Helper to build a guest with defaults overridden
	function guest(overrides: Partial<DashboardGuestItem> = {}): DashboardGuestItem {
		return makeGuest(overrides);
	}

	describe('Total invitations', () => {
		it('counts unique guest invitation records', () => {
			const items = [guest(), guest(), guest()];
			const totals = buildDashboardTotals(items);
			expect(totals.totalInvitations).toBe(3);
		});

		it('returns 0 for empty list', () => {
			expect(buildDashboardTotals([]).totalInvitations).toBe(0);
		});
	});

	describe('Enviadas — sent invitations', () => {
		it('counts unique invitations with deliveryStatus === shared', () => {
			const items = [
				guest({ deliveryStatus: 'shared' }),
				guest({ deliveryStatus: 'shared' }),
				guest({ deliveryStatus: 'generated' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.sharedInvitations).toBe(2);
		});

		it('does not count generated (unsent) invitations', () => {
			const items = [guest({ deliveryStatus: 'generated' })];
			const totals = buildDashboardTotals(items);
			expect(totals.sharedInvitations).toBe(0);
		});

		it('re-sending the same invitation does not increment — deliveryStatus is idempotent', () => {
			// deliveryStatus is a single value, not a counter.
			// One invitation shared 20 times still has deliveryStatus === 'shared'.
			const items = [guest({ deliveryStatus: 'shared' })];
			const totals = buildDashboardTotals(items);
			expect(totals.sharedInvitations).toBe(1);
		});

		it('one sent + one unsent = 1 Enviada', () => {
			const items = [
				guest({ deliveryStatus: 'shared' }),
				guest({ deliveryStatus: 'generated' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.sharedInvitations).toBe(1);
		});
	});

	describe('Pending — Por confirmar (unconfirmedShared)', () => {
		it('counts sent invitations without a final RSVP response', () => {
			const items = [guest({ deliveryStatus: 'shared', attendanceStatus: 'pending' })];
			const totals = buildDashboardTotals(items);
			expect(totals.unconfirmedShared).toBe(1);
		});

		it('does not count generated invitations', () => {
			const items = [guest({ deliveryStatus: 'generated', attendanceStatus: 'pending' })];
			const totals = buildDashboardTotals(items);
			expect(totals.unconfirmedShared).toBe(0);
		});

		it('does not count confirmed or declined invitations', () => {
			const items = [
				guest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' }),
				guest({ deliveryStatus: 'shared', attendanceStatus: 'declined' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.unconfirmedShared).toBe(0);
		});
	});

	describe('Confirmadas — confirmed invitations', () => {
		it('counts unique invitations with attendanceStatus === confirmed', () => {
			const items = [
				guest({ attendanceStatus: 'confirmed' }),
				guest({ attendanceStatus: 'confirmed' }),
				guest({ attendanceStatus: 'pending' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedInvitations).toBe(2);
		});

		it('counts once per confirmed invitation regardless of attendee count', () => {
			const items = [guest({ attendanceStatus: 'confirmed', attendeeCount: 4 })];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedInvitations).toBe(1);
		});
	});

	describe('Asistentes — confirmed attendee count', () => {
		it('sums attendeeCount for confirmed invitations only', () => {
			const items = [
				guest({ attendanceStatus: 'confirmed', attendeeCount: 4 }),
				guest({ attendanceStatus: 'confirmed', attendeeCount: 2 }),
				guest({ attendanceStatus: 'pending', attendeeCount: 0 }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedPeople).toBe(6);
		});

		it('does not include pending invitations maxAllowedAttendees', () => {
			const items = [
				guest({ attendanceStatus: 'pending', maxAllowedAttendees: 5, attendeeCount: 0 }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedPeople).toBe(0);
		});

		it('does not include declined invitations', () => {
			const items = [guest({ attendanceStatus: 'declined', attendeeCount: 0 })];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedPeople).toBe(0);
		});

		it('confirmed with 4 attendees = Asistentes 4', () => {
			const items = [guest({ attendanceStatus: 'confirmed', attendeeCount: 4 })];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedPeople).toBe(4);
		});

		it('confirmed(2) + confirmed(3) + pending(5) = Asistentes 5', () => {
			const items = [
				guest({ attendanceStatus: 'confirmed', attendeeCount: 2 }),
				guest({ attendanceStatus: 'confirmed', attendeeCount: 3 }),
				guest({ attendanceStatus: 'pending', maxAllowedAttendees: 5, attendeeCount: 0 }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.confirmedPeople).toBe(5);
		});
	});

	describe('Denegadas — declined invitations', () => {
		it('counts invitations with attendanceStatus === declined', () => {
			const items = [
				guest({ attendanceStatus: 'declined' }),
				guest({ attendanceStatus: 'declined' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.declinedInvitations).toBe(2);
		});
	});

	describe('Vistas — viewed invitations', () => {
		it('counts invitations with firstViewedAt set', () => {
			const items = [
				guest({ firstViewedAt: '2026-03-22T10:00:00.000Z' }),
				guest({ firstViewedAt: null }),
				guest({ firstViewedAt: '2026-03-23T12:00:00.000Z' }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.viewed).toBe(2);
		});
	});

	describe('Total invited capacity (denominator)', () => {
		it('sums maxAllowedAttendees for all invitations', () => {
			const items = [
				guest({ maxAllowedAttendees: 4 }),
				guest({ maxAllowedAttendees: 2 }),
				guest({ maxAllowedAttendees: 1 }),
			];
			const totals = buildDashboardTotals(items);
			expect(totals.totalPeople).toBe(7);
		});

		it('includes pending and unsent invitations capacity', () => {
			const items = [
				guest({
					maxAllowedAttendees: 4,
					deliveryStatus: 'generated',
					attendanceStatus: 'pending',
				}),
				guest({
					maxAllowedAttendees: 5,
					deliveryStatus: 'shared',
					attendanceStatus: 'confirmed',
					attendeeCount: 3,
				}),
			];
			const totals = buildDashboardTotals(items);
			// totalPeople = 4 + 5 = 9 (all maxAllowedAttendees)
			expect(totals.totalPeople).toBe(9);
			// confirmedPeople = 3 (only confirmed)
			expect(totals.confirmedPeople).toBe(3);
		});
	});
});
