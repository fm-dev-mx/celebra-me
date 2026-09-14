/**
 * Static proof for application capability claims used by contract migrations.
 * This intentionally examines executable publication paths only; migrations and test fixtures
 * retain historical overload coverage and are not application capability evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDeployedApplicationCapabilities } from './deployed-app-attestation.ts';
import { loadMigrationRolloutRegistry } from './migration-deployment-compatibility.ts';

const CURRENT_PUBLICATION_CAPABILITY = 'current_atomic_publication_client';
const REQUIRED_PUBLICATION_PARAMETERS = [
	'p_invitation_id',
	'p_draft_id',
	'p_expected_draft_updated_at',
	'p_expected_published_version',
	'p_public_metadata_hash',
	'p_projection_hash',
	'p_idempotency_key',
	'p_slug',
	'p_event_type',
	'p_is_demo',
	'p_content',
] as const;

const EXECUTABLE_PUBLICATION_PATHS = [
	'src/lib/intake/repositories/publication.repository.ts',
	'scripts/provision/apply-local-invitation.ts',
	'scripts/provision/invitation-import-engine.ts',
	'scripts/invitation/image-namespace-remap.ts',
] as const;

function read(root: string, relativePath: string, errors: string[]): string | null {
	const path = resolve(root, relativePath);
	if (!existsSync(path)) {
		errors.push(`Capability proof path is missing: ${relativePath}.`);
		return null;
	}
	return readFileSync(path, 'utf8');
}

function validateCurrentPublicationClient(root: string): string[] {
	const errors: string[] = [];
	const sourceByPath = Object.fromEntries(
		EXECUTABLE_PUBLICATION_PATHS.map((path) => [path, read(root, path, errors)]),
	) as Record<(typeof EXECUTABLE_PUBLICATION_PATHS)[number], string | null>;
	for (const [path, source] of Object.entries(sourceByPath)) {
		if (!source) continue;
		if (!source.includes('publish_invitation_atomic')) {
			errors.push(`Capability proof is missing publication RPC usage in ${path}.`);
		}
		for (const parameter of REQUIRED_PUBLICATION_PARAMETERS) {
			if (!source.includes(parameter)) {
				errors.push(`Capability proof is missing ${parameter} in ${path}.`);
			}
		}
	}
	const positionalLegacyCall = /publish_invitation_atomic\s*\(\s*(?!p_invitation_id\s*=>)[^\s)]/;
	const sqlPublicationPaths = EXECUTABLE_PUBLICATION_PATHS.filter(
		(path) => path !== 'src/lib/intake/repositories/publication.repository.ts',
	);
	for (const path of sqlPublicationPaths) {
		if (positionalLegacyCall.test(sourceByPath[path] ?? '')) {
			errors.push(`Revoked positional publication overload is used by ${path}.`);
		}
	}
	return errors;
}

export function validateDeployedAppCapabilities(root = process.cwd()): string[] {
	const errors: string[] = [];
	const manifestPath = resolve(root, 'supabase/deployed-app-capabilities.json');
	let capabilities: string[];
	try {
		capabilities = parseDeployedApplicationCapabilities(readFileSync(manifestPath, 'utf8'));
	} catch (error) {
		return [error instanceof Error ? error.message : String(error)];
	}
	const registry = loadMigrationRolloutRegistry(
		resolve(root, 'supabase/migration-rollout-registry.json'),
	);
	for (const capability of capabilities) {
		if (!registry.appCapabilities?.[capability]) {
			errors.push(`Capability is not registered: ${capability}.`);
		}
	}
	if (capabilities.includes(CURRENT_PUBLICATION_CAPABILITY)) {
		errors.push(...validateCurrentPublicationClient(root));
	}
	return errors;
}

function main(): void {
	const errors = validateDeployedAppCapabilities();
	if (errors.length === 0) {
		console.info('Deployed application capability claims: PASS');
		return;
	}
	for (const error of errors) console.error(`- ${error}`);
	process.exitCode = 1;
}

if (process.argv[1]?.endsWith('validate-deployed-app-capabilities.ts')) main();
