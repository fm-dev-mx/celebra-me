/**
 * Test-safe build-time constants.
 *
 * Wraps `import.meta.env` reads so that test files can mock this module
 * without Jest choking on the `import.meta.env` syntax.
 */
export function isDevEnvironment(): boolean {
	return import.meta.env.DEV;
}

export interface BuildIdentity {
	commitSha: string | null;
	gitRef: string | null;
}

/** Commit and ref baked in at build time (`astro.config.mjs` `vite.define`). */
export function readBuildIdentity(): BuildIdentity {
	const commitSha = String(import.meta.env.CELEBRA_BUILD_SHA ?? '')
		.trim()
		.toLowerCase();
	const gitRef = String(import.meta.env.CELEBRA_BUILD_REF ?? '').trim();
	return {
		commitSha: /^[0-9a-f]{40}$/.test(commitSha) ? commitSha : null,
		gitRef: gitRef || null,
	};
}
