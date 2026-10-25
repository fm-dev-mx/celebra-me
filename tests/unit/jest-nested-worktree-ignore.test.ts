/**
 * jest-nested-worktree-ignore.test.ts — Nested repository copies (.worktrees/, .claude/worktrees/,
 * review fixtures under .agent/tmp/) must never be collected, resolved or watched by `pnpm test`,
 * while a run rooted inside one of those copies still collects its own tests.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const root = process.cwd();
const requireConfig = createRequire(path.join(root, 'package.json'));

type JestConfigShape = {
	testPathIgnorePatterns?: string[];
	modulePathIgnorePatterns?: string[];
	watchPathIgnorePatterns?: string[];
};

const jestConfig = requireConfig(path.join(root, 'jest.config.cjs')) as JestConfigShape;

const integrationRoot = '/repo/celebra-me';
const nestedCopies = [
	`${integrationRoot}/.worktrees/stale-copy`,
	`${integrationRoot}/.claude/worktrees/stale-copy`,
	`${integrationRoot}/.agent/tmp/reports/review-fixture/candidate`,
];

const isIgnored = (patterns: string[] | undefined, rootDir: string, candidate: string) =>
	(patterns ?? []).some((pattern) =>
		new RegExp(pattern.replace('<rootDir>', rootDir)).test(candidate),
	);

describe('Jest nested repository copy ignore lists', () => {
	it.each(nestedCopies)('ignores tests, modules and watch events under %s', (copy) => {
		const candidate = `${copy}/tests/unit/example.test.ts`;
		expect(isIgnored(jestConfig.testPathIgnorePatterns, integrationRoot, candidate)).toBe(true);
		expect(isIgnored(jestConfig.modulePathIgnorePatterns, integrationRoot, candidate)).toBe(
			true,
		);
		expect(isIgnored(jestConfig.watchPathIgnorePatterns, integrationRoot, candidate)).toBe(
			true,
		);
	});

	it('still collects repository tests', () => {
		const candidate = `${integrationRoot}/tests/unit/example.test.ts`;
		expect(isIgnored(jestConfig.testPathIgnorePatterns, integrationRoot, candidate)).toBe(
			false,
		);
	});

	it.each(nestedCopies)('still collects own tests when rooted inside %s', (copy) => {
		const candidate = `${copy}/tests/unit/example.test.ts`;
		expect(isIgnored(jestConfig.testPathIgnorePatterns, copy, candidate)).toBe(false);
		expect(isIgnored(jestConfig.modulePathIgnorePatterns, copy, candidate)).toBe(false);
	});
});
