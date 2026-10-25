jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import {
	MAX_META_RETENTION_BATCHES,
	META_RETENTION_BATCH,
	runMetaConversionRetention,
} from '@/lib/commercial/meta-capi/retention.service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const request = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const full = { meta_conversion_events: META_RETENTION_BATCH, visitor_consent_withdrawals: 0 };

describe('runMetaConversionRetention', () => {
	beforeEach(() => request.mockReset());

	it('purges in batches until both tables come back short and sums the counts', async () => {
		request
			.mockResolvedValueOnce(full)
			.mockResolvedValueOnce({ meta_conversion_events: 40, visitor_consent_withdrawals: 3 });

		await expect(runMetaConversionRetention()).resolves.toEqual({
			conversionEventsDeleted: META_RETENTION_BATCH + 40,
			consentWithdrawalsDeleted: 3,
			batches: 2,
			complete: true,
		});
		expect(request).toHaveBeenCalledWith({
			pathWithQuery: 'rpc/purge_meta_conversion_retention',
			method: 'POST',
			useServiceRole: true,
			body: { p_batch: META_RETENTION_BATCH },
		});
	});

	it('keeps going while withdrawals still fill a batch', async () => {
		request
			.mockResolvedValueOnce({
				meta_conversion_events: 0,
				visitor_consent_withdrawals: META_RETENTION_BATCH,
			})
			.mockResolvedValueOnce({ meta_conversion_events: 0, visitor_consent_withdrawals: 0 });

		await expect(runMetaConversionRetention()).resolves.toMatchObject({
			batches: 2,
			complete: true,
		});
	});

	it('stops at the per-run batch cap and reports the purge as incomplete', async () => {
		request.mockResolvedValue(full);

		await expect(runMetaConversionRetention()).resolves.toEqual({
			conversionEventsDeleted: META_RETENTION_BATCH * MAX_META_RETENTION_BATCHES,
			consentWithdrawalsDeleted: 0,
			batches: MAX_META_RETENTION_BATCHES,
			complete: false,
		});
		expect(request).toHaveBeenCalledTimes(MAX_META_RETENTION_BATCHES);
	});

	it('propagates a database error to the scheduled job', async () => {
		request.mockRejectedValue(new Error('rpc down'));

		await expect(runMetaConversionRetention()).rejects.toThrow('rpc down');
	});
});
