import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import {
	assertMutationEnvironmentIdentity,
	decodeJwtProjectRef,
	extractApiProjectRef,
	SUPABASE_PROJECT_REFS,
} from '../../src/lib/intake/mutations/environment-identity.ts';
import { generateAuthDump, type AuthIdentity, type AuthUser } from './export-auth-users.ts';
import {
	createArtifactManifest,
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
	type CriticalBackupPurpose,
} from './backup-manifest.ts';
import {
	extractSupabaseProjectRef,
	getSecretFromEnvOrFiles,
	PROD_SECRET_FILES,
} from './db-target-config.ts';
import {
	captureRecoveryIntegrity,
	compareRecoveryIntegrity,
	computeRecoveryStateDigest,
	type RecoveryIntegritySnapshot,
} from './recovery-integrity.ts';
import { writeStorageObjectArchive } from './storage-object-archive.ts';
import { BACKUP_PHASE_LABELS, writeBackupPhase } from './critical-backup-progress.ts';
import {
	downloadStorageInventory,
	emptyStorageArchive,
	STORAGE_INVENTORY_SQL,
	type StorageInventoryRow,
} from './critical-backup-storage.ts';
import {
	assertWindowsEfsEncrypted,
	prepareEncryptedLocalDirectory,
} from './local-backup-operations.ts';
import {
	assertProductionDbUrl,
	getProdDbUrl,
	redactDbUrl,
	runCommand,
	timestamp,
} from './db-workflow-lib.ts';

function runBackupCommand(
	command: string,
	args: string[],
	options: { redact?: string[] } = {},
): ReturnType<typeof runCommand> {
	const result = runCommand(command, args, { ...options, throwOnError: false });
	if (result.status !== 0) {
		throw new Error(`Critical backup subprocess failed with status ${String(result.status)}.`);
	}
	return result;
}

let incompleteOutputDir: string | null = null;

function queryJson<T>(dbUrl: string, sql: string): T {
	const result = runBackupCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-psqlrc',
			'--tuples-only',
			'--no-align',
			'--dbname',
			dbUrl,
			'--command',
			sql,
		],
		{ redact: [dbUrl] },
	);
	const value = result.stdout.trim();
	if (!value) throw new Error('Production backup query returned no JSON result.');
	return JSON.parse(value) as T;
}

function verifyProductionSecrets(prodDbUrl: string): {
	prodSupabaseUrl: string;
	prodServiceRole: string;
} {
	const prodSupabaseUrl = getSecretFromEnvOrFiles('PROD_SUPABASE_URL', PROD_SECRET_FILES);
	const prodServiceRole = getSecretFromEnvOrFiles(
		'PROD_SUPABASE_SERVICE_ROLE_KEY',
		PROD_SECRET_FILES,
	);
	if (!prodSupabaseUrl || !prodServiceRole) {
		throw new Error(
			'Complete critical backup requires PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_ROLE_KEY in an approved ignored source.',
		);
	}
	const apiRef = extractApiProjectRef(prodSupabaseUrl);
	const credentialRef = decodeJwtProjectRef(prodServiceRole);
	if (!credentialRef) {
		throw new Error('Production service credential does not expose a verifiable project ref.');
	}
	const dbRef = extractSupabaseProjectRef(prodDbUrl);
	assertMutationEnvironmentIdentity({
		environment: 'production',
		projectRef: SUPABASE_PROJECT_REFS.production,
		apiUrl: prodSupabaseUrl,
		storageUrl: `${prodSupabaseUrl.replace(/\/$/, '')}/storage/v1/`,
		credentialProjectRef: credentialRef,
		dbProjectRef: dbRef,
	});
	if (apiRef !== SUPABASE_PROJECT_REFS.production) {
		throw new Error('Production API URL does not match the allowlisted project.');
	}
	return { prodSupabaseUrl, prodServiceRole };
}

function backupAuthData(
	prodDbUrl: string,
	authPath: string,
): { usersLength: number; identitiesLength: number } {
	const users = queryJson<AuthUser[]>(
		prodDbUrl,
		`select coalesce(json_agg(sub order by created_at), '[]'::json)::text from (
		  select id, aud, role, email, email_confirmed_at, raw_app_meta_data,
		         raw_user_meta_data, is_super_admin, phone, phone_confirmed_at,
		         banned_until, deleted_at, is_sso_user, is_anonymous, created_at, updated_at
		  from auth.users
		) sub;`,
	);
	const identities = queryJson<AuthIdentity[]>(
		prodDbUrl,
		`select coalesce(json_agg(sub order by created_at), '[]'::json)::text from (
		  select id, user_id, identity_data, provider, provider_id,
		         last_sign_in_at, created_at, updated_at
		  from auth.identities
		) sub;`,
	);
	writeFileSync(authPath, generateAuthDump(users, identities), { mode: 0o600 });
	return { usersLength: users.length, identitiesLength: identities.length };
}

async function backupStorageData(
	prodDbUrl: string,
	prodSupabaseUrl: string,
	prodServiceRole: string,
	storageMetadataPath: string,
	storageObjectsPath: string,
): Promise<number> {
	runBackupCommand(
		'pg_dump',
		[
			'--data-only',
			'--table',
			'storage.buckets',
			'--table',
			'storage.objects',
			'--no-owner',
			'--no-privileges',
			'--file',
			storageMetadataPath,
			'--dbname',
			prodDbUrl,
		],
		{ redact: [prodDbUrl] },
	);

	const inventory = queryJson<StorageInventoryRow[]>(prodDbUrl, STORAGE_INVENTORY_SQL);
	writeBackupPhase(BACKUP_PHASE_LABELS.storageObjects, `0/${inventory.length}`);
	const archive = emptyStorageArchive();
	archive.objects = await downloadStorageInventory({
		inventory,
		prodSupabaseUrl,
		prodServiceRole,
		onProgress: (index, total) => {
			writeBackupPhase(BACKUP_PHASE_LABELS.storageObjects, `${index}/${total}`);
		},
	});
	writeStorageObjectArchive(storageObjectsPath, archive);
	return archive.objects.length;
}

