#!/usr/bin/env node
/**
 * Daily read-only monitors for Production jobs that fail silently.
 *
 *   pnpm ops:monitor cleanup-heartbeat   # the memories cleanup cron logged a completed summary
 *   pnpm ops:monitor backup-freshness    # the off-site bucket holds a recent daily backup
 *   pnpm ops:monitor worker-errors       # 5xx responses and uncaught exceptions stay rare
 *   pnpm ops:monitor worker-limits       # no request was cut off by a CPU or memory limit
 *   pnpm ops:monitor platform-quotas     # the usage collector ran and no quota reached 80 %
 *
 * `cleanup-heartbeat`, `worker-errors`, `worker-limits` and `platform-quotas` query Workers Logs
 * through the Workers Observability API with a read-only token (MONITOR_CLOUDFLARE_API_TOKEN). `backup-freshness` lists the off-site R2 bucket with a
 * read-only R2 key (MONITOR_OFFSITE_R2_ACCESS_KEY_ID / MONITOR_OFFSITE_R2_SECRET_ACCESS_KEY).
 * Neither command writes anything.
 */

import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { PLATFORM_QUOTA_ALERT_RATIO } from '../../src/lib/platform/contract/limits.ts';
import { PLATFORM_USAGE_SUMMARY_EVENT } from '../../src/lib/platform/server/collector/quota-alerts.ts';
import { listOffsiteObjects, type OffsiteObject } from '../db/offsite-backup.ts';

const HOUR_MS = 60 * 60 * 1000;

export const PRODUCTION_WORKER = 'celebra-me';
export const CLEANUP_EVENT = 'memories_cleanup_summary';
/** The cleanup cron runs daily at 15:17 UTC; 26 hours tolerates a late run without hiding a miss. */
export const CLEANUP_LOOKBACK_MS = 26 * HOUR_MS;
/**
 * The daily backup is triggered by the operator machine's Windows Task Scheduler (docs/database-workflow.md),
 * not by this repository; 30 hours tolerates a late copy without hiding a miss.
 */
export const BACKUP_MAX_AGE_MS = 30 * HOUR_MS;
export const OFFSITE_BACKUP_BUCKET = 'celebra-me-prod-backups';
/** Worker health and quota monitors read the last day of Production logs. */
export const WORKER_LOOKBACK_MS = 24 * HOUR_MS;
/** More 5xx responses plus uncaught exceptions than this in a day opens the alert. */
export const WORKER_ERROR_THRESHOLD = 10;
/** Worker outcomes for a request cut off by a platform limit. */
export const RESOURCE_LIMIT_OUTCOMES = ['exceededCpu', 'exceededMemory', 'exceededResources'];

export const MONITOR_ENV = {
	accountId: 'CLOUDFLARE_ACCOUNT_ID',
	observabilityToken: 'MONITOR_CLOUDFLARE_API_TOKEN',
	r2AccessKeyId: 'MONITOR_OFFSITE_R2_ACCESS_KEY_ID',
	r2SecretAccessKey: 'MONITOR_OFFSITE_R2_SECRET_ACCESS_KEY',
} as const;

export interface MonitorResult {
	ok: boolean;
	detail: string;
}

type Fetch = typeof fetch;

/**
 * Workers Logs samples wide queries: over a 26-hour window it may read about an eighth of the rows
 * (`statistics.abr_level` above 1) and miss the single daily summary. Narrow slices read every row.
 */
export const CLEANUP_SLICE_MS = 4 * HOUR_MS;
/** A slice still sampled at this width is reported as inconclusive instead of split again. */
export const CLEANUP_MIN_SLICE_MS = 15 * 60 * 1000;

/**
 * Events view of Workers Logs: completed cleanup summaries of the Production Worker. The Worker
 * logs the summary as a JSON string, which Workers Logs parses into top-level fields (`event`,
 * `phase`); the event carries no `$metadata.message` to match against.
 */
export function buildCleanupHeartbeatQuery(fromMs: number, toMs: number): Record<string, unknown> {
	const fieldEquals = (key: string, value: string) => ({
		key,
		operation: 'eq',
		type: 'string',
		value,
	});
	return {
		queryId: 'celebra-me-cleanup-heartbeat',
		view: 'events',
		limit: 5,
		timeframe: { from: fromMs, to: toMs },
		parameters: {
			datasets: ['cloudflare-workers'],
			filterCombination: 'and',
			filters: [
				fieldEquals('$metadata.service', PRODUCTION_WORKER),
				fieldEquals('event', CLEANUP_EVENT),
				fieldEquals('phase', 'completed'),
			],
		},
	};
}

