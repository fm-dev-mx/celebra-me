import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
	lintProductionPatchSql,
	argValue,
	validateAndNormalizeSupabaseUrl,
	validateOwnerUserId,
	assertSameSupabaseProject,
	patchSqlRequiresOwnerUserId,
	type SqlManifest,
} from './sql-safety.ts';
import { getProdDbUrl, runPsql } from './db-workflow-lib.ts';
import { extractSupabaseProjectRef } from './db-target-config.ts';
import {
	OperatorError,
	operatorSymbol,
	renderOperatorError,
	writeHuman,
} from './operator-cli-ux.ts';
import { matchProductionWritePermit } from './production-write-permit.ts';
import {
	assessProductionPatchPreview,
	buildProductionPatchPreviewSql,
	parseProductionPatchPreview,
	type ProductionPatchPreviewAssessment,
} from './production-patch-preview.ts';
import { runMutationContractVerify } from './migrate-executors.ts';

const PRODUCTION_PATCH_PREVIEW_TIMEOUT_MS = 30_000;

/**
 * db:prod:patch disposition: RESTRICT_OWNER_ONLY / KEEP_SPECIALIZED
 *
 * Narrow owner-only path for reviewed manual SQL patches that cannot yet be
 * expressed as versioned supabase/migrations/*. Not a bypass for
 * invitation:release or db:migrate. Default operator mode is lint-only
 * (`--dry-run`).
 */

function printUsage(): void {
	writeHuman('Uso: pnpm db:prod:patch -- --dry-run --file <production-patch.sql>');
	writeHuman('La mutación es solo pnpm prod:apply -- --patch <production-patch.sql> --apply.');
	writeHuman('Este comando solo hace lint y no abre Production.');
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
		renderOperatorError(
			new OperatorError({
				title: 'Apply directo de parche bloqueado',
				cause: 'db:prod:patch no muta Production.',
				code: 'DIRECT_PRODUCTION_PATCH_APPLY_BLOCKED',
				remediation: ['Use pnpm prod:apply -- --patch <file> --apply.'],
				retryCommand: 'pnpm prod:apply -- --patch <file> --apply',
			}),
		);
		process.exit(1);
	}

	if (!dryRun) {
		printUsage();
		renderOperatorError(
			new OperatorError({
				title: 'Falta --dry-run',
				cause: 'db:prod:patch solo valida lint.',
				code: 'DRY_RUN_REQUIRED',
				remediation: ['Ejecute pnpm db:prod:patch -- --dry-run --file <path>.'],
				retryCommand: 'pnpm db:prod:patch -- --dry-run --file <path>',
			}),
		);
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
		renderOperatorError(
			new OperatorError({
				title: 'No se pudo leer el parche',
				cause: `No se puede leer ${path}.`,
				code: 'PATCH_FILE_UNREADABLE',
				remediation: ['Confirme la ruta del archivo SQL.'],
			}),
		);
		process.exit(1);
	}

	const result = lintProductionPatchSql(sql);

	if (!result.ok) {
		renderOperatorError(
			new OperatorError({
				title: 'Parche bloqueado por lint',
				cause: `El archivo ${path} no pasó la validación.`,
				code: 'PATCH_LINT_FAILED',
				remediation: result.errors,
			}),
		);
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

export function inspectProductionPatchPreview(
	prepared: PreparedProductionPatch,
	dbUrl: string,
): ProductionPatchPreviewAssessment {
	const result = runPsql(buildProductionPatchPreviewSql(prepared.manifest), dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		redact: [dbUrl],
		timeoutMs: PRODUCTION_PATCH_PREVIEW_TIMEOUT_MS,
	});
	if (result.status !== 0) {
		throw new OperatorError({
			title: 'Vista previa del parche fallida',
			cause: (result.stderr || result.stdout).trim() || 'La consulta de vista previa falló.',
			code: 'PATCH_PREVIEW_FAILED',
			remediation: ['Corrija el manifiesto o el estado de datos antes de aplicar.'],
		});
	}
	try {
		return assessProductionPatchPreview({
			evidence: parseProductionPatchPreview(prepared.manifest, result.stdout),
			min: Number(prepared.manifest['expected-rows-min']),
			max: Number(prepared.manifest['expected-rows-max']),
		});
	} catch {
		throw new OperatorError({
			title: 'Vista previa del parche no verificable',
			cause: 'La consulta de vista previa devolvió evidencia incompleta o malformada.',
			code: 'PATCH_PREVIEW_INVALID_OUTPUT',
			remediation: ['Corrija @dry-run-query antes de volver a planificar.'],
		});
	}
}

