/**
 * Server-only daily Meta Insights collector. One run collects one completed day and upserts it by
 * the table keys, so a second run for the same day refreshes the same rows instead of adding more.
 * Each source (ads, Page, Instagram) runs on its own: a missing id skips that source, a Graph
 * failure fails only that source. Results carry failure kinds only, never tokens, URLs or bodies.
 */
import { MetaGraphClient, MetaGraphError, readMetaInsightsConfig } from '@/lib/meta/graph-client';
import {
	META_ADS_ATTRIBUTION_WINDOW,
	META_IG_REACH_METRIC,
	META_METRIC_PERIOD,
	META_PAGE_REACH_METRIC,
} from '@/lib/meta/insights-dashboard';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { commercialPeriod } from '@/lib/tracking/commercial-period';

export type MetaInsightsSource = 'ads' | 'page' | 'instagram';

export type MetaSourceOutcome =
	| { status: 'completed'; rows: number }
	| { status: 'skipped'; reason: 'missing_config' | 'invalid_config' }
	| {
			status: 'failed';
			kind: MetaGraphError['kind'] | 'storage' | 'unknown';
			httpStatus: number | null;
			code: number | null;
			retryAfterMs: number | null;
	  };

export interface MetaInsightsCollectorResult {
	status: 'completed' | 'skipped' | 'failed';
	date: string;
	sources: Record<MetaInsightsSource, MetaSourceOutcome>;
	/** Names (never values) of the Meta runtime variables that are unset or blank. */
	missingConfig: string[];
}

const CONFIG_NAMES = {
	accessToken: 'META_GRAPH_ACCESS_TOKEN',
	adAccountId: 'META_AD_ACCOUNT_ID',
	pageId: 'META_PAGE_ID',
	igUserId: 'META_IG_USER_ID',
} as const;

interface CollectorOptions {
	now?: Date;
	/** Explicit day (YYYY-MM-DD) to collect or re-collect; defaults to the last completed day. */
	date?: string;
	fetchImpl?: typeof fetch;
}

interface AdsRow {
	account_id: string;
	level: 'campaign';
	object_id: string;
	insight_date: string;
	attribution_window: string;
	raw: Record<string, unknown>;
	collected_at: string;
}

interface OrganicRow {
	platform: 'facebook' | 'instagram';
	account_id: string;
	level: 'page' | 'ig_user';
	object_id: string;
	insight_date: string;
	metric_period: string;
	raw: Record<string, unknown>;
	collected_at: string;
}

const ADS_CONFLICT = 'account_id,level,object_id,insight_date,attribution_window';
const ORGANIC_CONFLICT = 'platform,account_id,level,object_id,insight_date,metric_period';

/** Meta returns counters as decimal strings; anything else is a malformed response. */
function metric(value: unknown): number {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isFinite(parsed) || parsed < 0) throw new MetaGraphError('response');
	return parsed;
}

function nextDay(date: string): string {
	const day = new Date(`${date}T00:00:00Z`);
	day.setUTCDate(day.getUTCDate() + 1);
	return day.toISOString().slice(0, 10);
}

/** Accepts `act_123` or a bare `123`, never producing `act_act_123`. */
export function normalizeAdAccountId(value: string): string | null {
	const trimmed = value.trim();
	if (/^act_\d+$/.test(trimmed)) return trimmed;
	if (/^\d+$/.test(trimmed)) return `act_${trimmed}`;
	return null;
}

function numericId(value: string): string | null {
	const trimmed = value.trim();
	return /^\d+$/.test(trimmed) ? trimmed : null;
}

async function collectAds(
	client: MetaGraphClient,
	accountId: string,
	date: string,
	collectedAt: string,
): Promise<AdsRow[]> {
	const rows: AdsRow[] = [];
	for await (const page of client.pages(`${accountId}/insights`, {
		level: 'campaign',
		fields: 'campaign_id,campaign_name,spend,impressions,clicks,account_currency,date_start',
		time_range: JSON.stringify({ since: date, until: date }),
		time_increment: '1',
		use_unified_attribution_setting: 'true',
		limit: '100',
	})) {
		for (const item of page) {
			if (
				typeof item.campaign_id !== 'string' ||
				!item.campaign_id ||
				item.date_start !== date
			)
				throw new MetaGraphError('response');
			rows.push({
				account_id: accountId,
				level: 'campaign',
				object_id: item.campaign_id,
				insight_date: date,
				attribution_window: META_ADS_ATTRIBUTION_WINDOW,
				raw: {
					campaign_name:
						typeof item.campaign_name === 'string' ? item.campaign_name : null,
					currency:
						typeof item.account_currency === 'string' ? item.account_currency : null,
					spend: metric(item.spend ?? '0'),
					impressions: metric(item.impressions ?? '0'),
					clicks: metric(item.clicks ?? '0'),
				},
				collected_at: collectedAt,
			});
		}
	}
	return rows;
}

