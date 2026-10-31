import {
	buildLeadStageUpdate,
	ChatLeadSchema,
	findAdCodeInMessage,
	LeadAdCodeSchema,
	LeadStageUpdateSchema,
	normalizeAdCode,
	parseLeadRecordQuery,
} from '@/lib/commercial/lead-record';
import { readTtclidFromUrl, sanitizeTtclid } from '@/lib/tracking/tiktok-attribution';

const NOW = new Date('2026-10-30T18:00:00.000Z');
const LEAD_ID = '6c0a8f5e-2b1d-4c3a-9e7f-1a2b3c4d5e6f';

describe('buildLeadStageUpdate', () => {
	it('stamps the stage change and the entered stage', () => {
		expect(buildLeadStageUpdate('new', { stage: 'qualified' }, NOW)).toEqual({
			lost_reason: null,
			stage: 'qualified',
			stage_changed_at: NOW.toISOString(),
			qualified_at: NOW.toISOString(),
		});
	});

	it('keeps the reason only for lost leads', () => {
		expect(
			buildLeadStageUpdate('qualified', { stage: 'lost', lostReason: 'price' }, NOW),
		).toMatchObject({ stage: 'lost', lost_reason: 'price', lost_at: NOW.toISOString() });
		expect(buildLeadStageUpdate('lost', { stage: 'new', lostReason: 'price' }, NOW)).toEqual({
			lost_reason: null,
			stage: 'new',
			stage_changed_at: NOW.toISOString(),
		});
	});

	it('edits value and event data without touching stage dates on the same stage', () => {
		expect(
			buildLeadStageUpdate(
				'order_confirmed',
				{
					stage: 'order_confirmed',
					packageValue: 1490,
					eventType: 'xv',
					eventDate: '2027-03-12',
				},
				NOW,
			),
		).toEqual({
			lost_reason: null,
			package_value: 1490,
			event_type: 'xv',
			event_date: '2027-03-12',
		});
	});

	it('clears the package value when null is sent', () => {
		expect(buildLeadStageUpdate('new', { stage: 'new', packageValue: null }, NOW)).toEqual({
			lost_reason: null,
			package_value: null,
		});
	});
});

describe('parseLeadRecordQuery', () => {
	it('reads lead codes with or without the prefix', () => {
		expect(parseLeadRecordQuery(' cm-ab3cd4 ')).toEqual({
			kind: 'code',
			leadCode: 'CM-AB3CD4',
		});
		expect(parseLeadRecordQuery('ab3cd4')).toEqual({ kind: 'code', leadCode: 'CM-AB3CD4' });
	});

	it('keeps a six-letter word as a name', () => {
		expect(parseLeadRecordQuery('Andrea')).toEqual({ kind: 'name', text: 'Andrea' });
	});

	it('reads phones by their last ten digits', () => {
		expect(parseLeadRecordQuery('+52 (656) 123-4567')).toEqual({
			kind: 'phone',
			digits: '6561234567',
		});
	});

	it('strips filter syntax from names and rejects unusable input', () => {
		expect(parseLeadRecordQuery('María,or=(id.gt.0)')).toEqual({
			kind: 'name',
			text: 'María or id gt',
		});
		expect(parseLeadRecordQuery('*')).toBeNull();
		expect(parseLeadRecordQuery('   ')).toBeNull();
	});
});

describe('ad codes', () => {
	it('normalizes ad codes', () => {
		expect(normalizeAdCode(' a-07 ')).toBe('A07');
		expect(normalizeAdCode('TK12')).toBe('TK12');
		expect(normalizeAdCode('07')).toBeUndefined();
		expect(normalizeAdCode('ABCD1')).toBeUndefined();
	});

	it('finds a known code written as its own word', () => {
		expect(findAdCodeInMessage('Hola, vengo por a07!', ['A07', 'B02'])).toBe('A07');
		expect(findAdCodeInMessage('Hola XA07', ['A07'])).toBeNull();
		expect(findAdCodeInMessage('Hola', [])).toBeNull();
	});
});

describe('schemas', () => {
	it('requires a reason for lost leads', () => {
		expect(LeadStageUpdateSchema.safeParse({ leadId: LEAD_ID, stage: 'lost' }).success).toBe(
			false,
		);
		const parsed = LeadStageUpdateSchema.parse({
			leadId: LEAD_ID,
			stage: 'lost',
			lostReason: 'no_reply',
			eventType: '',
			eventDate: '',
		});
		expect(parsed.lostReason).toBe('no_reply');
		expect(parsed.eventType).toBeUndefined();
		expect(parsed.eventDate).toBeUndefined();
	});

	it('rejects malformed event dates and negative values', () => {
		expect(
			LeadStageUpdateSchema.safeParse({
				leadId: LEAD_ID,
				stage: 'new',
				eventDate: '12/03/2027',
			}).success,
		).toBe(false);
		expect(
			LeadStageUpdateSchema.safeParse({ leadId: LEAD_ID, stage: 'new', packageValue: -1 })
				.success,
		).toBe(false);
	});

	it('normalizes the chat lead ad code and validates the phone', () => {
		expect(ChatLeadSchema.parse({ adCode: 'a07', phone: '656 123 4567' }).adCode).toBe('A07');
		expect(ChatLeadSchema.safeParse({ adCode: '07', phone: '6561234567' }).success).toBe(false);
		expect(ChatLeadSchema.safeParse({ adCode: 'A07', phone: '12' }).success).toBe(false);
	});

	it('defaults ad codes to active Meta codes', () => {
		expect(LeadAdCodeSchema.parse({ code: 'a 7', label: 'Video boda' })).toEqual({
			code: 'A7',
			label: 'Video boda',
			platform: 'meta',
			campaign: undefined,
			adName: undefined,
			active: true,
		});
	});
});

describe('TikTok click ID', () => {
	it('keeps only well-formed ttclid values', () => {
		expect(sanitizeTtclid(' E.C.P.abc123_XYZ ')).toBe('E.C.P.abc123_XYZ');
		expect(sanitizeTtclid('short')).toBeUndefined();
		expect(sanitizeTtclid('bad value with spaces')).toBeUndefined();
		expect(sanitizeTtclid(42)).toBeUndefined();
	});

	it('reads ttclid from a landing URL', () => {
		expect(readTtclidFromUrl('https://celebra-me.com/?ttclid=abcdef12345')).toBe('abcdef12345');
		expect(readTtclidFromUrl('https://celebra-me.com/')).toBeUndefined();
		expect(readTtclidFromUrl('not a url')).toBeUndefined();
	});
});
