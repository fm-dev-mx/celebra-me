#!/usr/bin/env tsx
/**
 * Runs Local Render Corpus regression and writes validation evidence.
 * Preserves the original non-zero exit when tests fail; evidence write
 * failures never convert a failed run into a pass.
 */

import { spawnSync } from 'node:child_process';
import { tryWriteValidationEvidence } from './write-regression-evidence.ts';

const startedAt = new Date().toISOString();
const command = 'pnpm test:local-render-corpus';

const result = spawnSync(
	'pnpm',
	['exec', 'jest', '--runTestsByPath', 'tests/provision/local-render-corpus-regression.test.ts'],
	{
		stdio: 'inherit',
		shell: true,
		env: process.env,
	},
);

const exitCode = result.status ?? 1;
const passed = exitCode === 0;
const completedAt = new Date().toISOString();

const writeResult = tryWriteValidationEvidence({
	validationType: 'regression',
	command,
	startedAt,
	completedAt,
	status: passed ? 'pass' : 'fail',
	total: 1,
	passed: passed ? 1 : 0,
	failed: passed ? 0 : 1,
	failures: passed
		? []
		: [{ slug: '*', message: 'Local Render Corpus regression suite failed' }],
});

if (!writeResult.ok) {
	console.error(`VALIDATION_EVIDENCE_WRITE_FAILED: ${writeResult.error}`);
}

process.exit(exitCode);
