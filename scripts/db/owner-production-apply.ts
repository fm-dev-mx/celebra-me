/**
 * Shared owner-only Production apply boundary.
 *
 * One interactive authorization model for all Production mutators:
 * explicit --apply, exact Production project identity, agent rejection,
 * deterministic operation summary, and a two-step TTY confirmation
 * (arrow intent defaulting to Cancel, optional technical review, then
 * short bound code) immediately before the first write.
 * No env/token/secret confirmation alternatives.
 */

import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { extractSupabaseProjectRef, redactDbUrl } from './db-target-config.ts';
import {
	failOperator,
	formatKeyValueBlock,
	inquirerTheme,
	operatorSymbol,
	shortSha,
	writeHuman,
	type OperatorFailureInput,
} from './operator-cli-ux.ts';
import { assertValidReleaseCheckEvidence } from './release-check.ts';

function failGate(input: OperatorFailureInput, env?: NodeJS.ProcessEnv): never {
	failOperator(input, env);
}

/* eslint-disable no-control-regex */
/**
 * Strip terminal paste / raw-mode noise that breaks exact confirmation matching.
 * Windows terminals after @inquirer select often deliver Enter as CR-only and may
 * leave control bytes (e.g. SUB from Ctrl+Z) in the buffer.
 */
export function sanitizeOwnerConfirmationInput(raw: string): string {
	return raw
		.replace(/\u001b\[200~/g, '')
		.replace(/\u001b\[201~/g, '')
		.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/[\u00A0\u202F]/g, ' ')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\r|\n/g, '')
		.replace(/[ \t]+/g, ' ')
		.trim();
}
/* eslint-enable no-control-regex */

/** First 8 hex characters of a binding fingerprint (planId, packageHash, etc.). */
export function shortBindingHex(bindingHex: string): string {
	const cleaned = bindingHex.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
	if (cleaned.length < 8) {
		failGate({
			title: 'Enlace de confirmación inválido',
			cause: 'El enlace de confirmación debe contener al menos 8 caracteres hexadecimales.',
			code: 'OWNER_BINDING_INVALID',
			remediation: [
				'Reejecute el preflight para obtener un plan o huella válidos.',
				'Reintente el apply con el plan actualizado.',
			],
		});
	}
	return cleaned.slice(0, 8);
}

/** Short typed confirmation code: `<VERB> <8-hex>`. */
export function buildOwnerConfirmationCode(operationVerb: string, bindingHex: string): string {
	const verb = operationVerb.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9_-]*$/.test(verb)) {
		failGate({
			title: 'Verbo de operación inválido',
			cause: 'operationVerb debe ser un token de operación en mayúsculas.',
			code: 'OWNER_BINDING_INVALID',
			remediation: [
				'Corrija el verbo de operación del comando (MIGRATE, PROMOTE, PATCH, RESET).',
				'Reintente el apply.',
			],
		});
	}
	return `${verb} ${shortBindingHex(bindingHex)}`;
}

export type OwnerIntent = 'proceed' | 'cancel' | 'review';

export interface OwnerProductionApplyInput {
	/** Must be true when the CLI received an explicit `--apply` flag. */
	apply: boolean;
	/** Resolved Production database URL (never logged in full). */
	dbUrl: string;
	/** Stable operation type label for technical review / audit. */
	operationType: string;
	/**
	 * Operation verb for the short confirmation code (e.g. MIGRATE, PROMOTE).
	 * Combined with bindingHex into `<VERB> <8-hex>`.
	 */
	operationVerb: string;
	/**
	 * Hex fingerprint bound to this exact apply (planId, packageHash, etc.).
	 * Only the first 8 hex characters are typed; full value stays in technical review.
	 */
	bindingHex: string;
	/** Spanish label for the dangerous apply action in the intent menu. */
	applyActionLabel: string;
	/**
	 * Compact operator summary rows (Spanish labels).
	 * Do not include URLs, full hashes, executors, or internal policy names.
	 */
	summary: ReadonlyArray<readonly [string, string]>;
	/**
	 * Optional technical review rows (impact + safety controls + internal identifiers).
	 * Shown only when the operator selects "Revisar cambios".
	 */
	technicalReview?: ReadonlyArray<readonly [string, string]>;
	/** Optional Spanish title override for the compact card. */
	summaryTitle?: string;
	/**
	 * When true, skip the compact summary card (caller already presented it).
	 * Menu + confirmation code still run.
	 */
	omitSummary?: boolean;
	env?: NodeJS.ProcessEnv;
	stdin?: NodeJS.ReadStream;
	/** Test seam for arrow intent menu. */
	selectIntent?: () => OwnerIntent | Promise<OwnerIntent>;
	/** Test seam for confirmation input. */
	readConfirmationLine?: () => string | Promise<string>;
	/** Test seam for release-check evidence (defaults to assertValidReleaseCheckEvidence). */
	assertReleaseEvidence?: () => { sha: string };
}

