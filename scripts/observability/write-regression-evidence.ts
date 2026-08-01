/**
 * Helpers for writing regression / screenshot validation evidence after runs.
 */

import {
	computeObservabilityFingerprints,
} from './fingerprints.ts';
import { readObservabilitySourceState } from './source-state.ts';
import {
	validationEvidenceRelativePath,
	writeValidationEvidenceSnapshot,
} from './validation-evidence.ts';
import type {
	ValidationEvidenceSnapshot,
	ValidationEvidenceType,
	ValidationFailureRecord,
	ValidationRunStatus,
} from './types.ts';

export interface WriteValidationEvidenceInput {
	validationType: ValidationEvidenceType;
	command: string;
	startedAt: string;
	completedAt?: string;
	status: ValidationRunStatus;
	total: number;
	passed: number;
	failed: number;
	failures?: ValidationFailureRecord[];
}

export function buildValidationEvidenceSnapshot(
	input: WriteValidationEvidenceInput,
): ValidationEvidenceSnapshot {
	const source = readObservabilitySourceState();
	const fingerprints = computeObservabilityFingerprints();
	const completedAt = input.completedAt ?? new Date().toISOString();
	return {
		schemaVersion: 1,
		validationType: input.validationType,
		command: input.command,
		startedAt: input.startedAt,
		completedAt,
		status: input.status,
		branch: source.branch,
		commitSha: source.commitSha,
		workingTreeDirty: source.workingTreeDirty,
		inputFingerprint: fingerprints.inputFingerprint,
		corpusFingerprint: fingerprints.corpusFingerprint,
		total: input.total,
		passed: input.passed,
		failed: input.failed,
		failures: input.failures ?? [],
		artifactLocation: validationEvidenceRelativePath(input.validationType),
	};
}

/**
 * Build + write evidence. Returns the snapshot on success.
 * Throws on write failure — callers must not reinterpret validation status.
 */
export function writeRegressionOrScreenshotEvidence(
	input: WriteValidationEvidenceInput,
): ValidationEvidenceSnapshot {
	const snapshot = buildValidationEvidenceSnapshot(input);
	writeValidationEvidenceSnapshot(snapshot);
	return snapshot;
}

/** Best-effort write; returns error message when write fails (does not throw). */
export function tryWriteValidationEvidence(
	input: WriteValidationEvidenceInput,
): { ok: true; snapshot: ValidationEvidenceSnapshot } | { ok: false; error: string } {
	try {
		const snapshot = writeRegressionOrScreenshotEvidence(input);
		return { ok: true, snapshot };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'evidence write failed';
		return { ok: false, error: message.slice(0, 200) };
	}
}
