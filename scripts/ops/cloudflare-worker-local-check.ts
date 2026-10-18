/**
 * Checks the built Cloudflare Worker while `wrangler dev` serves it locally in workerd.
 *
 * Repository CI builds the Cloudflare target, starts the canonical fixture transport in place of
 * Supabase and runs `wrangler dev --local`; no Cloudflare account or real secret is involved.
 * This script then requests pages, redirects and `/api/health` through the Worker's `fetch`,
 * compares the security headers with `src/lib/server/security-headers.ts`, and fires every cron
 * in `SCHEDULED_JOB_CRONS` through wrangler's scheduled handler endpoint. With `--log`, it also
 * waits for each job's own log line in the wrangler output, which proves `scheduled()` reached it.
 *
 *   tsx scripts/ops/cloudflare-worker-local-check.ts --url http://127.0.0.1:8799 \
 *       --log .tmp/workerd/wrangler.log [--sha <commit>]
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { SCHEDULED_JOB_CRONS, type ScheduledJobName } from '../../src/lib/server/scheduled-jobs.ts';
import {
	PERMANENT_REDIRECTS,
	resolveSecurityHeaders,
} from '../../src/lib/server/security-headers.ts';

/** Wrangler's local endpoint for the `scheduled` handler (the older `/__scheduled` is gone). */
export const SCHEDULED_HANDLER_PATH = '/cdn-cgi/handler/scheduled';

/** A line each job writes once it has run, whatever its outcome. */
export const SCHEDULED_JOB_LOG_MARKERS: Readonly<Record<ScheduledJobName, string>> = {
	memories_cleanup: '"event":"memories_cleanup_summary","phase":"completed"',
	engagement_maintenance: '[engagement][maintenance]',
	platform_usage: '[platform][collector]',
};

interface PageExpectation {
	path: string;
	status: number;
	location?: string;
}

/** Pages served by the Worker: prerendered asset, server page, auth redirects. */
export const PAGE_EXPECTATIONS: readonly PageExpectation[] = [
	{ path: '/', status: 200 },
	{ path: '/login', status: 200 },
	{ path: '/dashboard/invitados', status: 302, location: '/login' },
	{ path: '/dashboard/invitaciones/inv_123/preview', status: 302 },
	...PERMANENT_REDIRECTS.map((rule) => ({
		path: rule.source,
		status: 301,
		location: rule.destination,
	})),
];

export interface LocalCheckOptions {
	origin: string;
	fetchImpl?: typeof fetch;
	/** Returns the wrangler output so far; omitted, the job log lines are not awaited. */
	readLog?: () => string;
	expectedSha?: string;
	logTimeoutMs?: number;
	sleep?: (ms: number) => Promise<void>;
}

function headerFailures(path: string, response: Response): string[] {
	return resolveSecurityHeaders(path).flatMap(([name, value]) => {
		const actual = response.headers.get(name);
		return actual === value ? [] : [`${path}: header ${name} is ${actual ?? 'missing'}`];
	});
}

async function checkPage(
	fetchImpl: typeof fetch,
	origin: string,
	page: PageExpectation,
): Promise<string[]> {
	const response = await fetchImpl(`${origin}${page.path}`, { redirect: 'manual' });
	await response.text();
	const failures = headerFailures(page.path, response);
	if (response.status !== page.status) {
		failures.push(`${page.path}: status ${response.status}, expected ${page.status}`);
	}
	if (page.location !== undefined) {
		const location = response.headers.get('location') ?? '';
		if (new URL(location, origin).pathname !== page.location) {
			failures.push(
				`${page.path}: redirects to ${location || 'nothing'}, expected ${page.location}`,
			);
		}
	}
	return failures;
}

interface HealthBody {
	status?: string;
	build?: { commitSha?: string | null };
	checks?: { runtime?: { status?: string }; database?: { status?: string } };
}

function healthBodyFailures(body: HealthBody, expectedSha: string | undefined): string[] {
	const failures: string[] = [];
	if (body.checks?.runtime?.status !== 'ok') failures.push('runtime check is not ok');
	if (body.checks?.database?.status !== 'ok') failures.push('database check is not ok');
	const commitSha = body.build?.commitSha ?? 'null';
	if (expectedSha && commitSha !== expectedSha) {
		failures.push(`commitSha ${commitSha}, expected ${expectedSha}`);
	}
	return failures;
}

async function checkHealth(
	fetchImpl: typeof fetch,
	origin: string,
	expectedSha: string | undefined,
): Promise<string[]> {
	const path = '/api/health';
	const response = await fetchImpl(`${origin}${path}`);
	const body = ((await response.json().catch(() => null)) ?? {}) as HealthBody;
	const failures = headerFailures(path, response);
	if (response.status !== 200 || body.status !== 'healthy') {
		failures.push(`${path}: status ${response.status} (${body.status ?? 'no JSON body'})`);
	}
	failures.push(...healthBodyFailures(body, expectedSha).map((failure) => `${path}: ${failure}`));
	return failures;
}

async function checkScheduled(
	options: Required<Pick<LocalCheckOptions, 'origin'>> & LocalCheckOptions,
) {
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
	const failures: string[] = [];
	for (const [job, cron] of Object.entries(SCHEDULED_JOB_CRONS) as [ScheduledJobName, string][]) {
		const url = `${options.origin}${SCHEDULED_HANDLER_PATH}?cron=${encodeURIComponent(cron)}`;
		const response = await fetchImpl(url);
		const text = (await response.text()).trim();
		if (response.status !== 200 || text !== 'ok') {
			failures.push(`scheduled ${job} (${cron}): ${response.status} ${text.slice(0, 80)}`);
			continue;
		}
		if (!options.readLog) continue;
		const marker = SCHEDULED_JOB_LOG_MARKERS[job];
		const deadline = Date.now() + (options.logTimeoutMs ?? 15_000);
		while (!options.readLog().includes(marker) && Date.now() < deadline) await sleep(250);
		if (!options.readLog().includes(marker)) {
			failures.push(`scheduled ${job} (${cron}): no "${marker}" line in the wrangler log`);
		}
	}
	return failures;
}

/** Runs every check and returns the failures; an empty list means the Worker passed. */
export async function runLocalWorkerChecks(options: LocalCheckOptions): Promise<string[]> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const origin = options.origin.replace(/\/$/, '');
	const failures: string[] = [];
	for (const page of PAGE_EXPECTATIONS)
		failures.push(...(await checkPage(fetchImpl, origin, page)));
	failures.push(...(await checkHealth(fetchImpl, origin, options.expectedSha)));
	failures.push(...(await checkScheduled({ ...options, origin, fetchImpl })));
	return failures;
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: { url: { type: 'string' }, log: { type: 'string' }, sha: { type: 'string' } },
	});
	if (!values.url) throw new Error('--url is required (for example http://127.0.0.1:8799).');
	const logPath = values.log;
	const failures = await runLocalWorkerChecks({
		origin: values.url,
		expectedSha: values.sha,
		readLog: logPath ? () => readFileSync(logPath, 'utf8') : undefined,
	});
	if (failures.length > 0) {
		console.error(`Local Worker check failed:\n- ${failures.join('\n- ')}`);
		process.exit(1);
	}
	console.info(
		`Local Worker check passed: ${PAGE_EXPECTATIONS.length} pages, /api/health, ` +
			`${Object.keys(SCHEDULED_JOB_CRONS).length} crons.`,
	);
}

if (
	process.argv[1] &&
	/^cloudflare-worker-local-check\.(?:ts|js)$/.test(basename(process.argv[1]))
) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
