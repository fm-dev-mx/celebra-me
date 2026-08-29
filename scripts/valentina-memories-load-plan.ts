import {
	VALENTINA_MEMORIES_BROWSER_ORIGINS,
	VALENTINA_MEMORIES_EVENT_MAX_BYTES,
	VALENTINA_MEMORIES_EVENT_MAX_OBJECTS,
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	VALENTINA_MEMORIES_RATE_LIMIT,
	VALENTINA_MEMORIES_SESSION_MAX_BYTES,
	VALENTINA_MEMORIES_SESSION_MAX_FILES,
	VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
} from '../src/data/valentina-memories-upload.contract.ts';
import { VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE } from '../src/data/valentina-memories-media.contract.ts';

export const VALENTINA_MEMORIES_LOAD_AUTHORIZATION = 'STAGING_CAPACITY_TEST_AUTHORIZED' as const;
export const VALENTINA_MEMORIES_LOAD_COHORT_SIZE = 100;
export const VALENTINA_MEMORIES_LOAD_ONBOARDING_SECONDS = 10 * 60;

export type LoadMediaKind = 'image' | 'video';
export type LoadStageName = 'boundary' | 'smoke' | 'intermediate' | 'diagnostic' | 'final' | 'soak';

export type LoadUnit = {
	stage: LoadStageName;
	sessionIndex: number;
	kind: LoadMediaKind;
	sequence: number;
};

export type LoadProjectionInput = {
	imageBytes: number;
	videoBytes: number;
	baselineObjects: number;
	baselineBytes: number;
	diagnostic25?: boolean;
	soakMinutes?: 15 | 30;
};

export type LoadProjection = {
	cohortSessions: number;
	onboardingSeconds: number;
	residentObjectsAdded: number;
	residentBytesAdded: number;
	projectedResidentObjects: number;
	projectedResidentBytes: number;
	projectedRequests: number;
	cleanupBatches: number;
	stageObjects: Record<LoadStageName, number>;
	maxFilesPerSession: number;
	maxVideosPerSession: number;
	maxBytesPerSession: number;
	units: LoadUnit[];
};

export type LoadBudget = {
	objects: number;
	bytes: number;
	requests: number;
};

export type SanitizedStageResult = {
	stage: Exclude<LoadStageName, 'boundary'> | 'onboarding-rate-boundary';
	planned: number;
	completed: number;
	expected429: number;
	unexpected4xx: number;
	unexpected5xx: number;
	timeouts: number;
	p50Ms: number | null;
	p95Ms: number | null;
	p99Ms: number | null;
};

export type SanitizedLoadReport = {
	schemaVersion: 1;
	mode: 'dry-run' | 'staging-execution';
	status: 'DRY_RUN_READY' | 'STAGING_CAPACITY_VERIFIED' | 'BLOCKED';
	projection: Omit<LoadProjection, 'units'>;
	stages: SanitizedStageResult[];
	cleanup: {
		logicallyInaccessible: number;
		physicallyAbsent: number;
		quotaReleased: boolean;
	};
	providerMetrics: Array<{
		checkpoint: 'baseline' | 'final-profile' | 'final-cleanup';
		objectCount: number | null;
		payloadBytes: number | null;
		requestCount: number | null;
	}>;
	blockedReasons: string[];
};

const FORBIDDEN_REPORT_KEYS =
	/(cookie|recovery.?code|display.?name|raw.?media|object.?key|signed.?url|upload.?url|request.?signature|credential|token|secret|provider.?identifier|account.?id|deployment.?id|bucket.?name|origin|hostname)/i;

function requireNonNegativeInteger(value: number, label: string): void {
	if (!Number.isSafeInteger(value) || value < 0)
		throw new Error(`${label} must be a non-negative integer.`);
}

function addUnit(
	units: LoadUnit[],
	stage: LoadStageName,
	sessionIndex: number,
	kind: LoadMediaKind,
): void {
	units.push({ stage, sessionIndex, kind, sequence: units.length });
}

