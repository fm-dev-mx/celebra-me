import { makeGuest } from '@tests/helpers/guest-factory';
import {
	computeGuestSummary,
	getGuestProgressSteps,
	getGuestStage,
	getPrimaryStatus,
	isGuestToSend,
	type GuestStage,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

const CASES: Array<[GuestStage, Partial<DashboardGuestItem>]> = [
	['to-send', { deliveryStatus: 'generated' }],
	['unopened', { deliveryStatus: 'shared' }],
	['opened', { deliveryStatus: 'shared', isViewed: true }],
	['confirmed', { deliveryStatus: 'shared', attendanceStatus: 'confirmed', attendeeCount: 2 }],
	['declined', { deliveryStatus: 'shared', attendanceStatus: 'declined' }],
	// Answered through a link the host copied but never marked as sent.
	['confirmed', { deliveryStatus: 'generated', attendanceStatus: 'confirmed', attendeeCount: 2 }],
	['declined', { deliveryStatus: 'generated', attendanceStatus: 'declined' }],
];

describe('one stage drives every guest view', () => {
	it.each(CASES)(
		'%s: list pill, detail steps, send queue and summary agree',
		(stage, overrides) => {
			const guest = makeGuest(overrides);
			const [sent, opened, answer] = getGuestProgressSteps(guest);
			const answered = stage === 'confirmed' || stage === 'declined';

			expect(getGuestStage(guest)).toBe(stage);
			expect(getPrimaryStatus(guest).class).toBe(stage);
			expect(sent.state === 'done').toBe(stage !== 'to-send');
			expect(opened.state === 'done').toBe(answered || stage === 'opened');
			expect(answer.state === 'done').toBe(answered);
			expect(isGuestToSend(guest)).toBe(stage === 'to-send');
			expect(computeGuestSummary([guest]).stages[stage].invitations).toBe(1);
		},
	);

	it('never shows "Por enviar" for a guest who already answered', () => {
		const guest = makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'confirmed' });
		expect(getPrimaryStatus(guest).label).toBe('Confirmada');
		expect(getGuestProgressSteps(guest).every((step) => step.state === 'done')).toBe(true);
	});
});
