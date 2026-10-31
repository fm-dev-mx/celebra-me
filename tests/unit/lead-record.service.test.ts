jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));
jest.mock('@/lib/tracking/lead-code', () => ({
	createLeadCode: jest.fn(() => 'CM-AB3CD4'),
}));

import {
	createChatLead,
	searchLeadRecords,
	updateLeadStage,
} from '@/lib/commercial/lead-record.service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const LEAD_ID = '6c0a8f5e-2b1d-4c3a-9e7f-1a2b3c4d5e6f';

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: LEAD_ID,
		lead_code: 'CM-AB3CD4',
		created_at: '2026-10-30T18:00:00.000Z',
		channel: 'whatsapp',
		route: 'chat',
		name: 'Ana',
		phone: '6561234567',
		phone_e164: '+526561234567',
		event_type: 'xv',
		event_date: '2027-03-12',
		utm_source: 'meta',
		utm_medium: null,
		utm_campaign: 'XV otoño',
		utm_content: 'Video 1',
		ad_code: 'A07',
		fbc: null,
		fbp: null,
		fbclid: null,
		ttclid: null,
		ctwa_clid: null,
		stage: 'new',
		lost_reason: null,
		package_value: '1490.00',
		stage_changed_at: null,
		qualified_at: '2026-10-30T19:00:00.000Z',
		order_confirmed_at: null,
		order_cancelled_at: null,
		paid_delivered_at: null,
		lost_at: null,
		...overrides,
	};
}

function pathOf(call: number): string {
	return (mockRestRequest.mock.calls[call][0] as { pathWithQuery: string }).pathWithQuery;
}

describe('lead record service', () => {
	beforeEach(() => jest.clearAllMocks());

	it('lists open leads when the search is empty', async () => {
		mockRestRequest.mockResolvedValueOnce([row()]);
		const [record] = await searchLeadRecords('  ');
		expect(pathOf(0)).toMatch(
			/^leads\?stage=neq\.lost&select=.+&order=created_at\.desc&limit=20$/,
		);
		expect(record).toMatchObject({
			leadCode: 'CM-AB3CD4',
			phone: '+526561234567',
			campaign: 'XV otoño',
			ad: 'Video 1',
			packageValue: 1490,
			stageDates: { qualified: '2026-10-30T19:00:00.000Z' },
		});
	});

	it('searches by code, phone and name', async () => {
		mockRestRequest.mockResolvedValue([]);
		await searchLeadRecords('cm-ab3cd4');
		await searchLeadRecords('656 123 4567');
		await searchLeadRecords('Ana');
		expect(pathOf(0)).toContain('lead_code=eq.CM-AB3CD4&');
		expect(pathOf(1)).toContain('phone_e164=like.*6561234567&');
		expect(pathOf(2)).toContain('name=ilike.*Ana*&');
	});

	it('rejects an unusable search', async () => {
		await expect(searchLeadRecords('*')).rejects.toMatchObject({ status: 400 });
		expect(mockRestRequest).not.toHaveBeenCalled();
	});

	it('stamps the new stage from the stored one', async () => {
		mockRestRequest
			.mockResolvedValueOnce([{ stage: 'new' }])
			.mockResolvedValueOnce([row({ stage: 'lost', lost_reason: 'price' })]);
		const record = await updateLeadStage({
			leadId: LEAD_ID,
			stage: 'lost',
			lostReason: 'price',
		});
		const patch = mockRestRequest.mock.calls[1][0] as { method: string; body: object };
		expect(patch.method).toBe('PATCH');
		expect(patch.body).toMatchObject({ stage: 'lost', lost_reason: 'price' });
		expect(patch.body).toHaveProperty('lost_at');
		expect(record.lostReason).toBe('price');
	});

	it('returns 404 for an unknown lead', async () => {
		mockRestRequest.mockResolvedValueOnce([]);
		await expect(
			updateLeadStage({ leadId: LEAD_ID, stage: 'qualified' }),
		).rejects.toMatchObject({
			status: 404,
		});
	});

	it('creates a chat lead from a catalog ad code', async () => {
		mockRestRequest
			.mockResolvedValueOnce([
				{
					code: 'A07',
					label: 'Video XV',
					platform: 'meta',
					campaign: 'XV otoño',
					ad_name: 'Video 1',
					active: true,
				},
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ id: LEAD_ID, lead_code: 'CM-AB3CD4', status: 'new', session_id: null },
			])
			.mockResolvedValueOnce([row()]);
		const record = await createChatLead({ adCode: 'A07', phone: '656 123 4567', name: 'Ana' });
		const insert = mockRestRequest.mock.calls[2][0] as { body: Record<string, unknown> };
		expect(insert.body).toMatchObject({
			lead_code: 'CM-AB3CD4',
			channel: 'whatsapp',
			route: 'chat',
			ad_code: 'A07',
			utm_source: 'meta',
			utm_campaign: 'XV otoño',
			utm_content: 'Video 1',
			phone_e164: '+526561234567',
			consent_contact: true,
			consent_marketing: false,
		});
		expect(record.adCode).toBe('A07');
	});

	it('rejects ad codes outside the catalog', async () => {
		mockRestRequest.mockResolvedValueOnce([]);
		await expect(createChatLead({ adCode: 'Z99', phone: '6561234567' })).rejects.toMatchObject({
			status: 400,
		});
		expect(mockRestRequest).toHaveBeenCalledTimes(1);
	});
});
