/**
 * Shared owner-only Production apply boundary.
 *
 * One interactive authorization model for all Production mutators:
 * explicit --apply, exact Production project identity, agent rejection,
 * deterministic operation summary, and a two-step TTY confirmation
 * (arrow intent + short bound code) immediately before the first write.
 * No env/token/secret confirmation alternatives.
 */

import { readSync } from 'node:fs';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { extractSupabaseProjectRef, redactDbUrl } from './db-target-config.ts';
import { assertValidReleaseCheckEvidence } from './release-check.ts';

function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

function writeOwnerLine(message = ''): void {
	process.stderr.write(`${message}\n`);
}

/* eslint-disable no-control-regex */
/** Strip terminal paste noise that breaks exact confirmation matching on Windows. */
export function sanitizeOwnerConfirmationInput(raw: string): string {
	return raw
		.replace(/\u001b\[200~/g, '')
		.replace(/\u001b\[201~/g, '')
		.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/\r/g, '')
		.trim();
}
/* eslint-enable no-control-regex */

/** First 8 hex characters of a binding fingerprint (planId, packageHash, etc.). */
export function shortBindingHex(bindingHex: string): string {
	const cleaned = bindingHex.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
	if (cleaned.length < 8) {
		fail(
			'OWNER_BINDING_INVALID: Confirmation binding must contain at least 8 hexadecimal characters.',
		);
	}
	return cleaned.slice(0, 8);
}

/** Short typed confirmation code: `<VERB> <8-hex>`. */
export function buildOwnerConfirmationCode(operationVerb: string, bindingHex: string): string {
	const verb = operationVerb.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9_-]*$/.test(verb)) {
		fail('OWNER_BINDING_INVALID: operationVerb must be an uppercase operation token.');
	}
	return `${verb} ${shortBindingHex(bindingHex)}`;
}

export interface OwnerProductionApplyInput {
	/** Must be true when the CLI received an explicit `--apply` flag. */
	apply: boolean;
	/** Resolved Production database URL (never logged in full). */
	dbUrl: string;
	/** Stable operation type label for the summary. */
	operationType: string;
	/**
	 * Operation verb for the short confirmation code (e.g. MIGRATE, PROMOTE).
	 * Combined with bindingHex into `<VERB> <8-hex>`.
	 */
	operationVerb: string;
	/**
	 * Hex fingerprint bound to this exact apply (planId, packageHash, etc.).
	 * Only the first 8 hex characters are typed; full value stays in the summary.
	 */
	bindingHex: string;
	/** Spanish label for the dangerous apply action in the intent menu. */
	applyActionLabel: string;
	/** Deterministic summary rows printed before the challenge. */
	summary: ReadonlyArray<readonly [string, string]>;
	env?: NodeJS.ProcessEnv;
	stdin?: NodeJS.ReadStream;
	/** Test seam for arrow intent menu. */
	selectIntent?: () => 'proceed' | 'cancel' | Promise<'proceed' | 'cancel'>;
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
		fail(
			`PRODUCTION_TARGET_MISMATCH: Unable to extract Supabase project ref from PROD_DB_URL (${
				error instanceof Error ? error.message : String(error)
			}). Redacted: ${redactDbUrl(dbUrl)}`,
		);
	}
	if (projectRef !== SUPABASE_PROJECT_REFS.production) {
		fail(
			`PRODUCTION_TARGET_MISMATCH: Resolved database project ref does not match configured Production. Redacted: ${redactDbUrl(dbUrl)}`,
		);
	}
	return projectRef;
}

export function agentSelfAuthorizationBlocked(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const agentContext = env.CELEBRA_AGENT_CONTEXT?.trim();
	return Boolean(agentContext && agentContext !== 'false' && agentContext !== '0');
}