function preflightPatchPreview(
	prepared: PreparedProductionPatch,
	dbUrl: string,
): ProductionPatchPreviewAssessment {
	const assessment = inspectProductionPatchPreview(prepared, dbUrl);
	if (assessment.state === 'PENDING') return assessment;
	const storeConflict = assessment.reason === 'STORE_DISAGREEMENT';
	throw new OperatorError({
		title: storeConflict
			? 'Las poblaciones published/draft del parche no coinciden'
			: assessment.state === 'NOT_NEEDED'
				? 'El parche ya no requiere cambios'
				: 'Vista previa del parche fuera de los límites aprobados',
		cause: storeConflict
			? 'Las mismas identidades no están presentes en todos los stores declarados.'
			: assessment.state === 'NOT_NEEDED'
				? 'La vista previa en vivo devolvió cero filas.'
				: `La vista previa identificó ${assessment.evidence.total} filas fuera del rango aprobado.`,
		code: storeConflict
			? 'PATCH_PREVIEW_STORE_DISAGREEMENT'
			: assessment.state === 'NOT_NEEDED'
				? 'PATCH_NOT_NEEDED'
				: 'PATCH_PREVIEW_ROW_COUNT_MISMATCH',
		remediation: [
			'No aplique el parche con esta población.',
			'Revise la evidencia viva y genere un plan nuevo solo si aún corresponde.',
		],
	});
}

export interface ProductionPatchApplyResult {
	state: 'APPLIED_AND_VERIFIED';
}

export class ProductionPatchApplyError extends OperatorError {
	readonly state = 'APPLIED_VERIFICATION_FAILED' as const;

	constructor(error: unknown) {
		const detail = error instanceof Error ? error.message : String(error);
		super({
			title: 'El parche pudo aplicarse, pero no quedó verificado',
			cause: detail,
			code: 'APPLIED_VERIFICATION_FAILED',
			remediation: [
				'Ejecute el preflight read-only del parche y verifique el contrato antes de reintentar.',
				'No reutilice la autorización ni el plan anterior.',
			],
			noChangesMessage:
				'El write pudo completarse. No se considera seguro reintentar sin evidencia viva.',
		});
		this.name = 'ProductionPatchApplyError';
	}
}

/**
 * Execute a linted patch only through the reviewed prod:apply owner workflow.
 */
export async function applyPreparedProductionPatch(input: {
	prepared: PreparedProductionPatch;
	ownerUserId?: string;
	authorizedPlanBindingHex: string;
}): Promise<ProductionPatchApplyResult> {
	const requiresOwner = patchSqlRequiresOwnerUserId(input.prepared.sql);
	const { validatedOwnerId, normalizedUrl, dbUrl } = validateProductionTargetEnv(
		input.ownerUserId,
		requiresOwner,
	);
	const ownerConfig = validatedOwnerId
		? `SELECT set_config('app.owner_user_id', '${validatedOwnerId.replace(/'/g, "''")}', false);\n`
		: '';
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
				'Ejecute pnpm prod:apply -- --patch <file> --apply en una TTY del propietario.',
			],
		});
	}
	preflightPatchPreview(input.prepared, dbUrl);

	return executeProductionPatchSql(
		fullSql,
		dbUrl,
		normalizedUrl,
		input.prepared,
		input.authorizedPlanBindingHex,
	);
}

interface ValidatedTargetEnv {
	validatedOwnerId: string | null;
	normalizedUrl: string;
	dbUrl: string;
}

