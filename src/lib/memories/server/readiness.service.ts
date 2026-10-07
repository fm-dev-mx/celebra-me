/**
 * Which server settings the memories module is missing, for the super-admin
 * console. It reads the environment but reports only setting names: never a
 * value, a length or a fragment, so the answer is safe to send to the browser.
 */

import { createPrivateKey } from 'node:crypto';
import { getEnv } from '@/lib/server/env';
import type {
	MemoriesConfigKey,
	MemoriesReadiness,
	MemoriesWorkerKey,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_ENV } from './config';
import { normalizePem, resolveMemoriesWorkerUrl } from './private-request';

const MIN_SHARE_SECRET_LENGTH = 32;
const PROBE_TIMEOUT_MS = 3_000;

const WORKER_ENV: Record<MemoriesWorkerKey, string> = {
	uploadOrigin: MEMORIES_ENV.uploadOrigin,
	retrievalOrigin: MEMORIES_ENV.retrievalOrigin,
};

function isUsableSigningKey(envName: string): boolean {
	const pem = normalizePem(getEnv(envName));
	if (!pem) return false;
	try {
		return createPrivateKey(pem).asymmetricKeyType === 'ec';
	} catch {
		return false;
	}
}

function workerOrigin(key: MemoriesWorkerKey): URL | null {
	return resolveMemoriesWorkerUrl(WORKER_ENV[key], '/');
}

/** Settings that are absent or unusable as configured. */
export function findMissingMemoriesConfig(): MemoriesConfigKey[] {
	const checks: Record<MemoriesConfigKey, () => boolean> = {
		uploadOrigin: () => workerOrigin('uploadOrigin') !== null,
		retrievalOrigin: () => workerOrigin('retrievalOrigin') !== null,
		uploadSigningKey: () => isUsableSigningKey(MEMORIES_ENV.uploadSigningPrivateKey),
		retrievalSigningKey: () => isUsableSigningKey(MEMORIES_ENV.retrievalSigningPrivateKey),
		shareSecret: () =>
			getEnv(MEMORIES_ENV.shareSecret).trim().length >= MIN_SHARE_SECRET_LENGTH,
		cronSecret: () => getEnv(MEMORIES_ENV.cronSecret).trim().length > 0,
	};
	return (Object.keys(checks) as MemoriesConfigKey[]).filter((key) => !checks[key]());
}

/**
 * A Worker counts as reachable when it answers anything at all: a 404 or 401 at
 * its root still proves the origin points at a running Worker.
 */
async function probeWorker(origin: URL, fetchImpl: typeof fetch): Promise<boolean> {
	try {
		await fetchImpl(origin, { method: 'GET', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
		return true;
	} catch {
		return false;
	}
}

export async function checkMemoriesReadiness(
	options: { probeWorkers?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<MemoriesReadiness> {
	const missing = findMissingMemoriesConfig();
	if (options.probeWorkers === false) return { missing, unreachable: [] };
	const fetchImpl = options.fetchImpl ?? fetch;
	const unreachable: MemoriesWorkerKey[] = [];
	await Promise.all(
		(Object.keys(WORKER_ENV) as MemoriesWorkerKey[]).map(async (key) => {
			const origin = workerOrigin(key);
			if (origin && !(await probeWorker(origin, fetchImpl))) unreachable.push(key);
		}),
	);
	unreachable.sort();
	return { missing, unreachable };
}
