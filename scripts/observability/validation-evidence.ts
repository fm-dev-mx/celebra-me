/**
 * Validation evidence snapshots under `.tmp/observability/validation/`.
 * Freshness classification is read-only and never mutates DBs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
	EvidenceFreshness,
	ObservabilityFingerprints,
	ObservabilitySourceState,
	ValidationEvidenceSnapshot,
	ValidationEvidenceType,
} from './types.ts';

export const VALIDATION_EVIDENCE_SCHEMA_VERSION = 1 as const;

const PROJECT_ROOT = process.cwd();

export function validationEvidenceRelativePath(type: ValidationEvidenceType): string {
	return `.tmp/observability/validation/${type}.json`;
}

export function validationEvidenceAbsolutePath(type: ValidationEvidenceType): string {
	return resolve(PROJECT_ROOT, validationEvidenceRelativePath(type));
}

function isValidationEvidenceSnapshot(value: unknown): value is ValidationEvidenceSnapshot {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		v.schemaVersion === 1 &&
		(v.validationType === 'regression' || v.validationType === 'screenshots') &&
		(v.status === 'pass' || v.status === 'fail') &&
		typeof v.command === 'string' &&
		typeof v.startedAt === 'string' &&
		typeof v.completedAt === 'string' &&
		typeof v.inputFingerprint === 'string' &&
		typeof v.corpusFingerprint === 'string' &&
		typeof v.artifactLocation === 'string' &&
		typeof v.total === 'number' &&
		typeof v.passed === 'number' &&
		typeof v.failed === 'number' &&
		Array.isArray(v.failures)
	);
}

export function readValidationEvidenceSnapshot(
	type: ValidationEvidenceType,
): ValidationEvidenceSnapshot | null {
	const abs = validationEvidenceAbsolutePath(type);
	if (!existsSync(abs)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(abs, 'utf8'));
		return isValidationEvidenceSnapshot(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Persist a validation evidence snapshot.
 * May throw on filesystem errors — callers must catch write failures separately
 * so a failed validation is never converted into a pass.
 */
export function writeValidationEvidenceSnapshot(snapshot: ValidationEvidenceSnapshot): void {
	if (snapshot.schemaVersion !== VALIDATION_EVIDENCE_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported validation evidence schemaVersion: ${String(snapshot.schemaVersion)}`,
		);
	}
	const expectedRel = validationEvidenceRelativePath(snapshot.validationType);
	const abs = validationEvidenceAbsolutePath(snapshot.validationType);
	const toWrite: ValidationEvidenceSnapshot = {
		...snapshot,
		artifactLocation: expectedRel,
	};
	mkdirSync(dirname(abs), { recursive: true });
	writeFileSync(abs, `${JSON.stringify(toWrite, null, 2)}\n`, 'utf8');
}

/**
 * Classify evidence freshness against current fingerprints and source identity.
 *
 * PASS only when status=pass, schema ok, fingerprints match, and branch/HEAD
 * match the recorded snapshot. Dirty working trees may still PASS when
 * inputFingerprint matches current inputs.
 */
export function classifyValidationFreshness(
	snapshot: ValidationEvidenceSnapshot | null,
	currentFingerprints: ObservabilityFingerprints,
	currentSource: ObservabilitySourceState,
): EvidenceFreshness {
	if (!snapshot) return 'NOT_RUN';
	if (snapshot.schemaVersion !== VALIDATION_EVIDENCE_SCHEMA_VERSION) return 'INVALID';
	if (!isValidationEvidenceSnapshot(snapshot)) return 'INVALID';

	if (snapshot.status === 'fail') return 'FAIL';

	if (snapshot.inputFingerprint !== currentFingerprints.inputFingerprint) return 'STALE';
	if (snapshot.corpusFingerprint !== currentFingerprints.corpusFingerprint) return 'STALE';

	if (
		currentSource.commitSha &&
		snapshot.commitSha &&
		snapshot.commitSha !== currentSource.commitSha
	) {
		return 'STALE';
	}
	if (currentSource.branch && snapshot.branch && snapshot.branch !== currentSource.branch) {
		return 'STALE';
	}

	// Dirty tree is allowed only when input fingerprint still matches (checked above).
	if (snapshot.status === 'pass') return 'PASS';
	return 'INVALID';
}
