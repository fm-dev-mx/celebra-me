import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

import { collectFileFacts, normalizePath } from './commit-message-analysis.mjs';

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: options.shell ?? isWin,
		stdio: options.stdio ?? 'pipe',
		env: options.env || process.env,
		cwd: options.cwd || process.cwd(),
		input: options.input,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

function parseNameStatusZ(raw) {
	const tokens = String(raw || '')
		.split('\0')
		.filter(Boolean);
	const entries = [];
	for (let index = 0; index < tokens.length; ) {
		const rawStatus = tokens[index++] || 'M';
		const status = rawStatus.startsWith('R') ? 'R' : rawStatus[0];
		if (status === 'R') {
			const oldPath = normalizePath(tokens[index++] || '');
			const path = normalizePath(tokens[index++] || '');
			if (path) entries.push({ path, oldPath, status });
			continue;
		}
		const path = normalizePath(tokens[index++] || '');
		if (path) entries.push({ path, oldPath: '', status });
	}
	return entries;
}

function normalizeDiffEntries(entries = []) {
	return entries
		.map((entry) => ({
			path: normalizePath(entry.path),
			oldPath: normalizePath(entry.oldPath || ''),
			status: String(entry.status || 'M').toUpperCase(),
			area: String(entry.area || '').trim() || undefined,
		}))
		.filter((entry) => entry.path)
		.sort((left, right) => left.path.localeCompare(right.path));
}

function enrichEntries(entries) {
	const facts = collectFileFacts(
		entries.map((entry) => entry.path),
		entries,
	);
	const factsByPath = new Map(facts.map((fact) => [fact.path, fact]));
	return entries.map((entry) => ({
		...entry,
		area: factsByPath.get(entry.path)?.area || 'source',
	}));
}

function dedupeEntries(entries) {
	const byPath = new Map();
	for (const entry of entries) byPath.set(entry.path, entry);
	return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function getTrackedWorkingTreeEntries() {
	const hasHead = run('git', ['rev-parse', '--verify', 'HEAD']).status === 0;
	if (!hasHead) return [];
	const result = run('git', [
		'diff',
		'--name-status',
		'--find-renames',
		'--diff-filter=ACDMR',
		'-z',
		'HEAD',
	]);
	if (result.status !== 0) {
		throw new Error('Unable to read working tree diff.');
	}
	return parseNameStatusZ(result.stdout);
}

function getUntrackedEntries() {
	const result = run('git', ['ls-files', '--others', '--exclude-standard', '-z']);
	if (result.status !== 0) {
		throw new Error('Unable to read untracked files.');
	}
	return String(result.stdout || '')
		.split('\0')
		.map((entry) => normalizePath(entry))
		.filter(Boolean)
		.map((path) => ({ path, oldPath: '', status: 'A' }));
}

function getUnstagedTrackedEntries(options = {}) {
	const result = run('git', [
		'diff',
		'--name-status',
		'--find-renames',
		'--diff-filter=ACDMR',
		'-z',
	]);
	if (result.status !== 0) {
		throw new Error('Unable to read unstaged diff entries.');
	}
	const entries = parseNameStatusZ(result.stdout);
	return normalizeDiffEntries(options.enrich ? enrichEntries(entries) : entries);
}

function getWorkingTreeDiffEntries(options = {}) {
	const tracked = getTrackedWorkingTreeEntries();
	const untracked = getUntrackedEntries();
	const entries = dedupeEntries([...tracked, ...untracked]);
	return normalizeDiffEntries(options.enrich ? enrichEntries(entries) : entries);
}

function getStagedDiffEntries(options = {}) {
	const result = run('git', [
		'diff',
		'--cached',
		'--name-status',
		'--find-renames',
		'--diff-filter=ACDMR',
		'-z',
	]);
	if (result.status !== 0) {
		throw new Error('Unable to read staged diff entries.');
	}
	const entries = parseNameStatusZ(result.stdout);
	return normalizeDiffEntries(options.enrich ? enrichEntries(entries) : entries);
}

function signatureForEntries(entries) {
	return createHash('sha256')
		.update(
			JSON.stringify(
				(entries || []).map((entry) => ({
					path: entry.path,
					oldPath: entry.oldPath || '',
					status: entry.status,
				})),
			),
		)
		.digest('hex');
}

export {
	getStagedDiffEntries,
	getUnstagedTrackedEntries,
	getWorkingTreeDiffEntries,
	normalizeDiffEntries,
	parseNameStatusZ,
	run,
	signatureForEntries,
};
