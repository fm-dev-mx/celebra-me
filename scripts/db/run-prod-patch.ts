import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
	lintProductionPatchSql,
	argValue,
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
	type SqlManifest,
} from './sql-safety.ts';
import { getProdDbUrl, runCommand, runPsql } from './db-workflow-lib.ts';
import { OperatorError } from './operator-cli-ux.ts';
import { matchProductionWritePermit } from './production-write-permit.ts';

/**
 * db:prod:patch disposition: RESTRICT_OWNER_ONLY / KEEP_SPECIALIZED
 *
 * Narrow owner-only path for reviewed manual SQL patches that cannot yet be
 * expressed as versioned supabase/migrations/*. Not a bypass for
 * invitation:release or db:migrate. Default operator mode is lint-only
 * (`--dry-run`).
 */

function printUsage(): void {
	console.error('Usage: pnpm db:prod:patch -- --dry-run --file <production-patch.sql>');
	console.error(
		'Production mutation is available only through pnpm prod:apply -- --patch <production-patch.sql> --owner-user-id <UUID> --apply.',
	);
	console.error('This entrypoint is lint-only and never opens a Production database connection.');
}

interface ParsedPatchInput {
	dryRun: boolean;
	file: string;
	path: string;
}

function parsePatchInput(): ParsedPatchInput {
	const dryRun = process.argv.includes('--dry-run');
	const apply = process.argv.includes('--apply');
	const file = argValue('--file');

	if (apply) {
		printUsage();
		console.error('DIRECT_PRODUCTION_PATCH_APPLY_BLOCKED: use pnpm prod:apply -- --patch <file> --owner-user-id <uuid> --apply.');
		process.exit(1);
	}

	if (!dryRun) {
		printUsage();
		console.error('Specify --dry-run for lint-only validation.');
		process.exit(1);
	}

	if (!file || file === '--help' || file === '-h') {
		printUsage();
		process.exit(1);
	}

	const path = resolve(process.cwd(), file);
	let sql: string;
	try {
		sql = readFileSync(path, 'utf8');
	} catch {
		console.error(`Cannot read file: ${path}`);
		process.exit(1);
	}

	const result = lintProductionPatchSql(sql);

	if (!result.ok) {
		console.error(`Production patch blocked: ${path}`);
		for (const error of result.errors) console.error(`- ${error}`);
		process.exit(1);
	}

	return { dryRun, file, path };
}

export interface PreparedProductionPatch {
	file: string;
	path: string;
	sql: string;
	fingerprint: string;
	manifest: SqlManifest;
}

/** Lint-only patch preparation. Does not connect to Production. */
export function prepareProductionPatchFile(file: string): PreparedProductionPatch {
	const path = resolve(process.cwd(), file);
	let sql: string;
	try {
		sql = readFileSync(path, 'utf8');
	} catch {
		throw new OperatorError({
			title: 'No se pudo leer el parche',
			cause: 'No existe o no se puede leer el archivo de parche.',
			code: 'PRODUCTION_PATCH_UNREADABLE',
			remediation: ['Verifique la ruta relativa al repositorio y vuelva a planificar.'],
		});
	}
	const result = lintProductionPatchSql(sql);
	if (!result.ok) {
		throw new OperatorError({
			title: 'Parche de Production bloqueado',
			cause: result.errors.join('; '),
			code: 'PRODUCTION_PATCH_BLOCKED',
			remediation: [
				'Corrija el manifiesto y el SQL según sql-safety.',
				'Los parches no sustituyen db:migrate ni la promoción administrada.',
			],
			affected: { label: 'Errores de lint', items: [...result.errors] },
		});
	}
	const fingerprint = createHash('sha256').update(`${file}\u001f${sql}`).digest('hex');
	return { file, path, sql, fingerprint, manifest: result.manifest };
}

function assertPatchPreviewRowCount(manifest: SqlManifest, rawCount: string): number {
	const countText = rawCount.trim();
	if (!/^\d+$/.test(countText)) {
		throw new OperatorError({
			title: 'Vista previa del parche no verificable',
			cause: 'La consulta de vista previa no devolvió un único conteo entero.',
			code: 'PATCH_PREVIEW_COUNT_INVALID',
			remediation: ['Corrija @dry-run-query para que identifique un conjunto de filas contable.'],
		});
	}
	const count = Number(countText);
	const min = Number(manifest['expected-rows-min']);
	const max = Number(manifest['expected-rows-max']);
	if (!Number.isSafeInteger(count) || count < min || count > max) {
		throw new OperatorError({
			title: 'Vista previa del parche fuera de los límites aprobados',
			cause: `La vista previa identificó ${count} filas; el manifiesto permite ${min} a ${max}.`,
			code: 'PATCH_PREVIEW_ROW_COUNT_MISMATCH',
			remediation: [
				'No aplique el parche con esta población.',
				'Revise los predicados y vuelva a generar el plan de Production.',
			],
		});
	}
	return count;
}

function preflightPatchPreview(prepared: PreparedProductionPatch, dbUrl: string): number {
	const preview = prepared.manifest['dry-run-query'];
	if (!preview) {
		throw new OperatorError({
			title: 'Vista previa del parche ausente',
			cause: 'El parche preparado no tiene @dry-run-query.',
			code: 'PATCH_PREVIEW_REQUIRED',
			remediation: ['Vuelva a preparar el parche con un manifiesto válido.'],
		});
	}
	const result = runPsql(`select count(*)::text from (${preview}) as patch_target;`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		redact: [dbUrl],
	});
	if (result.status !== 0) {
		throw new OperatorError({
			title: 'Vista previa del parche fallida',
			cause: (result.stderr || result.stdout).trim() || 'La consulta de vista previa falló.',
			code: 'PATCH_PREVIEW_FAILED',
			remediation: ['Corrija el manifiesto o el estado de datos antes de aplicar.'],
		});
	}
	return assertPatchPreviewRowCount(prepared.manifest, result.stdout);
}

