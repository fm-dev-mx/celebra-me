import { createHash } from 'node:crypto';
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
} from './backup-manifest.ts';
import {
	extractSupabaseProjectRef,
	getSecretFromEnvOrFiles,
	PROD_SECRET_FILES,
} from './db-target-config.ts';
import { captureRecoveryIntegrity, compareRecoveryIntegrity } from './recovery-integrity.ts';
import {
	classifyStorageDownloadFailure,
	createStorageObjectArchiveEntry,
	writeStorageObjectArchive,
	type StorageObjectArchive,
} from './storage-object-archive.ts';
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

interface StorageInventoryRow {
	bucketId: string;
	name: string;
	contentType: string | null;
	declaredBytes: number | null;
	declaredSha256: string | null;
}

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

const integrityProfileArgument = process.argv.find((argument) =>
	argument.startsWith('--integrity-profile='),
);
const integrityProfileValue = integrityProfileArgument?.slice('--integrity-profile='.length);
if (integrityProfileValue && !['phase3', 'pre-phase3'].includes(integrityProfileValue)) {
	throw new Error('Unsupported critical backup integrity profile.');
}
const integrityProfile = integrityProfileValue === 'pre-phase3' ? 'pre-phase3' : 'phase3';

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

function parseNumeric(value: number | string | null): number | null {
	if (value === null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function storageObjectRef(bucketId: string, name: string): string {
	return createHash('sha256').update(`${bucketId}/${name}`).digest('hex').slice(0, 16);
}

async function main(): Promise<void> {
	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);
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

	const before = captureRecoveryIntegrity(prodDbUrl, { profile: integrityProfile });
	if (integrityProfile === 'pre-phase3') {
		const requiredPredecessor = '20260727180000';
		const phase3Versions = ['20260729140514', '20260729152113'];
		if (!before.migrationVersions?.includes(requiredPredecessor)) {
			throw new Error('Pre-Phase-3 backup requires the reviewed predecessor migration.');
		}
		if (phase3Versions.some((version) => before.migrationVersions?.includes(version))) {
			throw new Error('Pre-Phase-3 backup refuses a partially or fully migrated source.');
		}
	}

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

	const inventory = queryJson<StorageInventoryRow[]>(
		prodDbUrl,
		`select coalesce(json_agg(source order by "bucketId", name), '[]'::json)::text
		 from (
		   select distinct on (bucket_id, object_name)
		          bucket_id as "bucketId", object_name as name, content_type as "contentType",
		          declared_bytes as "declaredBytes", declared_sha256 as "declaredSha256"
		   from (
		     select a.bucket as bucket_id, a.storage_path as object_name,
		            coalesce(a.mime_type, o.metadata->>'mimetype') as content_type,
		            a.file_size as declared_bytes, a.sha256 as declared_sha256, 0 as priority
		     from public.invitation_assets a
		     left join storage.objects o on o.bucket_id = a.bucket and o.name = a.storage_path
		     where a.deleted_at is null and a.provider = 'supabase'
		     union all
		     select o.bucket_id, o.name, o.metadata->>'mimetype',
		            nullif(o.metadata->>'size', '')::bigint, null::text, 1
		     from storage.objects o
		     where o.bucket_id = 'invitation-assets'
		       and (
		         exists (
		           select 1 from public.published_invitation_content p
		           where p.content::text like '%' || o.name || '%'
		         )
		         or exists (
		           select 1 from public.invitation_content_drafts d
		           where d.content::text like '%' || o.name || '%'
		         )
		       )
		   ) candidates
		   order by bucket_id, object_name, priority
		 ) source;`,
	);
	const archive: StorageObjectArchive = {
		version: 1,
		createdAt: new Date().toISOString(),
		objects: [],
	};
	for (const object of inventory) {
		const objectRef = storageObjectRef(object.bucketId, object.name);
		const encodedPath = object.name.split('/').map(encodeURIComponent).join('/');
		const response = await fetch(
			`${prodSupabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(object.bucketId)}/${encodedPath}`,
			{
				headers: {
					Authorization: `Bearer ${prodServiceRole}`,
					apikey: prodServiceRole,
				},
			},
		);
		if (!response.ok) {
			const failureCategory = classifyStorageDownloadFailure(await response.text());
			throw new Error(
				`Critical Storage object download failed (${response.status}, ${failureCategory}, ref ${objectRef}).`,
			);
		}
		const content = new Uint8Array(await response.arrayBuffer());
		const entry = createStorageObjectArchiveEntry(
			object.bucketId,
			object.name,
			content,
			object.contentType,
		);
		const declaredBytes = parseNumeric(object.declaredBytes);
		if (declaredBytes !== null && declaredBytes !== entry.bytes) {
			throw new Error(`Storage object size mismatch (ref ${objectRef}).`);
		}
		if (object.declaredSha256 && object.declaredSha256 !== entry.sha256) {
			throw new Error(`Storage object checksum mismatch (ref ${objectRef}).`);
		}
		archive.objects.push(entry);
	}
	writeStorageObjectArchive(storageObjectsPath, archive);

	const after = captureRecoveryIntegrity(prodDbUrl, { profile: integrityProfile });
	const coherence = compareRecoveryIntegrity(before, after, { requireValidInvariants: false });
	if (!coherence.ok) {
		throw new Error(
			`Production changed while the critical backup set was being captured; no manifest was created.\n${coherence.failures.join('\n')}`,
		);
	}

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
	};
	validateCriticalBackupManifest(manifest);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
	assertWindowsEfsEncrypted([
		manifestPath,
		...manifest.artifacts.map((artifact) => artifact.path),
	]);

	console.info('Critical Production backup completed and verified.');
	console.info(`- Manifest: ${manifestPath}`);
	console.info(`- Auth users: ${users.length}`);
	console.info(`- Auth identities: ${identities.length}`);
	console.info(`- Storage objects: ${archive.objects.length}`);
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
