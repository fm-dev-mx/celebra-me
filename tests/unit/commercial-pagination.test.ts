jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadCommercialRows } from '@/lib/tracking/commercial-pagination.server';
const rest = jest.mocked(supabaseRestRequest);
beforeEach(() => rest.mockReset());
it('reads more than 2000 events even when the provider truncates pages below requested size', async () => {
	const rows = Array.from({ length: 2113 }, (_, i) => ({ id: String(i).padStart(6, '0') }));
	rest.mockImplementation(async ({ pathWithQuery }) => {
		const cursor =
			new URL(`https://example.test/${pathWithQuery}`).searchParams.get('id')?.slice(3) ?? '';
		return rows.filter((r) => r.id > cursor).slice(0, 237) as never;
	});
	expect(await loadCommercialRows('tracking_events?select=id')).toEqual(rows);
	expect(rest.mock.calls.every(([input]) => input.method === 'GET')).toBe(true);
});
it('rejects partial results after an upstream failure or non-advancing cursor', async () => {
	rest.mockResolvedValue([{ id: 'same' }]);
	await expect(loadCommercialRows('tracking_events?select=id')).rejects.toThrow(
		'did not advance',
	);
	rest.mockReset()
		.mockResolvedValueOnce([{ id: 'first' }])
		.mockRejectedValueOnce(new Error('offline'));
	await expect(loadCommercialRows('tracking_events?select=id')).rejects.toThrow('offline');
});
