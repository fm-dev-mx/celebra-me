import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { validateCriticalBackupManifest, type CriticalBackupManifest } from './backup-manifest.ts';
import { classifyDbTarget } from './db-target-config.ts';
import {
	captureRecoveryIntegrity,
	compareRecoveryIntegrity,
	type RecoveryIntegritySnapshot,
} from './recovery-integrity.ts';
import {
	materializeStorageObjectArchive,
	readStorageObjectArchive,
} from './storage-object-archive.ts';
import { runCommand } from './db-workflow-lib.ts';

interface RestoreReport {
	version: 1;
	manifestPath: string;
	sourceEnvironment: 'production' | 'disposable-test' | 'unknown';
	target: 'disposable-test';
	restoreStartedAt: string;
	restoreCompletedAt: string;
	verificationCompletedAt: string;
	restoreElapsedMs: number;
	verificationElapsedMs: number;
	totalElapsedMs: number;
	rtoTargetMs: number;
	rtoSatisfied: boolean;
	manualSteps: string[];
	manifestVerified: true;
	migrationCount: number;
	tables: RecoveryIntegritySnapshot['tables'];
	invariants: Record<string, number>;
	storageObjects: Array<{
		bucketId: string;
		name: string;
		bytes: number;
		sha256: string;
	}>;
}

const args = new Map(
	process.argv.slice(2).map((argument) => {
		const [key, ...value] = argument.replace(/^--/, '').split('=');
		return [key, value.join('=')];
	}),
);
const manifestArgument = args.get('manifest');
const targetDbUrl = args.get('target-db-url') ?? '';
if (!manifestArgument || !targetDbUrl) {
	throw new Error('Required: --manifest=... --target-db-url=...');
}
const manifestPath = resolve(manifestArgument);
const reportPath = resolve(args.get('report') ?? '.tmp/disposable-restore-report.json');
const storageRoot = resolve(
	args.get('storage-root') ?? `.tmp/recovery-drill/restored-storage-${Date.now()}`,
);

const target = classifyDbTarget(targetDbUrl);
if (target.target !== 'disposable-test') {
	throw new Error(`Restore target must be disposable-test, got ${target.target}.`);
}
if (!existsSync(manifestPath)) throw new Error('Recovery manifest does not exist.');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
validateCriticalBackupManifest(manifest, { allowDisposableTest: true });
if (!manifest.integrity) {
	throw new Error('Recovery manifest is missing the required integrity snapshot.');
}
if (existsSync(storageRoot)) {
	throw new Error(`Disposable Storage restore root already exists: ${storageRoot}`);
}

const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.kind, artifact.path]));
const requiredArtifact = (kind: 'database' | 'auth' | 'storage-metadata' | 'storage-objects') => {
	const path = artifacts.get(kind);
	if (!path) throw new Error(`Critical backup artifact is missing: ${kind}`);
	return path;
};

function runPsql(input: string, isFile = false): void {
	const psqlArgs = ['--set', 'ON_ERROR_STOP=1', '--no-psqlrc', '--dbname', targetDbUrl];
	if (isFile) {
		psqlArgs.push(
			'--command',
			'SET session_replication_role = replica;',
			'--file',
			input,
			'--command',
			'SET session_replication_role = origin;',
		);
	}
	runCommand('psql', psqlArgs, {
		input: isFile ? undefined : input,
		redact: [targetDbUrl],
	});
}

function clearRestoredData(): void {
	runPsql(`
do $$
declare table_list text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
    into table_list
    from pg_tables
   where schemaname = 'public';
  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end $$;
truncate table auth.identities, auth.users cascade;
truncate table storage.objects, storage.buckets cascade;
`);
}

function parseJsonRows<T>(sql: string): T[] {
	const result = runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-psqlrc',
			'--tuples-only',
			'--no-align',
			'--dbname',
			targetDbUrl,
			'--command',
			sql,
		],
		{ redact: [targetDbUrl] },
	);
	const value = result.stdout.trim();
	return value ? (JSON.parse(value) as T[]) : [];
}

const restoreStartedAtMs = Date.now();
const restoreStartedAt = new Date(restoreStartedAtMs).toISOString();

runCommand('npx', ['-y', 'tsx', 'scripts/db/disposable-test-env.ts', 'reset']);
clearRestoredData();
runPsql(requiredArtifact('auth'), true);
runPsql(requiredArtifact('database'), true);
runPsql(requiredArtifact('storage-metadata'), true);

