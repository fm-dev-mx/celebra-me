jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	createMetaCrmLeadStageEventId,
	enqueueMetaCrmLeadSalesStageEvents,
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
		['quoted', 'LeadQuoted', 'crm_lead_quoted', 'system_generated'],
		['paid', 'LeadPaid', 'crm_lead_paid', 'system_generated'],
		['lost', 'LeadLost', 'crm_lead_lost', 'system_generated'],
		['qualified', 'Lead', 'crm_lead_qualified', 'chat'],
		['order_confirmed', 'Purchase', 'crm_lead_order_confirmed', 'chat'],
	] as const)(
		'maps %s to a stable CRM event',
		(stage, eventName, triggerStatus, actionSource) => {
			expect(getMetaCrmLeadStageEvent(stage)).toEqual({
				eventName,
				triggerStatus,
				actionSource,
			});
			expect(getMetaCrmLeadStageFromTriggerStatus(triggerStatus)).toBe(stage);
			expect(createMetaCrmLeadStageEventId('lead-id', stage)).toBe(
				`crm-lead-stage:lead-id:${stage}`,
			);
		},
	);

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

describe('enqueueMetaCrmLeadSalesStageEvents', () => {
	const consentedLead = { id: 'lead-id', session_id: 'session-id', consent_marketing: true };
	const postedBodies = () =>
		rest.mock.calls
			.map(([request]) => request as { method: string; body?: Record<string, unknown> })
			.filter((request) => request.method === 'POST')
			.map((request) => request.body);

	it('queues a Lead without value when a landing lead is qualified', async () => {
		rest.mockResolvedValueOnce([consentedLead]).mockResolvedValueOnce([]);

		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route: 'landing',
			stage: 'qualified',
			packageValue: 1490,
		});

		expect(postedBodies()).toEqual([
			expect.objectContaining({
				event_name: 'Lead',
				event_id: 'crm-lead-stage:lead-id:qualified',
				trigger_status: 'crm_lead_qualified',
				value: null,
			}),
		]);
	});

	it('queues the Lead and a Purchase valued at the package when the order is confirmed', async () => {
		rest.mockResolvedValueOnce([consentedLead])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([consentedLead])
			.mockResolvedValueOnce([]);

		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route: 'landing',
			stage: 'order_confirmed',
			packageValue: 2490,
		});

		expect(postedBodies()).toEqual([
			expect.objectContaining({ event_name: 'Lead', trigger_status: 'crm_lead_qualified' }),
			expect.objectContaining({
				event_name: 'Purchase',
				event_id: 'crm-lead-stage:lead-id:order_confirmed',
				trigger_status: 'crm_lead_order_confirmed',
				value: 2490,
			}),
		]);
	});

	it.each([null, 0])('queues no Purchase when the package value is %p', async (packageValue) => {
		rest.mockResolvedValueOnce([consentedLead]).mockResolvedValueOnce([]);

		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route: 'landing',
			stage: 'order_confirmed',
			packageValue,
		});

		expect(postedBodies()).toEqual([expect.objectContaining({ event_name: 'Lead' })]);
	});

	it.each([
		['a chat lead', 'chat', 'qualified'],
		['a lead without route', null, 'order_confirmed'],
		['another stage', 'landing', 'paid_delivered'],
	] as const)('queues nothing for %s', async (_case, route, stage) => {
		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route,
			stage,
			packageValue: 1490,
		});

		expect(rest).not.toHaveBeenCalled();
	});

	it('keeps one row per client and stage when the stage is marked again', async () => {
		rest.mockResolvedValue([consentedLead]);

		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route: 'landing',
			stage: 'order_confirmed',
			packageValue: 2490,
		});
		await enqueueMetaCrmLeadSalesStageEvents({
			id: 'lead-id',
			route: 'landing',
			stage: 'order_confirmed',
			packageValue: 2490,
		});

		const posts = rest.mock.calls
			.map(
				([request]) =>
					request as { method: string; prefer?: string; pathWithQuery: string },
			)
			.filter((request) => request.method === 'POST');
		expect(posts).toHaveLength(4);
		for (const post of posts) {
			expect(post.pathWithQuery).toBe('meta_conversion_events?on_conflict=event_id');
			expect(post.prefer).toBe('resolution=ignore-duplicates,return=minimal');
		}
		const eventIds = postedBodies().map((body) => body?.event_id);
		expect(new Set(eventIds)).toEqual(
			new Set(['crm-lead-stage:lead-id:qualified', 'crm-lead-stage:lead-id:order_confirmed']),
		);
	});
});
