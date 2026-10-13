import type { EngagementRankingRow } from '@/lib/rsvp/repositories/engagement.repository';
import {
	buildEngagementRankingReport,
	median,
	RANKING_THRESHOLDS,
} from '@/lib/rsvp/engagement/engagement-ranking.service';

function row(overrides: Partial<EngagementRankingRow> & { slug: string }): EngagementRankingRow {
	return {
		event_id: `event-${overrides.slug}`,
		invitation_project_id: null,
		title: overrides.slug,
		event_type: 'boda',
		event_date: '2026-11-01',
		event_deleted: false,
		snapshot_kind: 'rolling',
		computed_at: '2026-10-13T10:43:00Z',
		metrics_version: 1,
		guests_total: 40,
		guests_shared: 30,
		guests_opened: 24,
		guests_responded: 12,
		opens_total: 48,
		open_rate: '0.8000',
		completion_rate: '0.5000',
		rsvp_conversion: '0.5000',
		reopen_ratio: '2.0000',
		median_seconds_to_open: '3600',
		median_seconds_to_respond: '7200',
		mobile_share: '0.7000',
		share_lead_days: 20,
		reminder_coverage: '0.5000',
		design: { themePreset: 'editorial' },
		design_schema_version: 1,
		group_value: 'editorial',
		sample_state: 'eligible',
		group_size: 1,
		group_eligible: 1,
		...overrides,
	};
}

/** Five eligible editorial invitations with distinct conversions, plus extras per test. */
function editorialGroup(): EngagementRankingRow[] {
	return [0.9, 0.7, 0.7, 0.4, 0.2].map((conversion, index) =>
		row({ slug: `editorial-${index}`, rsvp_conversion: String(conversion) }),
	);
}

const query = { eventType: 'boda', groupKey: 'themePreset', metric: 'rsvpConversion' } as const;

describe('median', () => {
	it('returns null for no values and the middle for odd and even counts', () => {
		expect(median([])).toBeNull();
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
	});
});

describe('buildEngagementRankingReport', () => {
	it('parses numeric strings and keeps null rates null', () => {
		const report = buildEngagementRankingReport(
			[row({ slug: 'a', open_rate: null, median_seconds_to_respond: null })],
			query,
		);
		const [item] = report.invitations;
		expect(item?.rsvpConversion).toBe(0.5);
		expect(item?.openRate).toBeNull();
		expect(item?.medianSecondsToRespond).toBeNull();
		expect(report.since).toBe('2026-10-12');
		expect(report.thresholds).toEqual(RANKING_THRESHOLDS);
	});

	it('ranks eligible invitations of a ranked group densely and leaves the rest unranked', () => {
		const rows = [
			...editorialGroup(),
			row({
				slug: 'small',
				guests_shared: 5,
				sample_state: 'insufficient',
				rsvp_conversion: '1.0000',
			}),
			row({ slug: 'lonely', group_value: 'storybook', rsvp_conversion: '0.95' }),
		];
		const report = buildEngagementRankingReport(rows, query);
		const bySlug = Object.fromEntries(report.invitations.map((item) => [item.slug, item]));

		expect(bySlug['editorial-0']?.rank).toBe(1);
		expect(bySlug['editorial-1']?.rank).toBe(2);
		expect(bySlug['editorial-2']?.rank).toBe(2);
		expect(bySlug['editorial-3']?.rank).toBe(3);
		// Eligible but its group has fewer than 5 eligible invitations.
		expect(bySlug.lonely?.rank).toBeNull();
		// Insufficient samples are listed last and never ranked, whatever their rate.
		expect(bySlug.small?.rank).toBeNull();
		expect(report.invitations.at(-1)?.slug).toBe('small');
	});

	it('ranks design groups by the median of eligible members and withholds small groups', () => {
		const rows = [
			...editorialGroup(),
			row({ slug: 'lonely', group_value: 'storybook', rsvp_conversion: '0.95' }),
			row({ slug: 'nodesign', group_value: null, design: null, rsvp_conversion: '0.99' }),
		];
		const report = buildEngagementRankingReport(rows, query);

		expect(report.designs[0]).toMatchObject({
			groupValue: 'editorial',
			invitations: 5,
			eligibleInvitations: 5,
			rsvpConversion: 0.7,
			rank: 1,
		});
		const storybook = report.designs.find((group) => group.groupValue === 'storybook');
		expect(storybook).toMatchObject({ invitations: 1, rsvpConversion: 0.95, rank: null });
		const nodesign = report.designs.find((group) => group.groupValue === null);
		expect(nodesign).toMatchObject({ invitations: 1, rank: null });
	});

	it('treats a shorter time to respond as better', () => {
		const rows = [1000, 500, 9000, 250, 2000].map((seconds, index) =>
			row({ slug: `t-${index}`, median_seconds_to_respond: String(seconds) }),
		);
		const report = buildEngagementRankingReport(rows, {
			...query,
			metric: 'medianSecondsToRespond',
		});
		expect(report.invitations.map((item) => item.slug)).toEqual([
			't-3',
			't-1',
			't-0',
			't-4',
			't-2',
		]);
		expect(report.invitations[0]?.rank).toBe(1);
	});

	it('excludes insufficient members from group medians', () => {
		const rows = [
			...editorialGroup(),
			row({
				slug: 'small',
				guests_shared: 3,
				sample_state: 'insufficient',
				rsvp_conversion: '0.0000',
			}),
		];
		const report = buildEngagementRankingReport(rows, query);
		expect(report.designs[0]).toMatchObject({
			invitations: 6,
			eligibleInvitations: 5,
			rsvpConversion: 0.7,
		});
	});
});
