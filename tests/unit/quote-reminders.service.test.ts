/** @jest-environment node */
jest.mock('@/lib/tracking/commercial-pagination.server', () => ({ loadCommercialRows: jest.fn() }));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
import { loadCommercialRows } from '@/lib/tracking/commercial-pagination.server';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	loadQuoteReminders,
	prepareQuoteReminder,
	loadQuoteReminderTimeline,
} from '@/lib/commercial/quote-reminders.service';
import { loadCrmTimeline } from '@/lib/commercial/crm-timeline.service';

const now = Date.parse('2026-10-30T12:00:00Z');
const lead = {
	id: '11111111-1111-4111-8111-111111111111',
	lead_code: 'CM-ABC234',
	name: 'Cliente',
	customer_id: 'customer',
	session_id: 'session',
	phone: null,
	phone_e164: '+526681234567',
	consent_contact: true,
	status: 'quoted',
	created_at: '2026-10-01T12:00:00Z',
	updated_at: '2026-10-27T12:00:00Z',
};
let tables: Record<string, unknown[]>;
beforeEach(() => {
	jest.useFakeTimers().setSystemTime(now);
	jest.resetAllMocks();
	tables = { leads: [{ ...lead }] };
	jest.mocked(loadCommercialRows).mockImplementation(
		async (query) => (tables[query.split('?')[0]] ?? []) as { id: string }[],
	);
	jest.mocked(supabaseRestRequest).mockResolvedValue([
		{ id: 'audit', target_id: lead.id, created_at: new Date(now).toISOString() },
	]);
});
afterEach(() => jest.useRealTimers());

it('includes the exact three-day boundary and excludes recently updated or invalid dates', async () => {
	expect(await loadQuoteReminders(now)).toEqual([
		expect.objectContaining({
			id: lead.id,
			canRemind: true,
			lastActivityAt: '2026-10-27T12:00:00.000Z',
		}),
	]);
	tables.leads = [
		{ ...lead, updated_at: '2026-10-27T12:00:00.001Z' },
		{ ...lead, updated_at: 'invalid' },
	];
	expect(await loadQuoteReminders(now)).toEqual([]);
});

it.each([
	[
		'commercial_demo_followups',
		{ id: 'followup', lead_id: lead.id, occurred_at: '2026-10-29T00:00:00Z' },
	],
	['visitor_sessions', { id: 'session', last_seen_at: '2026-10-29T00:00:00Z' }],
	[
		'tracking_events',
		{
			id: 'return',
			event_properties: { lead_code: lead.lead_code },
			occurred_at: '2026-10-29T00:00:00Z',
		},
	],
	['sales_orders', { id: 'order', lead_id: lead.id, updated_at: '2026-10-29T00:00:00Z' }],
	['sales_orders', { id: 'order', customer_id: 'customer', updated_at: '2026-10-29T00:00:00Z' }],
	['audit_logs', { id: 'audit', target_id: lead.id, created_at: '2026-10-29T00:00:00Z' }],
])('suppresses a reminder after activity in %s', async (table, activity) => {
	tables[table] = [activity];
	expect(await loadQuoteReminders(now)).toEqual([]);
	await expect(
		prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin'),
	).rejects.toMatchObject({ status: 409 });
	expect(supabaseRestRequest).not.toHaveBeenCalled();
});

it.each(['lead', 'customer'])('excludes classified QA %s records', async (recordType) => {
	tables.commercial_record_classifications = [
		{ record_type: recordType, record_id: recordType === 'lead' ? lead.id : 'customer' },
	];
	expect(await loadQuoteReminders(now)).toEqual([]);
});

it.each(['deposit_paid', 'paid'])(
	'excludes a stale quoted lead with a %s order',
	async (status) => {
		tables.sales_orders = [
			{ id: 'order', lead_id: lead.id, status, updated_at: lead.created_at },
		];
		expect(await loadQuoteReminders(now)).toEqual([]);
		await expect(
			prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin'),
		).rejects.toMatchObject({ status: 409 });
	},
);

it.each([{ consent_contact: false }, { phone_e164: null, phone: '6681234567' }])(
	'disables and rejects unusable contact %j',
	async (patch) => {
		tables.leads = [{ ...lead, ...patch }];
		expect(await loadQuoteReminders(now)).toEqual([
			expect.objectContaining({ canRemind: false }),
		]);
		await expect(
			prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin'),
		).rejects.toMatchObject({ status: 400 });
		expect(supabaseRestRequest).not.toHaveBeenCalled();
	},
);

it('persists an audit before returning the manual draft and canonical tracked link', async () => {
	const result = await prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin');
	const url = new URL(result.whatsappUrl);
	expect(url.origin + url.pathname).toBe('https://wa.me/526681234567');
	const text = url.searchParams.get('text')!;
	expect(text).toContain(
		'https://www.celebra-me.com/?lead_code=CM-ABC234&utm_source=whatsapp&utm_medium=manual&utm_campaign=quote_reminder',
	);
	expect(result.entry).toMatchObject({
		eventType: 'quote_reminder_prepared',
		description: expect.stringContaining('no está confirmado'),
	});
	expect(supabaseRestRequest).toHaveBeenCalledWith(
		expect.objectContaining({
			method: 'POST',
			useServiceRole: true,
			body: expect.objectContaining({
				id: 'key',
				actor_id: 'admin',
				target_id: lead.id,
				action: 'quote_reminder_prepared',
			}),
		}),
	);
});

it('does not offer a draft when the audit fails or the operation ID already exists', async () => {
	jest.mocked(supabaseRestRequest).mockRejectedValueOnce(new Error('unavailable'));
	await expect(
		prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin'),
	).rejects.toThrow('unavailable');
	jest.mocked(supabaseRestRequest).mockResolvedValueOnce([]);
	await expect(
		prepareQuoteReminder({ leadId: lead.id, idempotencyKey: 'key' }, 'admin'),
	).rejects.toMatchObject({ status: 409 });
});

it('shows only matching reminders for an unlinked lead or customer timeline', async () => {
	tables.audit_logs = [
		{ id: 'audit', target_id: lead.id, created_at: new Date(now).toISOString() },
		{ id: 'other', target_id: 'other', created_at: new Date(now).toISOString() },
	];
	expect(await loadQuoteReminderTimeline({ leadId: lead.id })).toHaveLength(1);
	jest.mocked(supabaseRestRequest).mockResolvedValue([]);
	expect(await loadCrmTimeline('customer')).toEqual([
		expect.objectContaining({ eventType: 'quote_reminder_prepared' }),
	]);
});
