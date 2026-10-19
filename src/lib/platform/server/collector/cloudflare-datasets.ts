/**
 * Cloudflare datasets of one collector run: Workers health per script, Durable
 * Objects requests and stored objects per namespace, R2 storage and operations
 * per bucket, and celebra-me.com traffic (404/403/threats per day plus the top
 * 404 paths). Each dataset fails on its own; payloads hold aggregates only.
 */

import { classifyR2Operations, storageBytesByBucket, windowBounds } from '../cloudflare-usage';
import {
	type CloudflareGraphqlResult,
	firstViewerNode,
	queryCloudflareGraphql,
} from '../cloudflare-graphql';
import {
	type ProviderFailure,
	asRows,
	fetchProviderJson,
	finiteNumber,
	isRecord,
} from '../provider-request';
import type { CloudflareCollectorConfig } from './collector-config';
import type { DatasetResult, PlatformSnapshotFailure } from './types';

const REST_ENDPOINT = 'https://api.cloudflare.com/client/v4';
/** Largest page the Durable Objects object listing accepts. */
const OBJECTS_PAGE_SIZE = 10_000;
/** Bounds one namespace to 100k listed objects per run; beyond that the count is a floor. */
const MAX_OBJECT_PAGES = 10;
const ZONE_DAYS = 8;
const TOP_404_PATHS = 10;
const MAX_PATH_LENGTH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Token permission each request needs, reported when Cloudflare denies it. */
const CLOUDFLARE_PERMISSIONS = {
	accountAnalytics: 'Account Analytics Read',
	workersScripts: 'Workers Scripts Read',
	zoneAnalytics: 'Zone Analytics Read (celebra-me.com)',
} as const;

const WORKERS_QUERY = `query PlatformWorkersHealth($accountTag: string!, $dayStart: Time!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		today: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $dayStart, datetime_leq: $now }) {
			dimensions { scriptName }
			sum { requests errors cpuTimeUs }
			quantiles { cpuTimeP50 cpuTimeP99 }
		}
		month: workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			dimensions { scriptName }
			sum { requests errors cpuTimeUs }
			quantiles { cpuTimeP50 cpuTimeP99 }
		}
	} }
}`;

const DURABLE_OBJECTS_QUERY = `query PlatformDurableObjects($accountTag: string!, $dayStart: Time!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		today: durableObjectsInvocationsAdaptiveGroups(limit: 100, filter: { datetime_geq: $dayStart, datetime_leq: $now }) {
			dimensions { namespaceId }
			sum { requests errors }
		}
		month: durableObjectsInvocationsAdaptiveGroups(limit: 100, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			dimensions { namespaceId }
			sum { requests errors }
		}
	} }
}`;

const R2_QUERY = `query PlatformR2($accountTag: string!, $storageSince: Time!, $monthStart: Time!, $now: Time!) {
	viewer { accounts(filter: { accountTag: $accountTag }) {
		storage: r2StorageAdaptiveGroups(limit: 1000, filter: { datetime_geq: $storageSince, datetime_leq: $now }) {
			dimensions { bucketName }
			max { payloadSize metadataSize }
		}
		operations: r2OperationsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $monthStart, datetime_leq: $now }) {
			dimensions { bucketName actionType }
			sum { requests }
		}
	} }
}`;

const ZONE_QUERY = `query PlatformZoneTraffic($zoneTag: string!, $sinceDate: Date!, $untilDate: Date!, $since: Time!, $now: Time!) {
	viewer { zones(filter: { zoneTag: $zoneTag }) {
		days: httpRequests1dGroups(limit: ${ZONE_DAYS}, filter: { date_geq: $sinceDate, date_leq: $untilDate }, orderBy: [date_ASC]) {
			dimensions { date }
			sum { requests threats responseStatusMap { edgeResponseStatus requests } }
		}
		top404: httpRequestsAdaptiveGroups(limit: ${TOP_404_PATHS}, filter: { datetime_geq: $since, datetime_leq: $now, edgeResponseStatus: 404 }, orderBy: [count_DESC]) {
			count
			dimensions { clientRequestPath }
		}
	} }
}`;