export function assertExactProductionProjectRef(dbUrl: string): string {
	let projectRef: string;
	try {
		projectRef = extractSupabaseProjectRef(dbUrl);
	} catch (error: unknown) {
		failGate({
			title: 'No se pudo verificar el destino Production',
			cause: `No fue posible extraer la referencia del proyecto Supabase (${
				error instanceof Error ? error.message : String(error)
			}). Destino redactado: ${redactDbUrl(dbUrl)}`,
			code: 'PRODUCTION_TARGET_MISMATCH',
			remediation: [
				'Confirme que PROD_DB_URL apunta al proyecto Production configurado.',
				'Vuelva a cargar las credenciales operativas del propietario.',
				'Reintente el apply.',
			],
		});
	}
	if (projectRef !== SUPABASE_PROJECT_REFS.production) {
		failGate({
			title: 'Destino distinto de Production',
			cause: `La base resuelta no coincide con Production. Destino redactado: ${redactDbUrl(dbUrl)}`,
			code: 'PRODUCTION_TARGET_MISMATCH',
			remediation: [
				'Use únicamente PROD_DB_URL de Production (nunca Preview ni Local).',
				'Verifique la identidad del proyecto y reintente.',
			],
		});
	}
	return projectRef;
}

export function agentSelfAuthorizationBlocked(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const agentContext = env.CELEBRA_AGENT_CONTEXT?.trim();
	return Boolean(agentContext && agentContext !== 'false' && agentContext !== '0');
}

/**
 * Read the bound confirmation code via the same @inquirer stack as the intent menu.
 *
 * Important: do not use byte-wise readSync(0) after @inquirer select. On Windows,
 * the terminal remains in raw mode where Enter is CR (0x0d) only; the old reader
 * skipped CR and waited for LF forever, so the operator appeared stuck and the
 * eventual buffer (often with control bytes) failed the exact match.
 */
async function promptOwnerConfirmationCode(
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	const { input } = await import('@inquirer/prompts');
	return input({
		message: 'Código de confirmación',
		required: true,
		theme: inquirerTheme(env),
	});
}

async function promptOwnerIntent(
	applyActionLabel: string,
	env: NodeJS.ProcessEnv = process.env,
): Promise<OwnerIntent> {
	// Dynamic import keeps Jest/CJS consumers free of @inquirer ESM parse issues.
	const { select } = await import('@inquirer/prompts');
	return select({
		message: 'Seleccione una acción',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Revisar cambios', value: 'review' as const },
			{ name: applyActionLabel, value: 'proceed' as const },
		],
		theme: inquirerTheme(env),
	});
}

function defaultTechnicalReview(input: {
	operationType: string;
	projectRef: string;
	releaseSha: string;
	dbUrl: string;
	bindingHex: string;
	confirmationCode: string;
	summary: ReadonlyArray<readonly [string, string]>;
	technicalReview?: ReadonlyArray<readonly [string, string]>;
}): ReadonlyArray<readonly [string, string]> {
	if (input.technicalReview && input.technicalReview.length > 0) {
		return input.technicalReview;
	}
	return [
		['Impacto', 'Escritura en Production tras confirmación'],
		...input.summary,
		['Tipo interno', input.operationType],
		['Project ref', input.projectRef],
		['Release SHA', input.releaseSha],
		['Destino', redactDbUrl(input.dbUrl)],
		['Enlace completo', input.bindingHex],
		['Código', input.confirmationCode],
		['Controles', 'TTY · agente bloqueado · release-check · sin token'],
	];
}

function writeCompactSummary(input: OwnerProductionApplyInput): void {
	const rows: Array<readonly [string, string]> = [
		['Entorno', 'Production'],
		...input.summary,
	];
	writeHuman(
		formatKeyValueBlock(input.summaryTitle ?? 'Escritura en Production', rows, {
			env: input.env,
		}),
	);
	writeHuman(
		`${operatorSymbol('info', input.env)} Cancelar está seleccionado por defecto. Enter no autoriza la escritura.`,
	);
	writeHuman();
}

function writeTechnicalReviewCard(
	rows: ReadonlyArray<readonly [string, string]>,
	env?: NodeJS.ProcessEnv,
): void {
	writeHuman(
		formatKeyValueBlock('Revisión técnica — impacto y controles', rows, { env }),
	);
	writeHuman();
}

/**
 * Final owner gate immediately before the first Production write.
 * Callers must invoke this only after all read-only preflight and backup steps.
 */
