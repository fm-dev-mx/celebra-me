/**
 * Shared owner-only Production apply boundary.
 *
 * One interactive authorization model for all Production mutators:
 * explicit --apply, exact Production project identity, agent rejection,
 * deterministic operation summary, and exact TTY confirmation immediately
 * before the first write. No env/token/secret confirmation alternatives.
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

export interface OwnerProductionApplyInput {
	/** Must be true when the CLI received an explicit `--apply` flag. */
	apply: boolean;
	/** Resolved Production database URL (never logged in full). */
	dbUrl: string;
	/** Stable operation type label for the summary. */
	operationType: string;
	/** Exact string the operator must type. */
	confirmationChallenge: string;
	/** Deterministic summary rows printed before the challenge. */
	summary: ReadonlyArray<readonly [string, string]>;
	env?: NodeJS.ProcessEnv;
	stdin?: NodeJS.ReadStream;
	/** Test seam for confirmation input. */
	readConfirmationLine?: () => string;
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

/**
 * Final owner gate immediately before the first Production write.
 * Callers must invoke this only after all read-only preflight and backup steps.
 */
export function requireOwnerProductionApply(input: OwnerProductionApplyInput): void {
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
	writeOwnerLine('Type the following confirmation exactly to proceed:');
	writeOwnerLine(input.confirmationChallenge);
	writeOwnerLine('============================================================');

	if (!input.readConfirmationLine && !stdin.isTTY) {
		fail(
			'TTY_REQUIRED: Production apply requires an interactive TTY for exact owner confirmation. Noninteractive confirmation is not accepted.',
		);
	}

	const typed = (input.readConfirmationLine ?? readTtyConfirmationLine)();
	if (typed !== input.confirmationChallenge) {
		fail(
			'OWNER_CONFIRMATION_MISMATCH: Typed confirmation did not match the required challenge. No Production write was performed.',
		);
	}

	writeOwnerLine('✅ Owner confirmation accepted. Proceeding with the first write.');
}
