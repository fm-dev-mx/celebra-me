import type { EngagementRankingV2Row } from '@/lib/rsvp/repositories/engagement.repository';
import {
	buildEngagementRankingReport,
	median,
	parseEngagementRankingQuery,
	RANKING_THRESHOLDS,
} from '@/lib/rsvp/engagement/engagement-ranking.service';

function row(
	overrides: Partial<EngagementRankingV2Row> & { slug: string },
): EngagementRankingV2Row {
	return {
		invitation_id: `inv-${overrides.slug}`,
		event_id: `event-${overrides.slug}`,
		title: overrides.slug,
		event_type: 'xv',
		event_date: '2026-11-01',
		event_status: 'upcoming',
		activity_state: 'measured',
		public_access: 'enabled',
		confirmation_mode: 'api',
		design: {
			themePreset: 'editorial',
			fontFamily: 'serif',
			personalizedAccessVariant: 'formal-pass',
			music: { enabled: true },
			rsvp: { accessMode: 'hybrid' },
		},
		snapshot_kind: 'rolling',
		computed_at: '2026-10-13T10:43:00Z',
		guests_total: 40,
		guests_shared: 30,
		guests_responded: 15,
		guests_responded_self: 12,
		guests_opened: 10,
		guests_opened_inferred: 18,
		response_rate: '0.4000',
		conversion_upper: '0.6667',
		open_rate: '0.3333',
		completion_rate: '0.5000',
		reopen_ratio: '2.0000',
		median_seconds_to_open: '3600',
		median_seconds_to_respond: '7200',
		mobile_share: '0.7000',
		share_lead_days: 20,
		reminder_coverage: '0.5000',
		sample_state: 'eligible',
		...overrides,
	};
}

/** Five comparable editorial XV invitations with distinct response rates. */
function editorialGroup(): EngagementRankingV2Row[] {
	return [0.9, 0.7, 0.7, 0.4, 0.2].map((rate, index) =>
		row({ slug: `editorial-${index}`, response_rate: String(rate) }),
	);
}

const query = parseEngagementRankingQuery({ eventType: 'xv' });

describe('median', () => {
	it('returns null for no values and the middle for odd and even counts', () => {
		expect(median([])).toBeNull();
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
	});
});

describe('parseEngagementRankingQuery', () => {
	it('defaults to all event types, theme preset and response rate', () => {
		expect(parseEngagementRankingQuery({})).toMatchObject({
			eventType: 'all',
			groupKey: 'themePreset',
			metric: 'responseRate',
			filters: { includeDisabled: false },
		});
	});

	it.each([
		[{ eventType: 'fiesta' }],
		[{ groupKey: 'fontFamily' }],
		[{ metric: 'reopenRatio' }],
		[{ eventStatus: 'soon' }],
		[{ activity: 'some' }],
		[{ music: 'maybe' }],
		[{ confirmationMode: 'sms' }],
		[{ includeDisabled: 'yes' }],
	])('rejects %p', (input) => {
		expect(() => parseEngagementRankingQuery(input)).toThrow();
	});
});

