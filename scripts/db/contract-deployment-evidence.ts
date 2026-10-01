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
	try {
		const deployment = loadLatestProductionDeployment();
		return {
			deployedAppIdentity: readDeployedApplicationAttestation({
				deployedSha: deployment.sha,
				targetReleaseSha: input.targetReleaseSha,
				checks: loadRemoteChecks(deployment.sha),
			}),
			remoteEvidenceUnavailable: null,
		};
	} catch (error: unknown) {
		if (input.mode === 'apply' || !isRemoteEvidenceUnavailable(error)) throw error;
		const message = error instanceof Error ? error.message : String(error);
		return {
			deployedAppIdentity: null,
			remoteEvidenceUnavailable: `UNVERIFIED: Production deployment evidence unavailable (${message}).`,
		};
	}
}
