import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
	lintProductionPatchSql,
	argValue,
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
} from './sql-safety.ts';
import { getProdDbUrl, runCommand, runPsql } from './db-workflow-lib.ts';
import { OperatorError } from './operator-cli-ux.ts';
import {
	requireOwnerProductionApply,
	type OwnerProductionApplyInput,
} from './owner-production-apply.ts';
import { matchProductionWritePermit } from './production-write-permit.ts';

/**
 * db:prod:patch disposition: RESTRICT_OWNER_ONLY / KEEP_SPECIALIZED
 *
 * Narrow owner-only path for reviewed manual SQL patches that cannot yet be
 * expressed as versioned supabase/migrations/*. Not a bypass for
 * invitation:release or db:migrate. Default operator mode is lint-only
 * (--dry-run). --apply requires interactive owner TTY confirmation.
 */

function printUsage(): void {
	console.error('Usage: pnpm db:prod:patch -- --dry-run --file <production-patch.sql>');
	console.error(
		'       pnpm db:prod:patch -- --apply --owner-user-id <UUID> --file <production-patch.sql>',
	);
	console.error(
		'Owner-only specialized maintenance. Prefer supabase/migrations + db:migrate for schema and invitation:release for managed content.',
	);
	console.error(
		'Apply requires `pnpm release-check` evidence and an interactive TTY confirmation.',
	);
}

interface ParsedPatchInput {
	dryRun: boolean;
	apply: boolean;
	file: string;
	path: string;
	ownerUserId: string | undefined;
	sql: string;
}

function parsePatchInput(): ParsedPatchInput {
	const dryRun = process.argv.includes('--dry-run');
	const apply = process.argv.includes('--apply');
	const file = argValue('--file');
	const ownerUserId = argValue('--owner-user-id');

	if (dryRun && apply) {
		console.error('Cannot specify both --dry-run and --apply. Choose one mode.');
		process.exit(1);
	}

	if (!dryRun && !apply) {
		printUsage();
		console.error('       Specify --dry-run (lint only) or --apply (execute after validation).');
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

	return { dryRun, apply, file, path, ownerUserId, sql };
}

export interface PreparedProductionPatch {
	file: string;
	path: string;
	sql: string;
	fingerprint: string;
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
	return { file, path, sql, fingerprint };
}

/**
 * Execute a linted patch after owner authorization.
 * When authorizedPlanBindingHex is set, asserts the in-process permit instead of prompting.
 */
export async function applyPreparedProductionPatch(input: {
	prepared: PreparedProductionPatch;
	ownerUserId: string;
	authorizedPlanBindingHex?: string;
	requireOwnerApply?: (gate: OwnerProductionApplyInput) => Promise<void>;
}): Promise<void> {
	const { validatedOwnerId, normalizedUrl, dbUrl } = validateProductionTargetEnv(
		input.ownerUserId,
	);
	const ownerConfig = `SELECT set_config('app.owner_user_id', '${validatedOwnerId.replace(/'/g, "''")}', false);\n`;
	const urlConfig = `SELECT set_config('app.supabase_project_url', '${normalizedUrl.replace(/'/g, "''")}', false);\n`;
	const fullSql = ownerConfig + urlConfig + input.prepared.sql;
	const manifestFingerprint = createHash('sha256')
		.update(
			`${input.prepared.file}\u001f${validatedOwnerId}\u001f${normalizedUrl}\u001f${fullSql}`,
		)
		.digest('hex');

	if (input.authorizedPlanBindingHex) {
		const match = matchProductionWritePermit({
			dbUrl,
			bindingHex: input.authorizedPlanBindingHex,
		});
		if (match !== 'ok') {
			throw new OperatorError({
				title: 'Autorización de Production no reutilizable',
				cause: `El permiso interno no coincide con el plan aprobado (${match}).`,
				code: 'PRODUCTION_WRITE_PERMIT_REQUIRED',
				remediation: [
					'Ejecute pnpm prod:apply -- --patch <file> --apply en una TTY del propietario.',
				],
			});
		}
	} else {
		await (input.requireOwnerApply ?? requireOwnerProductionApply)({
			apply: true,
			dbUrl,
			operationType: 'production_patch',
			operationVerb: 'PATCH',
			bindingHex: manifestFingerprint,
			applyActionLabel: 'Aplicar',
			summaryTitle: 'Parche SQL — Production',
			summary: [
				['Operación', 'Parche SQL especializado'],
				['Archivo', input.prepared.file],
				['Respaldo', 'Responsabilidad del operador antes del apply'],
				['Autorización', 'Confirmación interactiva del propietario'],
			],
			technicalReview: [
				['Impacto', 'Ejecuta SQL de mantenimiento en Production'],
				['Archivo', input.prepared.file],
				['Owner UUID', validatedOwnerId],
				['Huella', manifestFingerprint],
				['Tipo interno', 'production_patch'],
				['Controles', 'TTY · agente bloqueado · release-check · sin token'],
			],
		});
	}

	executeProductionPatchSql(fullSql, dbUrl, normalizedUrl, input.prepared.file, validatedOwnerId);
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
	const { dryRun, file, path, ownerUserId, sql } = parsePatchInput();

	if (dryRun) {
		console.info(`Production patch dry-run passed lint: ${path}`);
		console.info('No database connection was opened and no SQL was executed.');
		console.info(
			'Disposition: RESTRICT_OWNER_ONLY specialized maintenance — not invitation:release and not db:migrate.',
		);
		process.exit(0);
	}

	if (!ownerUserId) {
		console.error('--owner-user-id is required for --apply.');
		process.exit(1);
	}

	await applyPreparedProductionPatch({
		prepared: {
			file,
			path,
			sql,
			fingerprint: createHash('sha256').update(`${file}\u001f${sql}`).digest('hex'),
		},
		ownerUserId,
	});
}

function executeProductionPatchSql(
	fullSql: string,
	dbUrl: string,
	normalizedUrl: string,
	file: string,
	validatedOwnerId: string,
): void {
	const execResult = runPsql(fullSql, dbUrl, [normalizedUrl, dbUrl]);

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