function readTtyConfirmationLine(): string {
	process.stderr.write('Confirmation> ');
	const chunks: Buffer[] = [];
	const buf = Buffer.alloc(1);
	for (;;) {
		const bytesRead = readSync(0, buf, 0, 1, null);
		if (bytesRead <= 0) break;
		if (buf[0] === 0x0a) break;
		if (buf[0] === 0x0d) continue;
		chunks.push(Buffer.from(buf));
	}
	return Buffer.concat(chunks).toString('utf8');
}

async function promptOwnerIntent(applyActionLabel: string): Promise<'proceed' | 'cancel'> {
	// Dynamic import keeps Jest/CJS consumers free of @inquirer ESM parse issues.
	const { select } = await import('@inquirer/prompts');
	return select({
		message: 'Confirmar escritura en Production',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: applyActionLabel, value: 'proceed' as const },
		],
	});
}

/**
 * Final owner gate immediately before the first Production write.
 * Callers must invoke this only after all read-only preflight and backup steps.
 */
export async function requireOwnerProductionApply(
	input: OwnerProductionApplyInput,
): Promise<void> {
	if (!input.apply) {
		fail(
			'OWNER_APPLY_REQUIRED: Production mutation requires an explicit --apply flag. Dry-run/preflight mode performs no writes.',
		);
	}

	const env = input.env ?? process.env;
	if (agentSelfAuthorizationBlocked(env)) {
		fail(
			'AGENT_SELF_AUTHORIZATION_BLOCKED: Autonomous agents cannot authorize Production writes. An interactive owner TTY confirmation is required.',
		);
	}

	const projectRef = assertExactProductionProjectRef(input.dbUrl);
	const releaseEvidence = (input.assertReleaseEvidence ?? assertValidReleaseCheckEvidence)();
	const stdin = input.stdin ?? process.stdin;
	const confirmationCode = buildOwnerConfirmationCode(input.operationVerb, input.bindingHex);

	writeOwnerLine();
	writeOwnerLine('============================================================');
	writeOwnerLine('Production owner apply — review carefully');
	writeOwnerLine('============================================================');
	writeOwnerLine(`Operation:     ${input.operationType}`);
	writeOwnerLine(`Project ref:   ${projectRef}`);
	writeOwnerLine(`Release SHA:   ${releaseEvidence.sha}`);
	writeOwnerLine(`Target (redacted): ${redactDbUrl(input.dbUrl)}`);
	for (const [label, value] of input.summary) {
		writeOwnerLine(`${label.padEnd(14)} ${value}`);
	}
	writeOwnerLine('------------------------------------------------------------');
	writeOwnerLine('Confirmation code (type or paste exactly):');
	writeOwnerLine(`  ${confirmationCode}`);
	writeOwnerLine('============================================================');

	const hasIntentSeam = Boolean(input.selectIntent);
	const hasLineSeam = Boolean(input.readConfirmationLine);
	if (!hasIntentSeam && !hasLineSeam && !stdin.isTTY) {
		fail(
			'TTY_REQUIRED: Production apply requires an interactive TTY for exact owner confirmation. Noninteractive confirmation is not accepted.',
		);
	}

	const intent = input.selectIntent
		? await input.selectIntent()
		: hasLineSeam
			? 'proceed'
			: await promptOwnerIntent(input.applyActionLabel);

	if (intent !== 'proceed') {
		fail(
			'OWNER_CONFIRMATION_CANCELLED: Operator cancelled at the intent prompt. No Production write was performed.',
		);
	}

	writeOwnerLine();
	writeOwnerLine(`Escriba el código de confirmación:`);
	writeOwnerLine(`  ${confirmationCode}`);

	const typedRaw = await (input.readConfirmationLine ?? readTtyConfirmationLine)();
	const typed = sanitizeOwnerConfirmationInput(typedRaw);
	if (typed !== confirmationCode) {
		fail(
			'OWNER_CONFIRMATION_MISMATCH: Typed confirmation did not match the required challenge. No Production write was performed.',
		);
	}

	writeOwnerLine('✅ Owner confirmation accepted. Proceeding with the first write.');
}