/** Slices covering the lookback window, newest first. */
export function planCleanupSlices(nowMs: number): [number, number][] {
	const slices: [number, number][] = [];
	const start = nowMs - CLEANUP_LOOKBACK_MS;
	for (let to = nowMs; to > start; to -= CLEANUP_SLICE_MS) {
		slices.push([Math.max(start, to - CLEANUP_SLICE_MS), to]);
	}
	return slices;
}

interface ObservabilityResponse {
	success?: boolean;
	errors?: { message: string }[];
	result?: {
		events?: { count?: number; events?: unknown[] };
		calculations?: { aggregates?: { groupKey?: string; value?: number }[] }[];
		statistics?: { abr_level?: number };
	};
}

export type CleanupSliceOutcome =
	| { kind: 'failed'; reason: string }
	| { kind: 'found'; count: number }
	| { kind: 'empty'; sampled: boolean };

export function evaluateCleanupSlice(response: ObservabilityResponse): CleanupSliceOutcome {
	if (response.success === false || !response.result) {
		const reason = response.errors?.map((error) => error.message).join('; ') || 'no result';
		return { kind: 'failed', reason };
	}
	const count = response.result.events?.count ?? response.result.events?.events?.length ?? 0;
	if (count > 0) return { kind: 'found', count };
	return { kind: 'empty', sampled: (response.result.statistics?.abr_level ?? 1) > 1 };
}

export function evaluateBackupFreshness(objects: OffsiteObject[], nowMs: number): MonitorResult {
	const newest = objects
		.map((object) => ({ ...object, at: Date.parse(object.lastModified) }))
		.filter((object) => Number.isFinite(object.at))
		.sort((left, right) => right.at - left.at)[0];
	if (!newest) return { ok: false, detail: 'The off-site bucket holds no daily backup.' };
	const ageHours = (nowMs - newest.at) / HOUR_MS;
	const detail = `Newest daily backup ${newest.key} (${newest.bytes} bytes), ${ageHours.toFixed(1)} hours old.`;
	return newest.at >= nowMs - BACKUP_MAX_AGE_MS && newest.bytes > 0
		? { ok: true, detail }
		: { ok: false, detail: `${detail} Expected one newer than 30 hours and not empty.` };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is not set; the monitor cannot run.`);
	return value;
}

type ObservabilityQuery = (query: Record<string, unknown>) => Promise<ObservabilityResponse>;

/** Posts Workers Logs queries with the read-only token; an HTTP error becomes `success: false`. */
function observabilityClient(env: NodeJS.ProcessEnv, fetchImpl: Fetch): ObservabilityQuery {
	const accountId = requireEnv(env, MONITOR_ENV.accountId);
	const token = requireEnv(env, MONITOR_ENV.observabilityToken);
	return async (query) => {
		const response = await fetchImpl(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`,
			{
				method: 'POST',
				headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
				body: JSON.stringify(query),
				signal: AbortSignal.timeout(60_000),
			},
		);
		const body = (await response.json().catch(() => ({}))) as ObservabilityResponse;
		if (!response.ok) {
			return {
				success: false,
				errors: body.errors ?? [{ message: `HTTP ${response.status}` }],
			};
		}
		return body;
	};
}

export async function checkCleanupHeartbeat(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const query = observabilityClient(env, fetchImpl);
	const querySlice = async (fromMs: number, toMs: number): Promise<CleanupSliceOutcome> =>
		evaluateCleanupSlice(await query(buildCleanupHeartbeatQuery(fromMs, toMs)));

	const pending = planCleanupSlices(nowMs);
	let inconclusive = 0;
	while (pending.length > 0) {
		const [fromMs, toMs] = pending.shift()!;
		const outcome = await querySlice(fromMs, toMs);
		if (outcome.kind === 'failed') {
			return { ok: false, detail: `Workers Logs query failed: ${outcome.reason}.` };
		}
		if (outcome.kind === 'found') {
			return {
				ok: true,
				detail: `${outcome.count} completed cleanup summary event(s) between ${new Date(fromMs).toISOString()} and ${new Date(toMs).toISOString()}.`,
			};
		}
		if (!outcome.sampled) continue;
		if (toMs - fromMs > CLEANUP_MIN_SLICE_MS) {
			const middle = fromMs + Math.floor((toMs - fromMs) / 2);
			pending.unshift([middle, toMs], [fromMs, middle]);
		} else {
			inconclusive += 1;
		}
	}
	return inconclusive > 0
		? {
				ok: false,
				detail:
					`Workers Logs sampled ${inconclusive} slice(s) of the last 26 hours even at ` +
					'15 minutes, so a completed memories cleanup summary may have been missed.',
			}
		: {
				ok: false,
				detail:
					'No completed memories cleanup summary in the last 26 hours: the cron did not run ' +
					'or stopped after "started".',
			};
}

