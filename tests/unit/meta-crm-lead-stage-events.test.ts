jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	createMetaCrmLeadStageEventId,
	enqueueMetaCrmLeadStageEvent,
	getMetaCrmLeadStageEvent,
	getMetaCrmLeadStageForFollowupAction,
	getMetaCrmLeadStageFromTriggerStatus,
} from '@/lib/commercial/meta-capi/lead-stage-events';

const rest = jest.mocked(supabaseRestRequest);

beforeEach(() => {
	rest.mockReset();
});

describe('Meta CRM lead-stage mapping', () => {
	it.each([
		['quoted', 'LeadQuoted', 'crm_lead_quoted'],
		['paid', 'LeadPaid', 'crm_lead_paid'],
		['lost', 'LeadLost', 'crm_lead_lost'],
	] as const)('maps %s to a stable CRM event', (stage, eventName, triggerStatus) => {
		expect(getMetaCrmLeadStageEvent(stage)).toEqual({ eventName, triggerStatus });
		expect(getMetaCrmLeadStageFromTriggerStatus(triggerStatus)).toBe(stage);
		expect(createMetaCrmLeadStageEventId('lead-id', stage)).toBe(
			`crm-lead-stage:lead-id:${stage}`,
		);
	});

	it('maps only persisted quote and loss follow-ups', () => {
		expect(getMetaCrmLeadStageForFollowupAction('quote_sent')).toBe('quoted');
		expect(getMetaCrmLeadStageForFollowupAction('lost')).toBe('lost');
		expect(getMetaCrmLeadStageForFollowupAction('contact_received')).toBeUndefined();
		expect(getMetaCrmLeadStageForFollowupAction('demo_shared')).toBeUndefined();
		expect(getMetaCrmLeadStageEvent('toString')).toBeUndefined();
	});
});

describe('enqueueMetaCrmLeadStageEvent', () => {
	it('does not queue a stage without stored marketing consent', async () => {
		rest.mockResolvedValueOnce([
			{ id: 'lead-id', session_id: 'session-id', consent_marketing: false },
		]);

		await enqueueMetaCrmLeadStageEvent({ leadId: 'lead-id', stage: 'quoted' });

		expect(rest).toHaveBeenCalledTimes(1);
		expect(rest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				pathWithQuery: expect.stringContaining('leads?'),
			}),
		);
	});

	it('queues an idempotent lead row only after stored marketing consent', async () => {
		rest.mockResolvedValueOnce([
			{ id: 'lead-id', session_id: 'session-id', consent_marketing: true },
		]).mockResolvedValueOnce([]);

		await enqueueMetaCrmLeadStageEvent({ leadId: 'lead-id', stage: 'quoted' });

		expect(rest).toHaveBeenLastCalledWith({
			pathWithQuery: 'meta_conversion_events?on_conflict=event_id',
			method: 'POST',
			useServiceRole: true,
			prefer: 'resolution=ignore-duplicates,return=minimal',
			body: {
				event_name: 'LeadQuoted',
				event_id: 'crm-lead-stage:lead-id:quoted',
				trigger_status: 'crm_lead_quoted',
				lead_id: 'lead-id',
				session_id: 'session-id',
				value: null,
				status: 'pending',
			},
		});
	});
});
