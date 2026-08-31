/* eslint-disable max-lines -- The single bounded CLI keeps hosted gates and sanitized orchestration together. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
	VALENTINA_MEMORIES_BROWSER_ORIGINS,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_RATE_LIMIT,
	getValentinaMemoriesStorageBucketName,
} from '../src/data/valentina-memories-upload.contract.ts';
import { isValentinaMemoriesObjectKeyForMime } from '../src/data/valentina-memories-media.contract.ts';
import { retrieveValentinaMemoryObject } from '../src/lib/memories/valentina-memories-retrieval.ts';
import {
	VALENTINA_MEMORIES_LOAD_AUTHORIZATION,
	VALENTINA_MEMORIES_LOAD_COHORT_SIZE,
	VALENTINA_MEMORIES_LOAD_ONBOARDING_SECONDS,
	assertLoadBudget,
	assertSanitizedLoadReport,
	assertStagingOnlyTarget,
	percentile,
	projectValentinaMemoriesLoad,
	withoutLoadUnits,
	type LoadProjection,
	type LoadStageName,
	type LoadUnit,
	type SanitizedLoadReport,
	type SanitizedStageResult,
} from './valentina-memories-load-plan.ts';

type CliOptions = {
	execute: boolean;
	target: string;
	origin: string;
	expectedRevision?: string;
	deploymentLocator?: string;
	imageFixture?: string;
	videoFixture?: string;
	videoDurationSeconds: number;
	imageBytes: number;
	videoBytes: number;
	baselineObjects: number;
	baselineBytes: number;
	baselineObjectsProvided: boolean;
	baselineBytesProvided: boolean;
	baselineObservedAt?: string;
	budgetObjects?: number;
	budgetBytes?: number;
	budgetRequests?: number;
	diagnostic25: boolean;
	diagnosticReason?: string;
	soakMinutes?: 15 | 30;
	soakReason?: string;
	reportPath?: string;
};

type SessionState = { cookie: string };
type Fixture = {
	bytes: Uint8Array;
	mimeType: 'image/jpeg' | 'video/mp4';
	durationSeconds: number | null;
};
type UploadCapability = {
	uploadUrl: string;
	requiredHeaders: Record<string, string>;
	expiresAt: string;
};
type PublicItem = { id: string; status: string };
type Reservation = { item: PublicItem; upload: UploadCapability };
type RuntimeItem = {
	itemId: string;
	objectKey: string;
	mimeType: Fixture['mimeType'];
	sessionIndex: number;
};

class SafeLoadError extends Error {
	constructor(readonly reason: string) {
		super(reason);
	}
}

const DEFAULT_IMAGE_BYTES = 256 * 1024;
const DEFAULT_VIDEO_BYTES = 1024 * 1024;
const ALLOWED_DIAGNOSTIC_REASONS = new Set(['50-concurrency-inflection']);
const ALLOWED_SOAK_REASONS = new Set([
	'unexplained-degradation',
	'sustained-resource-growth',
	'cleanup-lag',
	'unstable-latency',
]);

function valueAfter(args: string[], index: number, label: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith('--')) throw new SafeLoadError(`Missing value for ${label}.`);
	return value;
}

function parseInteger(raw: string, label: string): number {
	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value < 0)
		throw new SafeLoadError(`${label} must be a non-negative integer.`);
	return value;
}

// eslint-disable-next-line complexity -- Explicit bounded flags keep every hosted gate auditable.
export function parseValentinaMemoriesLoadArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		execute: false,
		target: 'staging',
		origin: VALENTINA_MEMORIES_BROWSER_ORIGINS.staging[0],
		videoDurationSeconds: 15,
		imageBytes: DEFAULT_IMAGE_BYTES,
		videoBytes: DEFAULT_VIDEO_BYTES,
		baselineObjects: 0,
		baselineBytes: 0,
		baselineObjectsProvided: false,
		baselineBytesProvided: false,
		diagnostic25: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (flag === '--execute') options.execute = true;
		else if (flag === '--target') options.target = valueAfter(args, index++, flag);
		else if (flag === '--origin') options.origin = valueAfter(args, index++, flag);
		else if (flag === '--expected-revision')
			options.expectedRevision = valueAfter(args, index++, flag);
		else if (flag === '--deployment')
			options.deploymentLocator = valueAfter(args, index++, flag);
		else if (flag === '--image-fixture') options.imageFixture = valueAfter(args, index++, flag);
		else if (flag === '--video-fixture') options.videoFixture = valueAfter(args, index++, flag);
		else if (flag === '--video-duration')
			options.videoDurationSeconds = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--image-bytes')
			options.imageBytes = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--video-bytes')
			options.videoBytes = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--baseline-objects') {
			options.baselineObjects = parseInteger(valueAfter(args, index++, flag), flag);
			options.baselineObjectsProvided = true;
		} else if (flag === '--baseline-bytes') {
			options.baselineBytes = parseInteger(valueAfter(args, index++, flag), flag);
			options.baselineBytesProvided = true;
		} else if (flag === '--baseline-observed-at')
			options.baselineObservedAt = valueAfter(args, index++, flag);
		else if (flag === '--budget-objects')
			options.budgetObjects = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--budget-bytes')
			options.budgetBytes = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--budget-requests')
			options.budgetRequests = parseInteger(valueAfter(args, index++, flag), flag);
		else if (flag === '--diagnostic-25') options.diagnostic25 = true;
		else if (flag === '--diagnostic-reason')
			options.diagnosticReason = valueAfter(args, index++, flag);
		else if (flag === '--soak-minutes') {
			const minutes = parseInteger(valueAfter(args, index++, flag), flag);
			if (minutes !== 15 && minutes !== 30)
				throw new SafeLoadError('--soak-minutes must be 15 or 30.');
			options.soakMinutes = minutes;
		} else if (flag === '--soak-reason') options.soakReason = valueAfter(args, index++, flag);
		else if (flag === '--report') options.reportPath = valueAfter(args, index++, flag);
		else throw new SafeLoadError(`Unknown option: ${flag}.`);
	}
	assertStagingOnlyTarget({
		target: options.target,
		origin: options.origin,
		deploymentLocator: options.deploymentLocator,
	});
	if (options.diagnostic25 && !ALLOWED_DIAGNOSTIC_REASONS.has(options.diagnosticReason ?? ''))
		throw new SafeLoadError(
			'The 25-concurrency diagnostic requires a measured 50-concurrency inflection.',
		);
	if (options.soakMinutes && !ALLOWED_SOAK_REASONS.has(options.soakReason ?? ''))
		throw new SafeLoadError(
			'A conditional soak requires one allowed measured diagnostic reason.',
		);
	return options;
}

async function fixtureFromFile(
	filePath: string,
	mimeType: Fixture['mimeType'],
	durationSeconds: number | null,
): Promise<Fixture> {
	const bytes = await readFile(path.resolve(process.cwd(), filePath));
	return { bytes, mimeType, durationSeconds };
}

// eslint-disable-next-line complexity -- Fail-closed execution gates remain explicit and locally auditable.
function requireExecutionOptions(options: CliOptions): asserts options is CliOptions & {
	expectedRevision: string;
	deploymentLocator: string;
	imageFixture: string;
	videoFixture: string;
	budgetObjects: number;
	budgetBytes: number;
	budgetRequests: number;
} {
	if (process.env.VALENTINA_MEMORIES_LOAD_AUTHORIZATION !== VALENTINA_MEMORIES_LOAD_AUTHORIZATION)
		throw new SafeLoadError('Explicit owner Staging execution authorization is unavailable.');
	if (process.env.VALENTINA_MEMORIES_LOAD_COST_APPROVED !== 'true')
		throw new SafeLoadError('Explicit owner cost authorization is unavailable.');
	if (process.env.VALENTINA_MEMORIES_LOAD_STORAGE_TARGET !== 'staging')
		throw new SafeLoadError(
			'The authorized storage target is not structurally identified as Staging.',
		);
	if (!options.expectedRevision || !/^[0-9a-f]{40}$/i.test(options.expectedRevision))
		throw new SafeLoadError('An exact deployed Git revision is required.');
	for (const [label, value] of [
		['deployment', options.deploymentLocator],
		['image fixture', options.imageFixture],
		['video fixture', options.videoFixture],
	] as const) {
		if (!value) throw new SafeLoadError(`The ${label} is required for execution.`);
	}
	if (
		options.budgetObjects === undefined ||
		options.budgetBytes === undefined ||
		options.budgetRequests === undefined
	)
		throw new SafeLoadError('Explicit object, byte, and request budgets are required.');
	const baselineTimestamp = Date.parse(options.baselineObservedAt ?? '');
	if (
		!options.baselineObjectsProvided ||
		!options.baselineBytesProvided ||
		!Number.isFinite(baselineTimestamp) ||
		baselineTimestamp > Date.now() ||
		Date.now() - baselineTimestamp > 15 * 60 * 1000
	)
		throw new SafeLoadError('A fresh owner-operated read-only quota baseline is required.');
	if (
		options.videoDurationSeconds <= 0 ||
		options.videoDurationSeconds > VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS
	)
		throw new SafeLoadError('The video fixture duration is outside the canonical limit.');
	for (const name of [
		'VERCEL_TOKEN',
		'VERCEL_TEAM_ID',
		'CLOUDFLARE_API_TOKEN',
		'CLOUDFLARE_ACCOUNT_ID',
		'CRON_SECRET',
	]) {
		if (!process.env[name])
			throw new SafeLoadError(
				`Required read-only or cleanup visibility is unavailable (${name}).`,
			);
	}
}

function safeDeploymentAliases(payload: unknown): string[] {
	if (typeof payload !== 'object' || payload === null) return [];
	const aliases = (payload as { alias?: unknown }).alias;
	return Array.isArray(aliases)
		? aliases.filter((entry): entry is string => typeof entry === 'string')
		: [];
}

async function verifyDeployment(
	options: CliOptions & { expectedRevision: string; deploymentLocator: string },
): Promise<void> {
	const locator = encodeURIComponent(options.deploymentLocator);
	const deploymentUrl = new URL(`https://api.vercel.com/v13/deployments/${locator}`);
	deploymentUrl.searchParams.set('teamId', process.env.VERCEL_TEAM_ID as string);
	const response = await fetch(deploymentUrl, {
		headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new SafeLoadError('The deployed revision could not be verified.');
	const payload = (await response.json()) as {
		readyState?: unknown;
		meta?: { githubCommitSha?: unknown };
		target?: unknown;
		url?: unknown;
	};
	const originHost = new URL(options.origin).hostname;
	const aliases = safeDeploymentAliases(payload);
	if (
		payload.readyState !== 'READY' ||
		payload.target === 'production' ||
		payload.meta?.githubCommitSha !== options.expectedRevision ||
		!aliases.some((alias) => alias === originHost)
	) {
		throw new SafeLoadError(
			'The deployed revision, target, or stable allowlisted alias does not match.',
		);
	}
}

type ProviderMetric = SanitizedLoadReport['providerMetrics'][number];

async function collectProviderMetric(
	checkpoint: ProviderMetric['checkpoint'],
): Promise<ProviderMetric> {
	const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID as string;
	const bucketName = getValentinaMemoriesStorageBucketName('staging');
	if (!bucketName)
		throw new SafeLoadError('The canonical Staging storage target is unavailable.');
	const end = new Date();
	const start = new Date(end.getTime() - 15 * 60 * 1000);
	const query = `query LoadMetrics($accountTag: string!, $bucketName: string, $start: Time, $end: Time) {
		viewer { accounts(filter: { accountTag: $accountTag }) {
			r2StorageAdaptiveGroups(limit: 1, filter: { bucketName: $bucketName, datetime_geq: $start, datetime_leq: $end }, orderBy: [datetime_DESC]) { max { objectCount payloadSize } }
			r2OperationsAdaptiveGroups(limit: 1000, filter: { bucketName: $bucketName, datetime_geq: $start, datetime_leq: $end }) { sum { requests } }
		} }
	}`;
	const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query,
			variables: {
				accountTag,
				bucketName,
				start: start.toISOString(),
				end: end.toISOString(),
			},
		}),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new SafeLoadError('Provider metric visibility is unavailable.');
	const payload = (await response.json()) as {
		errors?: unknown[];
		data?: {
			viewer?: {
				accounts?: Array<{
					r2StorageAdaptiveGroups?: Array<{
						max?: { objectCount?: number; payloadSize?: number };
					}>;
					r2OperationsAdaptiveGroups?: Array<{ sum?: { requests?: number } }>;
				}>;
			};
		};
	};
	if (payload.errors?.length)
		throw new SafeLoadError('Provider metric visibility is unavailable.');
	const account = payload.data?.viewer?.accounts?.[0];
	if (!account) throw new SafeLoadError('Provider metric visibility is unavailable.');
	const storage = account.r2StorageAdaptiveGroups?.[0]?.max;
	const requestCount =
		account.r2OperationsAdaptiveGroups?.reduce(
			(sum, group) => sum + (group.sum?.requests ?? 0),
			0,
		) ?? null;
	return {
		checkpoint,
		objectCount: typeof storage?.objectCount === 'number' ? storage.objectCount : null,
		payloadBytes: typeof storage?.payloadSize === 'number' ? storage.payloadSize : null,
		requestCount,
	};
}

function cookieFromResponse(response: Response): string {
	const headers = response.headers as Headers & { getSetCookie?: () => string[] };
	const values = headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
	const cookie = values
		.map((value) => value.split(';', 1)[0])
		.find((value) => value.startsWith('__Host-valentina_memories_session='));
	if (!cookie) throw new SafeLoadError('A Staging session cookie was not issued.');
	return cookie;
}

async function appRequest(
	origin: string,
	pathname: string,
	init: RequestInit,
	expected: number[],
): Promise<Response> {
	const response = await fetch(new URL(pathname, origin), {
		...init,
		headers: { Origin: origin, ...(init.headers ?? {}) },
		signal: init.signal ?? AbortSignal.timeout(30_000),
	});
	if (!expected.includes(response.status)) {
		if (response.status >= 500)
			throw new SafeLoadError('An unexpected 5xx occurred during hosted execution.');
		throw new SafeLoadError('An unexpected response occurred during hosted execution.');
	}
	return response;
}

async function createCohort(origin: string): Promise<SessionState[]> {
	const sessions: SessionState[] = [];
	const intervalMs =
		(VALENTINA_MEMORIES_LOAD_ONBOARDING_SECONDS * 1000) / VALENTINA_MEMORIES_LOAD_COHORT_SIZE;
	for (let index = 0; index < VALENTINA_MEMORIES_LOAD_COHORT_SIZE; index += 1) {
		if (index > 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
		const response = await appRequest(
			origin,
			'/api/memories/valentina/session',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create',
					displayName: `Carga sintetica ${String(index + 1).padStart(3, '0')}`,
				}),
			},
			[201],
		);
		sessions.push({ cookie: cookieFromResponse(response) });
	}
	return sessions;
}

function uniqueFixture(base: Fixture, unit: LoadUnit): Fixture {
	const tag = new TextEncoder().encode(
		`\nsynthetic-load-${unit.sequence.toString(16).padStart(8, '0')}\n`,
	);
	const bytes = new Uint8Array(base.bytes.byteLength + tag.byteLength);
	bytes.set(base.bytes);
	bytes.set(tag, base.bytes.byteLength);
	return { ...base, bytes };
}

function checksumFor(bytes: Uint8Array): { hex: string; base64: string } {
	const digest = createHash('sha256').update(bytes).digest();
	return { hex: digest.toString('hex'), base64: digest.toString('base64') };
}

function objectKeyFromCapability(capability: UploadCapability, mimeType: string): string {
	const pathname = decodeURIComponent(new URL(capability.uploadUrl).pathname);
	const prefixIndex = pathname.indexOf('events/valentina/');
	if (prefixIndex < 0)
		throw new SafeLoadError(
			'The upload capability did not contain a canonical object locator.',
		);
	const objectKey = pathname.slice(prefixIndex);
	if (!isValentinaMemoriesObjectKeyForMime(objectKey, mimeType))
		throw new SafeLoadError(
			'The upload capability did not contain a canonical object locator.',
		);
	return objectKey;
}

async function reserve(
	origin: string,
	session: SessionState,
	fixture: Fixture,
	requestId: string,
): Promise<Reservation> {
	const checksum = checksumFor(fixture.bytes);
	const response = await appRequest(
		origin,
		'/api/memories/valentina/items',
		{
			method: 'POST',
			headers: { Cookie: session.cookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'reserve',
				mimeType: fixture.mimeType,
				sizeBytes: fixture.bytes.byteLength,
				checksumSha256: checksum.hex,
				durationSeconds: fixture.durationSeconds,
				clientRequestId: requestId,
			}),
		},
		[201],
	);
	return (await response.json()) as Reservation;
}

async function completeUpload(
	origin: string,
	session: SessionState,
	fixture: Fixture,
	reservation: Reservation,
	sessionIndex: number,
): Promise<RuntimeItem> {
	const checksum = checksumFor(fixture.bytes);
	if (reservation.upload.requiredHeaders['x-amz-checksum-sha256'] !== checksum.base64)
		throw new SafeLoadError('The signed checksum does not match the synthetic fixture.');
	const putResponse = await fetch(reservation.upload.uploadUrl, {
		method: 'PUT',
		headers: { Origin: origin, ...reservation.upload.requiredHeaders },
		body: new Uint8Array(fixture.bytes).buffer,
		signal: AbortSignal.timeout(60_000),
	});
	if (!putResponse.ok) throw new SafeLoadError('A direct Staging upload failed.');
	const completion = await appRequest(
		origin,
		`/api/memories/valentina/items/${reservation.item.id}`,
		{
			method: 'POST',
			headers: { Cookie: session.cookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'complete' }),
		},
		[200],
	);
	const completed = (await completion.json()) as { item?: PublicItem };
	if (completed.item?.status !== 'accepted')
		throw new SafeLoadError('A unique synthetic upload was not accepted.');
	await appRequest(
		origin,
		`/api/memories/valentina/items/${reservation.item.id}`,
		{
			headers: { Cookie: session.cookie },
		},
		[200],
	);
	return {
		itemId: reservation.item.id,
		objectKey: objectKeyFromCapability(reservation.upload, fixture.mimeType),
		mimeType: fixture.mimeType,
		sessionIndex,
	};
}

async function logicalDelete(
	origin: string,
	sessions: SessionState[],
	items: RuntimeItem[],
): Promise<void> {
	for (const item of items) {
		const session = sessions[item.sessionIndex];
		await appRequest(
			origin,
			`/api/memories/valentina/items/${item.itemId}`,
			{
				method: 'DELETE',
				headers: { Cookie: session.cookie },
			},
			[200],
		);
		await appRequest(
			origin,
			`/api/memories/valentina/items/${item.itemId}`,
			{
				headers: { Cookie: session.cookie },
			},
			[404],
		);
	}
}

function stageResult(
	stage: SanitizedStageResult['stage'],
	planned: number,
	latencies: number[],
): SanitizedStageResult {
	return {
		stage,
		planned,
		completed: latencies.length,
		expected429: stage === 'onboarding-rate-boundary' ? 1 : 0,
		unexpected4xx: 0,
		unexpected5xx: 0,
		timeouts: 0,
		p50Ms: percentile(latencies, 50),
		p95Ms: percentile(latencies, 95),
		p99Ms: percentile(latencies, 99),
	};
}

async function runBoundary(
	origin: string,
	session: SessionState,
	fixture: Fixture,
): Promise<{ item: RuntimeItem; result: SanitizedStageResult }> {
	const requestId = randomUUID();
	const start = performance.now();
	let first: Reservation | undefined;
	for (let index = 0; index < VALENTINA_MEMORIES_RATE_LIMIT.limit; index += 1) {
		const replay = await reserve(origin, session, fixture, requestId);
		first ??= replay;
	}
	const checksum = checksumFor(fixture.bytes);
	const boundaryResponse = await fetch(new URL('/api/memories/valentina/items', origin), {
		method: 'POST',
		headers: { Origin: origin, Cookie: session.cookie, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'reserve',
			mimeType: fixture.mimeType,
			sizeBytes: fixture.bytes.byteLength,
			checksumSha256: checksum.hex,
			durationSeconds: null,
			clientRequestId: requestId,
		}),
		signal: AbortSignal.timeout(30_000),
	});
	if (boundaryResponse.status !== 429 || !first)
		throw new SafeLoadError(
			'The explicit register rate boundary did not return the expected 429.',
		);
	const item = await completeUpload(origin, session, fixture, first, 99);
	return {
		item,
		result: stageResult('onboarding-rate-boundary', 1, [performance.now() - start]),
	};
}

async function runStage(input: {
	stage: Exclude<LoadStageName, 'boundary'>;
	units: LoadUnit[];
	origin: string;
	sessions: SessionState[];
	image: Fixture;
	video: Fixture;
}): Promise<{ items: RuntimeItem[]; result: SanitizedStageResult; latencies: number[] }> {
	const latencies: number[] = [];
	const items = await Promise.all(
		input.units.map(async (unit) => {
			const started = performance.now();
			const fixture = uniqueFixture(unit.kind === 'image' ? input.image : input.video, unit);
			const reservation = await reserve(
				input.origin,
				input.sessions[unit.sessionIndex],
				fixture,
				randomUUID(),
			);
			const item = await completeUpload(
				input.origin,
				input.sessions[unit.sessionIndex],
				fixture,
				reservation,
				unit.sessionIndex,
			);
			latencies.push(performance.now() - started);
			return item;
		}),
	);
	await logicalDelete(input.origin, input.sessions, items);
	return { items, result: stageResult(input.stage, input.units.length, latencies), latencies };
}

async function runSoak(input: {
	units: LoadUnit[];
	origin: string;
	sessions: SessionState[];
	image: Fixture;
	video: Fixture;
}): Promise<{ items: RuntimeItem[]; result: SanitizedStageResult }> {
	const items: RuntimeItem[] = [];
	const latencies: number[] = [];
	for (let offset = 0; offset < input.units.length; offset += 50) {
		if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 60_000));
		const wave = await runStage({
			stage: 'soak',
			units: input.units.slice(offset, offset + 50),
			origin: input.origin,
			sessions: input.sessions,
			image: input.image,
			video: input.video,
		});
		items.push(...wave.items);
		latencies.push(...wave.latencies);
	}
	return { items, result: stageResult('soak', input.units.length, latencies) };
}

async function verifyMissingObjectMechanism(): Promise<void> {
	const response = await retrieveValentinaMemoryObject({
		objectKey: `events/valentina/${randomUUID()}.jpg`,
		mimeType: 'image/jpeg',
		downloadName: 'inspect',
		mode: 'inspect',
	});
	if (response.status !== 404)
		throw new SafeLoadError('Deterministic physical deletion visibility is unavailable.');
}

async function invokeCleanup(origin: string, batches: number): Promise<number> {
	let deleted = 0;
	for (let index = 0; index < batches + 2; index += 1) {
		const response = await appRequest(
			origin,
			'/api/cron/valentina-memories-cleanup',
			{
				headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
			},
			[200],
		);
		const result = (await response.json()) as { deleted?: unknown; failed?: unknown };
		if (result.failed !== 0 || typeof result.deleted !== 'number')
			throw new SafeLoadError(
				'The existing physical cleanup flow did not complete deterministically.',
			);
		deleted += result.deleted;
		if (result.deleted === 0) break;
	}
	return deleted;
}

async function verifyPhysicalAbsence(items: RuntimeItem[]): Promise<void> {
	for (const item of items) {
		const response = await retrieveValentinaMemoryObject({
			objectKey: item.objectKey,
			mimeType: item.mimeType,
			downloadName: 'inspect',
			mode: 'inspect',
		});
		if (response.status !== 404)
			throw new SafeLoadError('Deterministic physical deletion could not be verified.');
	}
}

async function persistReport(report: SanitizedLoadReport, reportPath?: string): Promise<void> {
	assertSanitizedLoadReport(report);
	const root = path.resolve(process.cwd(), '.tmp/valentina-memories-load');
	const resolved = path.resolve(
		process.cwd(),
		reportPath ?? '.tmp/valentina-memories-load/report.json',
	);
	if (resolved !== path.join(root, 'report.json') && !resolved.startsWith(`${root}${path.sep}`))
		throw new SafeLoadError(
			'Reports may only be persisted below the repository load-report directory.',
		);
	await mkdir(path.dirname(resolved), { recursive: true });
	await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		mode: 0o600,
	});
}

function dryRunReport(projection: LoadProjection): SanitizedLoadReport {
	return {
		schemaVersion: 1,
		mode: 'dry-run',
		status: 'DRY_RUN_READY',
		projection: withoutLoadUnits(projection),
		stages: [],
		cleanup: { logicallyInaccessible: 0, physicallyAbsent: 0, quotaReleased: false },
		providerMetrics: [],
		blockedReasons: [],
	};
}

async function execute(options: CliOptions): Promise<SanitizedLoadReport> {
	requireExecutionOptions(options);
	const image = await fixtureFromFile(options.imageFixture, 'image/jpeg', null);
	const video = await fixtureFromFile(
		options.videoFixture,
		'video/mp4',
		options.videoDurationSeconds,
	);
	const tagBytes = new TextEncoder().encode('\nsynthetic-load-00000000\n').byteLength;
	const projection = projectValentinaMemoriesLoad({
		imageBytes: image.bytes.byteLength + tagBytes,
		videoBytes: video.bytes.byteLength + tagBytes,
		baselineObjects: options.baselineObjects,
		baselineBytes: options.baselineBytes,
		diagnostic25: options.diagnostic25,
		soakMinutes: options.soakMinutes,
	});
	assertLoadBudget(projection, {
		objects: options.budgetObjects,
		bytes: options.budgetBytes,
		requests: options.budgetRequests,
	});
	await verifyDeployment(options);
	await verifyMissingObjectMechanism();
	const providerMetrics = [await collectProviderMetric('baseline')];
	const sessions = await createCohort(options.origin);
	const allItems: RuntimeItem[] = [];
	const stages: SanitizedStageResult[] = [];
	const boundaryUnit = projection.units.find((unit) => unit.stage === 'boundary') as LoadUnit;
	const boundary = await runBoundary(
		options.origin,
		sessions[99],
		uniqueFixture(image, boundaryUnit),
	);
	allItems.push(boundary.item);
	stages.push(boundary.result);
	await logicalDelete(options.origin, sessions, [boundary.item]);
	for (const stage of ['smoke', 'intermediate', 'diagnostic', 'final', 'soak'] as const) {
		const units = projection.units.filter((unit) => unit.stage === stage);
		if (units.length === 0) continue;
		const result =
			stage === 'soak'
				? await runSoak({ units, origin: options.origin, sessions, image, video })
				: await runStage({
						stage,
						units,
						origin: options.origin,
						sessions,
						image,
						video,
					});
		allItems.push(...result.items);
		stages.push(result.result);
		if (stage === 'final') providerMetrics.push(await collectProviderMetric('final-profile'));
	}
	const cleanupDeleted = await invokeCleanup(options.origin, projection.cleanupBatches);
	await verifyPhysicalAbsence(allItems);
	providerMetrics.push(await collectProviderMetric('final-cleanup'));
	return {
		schemaVersion: 1,
		mode: 'staging-execution',
		status: cleanupDeleted >= allItems.length ? 'STAGING_CAPACITY_VERIFIED' : 'BLOCKED',
		projection: withoutLoadUnits(projection),
		stages,
		cleanup: {
			logicallyInaccessible: allItems.length,
			physicallyAbsent: allItems.length,
			quotaReleased: cleanupDeleted >= allItems.length,
		},
		providerMetrics,
		blockedReasons: cleanupDeleted >= allItems.length ? [] : ['cleanup_count_mismatch'],
	};
}

export async function runValentinaMemoriesLoadCli(args: string[]): Promise<SanitizedLoadReport> {
	const options = parseValentinaMemoriesLoadArgs(args);
	if (!options.execute) {
		const projection = projectValentinaMemoriesLoad({
			imageBytes: options.imageBytes,
			videoBytes: options.videoBytes,
			baselineObjects: options.baselineObjects,
			baselineBytes: options.baselineBytes,
			diagnostic25: options.diagnostic25,
			soakMinutes: options.soakMinutes,
		});
		const report = dryRunReport(projection);
		assertSanitizedLoadReport(report);
		return report;
	}
	return execute(options);
}

async function main(): Promise<void> {
	try {
		const report = await runValentinaMemoriesLoadCli(process.argv.slice(2));
		if (report.mode === 'staging-execution')
			await persistReport(
				report,
				parseValentinaMemoriesLoadArgs(process.argv.slice(2)).reportPath,
			);
		else console.info(JSON.stringify(report, null, 2));
		if (report.status === 'BLOCKED') process.exitCode = 1;
	} catch (error) {
		console.error(
			error instanceof SafeLoadError ? error.reason : 'Unexpected load harness failure.',
		);
		process.exitCode = 1;
	}
}

if (path.basename(process.argv[1] ?? '') === 'valentina-memories-load.ts') void main();
