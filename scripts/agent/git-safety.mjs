#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP_DIR = join(REPO_ROOT, '.agent', 'tmp');
const BASELINE_FILE = join(TMP_DIR, 'git-safety-baseline.json');
const ALLOW_FILE = join(TMP_DIR, 'allow-git-write');

function git(args) {
	return String(execSync(`git ${args.join(' ')}`, { encoding: 'utf8', cwd: REPO_ROOT })).trim();
}

function stagedDiffHash() {
	return createHash('sha256')
		.update(git(['diff', '--cached', '--binary', '--no-ext-diff']), 'utf8')
		.digest('hex');
}

function currentHead() {
	try {
		return git(['rev-parse', 'HEAD']);
	} catch {
		return null;
	}
}

function isAuthorized() {
	return existsSync(ALLOW_FILE);
}

function getStagedFiles() {
	const out = git(['diff', '--cached', '--name-status']);
	if (!out) return [];
	return out
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [status, ...pathParts] = line.split('\t');
			return { status: status.trim(), path: pathParts.join('\t') };
		});
}

function cmdStart() {
	if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

	const head = currentHead();
	const diffHash = stagedDiffHash();
	const baseline = { head, stagedDiffHash: diffHash };

	writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n', 'utf8');

	console.log('agent:git-safety:start');
	console.log(`  baseline HEAD:        ${head}`);
	console.log(`  staged diff hash:     ${diffHash}`);
	console.log(`  baseline file:        ${BASELINE_FILE}`);
	console.log('');
	console.log('Session started. Run `pnpm agent:git-safety:check` before your final report.');
}

function cmdCheck() {
	if (!existsSync(BASELINE_FILE)) {
		console.log('agent:git-safety:check\n\nPASSED\nno active session (no baseline file)');
		return;
	}

	const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
	const currentDiffHash = stagedDiffHash();
	const currentHeadValue = currentHead();
	const authorized = isAuthorized();
	const stagedChanged = currentDiffHash !== baseline.stagedDiffHash;
	const headChanged = baseline.head && currentHeadValue && baseline.head !== currentHeadValue;
	const failed = (stagedChanged || headChanged) && !authorized;
	const warned = (stagedChanged || headChanged) && authorized;

	console.log('agent:git-safety:check');
	console.log(`  authorization:        ${authorized ? 'present' : 'absent'}`);
	console.log(`  staged state changed: ${stagedChanged ? 'yes' : 'no'}`);
	console.log(`  HEAD changed:         ${headChanged ? 'yes' : 'no'}`);

	if (stagedChanged) {
		console.log('\n  Current staged files:');
		for (const f of getStagedFiles()) console.log(`    ${f.status}\t${f.path}`);
	}

	if (failed) {
		console.log('\nFAILED');
		if (stagedChanged) console.log('staged state changed since snapshot without authorization');
		if (headChanged)
			console.log(
				`HEAD changed from ${baseline.head} to ${currentHeadValue} without authorization`,
			);
		console.log(
			'\nAgents must not stage or unstage files without explicit user authorization.\nDo not auto-unstage. Ask the user how to proceed.',
		);
		process.exit(1);
	}

	if (warned) {
		console.log('\nPASSED with warnings (authorized session)');
		return;
	}

	console.log('\nPASSED');
	console.log('staged state: unchanged from snapshot');
	console.log(`HEAD changed: ${headChanged ? 'yes' : 'no'}`);
	console.log('working tree may contain unstaged changes');
}

function cmdEnd() {
	console.log('agent:git-safety:end');
	if (existsSync(BASELINE_FILE)) {
		unlinkSync(BASELINE_FILE);
		console.log('  baseline file removed');
	} else {
		console.log('  no baseline file found — nothing to clean up');
	}
}

function main() {
	const cmd = process.argv[2];

	if (!cmd || !['start', 'check', 'end'].includes(cmd)) {
		console.error('Usage: node scripts/agent/git-safety.mjs {start|check|end}');
		process.exit(1);
	}

	if (process.argv[3] !== undefined) {
		console.warn(
			`warning: unexpected extra arguments ignored: ${process.argv.slice(3).join(' ')}`,
		);
	}

	switch (cmd) {
		case 'start':
			cmdStart();
			break;
		case 'check':
			cmdCheck();
			break;
		case 'end':
			cmdEnd();
			break;
	}
}

main();
