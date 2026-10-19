#!/usr/bin/env node
/**
 * Daily read-only monitors for Production jobs that fail silently.
 *
 *   pnpm ops:monitor cleanup-heartbeat   # the memories cleanup cron logged a completed summary
 *   pnpm ops:monitor backup-freshness    # the off-site bucket holds a recent daily backup
 *
 * `cleanup-heartbeat` queries Workers Logs through the Workers Observability API with a read-only
 * token (MONITOR_CLOUDFLARE_API_TOKEN). `backup-freshness` lists the off-site R2 bucket with a
 * read-only R2 key (MONITOR_OFFSITE_R2_ACCESS_KEY_ID / MONITOR_OFFSITE_R2_SECRET_ACCESS_KEY).
 * Neither command writes anything.
 */

import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { listOffsiteObjects, type OffsiteObject } from '../db/offsite-backup.ts';

const HOUR_MS = 60 * 60 * 1000;

export const PRODUCTION_WORKER = 'celebra-me';
export const CLEANUP_EVENT = 'memories_cleanup_summary';
/** The cleanup cron runs daily at 15:17 UTC; 26 hours tolerates a late run without hiding a miss. */
export const CLEANUP_LOOKBACK_MS = 26 * HOUR_MS;
/** The daily backup lands around 10:00 UTC; 30 hours tolerates a late copy without hiding a miss. */
export const BACKUP_MAX_AGE_MS = 30 * HOUR_MS;
export const OFFSITE_BACKUP_BUCKET = 'celebra-me-prod-backups';

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

/** Events view of Workers Logs: completed cleanup summaries of the Production Worker. */
export function buildCleanupHeartbeatQuery(nowMs: number): Record<string, unknown> {
	const messageMatches = (value: string) => ({
		key: '$metadata.message',
		operation: 'includes',
		type: 'string',
		value,
	});
	return {
		queryId: 'celebra-me-cleanup-heartbeat',
		view: 'events',
		limit: 5,
		timeframe: { from: nowMs - CLEANUP_LOOKBACK_MS, to: nowMs },
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
				messageMatches(`"event":"${CLEANUP_EVENT}"`),
				messageMatches('"phase":"completed"'),
			],
		},
	};
}

interface ObservabilityResponse {
	success?: boolean;
	errors?: { message: string }[];
	result?: { events?: { count?: number; events?: unknown[] } };
}

export function evaluateCleanupHeartbeat(response: ObservabilityResponse): MonitorResult {
	if (response.success === false || !response.result) {
		const reason = response.errors?.map((error) => error.message).join('; ') || 'no result';
		return { ok: false, detail: `Workers Logs query failed: ${reason}.` };
	}
	const count = response.result.events?.count ?? response.result.events?.events?.length ?? 0;
	return count > 0
		? { ok: true, detail: `${count} completed cleanup summary event(s) in the last 26 hours.` }
		: {
				ok: false,
				detail:
					'No completed memories cleanup summary in the last 26 hours: the cron did not run ' +
					'or stopped after "started".',
			};
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

export async function checkCleanupHeartbeat(
	env: NodeJS.ProcessEnv,
	nowMs: number,
	fetchImpl: Fetch = fetch,
): Promise<MonitorResult> {
	const accountId = requireEnv(env, MONITOR_ENV.accountId);
	const token = requireEnv(env, MONITOR_ENV.observabilityToken);
	const response = await fetchImpl(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(buildCleanupHeartbeatQuery(nowMs)),
			signal: AbortSignal.timeout(60_000),
		},
	);
	const body = (await response.json().catch(() => ({}))) as ObservabilityResponse;
	if (!response.ok) {
		return evaluateCleanupHeartbeat({
			success: false,
			errors: body.errors ?? [{ message: `HTTP ${response.status}` }],
		});
	}
	return evaluateCleanupHeartbeat(body);
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

const MONITORS = {
	'cleanup-heartbeat': checkCleanupHeartbeat,
	'backup-freshness': checkBackupFreshness,
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
