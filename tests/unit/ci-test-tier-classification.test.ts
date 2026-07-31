/**
 * ci-test-tier-classification.test.ts — Hermetic proof that DB suites are
 * excluded from generic `pnpm test` and routed to disposable tiers.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const root = process.cwd();
const requireConfig = createRequire(path.join(root, 'package.json'));

type JestConfigShape = {
	testPathIgnorePatterns?: string[];
};

describe('CI hermetic vs disposable test tier classification', () => {
	it('excludes managed rekey disposable suite from hermetic Jest config', () => {
		const jestConfig = requireConfig(path.join(root, 'jest.config.cjs')) as JestConfigShape;
		expect(jestConfig.testPathIgnorePatterns).toEqual(
			expect.arrayContaining([
				'/tests/provision/goal2-rekey-disposable-integration\\.test\\.ts$',
			]),
		);
	});

	it('excludes RSVP DB contract suites from hermetic Jest config', () => {
		const jestConfig = requireConfig(path.join(root, 'jest.config.cjs')) as JestConfigShape;
		expect(jestConfig.testPathIgnorePatterns).toEqual(
			expect.arrayContaining([
				'/tests/db/public-guest-rsvp-db-boundary\\.test\\.ts$',
				'/tests/db/public-rsvp-http-wiring-db\\.test\\.ts$',
			]),
		);
	});

	it('registers managed disposable harness in package.json and GitHub Actions', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['test:db:managed-contracts']).toContain('run-managed-db-contracts');

		const workflow = fs.readFileSync(
			path.join(root, '.github/workflows/commit-validation.yml'),
			'utf8',
		);
		expect(workflow).toContain('pnpm test:db:managed-contracts');
	});
});
