/**
 * Read-only Production preflight for one event memory space. It sends GET and
 * OPTIONS requests only: no session is created, nothing is reserved and nothing
 * is uploaded. Run it before the canary and again on the day the window opens.
 *
 * It answers one question: does a guest who scans the printed QR reach a page
 * that can talk to the app and to the upload Worker?
 */

import path from 'node:path';
import {
	MEMORIES_CANONICAL_APP_ORIGIN,
	MEMORIES_PUBLIC_ORIGIN,
	isMemoriesPublicSlug,
} from '../../src/lib/memories/contract/private-request';
import type { MemoriesLiveCheck } from '../../src/lib/memories/contract/catalog';
import { runMemoriesLiveChecks } from '../../src/lib/memories/server/live-check';

export type PreflightInvocation = { slug: string; uploadOrigin: string | null };
export type PreflightResult = MemoriesLiveCheck;
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class PreflightArgumentError extends Error {}

export function parsePreflightInvocation(argv: readonly string[]): PreflightInvocation {
	const values = new Map<string, string>();
	for (const argument of argv[0] === '--' ? argv.slice(1) : argv) {
		const match = /^--([a-z-]+)=(.+)$/.exec(argument);
		if (!match) throw new PreflightArgumentError('INVALID_ARGUMENT');
		const [, key, value] = match;
		if (key !== 'slug' && key !== 'upload-origin')
			throw new PreflightArgumentError('UNKNOWN_ARGUMENT');
		if (values.has(key)) throw new PreflightArgumentError('DUPLICATE_ARGUMENT');
		values.set(key, value);
	}
	const slug = values.get('slug') ?? '';
	if (!isMemoriesPublicSlug(slug)) throw new PreflightArgumentError('INVALID_SLUG');
	const rawOrigin = values.get('upload-origin');
	if (!rawOrigin) return { slug, uploadOrigin: null };
	let origin: URL;
	try {
		origin = new URL(rawOrigin);
	} catch {
		throw new PreflightArgumentError('INVALID_UPLOAD_ORIGIN');
	}
	if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash)
		throw new PreflightArgumentError('INVALID_UPLOAD_ORIGIN');
	return { slug, uploadOrigin: origin.origin };
}

export async function runMemoriesPreflight(
	invocation: PreflightInvocation,
	fetchImpl: Fetch = fetch,
): Promise<PreflightResult[]> {
	return runMemoriesLiveChecks(
		{
			slug: invocation.slug,
			appOrigin: MEMORIES_CANONICAL_APP_ORIGIN,
			qrOrigin: MEMORIES_PUBLIC_ORIGIN,
			uploadOrigin: invocation.uploadOrigin,
			uploadSkipDetail: 'pass --upload-origin=<Sign Worker origin> to check it',
		},
		fetchImpl,
	);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
	let invocation: PreflightInvocation;
	try {
		invocation = parsePreflightInvocation(argv);
	} catch (error) {
		console.error(
			JSON.stringify({
				check: 'arguments',
				status: 'FAIL',
				detail:
					error instanceof PreflightArgumentError ? error.message : 'INVALID_ARGUMENT',
			}),
		);
		process.exitCode = 1;
		return;
	}
	const results = await runMemoriesPreflight(invocation);
	for (const entry of results) console.log(JSON.stringify(entry));
	const failed = results.some((entry) => entry.status === 'FAIL');
	console.log(JSON.stringify({ check: 'result', status: failed ? 'FAIL' : 'PASS', detail: '' }));
	if (failed) process.exitCode = 1;
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (
	entryArg.endsWith(`${path.sep}memories-production-preflight.ts`) ||
	entryArg.endsWith(`${path.sep}memories-production-preflight.js`)
) {
	void main();
}
