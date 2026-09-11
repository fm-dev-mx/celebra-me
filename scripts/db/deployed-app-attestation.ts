import { execFileSync } from 'node:child_process';
import {
	RemoteEvidenceError,
	requireProductionDeploymentSmoke,
	type RemoteCheckRun,
} from '../ops/release-readiness.ts';

export const DEPLOYED_APP_CAPABILITIES_PATH = 'supabase/deployed-app-capabilities.json';
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9_]*$/;
export interface DeployedApplicationAttestation {
	sha: string;
	capabilities: string[];
}
export function parseDeployedApplicationCapabilities(raw: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new RemoteEvidenceError(
			'invalid',
			'Deployed application capability manifest is not valid JSON.',
		);
	}
	if (!parsed || typeof parsed !== 'object')
		throw new RemoteEvidenceError(
			'invalid',
			'Deployed application capability manifest must be an object.',
		);
	const value = parsed as { version?: unknown; capabilities?: unknown };
	if (value.version !== 1 || !Array.isArray(value.capabilities))
		throw new RemoteEvidenceError(
			'invalid',
			'Deployed application capability manifest must contain version=1 and capabilities[].',
		);
	if (
		value.capabilities.some(
			(entry) => typeof entry !== 'string' || !CAPABILITY_PATTERN.test(entry),
		) ||
		new Set(value.capabilities).size !== value.capabilities.length
	)
		throw new RemoteEvidenceError(
			'invalid',
			'Deployed application capabilities must be unique lowercase identifiers.',
		);
	return (value.capabilities as string[]).slice().sort();
}
export function readDeployedApplicationAttestation(input: {
	deployedSha: string;
	targetReleaseSha: string;
	checks: RemoteCheckRun[];
	runner?: (command: string, args: string[]) => string;
}): DeployedApplicationAttestation {
	const deployedSha = input.deployedSha.trim().toLowerCase();
	const targetReleaseSha = input.targetReleaseSha.trim().toLowerCase();
	if (!SHA_PATTERN.test(deployedSha) || !SHA_PATTERN.test(targetReleaseSha))
		throw new RemoteEvidenceError(
			'invalid',
			'Deployment attestation requires exact deployed and target release SHAs.',
		);
	if (deployedSha === targetReleaseSha)
		throw new RemoteEvidenceError(
			'invalid',
			'Contract migration cannot self-authorize from the target release deployment.',
		);
	const runner =
		input.runner ?? ((command, args) => execFileSync(command, args, { encoding: 'utf8' }));
	try {
		runner('git', ['merge-base', '--is-ancestor', deployedSha, targetReleaseSha]);
	} catch {
		throw new RemoteEvidenceError(
			'invalid',
			'Deployed application SHA must be an ancestor of the target release.',
		);
	}
	requireProductionDeploymentSmoke(deployedSha, input.checks);
	let rawManifest: string;
	try {
		rawManifest = runner('git', ['show', `${deployedSha}:${DEPLOYED_APP_CAPABILITIES_PATH}`]);
	} catch {
		throw new RemoteEvidenceError(
			'invalid',
			`Deployed application capability manifest is missing from ${deployedSha}.`,
		);
	}
	return {
		sha: deployedSha,
		capabilities: parseDeployedApplicationCapabilities(rawManifest),
	};
}
