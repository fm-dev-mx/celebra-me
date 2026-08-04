import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface SourceFingerprint {
	trackedDiffHash: string;
	untrackedManifestSha256: string;
	untrackedFileCount: number;
	untrackedFiles: string[];
}

export interface SourceState extends SourceFingerprint {
	schemaVersion: 2;
	sourceHead: string;
	ignoreContractSha256: string;
}

function sha256(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function currentHead(root: string): string {
	return git(root, ['rev-parse', 'HEAD']);
}

export function sourceFingerprint(root: string): SourceFingerprint {
	const trackedDiff = execFileSync(
		'git',
		[
			'diff',
			'--binary',
			'HEAD',
			'--',
			'.',
			':(exclude)graphify-out/**',
			':(exclude).agent/tmp/**',
		],
		{ cwd: root },
	);
	const untracked = git(root, [
		'ls-files',
		'--others',
		'--exclude-standard',
		'--',
		'.',
		':(exclude)graphify-out/**',
		':(exclude).agent/tmp/**',
	])
		.split(/\r?\n/u)
		.filter(Boolean);
	const addedAgainstHead = git(root, [
		'diff',
		'--name-only',
		'--diff-filter=A',
		'HEAD',
		'--',
		'.',
		':(exclude)graphify-out/**',
		':(exclude).agent/tmp/**',
	])
		.split(/\r?\n/u)
		.filter(Boolean);
	const sourceFiles = [...new Set([...untracked, ...addedAgainstHead])].sort();
	const manifest = sourceFiles
		.map((file) => `${file}\0${sha256(readFileSync(path.join(root, file)))}\n`)
		.join('');
	return {
		trackedDiffHash: sha256(trackedDiff),
		untrackedManifestSha256: sha256(manifest),
		untrackedFileCount: sourceFiles.length,
		untrackedFiles: sourceFiles,
	};
}

export function assertSourceStateFresh(
	state: Partial<SourceState>,
	root: string,
	ignoreContractSha256: string,
): void {
	const head = currentHead(root);
	const fingerprint = sourceFingerprint(root);
	const mismatches = [
		state.schemaVersion !== 2 ? 'schemaVersion' : null,
		state.sourceHead !== head
			? `sourceHead (${state.sourceHead ?? '<missing>'} != ${head})`
			: null,
		state.trackedDiffHash !== fingerprint.trackedDiffHash ? 'trackedDiffHash' : null,
		state.untrackedManifestSha256 !== fingerprint.untrackedManifestSha256
			? 'untrackedManifestSha256'
			: null,
		JSON.stringify(state.untrackedFiles ?? []) !== JSON.stringify(fingerprint.untrackedFiles)
			? 'untrackedFiles'
			: null,
		state.ignoreContractSha256 !== ignoreContractSha256 ? 'ignoreContractSha256' : null,
	].filter(Boolean);
	if (mismatches.length > 0) {
		throw new Error(
			`Graphify source state is stale; regenerate the snapshot. Mismatches: ${mismatches.join(', ')}.\nCanonical refresh: pnpm ops graphify-refresh`,
		);
	}
}