export function buildValentinaMemoriesLoadUnits(
	input: {
		diagnostic25?: boolean;
		soakMinutes?: 15 | 30;
	} = {},
): LoadUnit[] {
	const units: LoadUnit[] = [];
	addUnit(units, 'boundary', 99, 'image');
	for (let index = 0; index < 10; index += 1) addUnit(units, 'smoke', index, 'image');
	for (let index = 10; index < 60; index += 1) addUnit(units, 'intermediate', index, 'image');
	if (input.diagnostic25) {
		for (let index = 0; index < 25; index += 1) addUnit(units, 'diagnostic', index, 'image');
	}
	for (let index = 0; index < VALENTINA_MEMORIES_LOAD_COHORT_SIZE; index += 1) {
		addUnit(units, 'final', index, index >= 80 ? 'video' : 'image');
	}
	if (input.soakMinutes) {
		for (let minute = 0; minute < input.soakMinutes; minute += 1) {
			for (let offset = 0; offset < 50; offset += 1) {
				const sessionIndex = (minute * 50 + offset) % VALENTINA_MEMORIES_LOAD_COHORT_SIZE;
				const existingVideos = units.filter(
					(unit) => unit.sessionIndex === sessionIndex && unit.kind === 'video',
				).length;
				addUnit(
					units,
					'soak',
					sessionIndex,
					offset < 10 && existingVideos < 2 ? 'video' : 'image',
				);
			}
		}
	}
	return units;
}

export function projectValentinaMemoriesLoad(input: LoadProjectionInput): LoadProjection {
	requireNonNegativeInteger(input.imageBytes, 'imageBytes');
	requireNonNegativeInteger(input.videoBytes, 'videoBytes');
	requireNonNegativeInteger(input.baselineObjects, 'baselineObjects');
	requireNonNegativeInteger(input.baselineBytes, 'baselineBytes');
	if (input.imageBytes <= 0 || input.imageBytes > VALENTINA_MEMORIES_MAX_IMAGE_BYTES)
		throw new Error('imageBytes is outside the canonical image limit.');
	if (input.videoBytes <= 0 || input.videoBytes > VALENTINA_MEMORIES_MAX_VIDEO_BYTES)
		throw new Error('videoBytes is outside the canonical video limit.');

	const units = buildValentinaMemoriesLoadUnits(input);
	const perSession = Array.from({ length: VALENTINA_MEMORIES_LOAD_COHORT_SIZE }, () => ({
		files: 0,
		videos: 0,
		bytes: 0,
	}));
	const stageObjects = {
		boundary: 0,
		smoke: 0,
		intermediate: 0,
		diagnostic: 0,
		final: 0,
		soak: 0,
	} satisfies Record<LoadStageName, number>;
	let residentBytesAdded = 0;
	for (const unit of units) {
		const bytes = unit.kind === 'image' ? input.imageBytes : input.videoBytes;
		const session = perSession[unit.sessionIndex];
		session.files += 1;
		session.videos += unit.kind === 'video' ? 1 : 0;
		session.bytes += bytes;
		residentBytesAdded += bytes;
		stageObjects[unit.stage] += 1;
	}
	const maxFilesPerSession = Math.max(...perSession.map((entry) => entry.files));
	const maxVideosPerSession = Math.max(...perSession.map((entry) => entry.videos));
	const maxBytesPerSession = Math.max(...perSession.map((entry) => entry.bytes));
	if (maxFilesPerSession >= VALENTINA_MEMORIES_SESSION_MAX_FILES)
		throw new Error(
			'The cumulative plan approaches or reaches the canonical session file quota.',
		);
	if (maxVideosPerSession > 2 || maxVideosPerSession >= VALENTINA_MEMORIES_SESSION_MAX_VIDEOS)
		throw new Error('The cumulative plan violates the deterministic video distribution.');
	if (maxBytesPerSession >= VALENTINA_MEMORIES_SESSION_MAX_BYTES)
		throw new Error(
			'The cumulative plan approaches or reaches the canonical session byte quota.',
		);

	const projectedResidentObjects = input.baselineObjects + units.length;
	const projectedResidentBytes = input.baselineBytes + residentBytesAdded;
	if (projectedResidentObjects >= VALENTINA_MEMORIES_EVENT_MAX_OBJECTS)
		throw new Error(
			'The cumulative plan approaches or reaches the canonical event object quota.',
		);
	if (projectedResidentBytes >= VALENTINA_MEMORIES_EVENT_MAX_BYTES)
		throw new Error(
			'The cumulative plan approaches or reaches the canonical event byte quota.',
		);

	const cleanupBatches = Math.ceil(units.length / VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE);
	const projectedRequests =
		VALENTINA_MEMORIES_LOAD_COHORT_SIZE +
		units.length * 6 +
		VALENTINA_MEMORIES_RATE_LIMIT.limit +
		units.length +
		cleanupBatches +
		2 +
		5;
	return {
		cohortSessions: VALENTINA_MEMORIES_LOAD_COHORT_SIZE,
		onboardingSeconds: VALENTINA_MEMORIES_LOAD_ONBOARDING_SECONDS,
		residentObjectsAdded: units.length,
		residentBytesAdded,
		projectedResidentObjects,
		projectedResidentBytes,
		projectedRequests,
		cleanupBatches,
		stageObjects,
		maxFilesPerSession,
		maxVideosPerSession,
		maxBytesPerSession,
		units,
	};
}

