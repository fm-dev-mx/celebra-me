import { publishGuestStreamEvent, subscribeGuestStreamEvent } from '@/lib/rsvp/core/stream';

describe('rsvp stream bus', () => {
	it('publishes events to subscribers of the same event id', () => {
		const listener = jest.fn();
		const unsubscribe = subscribeGuestStreamEvent('evt-1', listener);

		publishGuestStreamEvent({
			type: 'guest_updated',
			eventId: 'evt-1',
			guestId: 'guest-1',
			updatedAt: new Date().toISOString(),
		});

		expect(listener).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it('does not publish events across different event ids', () => {
		const listener = jest.fn();
		const unsubscribe = subscribeGuestStreamEvent('evt-A', listener);

		publishGuestStreamEvent({
			type: 'heartbeat',
			eventId: 'evt-B',
			updatedAt: new Date().toISOString(),
		});

		expect(listener).not.toHaveBeenCalled();
		unsubscribe();
	});
});
