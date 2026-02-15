export interface DashboardGuestStreamEvent {
	type: 'guest_updated' | 'heartbeat';
	eventId: string;
	guestId?: string;
	updatedAt: string;
}

type Listener = (event: DashboardGuestStreamEvent) => void;

const listenersByEvent = new Map<string, Set<Listener>>();

export function publishGuestStreamEvent(event: DashboardGuestStreamEvent): void {
	const listeners = listenersByEvent.get(event.eventId);
	if (!listeners || listeners.size === 0) return;
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// non-blocking listener errors
		}
	}
}

export function subscribeGuestStreamEvent(eventId: string, listener: Listener): () => void {
	const set = listenersByEvent.get(eventId) ?? new Set<Listener>();
	set.add(listener);
	listenersByEvent.set(eventId, set);

	return () => {
		const current = listenersByEvent.get(eventId);
		if (!current) return;
		current.delete(listener);
		if (current.size === 0) listenersByEvent.delete(eventId);
	};
}
