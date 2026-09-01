export const OPERATIONAL_EVIDENCE_SCHEMA_VERSION = 1 as const;

export type OperationalEvidenceEnvironment = 'local' | 'preview' | 'production';
export type OperationalEvidenceStatus = 'VERIFIED' | 'WARNING' | 'FAILED' | 'UNVERIFIED';
export type OperationalEvidencePhase = 'started' | 'completed';
export type OperationalAggregateValue = string | number | boolean | null;
export type OperationalAggregatePayload = Record<string, OperationalAggregateValue>;

export interface OperationalEvidenceV1<
	Check extends string = string,
	Payload extends OperationalAggregatePayload = OperationalAggregatePayload,
> {
	schemaVersion: typeof OPERATIONAL_EVIDENCE_SCHEMA_VERSION;
	check: Check;
	environment: OperationalEvidenceEnvironment;
	runId: string;
	startedAt: string;
	completedAt: string | null;
	observedAt: string;
	status: OperationalEvidenceStatus;
	reasonCode: string;
	source: string;
	ownerAction: string;
	commitSha?: string;
	deploymentId?: string;
	payload: Payload;
}

export interface OperationalEvidenceLogEvent {
	event: string;
	phase: OperationalEvidencePhase;
	evidence: OperationalEvidenceV1;
}

const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,79}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const FORBIDDEN_PAYLOAD_KEY_PATTERN =
	/(?:slug|query|guest|media|cookie|token|secret|signed|body|email|phone|object_?key|url|path)/i;
const FORBIDDEN_TEXT_PATTERN = /(?:https?:\/\/|bearer\s+|[?&](?:token|secret|signature)=)/i;

function isUtcTimestamp(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
		Number.isFinite(Date.parse(value))
	);
}

export function sanitizeOperationalCorrelationId(value: string | null | undefined): string | null {
	const trimmed = value?.trim() ?? '';
	return SAFE_TOKEN_PATTERN.test(trimmed) ? trimmed : null;
}

function assertEvidenceCodes(evidence: OperationalEvidenceV1): void {
	if (!SAFE_CODE_PATTERN.test(evidence.check) || !SAFE_CODE_PATTERN.test(evidence.reasonCode)) {
		throw new Error(
			'Operational evidence check and reason codes must be low-cardinality codes.',
		);
	}
	if (!SAFE_TOKEN_PATTERN.test(evidence.runId) || !SAFE_CODE_PATTERN.test(evidence.source)) {
		throw new Error('Operational evidence correlation or source is invalid.');
	}
}

function assertEvidenceTimestamps(evidence: OperationalEvidenceV1): void {
	if (
		!isUtcTimestamp(evidence.startedAt) ||
		!isUtcTimestamp(evidence.observedAt) ||
		(evidence.completedAt !== null && !isUtcTimestamp(evidence.completedAt))
	) {
		throw new Error('Operational evidence timestamps must be UTC ISO-8601 values.');
	}
	if (!evidence.ownerAction.trim() || FORBIDDEN_TEXT_PATTERN.test(evidence.ownerAction)) {
		throw new Error('Operational evidence owner action is missing or contains sensitive text.');
	}
}

function assertEvidenceCorrelation(evidence: OperationalEvidenceV1): void {
	if (evidence.commitSha !== undefined && !COMMIT_SHA_PATTERN.test(evidence.commitSha)) {
		throw new Error('Operational evidence commit SHA is invalid.');
	}
	if (
		evidence.deploymentId !== undefined &&
		sanitizeOperationalCorrelationId(evidence.deploymentId) === null
	) {
		throw new Error('Operational evidence deployment identifier is invalid.');
	}
}

function assertEvidencePayload(payload: OperationalAggregatePayload): void {
	for (const [key, value] of Object.entries(payload)) {
		if (!SAFE_CODE_PATTERN.test(key) || FORBIDDEN_PAYLOAD_KEY_PATTERN.test(key)) {
			throw new Error(`Operational evidence payload key is not approved: ${key}`);
		}
		if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
			throw new Error(`Operational evidence metric must be finite and non-negative: ${key}`);
		}
		if (
			typeof value === 'string' &&
			(!SAFE_TOKEN_PATTERN.test(value) || FORBIDDEN_TEXT_PATTERN.test(value))
		) {
			throw new Error(`Operational evidence payload value is not sanitized: ${key}`);
		}
	}
}

export function assertOperationalEvidenceSafe(evidence: OperationalEvidenceV1): void {
	if (evidence.schemaVersion !== OPERATIONAL_EVIDENCE_SCHEMA_VERSION) {
		throw new Error('Operational evidence schema version is unsupported.');
	}
	assertEvidenceCodes(evidence);
	assertEvidenceTimestamps(evidence);
	assertEvidenceCorrelation(evidence);
	assertEvidencePayload(evidence.payload);
}

export function serializeOperationalEvidenceEvent(
	event: string,
	phase: OperationalEvidencePhase,
	evidence: OperationalEvidenceV1,
): string {
	if (!SAFE_CODE_PATTERN.test(event)) {
		throw new Error('Operational evidence event name is invalid.');
	}
	assertOperationalEvidenceSafe(evidence);
	return JSON.stringify({ event, phase, evidence } satisfies OperationalEvidenceLogEvent);
}
