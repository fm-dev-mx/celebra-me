import { useCallback, useEffect, useState } from 'react';

export const GUEST_MESSAGES_SEEN_STORAGE_KEY = 'rsvp-dashboard-guest-messages-seen';

type SeenMap = Record<string, number>;

function readSeenMap(): SeenMap {
	try {
		const parsed: unknown = JSON.parse(
			window.localStorage.getItem(GUEST_MESSAGES_SEEN_STORAGE_KEY) ?? '{}',
		);
		return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {};
	} catch {
		return {};
	}
}

/**
 * When the host last read the message wall of an event, so new messages can be
 * told apart. Lives in this browser only; null means the wall was never read here.
 */
export function useGuestMessagesSeen(eventId: string | undefined): {
	seenAt: number | null;
	markSeen: () => void;
} {
	const [seenAt, setSeenAt] = useState<number | null>(null);

	useEffect(() => {
		if (!eventId) return;
		const stored = readSeenMap()[eventId];
		setSeenAt(typeof stored === 'number' ? stored : null);
	}, [eventId]);

	const markSeen = useCallback(() => {
		if (!eventId) return;
		const now = Date.now();
		setSeenAt(now);
		try {
			window.localStorage.setItem(
				GUEST_MESSAGES_SEEN_STORAGE_KEY,
				JSON.stringify({ ...readSeenMap(), [eventId]: now }),
			);
		} catch {
			// Storage can be unavailable (private mode); the mark still applies for this visit.
		}
	}, [eventId]);

	return { seenAt, markSeen };
}
