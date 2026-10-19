/**
 * Cloudflare analytics helpers shared by the platform usage collector: UTC
 * query windows, R2 operation classes and per-bucket storage. The collector
 * (`collector/cloudflare-datasets.ts`) queries Cloudflare; the console only
 * reads the snapshots it stores.
 */

import { finiteNumber, isRecord } from './provider-request';

export const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;

/** Free R2 operations; every other action type counts as Class A unless listed as Class B. */
const R2_FREE_ACTIONS = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);
const R2_CLASS_B_ACTIONS = new Set([
	'HeadBucket',
	'HeadObject',
	'GetObject',
	'UsageSummary',
	'GetBucketEncryption',
	'GetBucketLocation',
	'GetBucketCors',
	'GetBucketLifecycleConfiguration',
]);

export function windowBounds(now: Date) {
	const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const storageSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	return {
		now: now.toISOString(),
		dayStart: dayStart.toISOString(),
		monthStart: monthStart.toISOString(),
		storageSince: storageSince.toISOString(),
	};
}

export function classifyR2Operations(rows: Record<string, unknown>[] | null): {
	classA: number | null;
	classB: number | null;
} {
	if (!rows) return { classA: null, classB: null };
	let classA = 0;
	let classB = 0;
	for (const row of rows) {
		const actionType = isRecord(row.dimensions) ? row.dimensions.actionType : undefined;
		const requests = finiteNumber(isRecord(row.sum) ? row.sum.requests : undefined);
		if (typeof actionType !== 'string' || requests === null)
			return { classA: null, classB: null };
		if (R2_FREE_ACTIONS.has(actionType)) continue;
		if (R2_CLASS_B_ACTIONS.has(actionType)) classB += requests;
		else classA += requests;
	}
	return { classA, classB };
}

/** Bytes per bucket from the bucket-grouped query; malformed rows blank the meters. */
export function storageBytesByBucket(
	rows: Record<string, unknown>[] | null,
): Map<string, number> | null {
	if (!rows) return null;
	const byBucket = new Map<string, number>();
	for (const row of rows) {
		const dimensions = isRecord(row.dimensions) ? row.dimensions : null;
		const bucketName = dimensions?.bucketName;
		if (typeof bucketName !== 'string') return null;
		const max = isRecord(row.max) ? row.max : null;
		const payload = finiteNumber(max?.payloadSize);
		if (payload === null) return null;
		const metadata = finiteNumber(max?.metadataSize) ?? 0;
		const bytes = payload + metadata;
		byBucket.set(bucketName, Math.max(byBucket.get(bucketName) ?? 0, bytes));
	}
	return byBucket;
}
