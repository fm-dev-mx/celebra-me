/**
 * preview-write-auth.ts — Task-Scoped Preview Write Authorization Assertion
 *
 * Asserts the operator-provided task scope before writing to Preview. This is
 * operational coordination, not cryptographic security: strong enforcement
 * depends on separating credentials and execution boundaries.
 *
 * Authorization model:
 *  - Human (interactive): verify short-circuits; caller MUST still confirm (YES).
 *  - Automation (canonical): CELEBRA_TASK_SCOPE="preview:<slug>:<operation>".
 *  - Operator task: CELEBRA_OPERATOR_TASK=invitation:release (VS Code task) binds
 *    the exact preview:<slug>:<operation> token from the parsed release identity.
 *  - Exact operation match only — tokens ending in `apply` authorize only `apply`,
 *    never migrate / sync-invitations / purge / other operations. No `*` wildcard.
 *  - Lane/worktree/branch/environment identity alone IS NOT AUTHORIZATION.
 *  - Production credentials are never inputs to this mechanism.
 *  - Production promotion uses invitation:release owner confirmation (orchestrator), not this API.
 */

import { createInterface } from 'node:readline/promises';

export interface PreviewWriteAuthInput {
	slug: string;
	targets: ('local' | 'preview' | 'production')[];
	apply?: boolean;
	isInteractive?: boolean;
	/** Explicit scope token for tests or callers that already resolved CELEBRA_TASK_SCOPE. */
	authToken?: string;
	operation?: string;
}

export interface PreviewWriteAuthResult {
	authorized: boolean;
	actor: 'human_interactive' | 'automated_scoped_token';
	reason?: string;
}

/** Set by the VS Code invitation:release task. Not a credential. */
export const INVITATION_RELEASE_OPERATOR_TASK = 'invitation:release';

export function resolvePreviewWriteAuthToken(input: {
	slug: string;
	operation: string;
	authToken?: string;
	env?: NodeJS.ProcessEnv;
}): string | undefined {
	const env = input.env ?? process.env;
	if (typeof input.authToken === 'string' && input.authToken.length > 0) {
		return input.authToken;
	}
	if (typeof env.CELEBRA_TASK_SCOPE === 'string' && env.CELEBRA_TASK_SCOPE.length > 0) {
		return env.CELEBRA_TASK_SCOPE;
	}
	if (
		env.CELEBRA_OPERATOR_TASK === INVITATION_RELEASE_OPERATOR_TASK &&
		input.slug &&
		input.operation
	) {
		return `preview:${input.slug}:${input.operation}`;
	}
	return undefined;
}

export function verifyPreviewWriteAuthorization(input: PreviewWriteAuthInput): PreviewWriteAuthResult {
	const { slug, targets, apply = false, isInteractive = false, authToken, operation = 'apply' } = input;

	// If preview target is not being mutated, authorization is not required.
	if (!targets.includes('preview') || !apply) {
		return { authorized: true, actor: 'human_interactive' };
	}

	// Human Interactive mode
	if (isInteractive) {
		return {
			authorized: true,
			actor: 'human_interactive',
		};
	}

	// Automated / non-interactive writes require an explicit task-scoped assertion.
	const token = resolvePreviewWriteAuthToken({ slug, operation, authToken });
	if (!token || typeof token !== 'string') {
		throw new Error(
			`PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation for "${slug}" requires an explicit task scope. ` +
				`Set CELEBRA_TASK_SCOPE="preview:${slug}:${operation}". ` +
				`Lane, worktree, or environment variables alone are insufficient authorization.`,
		);
	}

	const expectedPrefix = `preview:${slug}:`;
	if (!token.startsWith(expectedPrefix)) {
		throw new Error(
			`PREVIEW_WRITE_AUTH_REQUIRED: Preview write authorization token mismatch. Expected token bound to target "preview" and slug "${slug}" (e.g. "${expectedPrefix}${operation}"), got "${token}".`,
		);
	}

	const tokenOp = token.slice(expectedPrefix.length).trim();
	if (tokenOp !== operation) {
		throw new Error(
			`PREVIEW_WRITE_AUTH_REQUIRED: Preview write authorization scope mismatch. Token operation "${tokenOp}" does not authorize operation "${operation}". Exact scope preview:${slug}:${operation} is required.`,
		);
	}

	return {
		authorized: true,
		actor: 'automated_scoped_token',
	};
}

/**
 * Shared interactive YES confirmation for Preview mutators.
 * Injectable input seam for tests; TTY readline is the default.
 */
export async function confirmPreviewWriteYes(input: {
	confirmPrompt: string;
	readConfirmationLine?: () => string | Promise<string>;
	isInteractive?: boolean;
}): Promise<void> {
	const isInteractive =
		input.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
	if (!isInteractive && !input.readConfirmationLine) {
		throw new Error(
			'PREVIEW_WRITE_CANCELLED: Interactive YES confirmation required; no TTY and no confirmation seam provided.',
		);
	}

	const readLine =
		input.readConfirmationLine ??
		(async () => {
			const rl = createInterface({ input: process.stdin, output: process.stderr });
			try {
				return (await rl.question(input.confirmPrompt)).trim();
			} finally {
				rl.close();
			}
		});

	const answer = (await readLine()).trim();
	if (answer !== 'YES') {
		throw new Error('PREVIEW_WRITE_CANCELLED: Operator cancelled the Preview write.');
	}
}

/**
 * Preview write gate for CLI mutators: validate task scope (non-TTY) and always
 * require an explicit YES confirmation on interactive TTY — even if CELEBRA_TASK_SCOPE
 * is set (leftover/wrong tokens must not skip confirmation).
 */
export async function authorizePreviewWriteApply(input: {
	slug: string;
	operation: string;
	confirmPrompt: string;
	readConfirmationLine?: () => string | Promise<string>;
	isInteractive?: boolean;
}): Promise<PreviewWriteAuthResult> {
	const isInteractive =
		input.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
	const result = verifyPreviewWriteAuthorization({
		slug: input.slug,
		targets: ['preview'],
		apply: true,
		isInteractive,
		operation: input.operation,
	});
	if (isInteractive || input.readConfirmationLine) {
		await confirmPreviewWriteYes({
			confirmPrompt: input.confirmPrompt,
			readConfirmationLine: input.readConfirmationLine,
			isInteractive,
		});
	}
	return result;
}
