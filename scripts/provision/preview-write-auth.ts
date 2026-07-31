/**
 * preview-write-auth.ts — Task-Scoped Preview Write Authorization Assertion
 *
 * Asserts the operator-provided task scope before writing to Preview. This is
 * operational coordination, not cryptographic security: strong enforcement
 * depends on separating credentials and execution boundaries.
 *
 * Authorization model:
 *  - Human (interactive): caller confirms separately, then passes isInteractive.
 *  - Automation (canonical): CELEBRA_TASK_SCOPE="preview:<slug>:<operation>".
 *  - Lane/worktree/branch/environment identity alone IS NOT AUTHORIZATION.
 *  - Production credentials are never inputs to this mechanism.
 *  - Production promotion uses invitation:promote owner confirmation, not this API.
 */

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
	const token = process.env.CELEBRA_TASK_SCOPE ?? authToken;
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
	if (tokenOp !== operation && tokenOp !== 'apply' && tokenOp !== '*') {
		throw new Error(
			`PREVIEW_WRITE_AUTH_REQUIRED: Preview write authorization scope mismatch. Token operation "${tokenOp}" does not authorize operation "${operation}".`,
		);
	}

	return {
		authorized: true,
		actor: 'automated_scoped_token',
	};
}
