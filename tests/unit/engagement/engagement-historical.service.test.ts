import { ApiError } from '@/lib/rsvp/core/errors';
import {
	parseHistoricalEventType,
	toHistoricalInvitation,
} from '@/lib/rsvp/engagement/engagement-historical.service';
import type { HistoricalEstimateRow } from '@/lib/rsvp/repositories/engagement.repository';

const row: HistoricalEstimateRow = {
	invitation_id: 'inv-1',
	event_id: 'evt-1',
	title: 'Histórica',
	slug: 'historica',
	event_type: 'xv',
	event_date: '2026-09-20',
	method_version: 1,
	computed_at: '2026-10-26T08:00:00Z',
	guests_total: 120,
	guests_shared: 110,
	guests_viewed: 80,
	guests_responded_self: 60,
	opened_lower: 60,
	opened_upper: 90,
	visits_estimate: 240,
	visits_per_viewer: '3.00',
	conversion_lower: '0.6667',
	views_counted: 400,
	views_before_share: 12,
	views_within_preview_window: 30,
	guests_unshared: 10,
	guests_unshared_viewed: 4,
	guests_unshared_responded_self: 2,
};

describe('parseHistoricalEventType', () => {
	it('defaults to every event type and accepts a known one', () => {
		expect(parseHistoricalEventType(null)).toBe('all');
		expect(parseHistoricalEventType(' xv ')).toBe('xv');
	});

	it('rejects an unknown event type', () => {
		expect(() => parseHistoricalEventType('fiesta')).toThrow(ApiError);
	});
});

describe('toHistoricalInvitation', () => {
	it('maps aggregates and parses numeric strings', () => {
		expect(toHistoricalInvitation(row)).toMatchObject({
			slug: 'historica',
			openedLower: 60,
			openedUpper: 90,
			visitsPerViewer: 3,
			conversionLower: 0.6667,
			guestsUnshared: 10,
			guestsUnsharedViewed: 4,
		});
	});

	it('keeps missing ratios null', () => {
		const empty = toHistoricalInvitation({
			...row,
			visits_per_viewer: null,
			conversion_lower: null,
		});
		expect(empty.visitsPerViewer).toBeNull();
		expect(empty.conversionLower).toBeNull();
	});
});
