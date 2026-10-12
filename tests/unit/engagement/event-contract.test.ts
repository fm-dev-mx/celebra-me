import { parseClientEngagementBatch } from '@/lib/rsvp/engagement/event-contract';

const base = {
	clientEventId: '6f1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
	schemaVersion: 1,
	occurredAt: '2026-10-10T18:00:00.000Z',
	pageViewId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
};

describe('client engagement batch contract', () => {
	it('accepts every client event of taxonomy v1', () => {
		const result = parseClientEngagementBatch({
			events: [
				{
					...base,
					eventName: 'invitation_opened',
					properties: { entry: 'short_link', isReload: false },
				},
				{ ...base, eventName: 'invitation_progressed', properties: { milestone: 75 } },
				{ ...base, eventName: 'rsvp_form_viewed', properties: {} },
				{ ...base, eventName: 'rsvp_form_started', properties: {} },
			],
		});
		expect(result.ok).toBe(true);
	});

	it.each([
		[
			'server-only event',
			{ ...base, eventName: 'rsvp_submitted', properties: { attendanceStatus: 'confirmed' } },
		],
		['reserved event', { ...base, eventName: 'cta_clicked', properties: { cta: 'map' } }],
		[
			'non-milestone depth',
			{ ...base, eventName: 'invitation_progressed', properties: { milestone: 30 } },
		],
		['extra property', { ...base, eventName: 'rsvp_form_viewed', properties: { x: 1 } }],
		[
			'extra envelope key',
			{ ...base, trafficClass: 'host', eventName: 'rsvp_form_viewed', properties: {} },
		],
		[
			'wrong schema version',
			{ ...base, schemaVersion: 2, eventName: 'rsvp_form_viewed', properties: {} },
		],
		[
			'malformed id',
			{ ...base, clientEventId: 'nope', eventName: 'rsvp_form_viewed', properties: {} },
		],
	])('rejects %s', (_label, event) => {
		expect(parseClientEngagementBatch({ events: [event] }).ok).toBe(false);
	});

	it('rejects empty and oversized batches', () => {
		const event = { ...base, eventName: 'rsvp_form_viewed', properties: {} };
		expect(parseClientEngagementBatch({ events: [] }).ok).toBe(false);
		expect(
			parseClientEngagementBatch({ events: Array.from({ length: 21 }, () => event) }).ok,
		).toBe(false);
	});
});
