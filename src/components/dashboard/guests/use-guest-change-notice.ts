import { useEffect, useRef, useState } from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

type Answer = DashboardGuestItem['attendanceStatus'];

/** Sentence describing guests who answered since the last refresh, or null when nobody did. */
export function describeNewAnswers(
	previous: ReadonlyMap<string, Answer>,
	items: DashboardGuestItem[],
): string | null {
	const answered = items.filter((item) => {
		const before = previous.get(item.guestId);
		return (
			before !== undefined &&
			before !== item.attendanceStatus &&
			(item.attendanceStatus === 'confirmed' || item.attendanceStatus === 'declined')
		);
	});
	if (answered.length === 0) return null;
	if (answered.length > 1) return `${answered.length} invitados acaban de responder`;
	const [guest] = answered;
	return guest.attendanceStatus === 'confirmed'
		? `${guest.fullName} confirmó su asistencia`
		: `${guest.fullName} avisó que no podrá ir`;
}

/**
 * Watches background refreshes and announces new RSVP answers, so a guest moving
 * to another section never happens silently. Resets when the event changes.
 */
export function useGuestChangeNotice(eventId: string, items: DashboardGuestItem[]) {
	const [notice, setNotice] = useState<string | null>(null);
	const snapshotRef = useRef<{ eventId: string; answers: Map<string, Answer> } | null>(null);

	useEffect(() => {
		const answers = new Map(items.map((item) => [item.guestId, item.attendanceStatus]));
		const snapshot = snapshotRef.current;
		if (snapshot && snapshot.eventId === eventId) {
			const message = describeNewAnswers(snapshot.answers, items);
			if (message) setNotice(message);
		} else {
			setNotice(null);
		}
		snapshotRef.current = { eventId, answers };
	}, [eventId, items]);

	return { notice, dismissNotice: () => setNotice(null) };
}