const storageArchive = readStorageObjectArchive(requiredArtifact('storage-objects'));
mkdirSync(dirname(storageRoot), { recursive: true });
const restoredStorage = materializeStorageObjectArchive(storageArchive, storageRoot);
const restoreCompletedAtMs = Date.now();

const expectedAssets = parseJsonRows<{
	bucket: string;
	storagePath: string;
	fileSize: number | null;
	sha256: string | null;
}>(`select coalesce(json_agg(json_build_object(
  'bucket', a.bucket,
  'storagePath', a.storage_path,
  'fileSize', a.file_size,
  'sha256', a.sha256
) order by a.bucket, a.storage_path), '[]'::json)::text
from public.invitation_assets a
where a.deleted_at is null and a.provider = 'supabase';`);
const storageByIdentity = new Map(
	restoredStorage.map((object) => [`${object.bucketId}/${object.name}`, object]),
);
const storageMetadataIdentities = new Set(
	parseJsonRows<{ bucket: string; name: string }>(`select coalesce(json_agg(json_build_object(
  'bucket', o.bucket_id,
  'name', o.name
) order by o.bucket_id, o.name), '[]'::json)::text from storage.objects o;`).map(
		(object) => `${object.bucket}/${object.name}`,
	),
);
const storageFailures: string[] = [];
for (const asset of expectedAssets) {
	const identity = `${asset.bucket}/${asset.storagePath}`;
	const restored = storageByIdentity.get(identity);
	if (!restored) {
		storageFailures.push(`Missing restored Storage bytes for ${identity}.`);
		continue;
	}
	if (!storageMetadataIdentities.has(identity))
		storageFailures.push(`Missing restored Storage metadata for ${identity}.`);
	if (asset.fileSize !== null && asset.fileSize !== restored.bytes)
		storageFailures.push(`Storage size differs from invitation_assets for ${identity}.`);
	if (asset.sha256 && asset.sha256 !== restored.sha256)
		storageFailures.push(`Storage checksum differs from invitation_assets for ${identity}.`);
}
if (storageFailures.length > 0) {
	throw new Error(`Critical Storage recovery failed:\n${storageFailures.join('\n')}`);
}

const actualIntegrity = captureRecoveryIntegrity(targetDbUrl);
const comparison = compareRecoveryIntegrity(manifest.integrity, actualIntegrity);
if (!comparison.ok) {
	throw new Error(`Disposable recovery integrity failed:\n${comparison.failures.join('\n')}`);
}

const verificationCompletedAtMs = Date.now();
const rtoTargetMs = 4 * 60 * 60 * 1000;
const report: RestoreReport = {
	version: 1,
	manifestPath,
	sourceEnvironment: manifest.sourceEnvironment ?? 'unknown',
	target: 'disposable-test',
	restoreStartedAt,
	restoreCompletedAt: new Date(restoreCompletedAtMs).toISOString(),
	verificationCompletedAt: new Date(verificationCompletedAtMs).toISOString(),
	restoreElapsedMs: restoreCompletedAtMs - restoreStartedAtMs,
	verificationElapsedMs: verificationCompletedAtMs - restoreCompletedAtMs,
	totalElapsedMs: verificationCompletedAtMs - restoreStartedAtMs,
	rtoTargetMs,
	rtoSatisfied: verificationCompletedAtMs - restoreStartedAtMs <= rtoTargetMs,
	manualSteps: [],
	manifestVerified: true,
	migrationCount: actualIntegrity.migrationCount,
	tables: actualIntegrity.tables,
	invariants: actualIntegrity.invariants,
	storageObjects: restoredStorage.map(({ bucketId, name, bytes, sha256 }) => ({
		bucketId,
		name,
		bytes,
		sha256,
	})),
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });

console.info('Disposable recovery drill passed.');
console.info(`- Report: ${reportPath}`);
console.info(`- Migrations: ${report.migrationCount}`);
console.info(`- Critical tables: ${Object.keys(report.tables).length}`);
console.info(`- Storage objects: ${report.storageObjects.length}`);
console.info(`- Total elapsed: ${report.totalElapsedMs} ms`);
console.info(`- RTO <= 4 hours: ${report.rtoSatisfied ? 'PASS' : 'FAIL'}`);