export async function checkBackupFreshness(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const objects = await listOffsiteObjects(
		{
			accountId: requireEnv(env, MONITOR_ENV.accountId),
			bucket: OFFSITE_BACKUP_BUCKET,
			accessKeyId: requireEnv(env, MONITOR_ENV.r2AccessKeyId),
			secretAccessKey: requireEnv(env, MONITOR_ENV.r2SecretAccessKey),
			// Listing never encrypts; the recipient is only used by uploads.
			recipient: '',
		},
		'daily',
		fetchImpl,
	);
	return evaluateBackupFreshness(objects, nowMs);
}

type LogFilter = {
	key: string;
	operation: string;
	type: 'string' | 'number';
	value: string | number;
};

/**
 * Calculations view of Workers Logs: request counts of the Production Worker matching `filters`,
 * grouped by `groupBy`. Workers Logs answers a day of filtered rows without sampling
 * (`abr_level` 1); a sampled answer could hide rare events, so it fails the check instead.
 */
export function buildCountQuery(
	queryId: string,
	fromMs: number,
	toMs: number,
	filters: LogFilter[],
	groupBy: string,
): Record<string, unknown> {
	return {
		queryId,
		view: 'calculations',
		timeframe: { from: fromMs, to: toMs },
		parameters: {
			datasets: ['cloudflare-workers'],
			filterCombination: 'and',
			filters: [
				{
					key: '$metadata.service',
					operation: 'eq',
					type: 'string',
					value: PRODUCTION_WORKER,
				},
				...filters,
			],
			calculations: [{ operator: 'count' }],
			groupBys: [{ type: 'string', value: groupBy }],
		},
	};
}

export type CountOutcome =
	{ kind: 'failed'; reason: string } | { kind: 'counted'; counts: Record<string, number> };

export function evaluateCounts(response: ObservabilityResponse): CountOutcome {
	if (response.success === false || !response.result) {
		const reason = response.errors?.map((error) => error.message).join('; ') || 'no result';
		return { kind: 'failed', reason };
	}
	if ((response.result.statistics?.abr_level ?? 1) > 1) {
		return {
			kind: 'failed',
			reason: 'Workers Logs sampled the day, so rare events may be missing',
		};
	}
	const counts: Record<string, number> = {};
	for (const aggregate of response.result.calculations?.[0]?.aggregates ?? []) {
		const key = aggregate.groupKey ?? '';
		counts[key] = (counts[key] ?? 0) + Math.round(aggregate.value ?? 0);
	}
	return { kind: 'counted', counts };
}

const OUTCOME_FIELD = '$workers.outcome';
/** Every outcome but a served request and a visitor who left before the answer. */
const FAILED_OUTCOME_FILTERS: LogFilter[] = [
	{ key: OUTCOME_FIELD, operation: 'neq', type: 'string', value: 'ok' },
	{ key: OUTCOME_FIELD, operation: 'neq', type: 'string', value: 'canceled' },
];
const SERVER_ERROR_FILTERS: LogFilter[] = [
	{ key: '$workers.event.response.status', operation: 'gte', type: 'number', value: 500 },
];

const sum = (counts: Record<string, number>) =>
	Object.values(counts).reduce((total, count) => total + count, 0);
const describeCounts = (counts: Record<string, number>) =>
	Object.entries(counts)
		.map(([key, count]) => `${key} ${count}`)
		.join(', ') || 'none';

async function countLastDay(
	query: ObservabilityQuery,
	nowMs: number,
	queryId: string,
	filters: LogFilter[],
	groupBy: string,
): Promise<CountOutcome> {
	return evaluateCounts(
		await query(buildCountQuery(queryId, nowMs - WORKER_LOOKBACK_MS, nowMs, filters, groupBy)),
	);
}

export async function checkWorkerErrors(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const query = observabilityClient(env, fetchImpl);
	const serverErrors = await countLastDay(
		query,
		nowMs,
		'celebra-me-server-errors',
		SERVER_ERROR_FILTERS,
		OUTCOME_FIELD,
	);
	if (serverErrors.kind === 'failed') {
		return { ok: false, detail: `Workers Logs query failed: ${serverErrors.reason}.` };
	}
	const outcomes = await countLastDay(
		query,
		nowMs,
		'celebra-me-failed-outcomes',
		FAILED_OUTCOME_FILTERS,
		OUTCOME_FIELD,
	);
	if (outcomes.kind === 'failed') {
		return { ok: false, detail: `Workers Logs query failed: ${outcomes.reason}.` };
	}
	const responses5xx = sum(serverErrors.counts);
	const exceptions = outcomes.counts.exception ?? 0;
	const detail =
		`${responses5xx} 5xx response(s) and ${exceptions} uncaught exception(s) in the last 24 ` +
		`hours (alert above ${WORKER_ERROR_THRESHOLD}).`;
	return responses5xx + exceptions > WORKER_ERROR_THRESHOLD
		? { ok: false, detail: `${detail} Failed outcomes: ${describeCounts(outcomes.counts)}.` }
		: { ok: true, detail };
}

