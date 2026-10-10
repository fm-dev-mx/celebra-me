#!/usr/bin/env node
/**
 * related-test-files.mjs
 *
 * Single source of truth for the changed files passed to Jest
 * `--findRelatedTests`.
 *
 * Public API:
 *   getRelatedTestSourceFiles(changedFiles: string[]): string[]
 *     - Returns changed JavaScript, TypeScript, and Astro source files.
 *     - Directly changed test files remain in the list so Jest runs them.
 *     - Missing paths are excluded (for example, deleted working-tree files).
 */

import { existsSync } from 'node:fs';

const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u;

/**
 * Contract tests that read these inputs from disk instead of importing them. The import graph can
 * never select them, so the input kind does; each entry runs in seconds.
 */
const CONTRACT_TESTS_BY_INPUT = [
	{
		pattern: /^src\/styles\/.*\.scss$/u,
		tests: [
			'tests/unit/editorial-cover-reveal-contract.test.ts',
			'tests/unit/envelope-tier-selection.test.ts',
			'tests/unit/gallery-microinteractions.test.ts',
			'tests/unit/gallery-single-style-contract.test.ts',
			'tests/unit/header-navigation.test.ts',
			'tests/unit/invitation-profile-boundary.test.ts',
			'tests/unit/landing-promo-literals.test.ts',
			'tests/unit/presentation-option-portability.test.ts',
			'tests/unit/style-boundaries.test.ts',
		],
	},
	{
		pattern: /^supabase\/migrations\/.*\.sql$/u,
		tests: [
			'tests/unit/commercial-capi-readiness-migration.test.ts',
			'tests/unit/db-permissions.test.ts',
			'tests/unit/invitations-domain-migration.test.ts',
			'tests/unit/migration-safety.test.ts',
			'tests/unit/mutation-receipt-lock-serialization-migration.test.ts',
			'tests/unit/phase2-resumable-mutations-migration.test.ts',
			'tests/unit/public-guest-rsvp-boundary-migration.test.ts',
			'tests/unit/rsvp-attendee-limit-migration.test.ts',
		],
	},
	{
		pattern: /\.astro$/u,
		tests: [
			'tests/unit/celestial-conversion-content.test.ts',
			'tests/unit/editorial-cover-reveal-contract.test.ts',
			'tests/unit/env-contract.test.ts',
			'tests/unit/gallery-commercial-slot.test.ts',
			'tests/unit/gallery-microinteractions.test.ts',
			'tests/unit/gallery-presentation.test.ts',
			'tests/unit/header-navigation.test.ts',
			'tests/unit/invitation-architecture-boundaries.test.ts',
			'tests/unit/landing-copy-register.test.ts',
			'tests/unit/landing-promo-literals.test.ts',
			'tests/unit/presentation-option-portability.test.ts',
			'tests/unit/private-cache-contract.test.ts',
			'tests/unit/reveal-gate-automation-contract.test.ts',
			'tests/unit/routing-security-rejection.test.ts',
			'tests/unit/style-boundaries.test.ts',
			'tests/unit/variant-governance.test.ts',
			'tests/unit/venue-map-illustration.test.ts',
		],
	},
];

/** Contract tests selected by the kind of changed input (missing test files are skipped). */
export function getContractTestsForInputs(changedFiles, pathExists = existsSync) {
	const selected = new Set();
	for (const file of changedFiles) {
		for (const { pattern, tests } of CONTRACT_TESTS_BY_INPUT) {
			if (!pattern.test(file)) continue;
			for (const test of tests) if (pathExists(test)) selected.add(test);
		}
	}
	return [...selected].sort();
}

export function getRelatedTestSourceFiles(changedFiles, pathExists = existsSync) {
	return [
		...new Set(changedFiles.filter((file) => SOURCE_PATTERN.test(file) && pathExists(file))),
	];
}

/** Deleted sources and data/config inputs have no reliable import graph. */
export function buildRelatedTestArgs(changedFiles, pathExists = existsSync) {
	const files = [...new Set(changedFiles.map((file) => file.replaceAll('\\', '/')))];
	const needsFullSuite = files.some(
		(file) =>
			(/\.(?:json|ya?ml)$/u.test(file) &&
				!file.startsWith('docs/') &&
				file !== 'tests/e2e/visual-baselines/manifest.json') ||
			(SOURCE_PATTERN.test(file) && !file.startsWith('tests/e2e/') && !pathExists(file)),
	);
	if (needsFullSuite) return ['exec', 'jest'];
	const sources = getRelatedTestSourceFiles(files, pathExists).filter(
		(file) => !file.startsWith('tests/e2e/'),
	);
	// A test path is related to itself, so contract tests ride along as plain inputs.
	const inputs = [...new Set([...sources, ...getContractTestsForInputs(files, pathExists)])];
	return inputs.length
		? ['exec', 'jest', '--findRelatedTests', '--passWithNoTests', ...inputs]
		: [];
}
