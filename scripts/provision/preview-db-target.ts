/**
 * Preview-only database target for provisioning CLIs that write Preview rows directly.
 * Production and any other target are rejected before a connection is used.
 */

import {
	classifyDbTarget,
	redactDbUrl,
	resolveTargetDbUrl,
	validateEnvironmentUrlsPreflight,
} from '../db/db-target-config.ts';

export function resolvePreviewOnlyDbUrl(
	input: { errorPrefix: string; purpose: string },
	env: NodeJS.ProcessEnv = process.env,
): string {
	const { errorPrefix, purpose } = input;
	const url = resolveTargetDbUrl('preview', env);
	if (!url) {
		throw new Error(`${errorPrefix}_CREDENTIALS: PREVIEW_DB_URL is required to ${purpose}.`);
	}

	const classification = classifyDbTarget(url);
	if (classification.target === 'production') {
		throw new Error(
			`${errorPrefix}_PRODUCTION_REJECTED: Commands that ${purpose} must not target Production.`,
		);
	}
	if (classification.target !== 'preview') {
		throw new Error(
			`${errorPrefix}_TARGET_REJECTED: Expected Preview database target, got "${classification.target}" (${redactDbUrl(url)}).`,
		);
	}
	// classifyDbTarget trusts PREVIEW_DB_URL itself; also require the canonical Preview project.
	try {
		validateEnvironmentUrlsPreflight({ target: 'preview', targetDbUrl: url });
	} catch (error: unknown) {
		throw new Error(
			`${errorPrefix}_TARGET_REJECTED: ${error instanceof Error ? error.message : String(error)} (${redactDbUrl(url)}).`,
			{ cause: error },
		);
	}
	return url;
}
