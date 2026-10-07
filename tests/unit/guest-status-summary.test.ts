import { makeGuest } from '@tests/helpers/guest-factory';
import {
	computeGuestStatusCounts,
	getGuestSummaryMessage,
	type GuestStatusCounts,
} from '@/components/dashboard/guests/guest-presenter';

function counts(overrides: Partial<GuestStatusCounts> = {}): GuestStatusCounts {
	return {
		total: 0,
		toSend: 0,
		waiting: 0,
		confirmed: 0,
		declined: 0,
		confirmedPeople: 0,
		...overrides,
	};
}

describe('computeGuestStatusCounts', () => {
	it('buckets each guest into exactly one status', () => {
		const result = computeGuestStatusCounts([
			makeGuest({ guestId: 'a', deliveryStatus: 'generated' }),
			makeGuest({ guestId: 'b', deliveryStatus: 'shared' }),
			makeGuest({
				guestId: 'c',
				deliveryStatus: 'shared',
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
			}),
			makeGuest({
				guestId: 'd',
				deliveryStatus: 'generated',
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
			}),
			makeGuest({ guestId: 'e', deliveryStatus: 'shared', attendanceStatus: 'declined' }),
		]);

		expect(result).toEqual({
			total: 5,
			toSend: 1,
			waiting: 1,
			confirmed: 2,
			declined: 1,
			confirmedPeople: 5,
		});
	});
});

describe('getGuestSummaryMessage', () => {
	it('guides the host when there are no guests', () => {
		expect(getGuestSummaryMessage(counts())).toEqual({
			count: null,
			title: 'Todavía no tiene invitados',
			detail: 'Agregue su primer invitado para empezar.',
			tone: 'empty',
		});
	});

	it.each([
		[
			counts({ total: 2, toSend: 2 }),
			2,
			'invitaciones por enviar',
			'Todavía nadie ha respondido.',
		],
		[
			counts({ total: 3, toSend: 1, waiting: 2 }),
			1,
			'invitación por enviar',
			'2 esperan respuesta.',
		],
		[
			counts({ total: 3, toSend: 1, waiting: 1, confirmed: 1 }),
			1,
			'invitación por enviar',
			'1 ya confirmó.',
		],
		[
			counts({ total: 4, toSend: 1, confirmed: 3 }),
			1,
			'invitación por enviar',
			'3 ya confirmaron.',
		],
	])('prioritizes unsent invitations (%#)', (input, count, title, detail) => {
		expect(getGuestSummaryMessage(input)).toEqual({ count, title, detail, tone: 'pending' });
	});

	it('suggests reminders once everything is sent', () => {
		expect(getGuestSummaryMessage(counts({ total: 3, waiting: 1, confirmed: 2 }))).toEqual({
			count: 1,
			title: 'invitado no ha respondido',
			detail: 'Puede enviarles un recordatorio.',
			tone: 'waiting',
		});
	});

	it('reports attendance when every guest answered', () => {
		expect(
			getGuestSummaryMessage(
				counts({ total: 2, confirmed: 1, declined: 1, confirmedPeople: 1 }),
			),
		).toMatchObject({ count: null, detail: 'Viene 1 persona.', tone: 'done' });
		expect(
			getGuestSummaryMessage(counts({ total: 2, confirmed: 2, confirmedPeople: 6 })).detail,
		).toBe('Vienen 6 personas.');
	});
});