function writeBackupManifest(
	databasePath: string,
	authPath: string,
	storageMetadataPath: string,
	storageObjectsPath: string,
	manifestPath: string,
	after: RecoveryIntegritySnapshot,
): void {
	const purposeRaw = process.env.CELEBRA_CRITICAL_BACKUP_PURPOSE?.trim();
	const purpose: CriticalBackupPurpose =
		purposeRaw === 'migrate-pre' ||
		purposeRaw === 'migrate-post' ||
		purposeRaw === 'promote-pre' ||
		purposeRaw === 'standalone'
			? purposeRaw
			: 'standalone';
	const planId = process.env.CELEBRA_CRITICAL_BACKUP_PLAN_ID?.trim() || undefined;
	const pendingRaw = process.env.CELEBRA_CRITICAL_BACKUP_PENDING?.trim();
	const pendingVersions = pendingRaw
		? pendingRaw
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean)
		: undefined;

	const manifest: CriticalBackupManifest = {
		version: 1,
		createdAt: new Date().toISOString(),
		environment: 'production',
		projectRef: SUPABASE_PROJECT_REFS.production,
		sourceEnvironment: 'production',
		artifacts: [
			createArtifactManifest('database', databasePath),
			createArtifactManifest('auth', authPath),
			createArtifactManifest('storage-metadata', storageMetadataPath),
			createArtifactManifest('storage-objects', storageObjectsPath),
		],
		integrity: after,
		purpose,
		planId,
		pendingVersions,
		stateDigest: computeRecoveryStateDigest(after),
	};
	validateCriticalBackupManifest(manifest);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
	assertWindowsEfsEncrypted([
		manifestPath,
		...manifest.artifacts.map((artifact) => artifact.path),
	]);
}

async function main(): Promise<void> {
	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);
	const { prodSupabaseUrl, prodServiceRole } = verifyProductionSecrets(prodDbUrl);

	const outputDir = resolve('.backups', 'prod', `critical-${timestamp()}`);
	incompleteOutputDir = outputDir;
	mkdirSync(outputDir, { recursive: true });
	prepareEncryptedLocalDirectory(outputDir);
	const databasePath = resolve(outputDir, 'database.sql');
	const authPath = resolve(outputDir, 'auth.sql');
	const storageMetadataPath = resolve(outputDir, 'storage-metadata.sql');
	const storageObjectsPath = resolve(outputDir, 'storage-objects.json');
	const manifestPath = resolve(outputDir, 'manifest.json');

	console.info('Critical Production backup (read-only)');
	console.info(`- PROD_DB_URL source: ${source}`);
	console.info(`- Target: ${redactDbUrl(prodDbUrl)}`);
	console.info('- Environment identity: verified Production project');
	console.info('- Output: ignored, access-restricted local backup directory');

	writeBackupPhase(BACKUP_PHASE_LABELS.integrityBefore);
	const before = captureRecoveryIntegrity(prodDbUrl);

	writeBackupPhase(BACKUP_PHASE_LABELS.dumpPublic);
	runBackupCommand(
		'pg_dump',
		[
			'--data-only',
			'--schema',
			'public',
			'--no-owner',
			'--no-privileges',
			'--file',
			databasePath,
			'--dbname',
			prodDbUrl,
		],
		{ redact: [prodDbUrl] },
	);

	writeBackupPhase(BACKUP_PHASE_LABELS.auth);
	const { usersLength, identitiesLength } = backupAuthData(prodDbUrl, authPath);

	writeBackupPhase(BACKUP_PHASE_LABELS.storageMetadata);
	const storageObjectsCount = await backupStorageData(
		prodDbUrl,
		prodSupabaseUrl,
		prodServiceRole,
		storageMetadataPath,
		storageObjectsPath,
	);

	writeBackupPhase(BACKUP_PHASE_LABELS.integrityAfter);
	const after = captureRecoveryIntegrity(prodDbUrl);
	const coherence = compareRecoveryIntegrity(before, after, { requireValidInvariants: false });
	if (!coherence.ok) {
		throw new Error(
			`Production changed while the critical backup set was being captured; no manifest was created.\n${coherence.failures.join('\n')}`,
		);
	}

	writeBackupPhase(BACKUP_PHASE_LABELS.manifest);
	writeBackupManifest(
		databasePath,
		authPath,
		storageMetadataPath,
		storageObjectsPath,
		manifestPath,
		after,
	);

	console.info('Critical Production backup completed and verified.');
	console.info(`- Manifest: ${manifestPath}`);
	console.info(`- Auth users: ${usersLength}`);
	console.info(`- Auth identities: ${identitiesLength}`);
	console.info(`- Storage objects: ${storageObjectsCount}`);
	console.info(`- Critical tables: ${Object.keys(after.tables).length}`);
	console.info(`- Integrity profile: ${after.profile}`);
	console.info(`CRITICAL_BACKUP_MANIFEST=${manifestPath}`);
	incompleteOutputDir = null;
}

main().catch((error: unknown) => {
	if (incompleteOutputDir) {
		const backupRoot = resolve('.backups', 'prod');
		const safeChild =
			dirname(incompleteOutputDir) === backupRoot &&
			basename(incompleteOutputDir).startsWith('critical-');
		if (safeChild) rmSync(incompleteOutputDir, { recursive: true, force: true });
	}
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