/** Reads one daily value from either the `values` series or the `total_value` shape. */
function dailyValue(items: Record<string, unknown>[], name: string, date: string): number {
	const entry = items.find((item) => item.name === name);
	if (!entry) throw new MetaGraphError('response');
	const total = entry.total_value;
	if (total && typeof total === 'object' && 'value' in total) return metric(total.value);
	if (!Array.isArray(entry.values)) throw new MetaGraphError('response');
	const values = entry.values.filter(
		(value): value is Record<string, unknown> => typeof value === 'object' && value !== null,
	);
	// A daily value ends at the start of the next day in the asset's own timezone.
	const match =
		values.length === 1
			? values[0]
			: values.find(
					(value) =>
						typeof value.end_time === 'string' &&
						value.end_time.startsWith(nextDay(date)),
				);
	if (!match) throw new MetaGraphError('response');
	return metric(match.value);
}

async function collectOrganic(
	client: MetaGraphClient,
	source: 'page' | 'instagram',
	objectId: string,
	date: string,
	collectedAt: string,
): Promise<OrganicRow> {
	const name = source === 'page' ? META_PAGE_REACH_METRIC : META_IG_REACH_METRIC;
	const params: Record<string, string> = {
		metric: name,
		period: META_METRIC_PERIOD,
		since: date,
		until: nextDay(date),
	};
	if (source === 'instagram') params.metric_type = 'total_value';
	const items: Record<string, unknown>[] = [];
	for await (const page of client.pages(`${objectId}/insights`, params)) items.push(...page);
	return {
		platform: source === 'page' ? 'facebook' : 'instagram',
		account_id: objectId,
		level: source === 'page' ? 'page' : 'ig_user',
		object_id: objectId,
		insight_date: date,
		metric_period: META_METRIC_PERIOD,
		raw: { [name]: dailyValue(items, name, date) },
		collected_at: collectedAt,
	};
}

async function upsert(table: string, conflict: string, rows: object[]): Promise<void> {
	if (rows.length === 0) return;
	await supabaseRestRequest<unknown>({
		pathWithQuery: `${table}?on_conflict=${conflict}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=minimal',
		body: rows,
	});
}

function failure(error: unknown): MetaSourceOutcome {
	if (error instanceof MetaGraphError) {
		return {
			status: 'failed',
			kind: error.kind,
			httpStatus: error.status ?? null,
			code: error.code ?? null,
			retryAfterMs: error.retryAfterMs ?? null,
		};
	}
	return {
		status: 'failed',
		kind: error instanceof SupabaseHttpError ? 'storage' : 'unknown',
		httpStatus: error instanceof SupabaseHttpError ? error.status : null,
		code: null,
		retryAfterMs: null,
	};
}

async function runSource(
	id: string | null,
	present: boolean,
	collect: (id: string) => Promise<number>,
): Promise<MetaSourceOutcome> {
	if (!present) return { status: 'skipped', reason: 'missing_config' };
	if (!id) return { status: 'skipped', reason: 'invalid_config' };
	try {
		return { status: 'completed', rows: await collect(id) };
	} catch (error) {
		return failure(error);
	}
}

export async function runMetaInsightsCollector(
	options: CollectorOptions = {},
): Promise<MetaInsightsCollectorResult> {
	const date = options.date ?? commercialPeriod(30, options.now).endDate;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('date must be YYYY-MM-DD');
	const config = readMetaInsightsConfig();
	const missingConfig = (Object.keys(CONFIG_NAMES) as (keyof typeof CONFIG_NAMES)[])
		.filter((key) => !config[key].trim())
		.map((key) => CONFIG_NAMES[key]);
	const token = config.accessToken.trim();
	if (!token) {
		const skipped: MetaSourceOutcome = { status: 'skipped', reason: 'missing_config' };
		return {
			status: 'skipped',
			date,
			sources: { ads: skipped, page: skipped, instagram: skipped },
			missingConfig,
		};
	}
	let client: MetaGraphClient;
	try {
		client = new MetaGraphClient({ accessToken: token, fetchImpl: options.fetchImpl });
	} catch {
		const skipped: MetaSourceOutcome = { status: 'skipped', reason: 'invalid_config' };
		return {
			status: 'skipped',
			date,
			sources: { ads: skipped, page: skipped, instagram: skipped },
			missingConfig,
		};
	}
	const collectedAt = (options.now ?? new Date()).toISOString();

	const ads = await runSource(
		normalizeAdAccountId(config.adAccountId),
		Boolean(config.adAccountId.trim()),
		async (accountId) => {
			const rows = await collectAds(client, accountId, date, collectedAt);
			await upsert('meta_ads_insights_daily', ADS_CONFLICT, rows);
			return rows.length;
		},
	);
	const organic = (source: 'page' | 'instagram', raw: string) =>
		runSource(numericId(raw), Boolean(raw.trim()), async (objectId) => {
			const reader =
				source === 'page'
					? new MetaGraphClient({
							accessToken: await client.pageAccessToken(objectId),
							fetchImpl: options.fetchImpl,
						})
					: client;
			const row = await collectOrganic(reader, source, objectId, date, collectedAt);
			await upsert('meta_organic_insights_daily', ORGANIC_CONFLICT, [row]);
			return 1;
		});
	const page = await organic('page', config.pageId);
	const instagram = await organic('instagram', config.igUserId);

	const outcomes = [ads, page, instagram];
	const status = outcomes.some((outcome) => outcome.status === 'failed')
		? 'failed'
		: outcomes.every((outcome) => outcome.status === 'skipped')
			? 'skipped'
			: 'completed';
	return { status, date, sources: { ads, page, instagram }, missingConfig };
}