export async function requireOwnerProductionApply(
	input: OwnerProductionApplyInput,
): Promise<void> {
	const env = input.env ?? process.env;

	if (!input.apply) {
		failGate(
			{
				title: 'Se requiere --apply explícito',
				cause: 'Las mutaciones de Production exigen la bandera --apply. El modo preflight no escribe.',
				code: 'OWNER_APPLY_REQUIRED',
				remediation: [
					'Ejecute primero el preflight de solo lectura.',
					'Reintente con --apply en una TTY interactiva del propietario.',
				],
			},
			env,
		);
	}

	if (agentSelfAuthorizationBlocked(env)) {
		failGate(
			{
				title: 'Autorización por agente bloqueada',
				cause: 'Los agentes autónomos no pueden autorizar escrituras en Production.',
				code: 'AGENT_SELF_AUTHORIZATION_BLOCKED',
				remediation: [
					'Ejecute el comando en una terminal interactiva del propietario.',
					'No defina CELEBRA_AGENT_CONTEXT durante el apply de Production.',
				],
			},
			env,
		);
	}

	const projectRef = assertExactProductionProjectRef(input.dbUrl);
	const releaseEvidence = (input.assertReleaseEvidence ?? assertValidReleaseCheckEvidence)();
	const stdin = input.stdin ?? process.stdin;
	const confirmationCode = buildOwnerConfirmationCode(input.operationVerb, input.bindingHex);

	writeHuman();
	if (!input.omitSummary) {
		writeCompactSummary(input);
	} else {
		writeHuman(
			`${operatorSymbol('info', env)} Autorización: Cancelar está seleccionado por defecto. Enter no autoriza la escritura.`,
		);
		writeHuman();
	}

	const hasIntentSeam = Boolean(input.selectIntent);
	const hasLineSeam = Boolean(input.readConfirmationLine);
	const ttyOk = Boolean(stdin.isTTY && process.stderr.isTTY);
	if (!hasIntentSeam && !hasLineSeam && !ttyOk) {
		failGate(
			{
				title: 'Se requiere una TTY interactiva',
				cause: 'Production apply exige confirmación exacta del propietario en una TTY. No se acepta confirmación no interactiva.',
				code: 'TTY_REQUIRED',
				remediation: [
					'Ejecute el comando en una terminal interactiva.',
					'No use CI, pipes ni automatización para autorizar Production.',
				],
			},
			env,
		);
	}

	for (;;) {
		const intent = input.selectIntent
			? await input.selectIntent()
			: hasLineSeam
				? 'proceed'
				: await promptOwnerIntent(input.applyActionLabel, env);

		if (intent === 'cancel') {
			failGate(
				{
					title: 'Operación cancelada',
					cause: 'El operador canceló en el menú de intención.',
					code: 'OWNER_CONFIRMATION_CANCELLED',
					remediation: [
						'Si la escritura era intencional, vuelva a ejecutar el comando.',
						'Revise el plan y seleccione Aplicar de forma explícita.',
					],
				},
				env,
			);
		}

		if (intent === 'review') {
			writeTechnicalReviewCard(
				defaultTechnicalReview({
					operationType: input.operationType,
					projectRef,
					releaseSha: releaseEvidence.sha,
					dbUrl: input.dbUrl,
					bindingHex: input.bindingHex,
					confirmationCode,
					summary: input.summary,
					technicalReview: input.technicalReview,
				}),
				env,
			);
			continue;
		}

		break;
	}

	writeHuman(`Escriba el código de confirmación exactamente:`);
	writeHuman(`  ${confirmationCode}`);
	writeHuman(
		`${operatorSymbol('info', env)} Enlace: plan ${shortSha(input.bindingHex)} · release ${shortSha(releaseEvidence.sha)}`,
	);

	const typedRaw = await (input.readConfirmationLine
		? input.readConfirmationLine()
		: promptOwnerConfirmationCode(env));
	const typed = sanitizeOwnerConfirmationInput(typedRaw);
	if (typed !== confirmationCode) {
		failGate(
			{
				title: 'Código de confirmación incorrecto',
				cause:
					`El texto ingresado no coincide con el desafío vinculado al plan. ` +
					`Esperado ${confirmationCode.length} caracteres; recibido ${typed.length}.`,
				code: 'OWNER_CONFIRMATION_MISMATCH',
				remediation: [
					'Escriba exactamente el código mostrado (VERB + espacio + 8 hex), sin caracteres de control.',
					'No use Ctrl+Z para “desbloquear” el prompt; use solo Enter tras el código.',
					'Si el plan cambió, cancele, vuelva a revisar y genere un nuevo código.',
				],
			},
			env,
		);
	}

	writeHuman(
		`${operatorSymbol('ok', env)} Confirmación del propietario aceptada. Continuando con la primera escritura.`,
	);
}
