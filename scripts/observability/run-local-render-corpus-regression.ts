#!/usr/bin/env tsx
/**
 * Runs Local Render Corpus regression and writes validation evidence.
 * Preserves the original non-zero exit when tests fail; evidence write
 * failures never convert a failed run into a pass.
 *
 * Totals come from Jest's JSON report (numTotalTests / passed / failed),
 * not fabricated placeholders.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tryWriteValidationEvidence } from './validation-evidence.ts';

const startedAt = new Date().toISOString();
const command = 'pnpm test:local-render-corpus';
const reportPath = resolve(
	process.cwd(),
	'.tmp/observability/validation/regression-jest-report.json',
);
const jestCliPath = resolve(process.cwd(), 'node_modules/jest/bin/jest.js');

mkdirSync(dirname(reportPath), { recursive: true });
if (existsSync(reportPath)) {
	rmSync(reportPath);
}

const result = spawnSync(
	process.execPath,
	[
		jestCliPath,
		'--runTestsByPath',
		'tests/provision/local-render-corpus-regression.test.ts',
		'--json',
		`--outputFile=${reportPath}`,
	],
	{
		stdio: 'inherit',
		shell: false,
		env: process.env,
	},
);

const exitCode = result.status ?? 1;
const completedAt = new Date().toISOString();

interface JestJsonReport {
	success?: boolean;
	numTotalTests?: number;
	numPassedTests?: number;
	numFailedTests?: number;
	testResults?: Array<{
		name?: string;
		status?: string;
		assertionResults?: Array<{
			fullName?: string;
			status?: string;
			failureMessages?: string[];
		}>;
	}>;
}

function readJestReport(): JestJsonReport | null {
	if (!existsSync(reportPath)) return null;
	try {
		return JSON.parse(readFileSync(reportPath, 'utf8')) as JestJsonReport;
	} catch {
		return null;
	}
}

const report = readJestReport();
const total = typeof report?.numTotalTests === 'number' ? report.numTotalTests : null;
const passed = typeof report?.numPassedTests === 'number' ? report.numPassedTests : null;
const failed = typeof report?.numFailedTests === 'number' ? report.numFailedTests : null;

const failures: Array<{ slug: string; message: string }> = [];
for (const suite of report?.testResults ?? []) {
	for (const assertion of suite.assertionResults ?? []) {
		if (assertion.status !== 'failed') continue;
		const message = (assertion.failureMessages?.[0] ?? assertion.fullName ?? 'test failed')
			.split('\n')[0]!
			.slice(0, 200);
		const slugMatch = message.match(/\b([a-z0-9]+(?:-[a-z0-9]+)+)\b/);
		failures.push({
			slug: slugMatch?.[1] ?? '*',
			message,
		});
	}
}

const status = exitCode === 0 ? 'pass' : 'fail';
const writeResult = tryWriteValidationEvidence({
	validationType: 'regression',
	command,
	startedAt,
	completedAt,
	status,
	// When Jest report is unavailable, record truthful zeros rather than inventing suite counts.
	total: total ?? 0,
	passed: passed ?? 0,
	failed: failed ?? (exitCode === 0 ? 0 : 1),
	failures:
		failures.length > 0
			? failures
			: exitCode === 0
				? []
				: [
						{
							slug: '*',
							message:
								total === null
									? 'Local Render Corpus regression failed (Jest JSON report unavailable)'
									: 'Local Render Corpus regression suite failed',
						},
					],
});

if (!writeResult.ok) {
	console.error(`VALIDATION_EVIDENCE_WRITE_FAILED: ${writeResult.error}`);
} else if (total === null) {
	console.error(
		'VALIDATION_EVIDENCE_COUNTS_UNAVAILABLE: wrote fail/pass status without Jest totals',
	);
}

process.exit(exitCode);