function failed(
	failure: ProviderFailure,
	stage: string,
	permission: string,
	code?: string,
): DatasetResult {
	const payload: PlatformSnapshotFailure = { failure, stage };
	if (code) payload.code = code;
	// 403, or a GraphQL authorization error, means the token lacks this permission.
	if (failure === 'http_403' || (failure === 'graphql_error' && code === 'authz')) {
		payload.missingPermission = permission;
	}
	return { ok: false, payload };
}

function graphqlFailure(
	result: Extract<CloudflareGraphqlResult, { ok: false }>,
	permission: string,
): DatasetResult {
	return failed(result.failure, 'graphql', permission, result.code);
}

function malformed(stage: string, permission: string): DatasetResult {
	return failed('malformed', stage, permission);
}

const usToMs = (us: number) => Math.round(us / 1000);

interface WorkerWindow {
	requests: number;
	errors: number;
	cpuTimeMs: number;
	cpuP50Ms: number;
	cpuP99Ms: number;
}

/**
 * Per-script figures for one window. A script can come back in several rows
 * (`__unknown__` does); sums add up and quantiles keep the worst row.
 */
function parseWorkerRow(
	row: Record<string, unknown>,
): { scriptName: string; window: WorkerWindow } | null {
	const scriptName = isRecord(row.dimensions) ? row.dimensions.scriptName : undefined;
	const sum = isRecord(row.sum) ? row.sum : null;
	const quantiles = isRecord(row.quantiles) ? row.quantiles : null;
	const requests = finiteNumber(sum?.requests);
	const errors = finiteNumber(sum?.errors);
	const cpuUs = finiteNumber(sum?.cpuTimeUs);
	if (typeof scriptName !== 'string' || requests === null || errors === null || cpuUs === null) {
		return null;
	}
	return {
		scriptName,
		window: {
			requests,
			errors,
			cpuTimeMs: usToMs(cpuUs),
			cpuP50Ms: usToMs(finiteNumber(quantiles?.cpuTimeP50) ?? 0),
			cpuP99Ms: usToMs(finiteNumber(quantiles?.cpuTimeP99) ?? 0),
		},
	};
}

/**
 * Per-script figures for one window. A script can come back in several rows
 * (`__unknown__` does); sums add up and quantiles keep the worst row.
 */
export function workerWindowsByScript(
	rows: Record<string, unknown>[] | null,
): Map<string, WorkerWindow> | null {
	if (!rows) return null;
	const byScript = new Map<string, WorkerWindow>();
	for (const row of rows) {
		const parsed = parseWorkerRow(row);
		if (!parsed) return null;
		const previous = byScript.get(parsed.scriptName);
		const next = parsed.window;
		byScript.set(
			parsed.scriptName,
			previous
				? {
						requests: previous.requests + next.requests,
						errors: previous.errors + next.errors,
						cpuTimeMs: previous.cpuTimeMs + next.cpuTimeMs,
						cpuP50Ms: Math.max(previous.cpuP50Ms, next.cpuP50Ms),
						cpuP99Ms: Math.max(previous.cpuP99Ms, next.cpuP99Ms),
					}
				: next,
		);
	}
	return byScript;
}

function totalsOf(windows: Iterable<WorkerWindow>) {
	let requests = 0;
	let errors = 0;
	let cpuTimeMs = 0;
	for (const window of windows) {
		requests += window.requests;
		errors += window.errors;
		cpuTimeMs += window.cpuTimeMs;
	}
	return { requests, errors, cpuTimeMs };
}

/** Account query variables: today and the month so far, in UTC. */
function accountWindows(config: CloudflareCollectorConfig, now: Date) {
	const bounds = windowBounds(now);
	return {
		accountTag: config.accountId,
		dayStart: bounds.dayStart,
		monthStart: bounds.monthStart,
		now: bounds.now,
	};
}

