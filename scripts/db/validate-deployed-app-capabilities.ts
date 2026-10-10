/**
 * Static proof for application capability claims used by contract migrations.
 * This intentionally examines executable publication paths only; migrations and test fixtures
 * retain historical overload coverage and are not application capability evidence.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

const EVENT_MEMORIES_CAPABILITY = 'event_memories_client';
/** The only executable modules that name memories tables and RPCs. */
export const EXECUTABLE_MEMORIES_PATHS = [
	'src/lib/memories/server/catalog.repository.ts',
	'src/lib/memories/server/settings.repository.ts',
	'scripts/db/memories-concurrency-test.ts',
] as const;
const REQUIRED_MEMORIES_RPCS = [
	'reserve_event_memory_item',
	'resolve_event_memory_session',
	'expire_event_memory_content',
] as const;
const LEGACY_MEMORIES_OBJECT = /valentina_memor/;

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

/**
 * The replacement application uses only the event-neutral catalog: every
 * executable memories path calls the new RPCs and none names a legacy object.
 */
function validateEventMemoriesClient(root: string): string[] {
	const errors: string[] = [];
	const catalogSource = read(root, EXECUTABLE_MEMORIES_PATHS[0], errors);
	for (const rpc of REQUIRED_MEMORIES_RPCS) {
		if (catalogSource && !catalogSource.includes(rpc)) {
			errors.push(`Capability proof is missing ${rpc} in ${EXECUTABLE_MEMORIES_PATHS[0]}.`);
		}
	}
	for (const path of EXECUTABLE_MEMORIES_PATHS) {
		const source =
			path === EXECUTABLE_MEMORIES_PATHS[0] ? catalogSource : read(root, path, errors);
		if (source && LEGACY_MEMORIES_OBJECT.test(source)) {
			errors.push(`Legacy memories object is still referenced by ${path}.`);
		}
	}
	return errors;
}

const RETIRED_TABLES_CAPABILITY = 'retired_legacy_tables_client';
/** Tables dropped by contract migrations; no executable module may name them. */
export const RETIRED_TABLES = [
	'event_claim_codes',
	'intake_requests',
	'intake_submissions',
	'rsvp_records',
	'rsvp_audit_log',
	'rsvp_channel_log',
	'managed_invitation_legacy_adoption_receipts',
	'host_profiles',
] as const;
const EXECUTABLE_ROOTS = ['src', 'scripts', 'workers'] as const;
const EXECUTABLE_EXTENSION = /\.(?:ts|tsx|astro|mjs|cjs|js)$/;

function listExecutableFiles(root: string): string[] {
	const files: string[] = [];
	const walk = (relative: string) => {
		const absolute = resolve(root, relative);
		if (!existsSync(absolute)) return;
		for (const entry of readdirSync(absolute, { withFileTypes: true })) {
			const child = `${relative}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules') walk(child);
			} else if (EXECUTABLE_EXTENSION.test(entry.name)) {
				files.push(child);
			}
		}
	};
	for (const directory of EXECUTABLE_ROOTS) walk(directory);
	return files;
}

/** The application and operator scripts never name a retired table or its legacy memories peers. */
function validateRetiredTablesClient(root: string): string[] {
	const errors: string[] = [];
	const pattern = new RegExp(`\\b(?:${RETIRED_TABLES.join('|')})\\b|valentina_memor`);
	for (const path of listExecutableFiles(root)) {
		if (path === 'scripts/db/validate-deployed-app-capabilities.ts') continue;
		const source = readFileSync(resolve(root, path), 'utf8');
		const match = source.match(pattern);
		if (match) errors.push(`Retired table ${match[0]} is still referenced by ${path}.`);
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
	if (capabilities.includes(EVENT_MEMORIES_CAPABILITY)) {
		errors.push(...validateEventMemoriesClient(root));
	}
	if (capabilities.includes(RETIRED_TABLES_CAPABILITY)) {
		errors.push(...validateRetiredTablesClient(root));
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
