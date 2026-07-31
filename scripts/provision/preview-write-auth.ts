/**
 * preview-write-auth.ts — Scoped Preview Write Authorization Engine
 *
 * Enforces strict capability authorization before writing to Preview target.
 *
 * Capability Model:
 *  - Human (Interactive): Authorized via explicit interactive prompt/confirmation.
 *  - Automated Agent (Non-interactive): Requires explicit scoped authorization token
 *    (e.g., CELEBRA_PREVIEW_WRITE_AUTH="preview:<slug>:apply").
 *  - Lane/worktree/branch/environment identity alone IS NOT AUTHORIZATION.
 */

export interface PreviewWriteAuthInput {
	slug: string;
	targets: ('local' | 'preview' | 'production')[];
	apply?: boolean;
	isInteractive?: boolean;
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

	// Automated / Non-interactive mode requires explicit scoped token
	const token = authToken ?? process.env.CELEBRA_PREVIEW_WRITE_AUTH;
	if (!token || typeof token !== 'string') {
		throw new Error(
			`PREVIEW_WRITE_AUTH_REQUIRED: Automated Preview mutation for "${slug}" requires explicit scoped authorization. ` +
				`Set CELEBRA_PREVIEW_WRITE_AUTH="preview:${slug}:${operation}" or pass --preview-write-auth. ` +
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