function validateProductionTargetEnv(
	ownerUserId: string | undefined,
	requiresOwner: boolean,
): ValidatedTargetEnv {
	let validatedOwnerId: string | null = null;
	if (requiresOwner || ownerUserId) {
		try {
			validatedOwnerId = validateOwnerUserId(ownerUserId);
		} catch (error: unknown) {
			throw new OperatorError({
				title: 'Propietario del parche inválido',
				cause: error instanceof Error ? error.message : String(error),
				code: 'OWNER_USER_ID_INVALID',
				remediation: [
					requiresOwner
						? 'Este parche asigna dueño: pase --owner-user-id <uuid> al generar un plan nuevo.'
						: 'Si pasa --owner-user-id, debe ser un UUID válido.',
				],
			});
		}
	}

	const { url: dbUrl } = getProdDbUrl();
	let normalizedUrl: string;
	try {
		normalizedUrl = resolveProductionPatchApiUrl(dbUrl);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new OperatorError({
			title: 'Falta la identidad API de Production',
			cause: message,
			code: message.includes('must reference the same')
				? 'PRODUCTION_PROJECT_MISMATCH'
				: 'PRODUCTION_API_IDENTITY_INVALID',
			remediation: [
				'PROD_DB_URL debe apuntar al proyecto Production allowlisted.',
				'Si define PROD_SUPABASE_URL, debe ser https://<ref>.supabase.co del mismo proyecto.',
				'No use SUPABASE_URL local para un apply de Production.',
			],
		});
	}

	return { validatedOwnerId, normalizedUrl, dbUrl };
}

/** Derive the Production API origin from PROD_DB_URL. Never reads local SUPABASE_URL. */
export function resolveProductionPatchApiUrl(dbUrl: string): string {
	const projectRef = extractSupabaseProjectRef(dbUrl);
	const derived = `https://${projectRef}.supabase.co`;
	const explicit = process.env.PROD_SUPABASE_URL?.trim();
	if (explicit?.startsWith('postgresql://')) {
		throw new Error(
			'PROD_SUPABASE_URL debe ser una URL HTTPS de Supabase, no una conexión PostgreSQL.',
		);
	}
	const normalized = validateAndNormalizeSupabaseUrl(explicit || derived);
	assertSameSupabaseProject(normalized, dbUrl);
	return normalized;
}

export async function runProdPatchMain(): Promise<void> {
	const { dryRun, path } = parsePatchInput();

	if (dryRun) {
		writeHuman(`${operatorSymbol('ok')} Lint de parche correcto: ${path}`);
		writeHuman('No se abrió Production y no se ejecutó SQL.');
		writeHuman(
			`${operatorSymbol('info')} Mutación: pnpm prod:apply -- --patch <file> --apply.`,
		);
		process.exit(0);
	}

	throw new Error('Unreachable: direct production patch execution is blocked.');
}

function executeProductionPatchSql(
	fullSql: string,
	dbUrl: string,
	normalizedUrl: string,
	prepared: PreparedProductionPatch,
	authorizedPlanBindingHex: string,
): ProductionPatchApplyResult {
	const execResult = runPsql(fullSql, dbUrl, {
		redact: [normalizedUrl, dbUrl],
		throwOnError: false,
		productionPermit: {
			bindingHex: authorizedPlanBindingHex,
			operationType: 'production_apply',
		},
	});

	if (execResult.status !== 0) {
		throw new ProductionPatchApplyError(
			`Production patch process failed (exit ${execResult.status ?? 'unknown'}).`,
		);
	}

	writeHuman(`${operatorSymbol('ok')} Parche aplicado: ${prepared.file}`);
	if (execResult.stdout) writeHuman(execResult.stdout);

	try {
		writeHuman(`${operatorSymbol('info')} Verificando contrato de schema…`);
		runMutationContractVerify('production', {
			bindingHex: authorizedPlanBindingHex,
			operationType: 'production_apply',
		});
		const finalPreview = inspectProductionPatchPreview(prepared, dbUrl);
		if (finalPreview.state !== 'NOT_NEEDED') {
			throw new Error(
				`PATCH_POST_APPLY_ROWS_REMAIN: ${finalPreview.evidence.total} target rows remain.`,
			);
		}
	} catch (error) {
		if (error instanceof ProductionPatchApplyError) throw error;
		throw new ProductionPatchApplyError(error);
	}
	writeHuman(`${operatorSymbol('ok')} Contrato de schema verificado.`);
	return { state: 'APPLIED_AND_VERIFIED' };
}

function isMain(): boolean {
	const entry = process.argv[1];
	return typeof entry === 'string' && /run-prod-patch\.(ts|js|mjs|cjs)$/.test(entry);
}

if (isMain()) {
	void runProdPatchMain().catch((error: unknown) => {
		renderOperatorError(error, {
			title: 'No se pudo completar el lint del parche',
			retryCommand: 'pnpm db:prod:patch -- --dry-run --file <path>',
		});
		process.exit(1);
	});
}