export async function checkWorkerLimits(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const outcomes = await countLastDay(
		observabilityClient(env, fetchImpl),
		nowMs,
		'celebra-me-failed-outcomes',
		FAILED_OUTCOME_FILTERS,
		OUTCOME_FIELD,
	);
	if (outcomes.kind === 'failed') {
		return { ok: false, detail: `Workers Logs query failed: ${outcomes.reason}.` };
	}
	const limited = Object.fromEntries(
		Object.entries(outcomes.counts).filter(([outcome]) =>
			RESOURCE_LIMIT_OUTCOMES.includes(outcome),
		),
	);
	return sum(limited) > 0
		? {
				ok: false,
				detail: `Requests cut off by a platform limit in the last 24 hours: ${describeCounts(limited)}.`,
			}
		: { ok: true, detail: 'No request hit a CPU or memory limit in the last 24 hours.' };
}

/** Events view: the newest collector summary that reported at least one quota alert. */
export function buildQuotaAlertEventsQuery(fromMs: number, toMs: number): Record<string, unknown> {
	return {
		queryId: 'celebra-me-quota-alerts',
		view: 'events',
		limit: 1,
		timeframe: { from: fromMs, to: toMs },
		parameters: {
			datasets: ['cloudflare-workers'],
			filterCombination: 'and',
			filters: [
				{
					key: '$metadata.service',
					operation: 'eq',
					type: 'string',
					value: PRODUCTION_WORKER,
				},
				{
					key: 'event',
					operation: 'eq',
					type: 'string',
					value: PLATFORM_USAGE_SUMMARY_EVENT,
				},
				{ key: 'quotaAlertCount', operation: 'gt', type: 'number', value: 0 },
			],
		},
	};
}

function latestQuotaAlertText(response: ObservabilityResponse): string | null {
	const [event] = response.result?.events?.events ?? [];
	const source = (event as { source?: { quotaAlertText?: unknown } } | undefined)?.source;
	return typeof source?.quotaAlertText === 'string' ? source.quotaAlertText : null;
}

export async function checkPlatformQuotas(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const query = observabilityClient(env, fetchImpl);
	const summaryFilter: LogFilter = {
		key: 'event',
		operation: 'eq',
		type: 'string',
		value: PLATFORM_USAGE_SUMMARY_EVENT,
	};
	const summaries = await countLastDay(
		query,
		nowMs,
		'celebra-me-usage-summaries',
		[summaryFilter],
		'event',
	);
	if (summaries.kind === 'failed') {
		return { ok: false, detail: `Workers Logs query failed: ${summaries.reason}.` };
	}
	const runs = sum(summaries.counts);
	if (runs === 0) {
		return {
			ok: false,
			detail:
				'No platform usage summary in the last 24 hours: the collector cron did not run, so ' +
				'quota usage is unknown.',
		};
	}
	const alerts = await countLastDay(
		query,
		nowMs,
		'celebra-me-usage-alerts',
		[summaryFilter, { key: 'quotaAlertCount', operation: 'gt', type: 'number', value: 0 }],
		'event',
	);
	if (alerts.kind === 'failed') {
		return { ok: false, detail: `Workers Logs query failed: ${alerts.reason}.` };
	}
	const alerted = sum(alerts.counts);
	const percent = Math.round(PLATFORM_QUOTA_ALERT_RATIO * 100);
	if (alerted === 0) {
		return { ok: true, detail: `${runs} collector run(s); no quota reached ${percent} %.` };
	}
	const latest = latestQuotaAlertText(
		await query(buildQuotaAlertEventsQuery(nowMs - WORKER_LOOKBACK_MS, nowMs)),
	);
	return {
		ok: false,
		detail: `${alerted} of ${runs} collector run(s) found a quota at or above ${percent} %. Latest: ${latest ?? 'see Workers Logs'}.`,
	};
}

const MONITORS = {
	'cleanup-heartbeat': checkCleanupHeartbeat,
	'backup-freshness': checkBackupFreshness,
	'worker-errors': checkWorkerErrors,
	'worker-limits': checkWorkerLimits,
	'platform-quotas': checkPlatformQuotas,
} as const;

async function main(): Promise<void> {
	const name = process.argv[2] as keyof typeof MONITORS;
	const monitor = MONITORS[name];
	if (!monitor) {
		throw new Error(`Usage: ops:monitor <${Object.keys(MONITORS).join('|')}>`);
	}
	const result = await monitor(process.env, Date.now());
	const line = `${result.ok ? 'OK' : 'FAILED'} ${name}: ${result.detail}`;
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
	}
	if (!result.ok) {
		console.error(line);
		process.exit(1);
	}
	console.info(line);
}

if (process.argv[1] && /^scheduled-monitors\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
