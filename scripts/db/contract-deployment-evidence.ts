/**
 * Deployed-application evidence for contract-phase migrations on hosted targets.
 *
 * The documented contract gate is a smoke-checked Production deployment whose
 * versioned capability manifest provides the replacement path
 * (`docs/database-workflow.md`, Migration / Deployment Compatibility Contract).
 * The gate is the same for Preview and Production: no environment variable or
 * operator assertion can stand in for it.
 */

import {
	isRemoteEvidenceUnavailable,
	loadLatestProductionDeployment,
	loadRemoteChecks,
} from '../ops/release-readiness.ts';
import { readDeployedApplicationAttestation } from './deployed-app-attestation.ts';
import type { loadMigrationRolloutRegistry } from './migration-deployment-compatibility.ts';

export interface ContractDeploymentEvidence {
	deployedAppIdentity: { sha: string; capabilities: string[] } | null;
	remoteEvidenceUnavailable: string | null;
}

/**
 * Plan rebuilds within one command re-request the same evidence seconds apart. Successful lookups
 * are reused briefly so a rebuild does not repeat every GitHub call, while a later revalidation
 * (or a new process) still observes a changed Production deployment.
 */
const EVIDENCE_REUSE_MS = 60_000;
const evidenceCache = new Map<string, { at: number; evidence: ContractDeploymentEvidence }>();

export function resetContractDeploymentEvidenceCache(): void {
	evidenceCache.clear();
}

export function resolveContractDeploymentEvidence(input: {
	candidateVersions: readonly string[];
	registry: ReturnType<typeof loadMigrationRolloutRegistry>;
	targetReleaseSha: string;
	mode: 'preflight' | 'apply';
}): ContractDeploymentEvidence {
	const requiresContractEvidence = input.candidateVersions.some(
		(version) => input.registry.migrations[version]?.phase === 'contract',
	);
	if (!requiresContractEvidence) {
		return { deployedAppIdentity: null, remoteEvidenceUnavailable: null };
	}
	const cached = evidenceCache.get(input.targetReleaseSha);
	if (cached && Date.now() - cached.at < EVIDENCE_REUSE_MS) return cached.evidence;
	try {
		const deployment = loadLatestProductionDeployment();
		const evidence: ContractDeploymentEvidence = {
			deployedAppIdentity: readDeployedApplicationAttestation({
				deployedSha: deployment.sha,
				targetReleaseSha: input.targetReleaseSha,
				checks: loadRemoteChecks(deployment.sha),
			}),
			remoteEvidenceUnavailable: null,
		};
		evidenceCache.set(input.targetReleaseSha, { at: Date.now(), evidence });
		return evidence;
	} catch (error: unknown) {
		if (input.mode === 'apply' || !isRemoteEvidenceUnavailable(error)) throw error;
		const message = error instanceof Error ? error.message : String(error);
		return {
			deployedAppIdentity: null,
			remoteEvidenceUnavailable: `UNVERIFIED: Production deployment evidence unavailable (${message}).`,
		};
	}
}
