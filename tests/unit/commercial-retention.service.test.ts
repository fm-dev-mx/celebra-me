jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import {
	COMMERCIAL_PURGE_BATCH,
	MAX_COMMERCIAL_PURGE_BATCHES,
	runCommercialRetention,
} from '@/lib/commercial/commercial-retention.service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const request = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const full = { tracking_events: COMMERCIAL_PURGE_BATCH, visitor_sessions: 0 };

describe('runCommercialRetention', () => {
	beforeEach(() => request.mockReset());

	it('purges in batches until both tables come back short and sums the counts', async () => {
		request
			.mockResolvedValueOnce(full)
			.mockResolvedValueOnce({ tracking_events: 120, visitor_sessions: 30 });

		await expect(runCommercialRetention()).resolves.toEqual({
			trackingEventsDeleted: COMMERCIAL_PURGE_BATCH + 120,
			visitorSessionsDeleted: 30,
			batches: 2,
			complete: true,
		});
		expect(request).toHaveBeenCalledWith({
			pathWithQuery: 'rpc/purge_commercial_analytics',
			method: 'POST',
			useServiceRole: true,
			body: { p_batch: COMMERCIAL_PURGE_BATCH },
		});
	});

	it('keeps going while sessions still fill a batch', async () => {
		request
			.mockResolvedValueOnce({ tracking_events: 0, visitor_sessions: COMMERCIAL_PURGE_BATCH })
			.mockResolvedValueOnce({ tracking_events: 0, visitor_sessions: 0 });

		await expect(runCommercialRetention()).resolves.toMatchObject({
			batches: 2,
			complete: true,
		});
	});

	it('stops at the daily batch cap and reports the purge as incomplete', async () => {
		request.mockResolvedValue(full);

		await expect(runCommercialRetention()).resolves.toEqual({
			trackingEventsDeleted: COMMERCIAL_PURGE_BATCH * MAX_COMMERCIAL_PURGE_BATCHES,
			visitorSessionsDeleted: 0,
			batches: MAX_COMMERCIAL_PURGE_BATCHES,
			complete: false,
		});
	});

	it('propagates a database error to the scheduled job', async () => {
		request.mockRejectedValue(new Error('rpc down'));

		await expect(runCommercialRetention()).rejects.toThrow('rpc down');
	});
});