describe('buildEngagementRankingReport', () => {
	it('lists every invitation, parses numbers and keeps measured figures null without activity', () => {
		const report = buildEngagementRankingReport(
			[
				row({ slug: 'measured' }),
				row({
					slug: 'quiet',
					activity_state: 'none',
					snapshot_kind: null,
					open_rate: null,
					completion_rate: null,
				}),
			],
			query,
		);
		expect(report.totals).toEqual({ listed: 2, total: 2 });
		const quiet = report.invitations.find((item) => item.slug === 'quiet');
		expect(quiet).toMatchObject({ activityState: 'none', openRate: null, responseRate: 0.4 });
		expect(report.since).toBe('2026-10-12');
		expect(report.thresholds).toEqual(RANKING_THRESHOLDS);
	});

	it('ranks comparable invitations of ranked groups densely; others stay unranked', () => {
		const rows = [
			...editorialGroup(),
			row({
				slug: 'small',
				guests_shared: 5,
				sample_state: 'insufficient',
				response_rate: '1',
			}),
			row({ slug: 'lonely', design: { themePreset: 'storybook' }, response_rate: '0.95' }),
		];
		const report = buildEngagementRankingReport(rows, query);
		const bySlug = Object.fromEntries(report.invitations.map((item) => [item.slug, item]));
		expect(bySlug['editorial-1']?.rank).toBe(3);
		expect(bySlug['editorial-2']?.rank).toBe(3);
		expect(bySlug['editorial-3']?.rank).toBe(4);
		// Invitations rank within the type on their own sample, whatever their group size.
		expect(bySlug.lonely?.rank).toBe(1);
		expect(bySlug['editorial-0']?.rank).toBe(2);
		expect(bySlug.small?.rank).toBeNull();
		expect(report.designs[0]).toMatchObject({
			groupValue: 'editorial',
			comparableInvitations: 5,
			responseRate: 0.7,
			rank: 1,
		});
	});

	it('ranks within each event type when listing all types', () => {
		const rows = [
			...editorialGroup(),
			...editorialGroup().map((item) => ({
				...item,
				slug: `boda-${item.slug}`,
				invitation_id: `inv-boda-${item.slug}`,
				event_type: 'boda',
			})),
		];
		const report = buildEngagementRankingReport(rows, { ...query, eventType: 'all' });
		const firsts = report.invitations
			.filter((item) => item.rank === 1)
			.map((item) => item.eventType);
		expect(firsts.sort()).toEqual(['boda', 'xv']);
		expect(report.designs.filter((group) => group.rank === 1)).toHaveLength(2);
	});

	it('blanks the trivial conversion bound when no open was measured', () => {
		const report = buildEngagementRankingReport(
			[
				row({
					slug: 'quiet',
					activity_state: 'none',
					guests_opened: 0,
					conversion_upper: '1',
				}),
			],
			query,
		);
		expect(report.invitations[0]?.conversionUpper).toBeNull();
	});

	it('marks WhatsApp conversion as not measurable and keeps it out of the conversion ranking', () => {
		const rows = [
			...editorialGroup(),
			row({ slug: 'whatsapp', confirmation_mode: 'whatsapp', conversion_upper: '1' }),
			row({ slug: 'both', confirmation_mode: 'both', conversion_upper: '1' }),
		];
		const report = buildEngagementRankingReport(rows, { ...query, metric: 'conversionUpper' });
		const bySlug = Object.fromEntries(report.invitations.map((item) => [item.slug, item]));
		expect(bySlug.whatsapp).toMatchObject({
			conversionMeasurability: 'none',
			conversionUpper: null,
			rank: null,
		});
		expect(bySlug.both).toMatchObject({ conversionMeasurability: 'partial', rank: null });
	});

	it('keeps WhatsApp and mixed confirmation out of the response-rate ranking', () => {
		const rows = [
			row({ slug: 'form', response_rate: '0.5' }),
			row({ slug: 'mixed', confirmation_mode: 'both', response_rate: '0.9' }),
		];
		const bySlug = Object.fromEntries(
			buildEngagementRankingReport(rows, query).invitations.map((item) => [item.slug, item]),
		);
		expect(bySlug.form?.rank).toBe(1);
		expect(bySlug.mixed).toMatchObject({ responseRate: 0.9, rank: null });
	});

	it('hides disabled invitations unless asked and never ranks them', () => {
		const rows = [
			...editorialGroup(),
			row({ slug: 'off', public_access: 'disabled', response_rate: '1' }),
		];
		expect(
			buildEngagementRankingReport(rows, query).invitations.map((item) => item.slug),
		).not.toContain('off');
		const included = buildEngagementRankingReport(rows, {
			...query,
			filters: { includeDisabled: true },
		});
		expect(included.invitations.find((item) => item.slug === 'off')?.rank).toBeNull();
	});

	it('filters by status, activity, font, music and confirmation, and counts what is listed', () => {
		const rows = [
			row({ slug: 'a' }),
			row({ slug: 'b', event_status: 'past', activity_state: 'none' }),
			row({ slug: 'c', design: { fontFamily: 'sans', music: { enabled: false } } }),
			row({ slug: 'd', confirmation_mode: 'whatsapp' }),
		];
		const pick = (filters: Parameters<typeof buildEngagementRankingReport>[1]['filters']) =>
			buildEngagementRankingReport(rows, { ...query, filters })
				.invitations.map((item) => item.slug)
				.sort();
		expect(pick({ eventStatus: 'past' })).toEqual(['b']);
		expect(pick({ activity: 'measured' })).toEqual(['a', 'c', 'd']);
		expect(pick({ fontFamily: 'sans' })).toEqual(['c']);
		expect(pick({ music: 'without' })).toEqual(['c']);
		expect(pick({ confirmationMode: 'whatsapp' })).toEqual(['d']);
		expect(
			buildEngagementRankingReport(rows, { ...query, filters: { eventStatus: 'past' } })
				.totals,
		).toEqual({
			listed: 1,
			total: 4,
		});
	});

	it('derives facets from the data so new designs classify themselves', () => {
		const rows = [
			row({ slug: 'a' }),
			row({ slug: 'b', design: { themePreset: 'brand-new-preset', fontFamily: 'display' } }),
		];
		const { facets } = buildEngagementRankingReport(rows, query);
		expect(facets.themePreset.map((value) => value.value)).toEqual([
			'brand-new-preset',
			'editorial',
		]);
		expect(facets.fontFamily.map((value) => value.value)).toContain('display');
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
	});
});