export function assertLoadBudget(projection: LoadProjection, budget: LoadBudget): void {
	for (const [label, value] of Object.entries(budget))
		requireNonNegativeInteger(value, `budget.${label}`);
	if (budget.objects >= VALENTINA_MEMORIES_EVENT_MAX_OBJECTS)
		throw new Error('The owner object budget must remain below the canonical event quota.');
	if (budget.bytes >= VALENTINA_MEMORIES_EVENT_MAX_BYTES)
		throw new Error('The owner byte budget must remain below the canonical event quota.');
	if (projection.projectedResidentObjects >= budget.objects)
		throw new Error('Projected resident objects do not preserve the approved owner margin.');
	if (projection.projectedResidentBytes >= budget.bytes)
		throw new Error('Projected resident bytes do not preserve the approved owner margin.');
	if (projection.projectedRequests > budget.requests)
		throw new Error('Projected requests exceed the approved owner budget.');
}

export function assertStagingOnlyTarget(input: {
	target: string;
	origin: string;
	deploymentLocator?: string;
}): void {
	const productionOrigin = VALENTINA_MEMORIES_BROWSER_ORIGINS.production[0];
	const signals = [input.target, input.origin, input.deploymentLocator ?? '']
		.join(' ')
		.toLowerCase();
	if (
		input.target !== 'staging' ||
		signals.includes('production') ||
		signals.includes(productionOrigin)
	)
		throw new Error('Production is structurally rejected as a Valentina Memories load target.');
	if (!VALENTINA_MEMORIES_BROWSER_ORIGINS.staging.includes(input.origin as never))
		throw new Error('The origin is not an exact canonical Staging allowlisted origin.');
}

export function percentile(values: number[], percentileValue: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.min(
		sorted.length - 1,
		Math.ceil((percentileValue / 100) * sorted.length) - 1,
	);
	return Math.round(sorted[index] * 100) / 100;
}

export function assertSanitizedLoadReport(report: SanitizedLoadReport): void {
	const inspect = (value: unknown, path: string): void => {
		if (Array.isArray(value))
			return value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
		if (typeof value !== 'object' || value === null) return;
		for (const [key, child] of Object.entries(value)) {
			if (FORBIDDEN_REPORT_KEYS.test(key))
				throw new Error(`Unsafe report field at ${path}.${key}.`);
			inspect(child, `${path}.${key}`);
		}
	};
	inspect(report, 'report');
}

export function withoutLoadUnits(projection: LoadProjection): Omit<LoadProjection, 'units'> {
	const { units: _units, ...sanitized } = projection;
	return sanitized;
}
