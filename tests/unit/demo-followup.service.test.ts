jest.mock('@/lib/commercial/demo-inventory.server', () => ({
	loadDemoInventory: jest.fn(async () => [{ slug: 'demo-xv-celestial-blue', eventType: 'xv' }]),
}));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
jest.mock('@/lib/tracking/lead.repository', () => ({
	findLeadByCode: jest.fn(),
	upsertLead: jest.fn(),
}));
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadDemoInventory } from '@/lib/commercial/demo-inventory.server';
import { findLeadByCode, upsertLead } from '@/lib/tracking/lead.repository';
import { recordDemoFollowup } from '@/lib/commercial/demo-followup.service';
import { DemoFollowupSchema } from '@/lib/commercial/demo-followup';

const rest = jest.mocked(supabaseRestRequest);
const find = jest.mocked(findLeadByCode);
const input = {
	idempotencyKey: '11111111-1111-4111-8111-111111111111',
	leadCode: 'CM-ABC123',
	demoSlug: 'demo-xv-celestial-blue',
	action: 'contact_received' as const,
	lossReason: 'not_reported' as const,
	occurredAt: '2026-01-01T00:00:00Z',
};
const row = {
	id: input.idempotencyKey,
	lead_id: 'lead',
	demo_slug: input.demoSlug,
	action: input.action,
};
beforeEach(() => {
	jest.resetAllMocks();
	jest.mocked(loadDemoInventory).mockResolvedValue([
		{ slug: input.demoSlug, title: 'Celestial Blue', eventType: 'xv' },
	]);
	find.mockResolvedValue({
		id: 'lead',
		leadCode: input.leadCode,
		status: 'new',
		sessionId: null,
	});
});

it('records only an administrative milestone using the authenticated actor and stable ID', async () => {
	rest.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
	expect(await recordDemoFollowup(input, 'actor')).toEqual(row);
	expect(rest).toHaveBeenLastCalledWith(
		expect.objectContaining({
			method: 'POST',
			body: expect.objectContaining({
				id: input.idempotencyKey,
				created_by: 'actor',
				lead_id: 'lead',
			}),
		}),
	);
	expect(upsertLead).not.toHaveBeenCalled();
});
it('returns the already recorded milestone on duplicate submission', async () => {
	rest.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
	expect(await recordDemoFollowup(input, 'actor')).toEqual(row);
	expect(rest.mock.calls.filter(([r]) => r.method === 'POST')).toHaveLength(1);
});
it('does not create an opportunity when the persistence dependency is unavailable', async () => {
	rest.mockRejectedValueOnce(new Error('missing schema'));
	await expect(recordDemoFollowup(input, 'actor')).rejects.toThrow('missing schema');
	expect(find).not.toHaveBeenCalled();
	expect(upsertLead).not.toHaveBeenCalled();
});
it('rejects unknown demos and arbitrary personal-data fields', async () => {
	await expect(
		recordDemoFollowup({ ...input, demoSlug: 'demo-unknown' }, 'actor'),
	).rejects.toThrow('Demo o fecha');
	expect(rest).not.toHaveBeenCalled();
	expect(DemoFollowupSchema.safeParse({ ...input, phone: 'private' }).success).toBe(false);
});