/**
 * Execute a linted patch only through the reviewed prod:apply owner workflow.
 */
export async function applyPreparedProductionPatch(input: {
	prepared: PreparedProductionPatch;
	ownerUserId: string;
	authorizedPlanBindingHex: string;
}): Promise<void> {
	const { validatedOwnerId, normalizedUrl, dbUrl } = validateProductionTargetEnv(
		input.ownerUserId,
	);
	const ownerConfig = `SELECT set_config('app.owner_user_id', '${validatedOwnerId.replace(/'/g, "''")}', false);\n`;
	const urlConfig = `SELECT set_config('app.supabase_project_url', '${normalizedUrl.replace(/'/g, "''")}', false);\n`;
	const fullSql = ownerConfig + urlConfig + input.prepared.sql;
	const match = matchProductionWritePermit({
		dbUrl,
		bindingHex: input.authorizedPlanBindingHex,
		operationType: 'production_apply',
	});
	if (match !== 'ok') {
		throw new OperatorError({
			title: 'Autorización de Production no reutilizable',
			cause: `El permiso interno no coincide con el plan aprobado (${match}).`,
			code: 'PRODUCTION_WRITE_PERMIT_REQUIRED',
			remediation: [
				'Ejecute pnpm prod:apply -- --patch <file> --owner-user-id <uuid> --apply en una TTY del propietario.',
			],
		});
	}
	preflightPatchPreview(input.prepared, dbUrl);

	executeProductionPatchSql(
		fullSql,
		dbUrl,
		normalizedUrl,
		input.prepared.file,
		validatedOwnerId,
		input.authorizedPlanBindingHex,
	);
}

interface ValidatedTargetEnv {
	validatedOwnerId: string;
	normalizedUrl: string;
	dbUrl: string;
}

function validateProductionTargetEnv(ownerUserId: string | undefined): ValidatedTargetEnv {
	let validatedOwnerId: string;
	try {
		validatedOwnerId = validateOwnerUserId(ownerUserId);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	}

	const rawSupabaseUrl = process.env.SUPABASE_URL || '';
	if (!rawSupabaseUrl) {
		console.error('SUPABASE_URL environment variable is required for --apply.');
		process.exit(1);
	}
	if (rawSupabaseUrl.startsWith('postgresql://')) {
		console.error(
			'SUPABASE_URL must be the Supabase API URL (https://<project>.supabase.co), not a PostgreSQL connection string. ' +
				'Set PROD_DB_URL for the database connection string.',
		);
		process.exit(1);
	}
	let normalizedUrl: string;
	try {
		normalizedUrl = validateAndNormalizeSupabaseUrl(rawSupabaseUrl);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	}

	const { url: dbUrl } = getProdDbUrl();

	try {
		assertSameSupabaseProject(normalizedUrl, dbUrl);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	}

	return { validatedOwnerId, normalizedUrl, dbUrl };
}

export async function runProdPatchMain(): Promise<void> {
	const { dryRun, path } = parsePatchInput();

	if (dryRun) {
		console.info(`Production patch dry-run passed lint: ${path}`);
		console.info('No database connection was opened and no SQL was executed.');
		console.info(
			'Disposition: RESTRICT_OWNER_ONLY specialized maintenance — not invitation:release and not db:migrate.',
		);
		process.exit(0);
	}

	throw new Error('Unreachable: direct production patch execution is blocked.');
}

function executeProductionPatchSql(
	fullSql: string,
	dbUrl: string,
	normalizedUrl: string,
	file: string,
	validatedOwnerId: string,
	authorizedPlanBindingHex: string,
): void {
	const execResult = runPsql(fullSql, dbUrl, {
		redact: [normalizedUrl, dbUrl],
		productionPermit: {
			bindingHex: authorizedPlanBindingHex,
			operationType: 'production_apply',
		},
	});

	if (execResult.status !== 0) {
		console.error(`Production patch failed (exit ${execResult.status}):`);
		console.error(execResult.stderr || execResult.stdout);
		process.exit(1);
	}

	console.info(`Owner UUID validated and applied: ${validatedOwnerId}`);
	console.info(`Production patch applied successfully: ${file}`);
	if (execResult.stdout) console.info(execResult.stdout);

	console.info('Running post-apply mutation schema contract verification...');
	const contractResult = runCommand(
		'npx',
		['tsx', 'scripts/db/verify-mutation-schema-contract.ts', '--target', 'production'],
		{
			env: { ...process.env, PROD_DB_URL: dbUrl },
			redact: [dbUrl],
			throwOnError: false,
		},
	);
	if (contractResult.status !== 0) {
		console.error(
			`POST_APPLY_CONTRACT_FAILED: Production patch SQL succeeded but mutation schema contract verification failed (exit ${contractResult.status}).`,
		);
		console.error(contractResult.stderr || contractResult.stdout);
		process.exit(1);
	}
	console.info('✅ Post-apply mutation schema contract verification passed.');
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /run-prod-patch\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void runProdPatchMain().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