export async function collectWorkers(
	config: CloudflareCollectorConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<DatasetResult> {
	const permission = CLOUDFLARE_PERMISSIONS.accountAnalytics;
	const variables = accountWindows(config, now);
	const result = await queryCloudflareGraphql(WORKERS_QUERY, variables, config.token, fetchImpl);
	if (!result.ok) return graphqlFailure(result, permission);
	const account = firstViewerNode(result.viewer, 'accounts');
	const today = workerWindowsByScript(asRows(account?.today));
	const month = workerWindowsByScript(asRows(account?.month));
	if (!today || !month) return malformed('graphql', permission);
	const names = [...new Set([...month.keys(), ...today.keys()])].sort();
	return {
		ok: true,
		payload: {
			dayStart: variables.dayStart,
			monthStart: variables.monthStart,
			scripts: names.map((scriptName) => ({
				scriptName,
				today: today.get(scriptName) ?? null,
				month: month.get(scriptName) ?? null,
			})),
			totals: { today: totalsOf(today.values()), month: totalsOf(month.values()) },
		},
	};
}

function requestsByNamespace(
	rows: Record<string, unknown>[] | null,
): Map<string, { requests: number; errors: number }> | null {
	if (!rows) return null;
	const byNamespace = new Map<string, { requests: number; errors: number }>();
	for (const row of rows) {
		const namespaceId = isRecord(row.dimensions) ? row.dimensions.namespaceId : undefined;
		const sum = isRecord(row.sum) ? row.sum : null;
		const requests = finiteNumber(sum?.requests);
		const errors = finiteNumber(sum?.errors);
		if (typeof namespaceId !== 'string' || requests === null || errors === null) return null;
		const previous = byNamespace.get(namespaceId);
		byNamespace.set(namespaceId, {
			requests: (previous?.requests ?? 0) + requests,
			errors: (previous?.errors ?? 0) + errors,
		});
	}
	return byNamespace;
}

interface NamespaceInfo {
	id: string;
	name: string | null;
	script: string | null;
	className: string | null;
}

type RestResult<T> = { ok: true; value: T } | { ok: false; failure: ProviderFailure };

async function listNamespaces(
	config: CloudflareCollectorConfig,
	fetchImpl: typeof fetch,
): Promise<RestResult<NamespaceInfo[]>> {
	const response = await fetchProviderJson(
		`${REST_ENDPOINT}/accounts/${config.accountId}/workers/durable_objects/namespaces?per_page=1000`,
		{ method: 'GET', token: config.token },
		fetchImpl,
	);
	if (!response.ok) return { ok: false, failure: response.failure };
	const rows = isRecord(response.body) ? asRows(response.body.result) : null;
	if (!rows) return { ok: false, failure: 'malformed' };
	const text = (value: unknown) => (typeof value === 'string' ? value : null);
	const namespaces: NamespaceInfo[] = [];
	for (const row of rows) {
		if (typeof row.id !== 'string') return { ok: false, failure: 'malformed' };
		namespaces.push({
			id: row.id,
			name: text(row.name),
			script: text(row.script),
			className: text(row.class),
		});
	}
	return { ok: true, value: namespaces };
}

/** Objects in a namespace and how many hold stored data, following the cursor. */
export async function countNamespaceObjects(
	config: CloudflareCollectorConfig,
	namespaceId: string,
	fetchImpl: typeof fetch,
): Promise<RestResult<{ objects: number; withStoredData: number; truncated: boolean }>> {
	let objects = 0;
	let withStoredData = 0;
	let cursor: string | null = null;
	for (let page = 0; page < MAX_OBJECT_PAGES; page += 1) {
		const query = new URLSearchParams({ limit: String(OBJECTS_PAGE_SIZE) });
		if (cursor) query.set('cursor', cursor);
		const response = await fetchProviderJson(
			`${REST_ENDPOINT}/accounts/${config.accountId}/workers/durable_objects/namespaces/${encodeURIComponent(namespaceId)}/objects?${query}`,
			{ method: 'GET', token: config.token },
			fetchImpl,
		);
		if (!response.ok) return { ok: false, failure: response.failure };
		const body = isRecord(response.body) ? response.body : null;
		const rows = asRows(body?.result);
		if (!rows) return { ok: false, failure: 'malformed' };
		objects += rows.length;
		withStoredData += rows.filter((row) => row.hasStoredData === true).length;
		const info = isRecord(body?.result_info) ? body.result_info : null;
		// The API returns a cursor even on the last page; a short page ends the listing.
		cursor = typeof info?.cursor === 'string' && info.cursor ? info.cursor : null;
		if (rows.length < OBJECTS_PAGE_SIZE || !cursor) {
			return { ok: true, value: { objects, withStoredData, truncated: false } };
		}
	}
	return { ok: true, value: { objects, withStoredData, truncated: true } };
}

export async function collectDurableObjects(
	config: CloudflareCollectorConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<DatasetResult> {
	const variables = accountWindows(config, now);
	const [graphql, namespaces] = await Promise.all([
		queryCloudflareGraphql(DURABLE_OBJECTS_QUERY, variables, config.token, fetchImpl),
		listNamespaces(config, fetchImpl),
	]);
	if (!graphql.ok) return graphqlFailure(graphql, CLOUDFLARE_PERMISSIONS.accountAnalytics);
	if (!namespaces.ok) {
		return failed(namespaces.failure, 'namespaces', CLOUDFLARE_PERMISSIONS.workersScripts);
	}
	const account = firstViewerNode(graphql.viewer, 'accounts');
	const today = requestsByNamespace(asRows(account?.today));
	const month = requestsByNamespace(asRows(account?.month));
	if (!today || !month) return malformed('graphql', CLOUDFLARE_PERMISSIONS.accountAnalytics);
	const counts = await Promise.all(
		namespaces.value.map((namespace) => countNamespaceObjects(config, namespace.id, fetchImpl)),
	);
	const failedCount = counts.find((count) => !count.ok);
	if (failedCount && !failedCount.ok) {
		return failed(failedCount.failure, 'objects', CLOUDFLARE_PERMISSIONS.workersScripts);
	}
	const rows = namespaces.value.map((namespace, index) => {
		const count = counts[index];
		return {
			...namespace,
			requestsToday: today.get(namespace.id)?.requests ?? 0,
			requestsMonth: month.get(namespace.id)?.requests ?? 0,
			errorsMonth: month.get(namespace.id)?.errors ?? 0,
			...(count?.ok ? count.value : { objects: 0, withStoredData: 0, truncated: false }),
		};
	});
	return {
		ok: true,
		payload: {
			dayStart: variables.dayStart,
			monthStart: variables.monthStart,
			namespaces: rows,
			totals: {
				requestsToday: rows.reduce((sum, row) => sum + row.requestsToday, 0),
				requestsMonth: rows.reduce((sum, row) => sum + row.requestsMonth, 0),
				objects: rows.reduce((sum, row) => sum + row.objects, 0),
				withStoredData: rows.reduce((sum, row) => sum + row.withStoredData, 0),
			},
		},
	};
}

export async function collectR2(
	config: CloudflareCollectorConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<DatasetResult> {
	const permission = CLOUDFLARE_PERMISSIONS.accountAnalytics;
	const bounds = windowBounds(now);
	const variables = {
		accountTag: config.accountId,
		storageSince: bounds.storageSince,
		monthStart: bounds.monthStart,
		now: bounds.now,
	};
	const result = await queryCloudflareGraphql(R2_QUERY, variables, config.token, fetchImpl);
	if (!result.ok) return graphqlFailure(result, permission);
	const account = firstViewerNode(result.viewer, 'accounts');
	const storage = storageBytesByBucket(asRows(account?.storage));
	const operationRows = asRows(account?.operations);
	if (!storage || !operationRows) return malformed('graphql', permission);
	const rowsByBucket = new Map<string, Record<string, unknown>[]>();
	for (const row of operationRows) {
		const bucketName = isRecord(row.dimensions) ? row.dimensions.bucketName : undefined;
		if (typeof bucketName !== 'string') return malformed('graphql', permission);
		rowsByBucket.set(bucketName, [...(rowsByBucket.get(bucketName) ?? []), row]);
	}
	const names = [...new Set([...storage.keys(), ...rowsByBucket.keys()])].sort();
	const buckets = [];
	for (const bucketName of names) {
		const operations = classifyR2Operations(rowsByBucket.get(bucketName) ?? []);
		if (operations.classA === null || operations.classB === null) {
			return malformed('graphql', permission);
		}
		buckets.push({
			bucketName,
			storageBytes: storage.get(bucketName) ?? 0,
			classA: operations.classA,
			classB: operations.classB,
		});
	}
	return {
		ok: true,
		payload: {
			monthStart: variables.monthStart,
			buckets,
			totals: {
				storageBytes: buckets.reduce((sum, bucket) => sum + bucket.storageBytes, 0),
				classA: buckets.reduce((sum, bucket) => sum + bucket.classA, 0),
				classB: buckets.reduce((sum, bucket) => sum + bucket.classB, 0),
			},
		},
	};
}

function statusCount(map: unknown, status: number): number | null {
	const rows = asRows(map);
	if (!rows) return null;
	let total = 0;
	for (const row of rows) {
		const requests = finiteNumber(row.requests);
		if (requests === null) return null;
		if (row.edgeResponseStatus === status) total += requests;
	}
	return total;
}

function parseZoneDay(row: Record<string, unknown>) {
	const date = isRecord(row.dimensions) ? row.dimensions.date : undefined;
	const sum = isRecord(row.sum) ? row.sum : null;
	const day = {
		requests: finiteNumber(sum?.requests),
		threats: finiteNumber(sum?.threats),
		status403: statusCount(sum?.responseStatusMap, 403),
		status404: statusCount(sum?.responseStatusMap, 404),
	};
	if (typeof date !== 'string' || Object.values(day).some((value) => value === null)) return null;
	return { date, ...day };
}

function parse404Path(row: Record<string, unknown>) {
	const path = isRecord(row.dimensions) ? row.dimensions.clientRequestPath : undefined;
	const count = finiteNumber(row.count);
	if (typeof path !== 'string' || count === null) return null;
	// Scanner-controlled text: stored truncated and only ever rendered as text.
	return { path: path.slice(0, MAX_PATH_LENGTH), count };
}

export async function collectZone(
	config: CloudflareCollectorConfig,
	now: Date,
	fetchImpl: typeof fetch,
): Promise<DatasetResult> {
	const permission = CLOUDFLARE_PERMISSIONS.zoneAnalytics;
	const variables = {
		zoneTag: config.zoneTag,
		sinceDate: new Date(now.getTime() - (ZONE_DAYS - 1) * DAY_MS).toISOString().slice(0, 10),
		untilDate: now.toISOString().slice(0, 10),
		since: new Date(now.getTime() - DAY_MS).toISOString(),
		now: now.toISOString(),
	};
	const result = await queryCloudflareGraphql(ZONE_QUERY, variables, config.token, fetchImpl);
	if (!result.ok) return graphqlFailure(result, permission);
	const zone = firstViewerNode(result.viewer, 'zones');
	const dayRows = asRows(zone?.days);
	const pathRows = asRows(zone?.top404);
	if (!dayRows || !pathRows) return malformed('graphql', permission);
	const days = dayRows.map(parseZoneDay);
	const top404Paths = pathRows.map(parse404Path);
	if (days.some((day) => day === null) || top404Paths.some((path) => path === null)) {
		return malformed('graphql', permission);
	}
	return { ok: true, payload: { days, top404Since: variables.since, top404Paths } };
}
