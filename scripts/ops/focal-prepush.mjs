#!/usr/bin/env node
/**
 * focal-prepush.mjs
 *
 * One local command that runs, before a push, the checks that otherwise fail only in Repository CI:
 * the Jest tests related to the branch (including the contract tests that read files from disk),
 * stylelint, the browserless visual matrix check, and the affected-pages visual comparison in the
 * pinned browser runtime. It adds no checks of its own; it composes `validate:changed` and
 * `validate:prepush --affected` over the whole branch range instead of the working tree only.
 *
 * Usage: pnpm validate:focal [-- --base <ref>] [--sha <commit>] [--pages <slug,...>] [--no-visual] [--plan]
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { evaluateLaneGuard } from '../agent/lane-guard.mjs';
import { getChangedFilesInWorkingTree } from '../shared-changed-files.mjs';
import { runValidation } from '../validation-runner.mjs';
import { visualImpactFiles } from './visual-impact.ts';

function git(args) {
	const result = spawnSync('git', args, { encoding: 'utf8' });
	if (result.error) throw result.error;
	if ((result.status ?? 1) !== 0) {
		throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
	}
	return result.stdout.trim();
}

function flag(argv, name) {
	const inline = argv.find((arg) => arg.startsWith(`${name}=`));
	if (inline) return inline.slice(name.length + 1);
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : undefined;
}

/** Branch range (merge base..sha) plus uncommitted work, so the check sees what the push will carry. */
export function collectFocalFiles({ baseSha, sha, workingTree }) {
	const committed = git(['diff', '--name-only', '--diff-filter=ACMRD', baseSha, sha])
		.split(/\r?\n/u)
		.filter(Boolean);
	return [...new Set([...committed, ...workingTree])];
}

/** Steps the command will run for these files; pure so the plan can be tested and printed. */
export function buildFocalPlan({ files, skipVisual = false }) {
	const visualFiles = visualImpactFiles(files);
	return {
		files,
		visualFiles,
		runVisualAffected: !skipVisual && visualFiles.length > 0,
	};
}

function main(argv) {
	const lane = evaluateLaneGuard(process.cwd(), 'commit');
	if (!lane.ok) {
		console.warn(
			`⚠ This checkout is not a canonical lane: ${lane.message}\n  The checks run, but git-safety will reject the commit here; move the work to a lane first.`,
		);
	}

	const sha = git(['rev-parse', flag(argv, '--sha') ?? 'HEAD']);
	const baseRef = flag(argv, '--base') ?? 'origin/develop';
	const baseSha = git(['merge-base', baseRef, sha]);
	const files = collectFocalFiles({
		baseSha,
		sha,
		workingTree: sha === git(['rev-parse', 'HEAD']) ? getChangedFilesInWorkingTree() : [],
	});
	const plan = buildFocalPlan({ files, skipVisual: argv.includes('--no-visual') });

	console.log(
		`Focal pre-push checks: ${files.length} file(s) between ${baseSha.slice(0, 9)} and ${sha.slice(0, 9)}.`,
	);
	if (argv.includes('--plan')) {
		for (const file of plan.files) console.log(`  - ${file}`);
		console.log(
			plan.runVisualAffected
				? `Visual: affected pages would run (${plan.visualFiles.length} visual-impact file(s)).`
				: 'Visual: no affected-pages comparison.',
		);
		return 0;
	}

	const staticCode = runValidation({
		files: plan.files,
		scope: 'focal',
		scopeDescription: 'branch',
	});
	if (staticCode !== 0) return staticCode;
	if (!plan.runVisualAffected) return 0;

	const visualArgs = [
		'validate:prepush',
		'--',
		'--affected',
		'--sha',
		sha,
		'--base-sha',
		baseSha,
	];
	const pages = flag(argv, '--pages');
	if (pages) visualArgs.push('--pages', pages);
	console.log(`\n→ Affected visual pages (pinned browser runtime): pnpm ${visualArgs.join(' ')}`);
	const pnpm = process.env.npm_execpath?.trim();
	const result = pnpm
		? spawnSync(process.execPath, [pnpm, ...visualArgs], { stdio: 'inherit' })
		: spawnSync('pnpm', visualArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
	return result.status ?? 1;
}

if (process.argv[1] && /focal-prepush\.mjs$/u.test(process.argv[1].replaceAll('\\', '/'))) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
