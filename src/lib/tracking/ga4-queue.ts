interface Ga4PendingEvent {
	eventName: string;
	eventProperties: Record<string, string | number | boolean>;
}

export interface Ga4EventQueue {
	clear(): void;
	enqueue(eventName: string, eventProperties: Record<string, string | number | boolean>): void;
	flush(
		replay: (eventName: string, eventProperties: Record<string, string | number | boolean>) => void,
		sendDeferredPageView: () => void,
	): void;
	getPendingCount(): number;
	markPageViewForwarded(): void;
	resetPageViewForwarded(): void;
	shouldForwardPageView(): boolean;
}

export function createGa4EventQueue(maxPendingEvents: number): Ga4EventQueue {
	const pendingEvents: Ga4PendingEvent[] = [];
	let pageViewForwarded = false;

	return {
		clear() {
			pendingEvents.splice(0);
		},
		enqueue(eventName, eventProperties) {
			if (pendingEvents.length >= maxPendingEvents) return;
			pendingEvents.push({ eventName, eventProperties });
		},
		flush(replay, sendDeferredPageView) {
			const events = pendingEvents.splice(0);
			for (const { eventName, eventProperties } of events) {
				replay(eventName, eventProperties);
			}
			if (!pageViewForwarded) {
				sendDeferredPageView();
			}
		},
		getPendingCount() {
			return pendingEvents.length;
		},
		markPageViewForwarded() {
			pageViewForwarded = true;
		},
		resetPageViewForwarded() {
			pageViewForwarded = false;
		},
		shouldForwardPageView() {
			return !pageViewForwarded;
		},
	};
}
