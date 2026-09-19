import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface CaptureSourceEvidence {
	status: 'recorded' | 'unavailable';
	/** Capture workspace only; never proof of the server's deployed revision. */
	role: 'capture-workspace';
	head: string | null;
	indexSha256: string | null;
	workingTreeSha256: string | null;
	untrackedSourceSha256: string | null;
	dirty: boolean | null;
}

export function evidenceHash(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

/** Fingerprint code without persisting patches, credentials, file contents or machine paths. */
export function readCaptureSourceEvidence(cwd = process.cwd()): CaptureSourceEvidence {
	const empty: CaptureSourceEvidence = {
		status: 'unavailable',
		role: 'capture-workspace',
		head: null,
		indexSha256: null,
		workingTreeSha256: null,
		untrackedSourceSha256: null,
		dirty: null,
	};
	try {
		const git = (...args: string[]) =>
			execFileSync('git', args, {
				cwd,
				encoding: 'utf8',
				maxBuffer: 32 * 1024 * 1024,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		const root = git('rev-parse', '--show-toplevel').trim();
		const head = git('rev-parse', 'HEAD').trim();
		const index = git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD');
		const working = git('diff', '--no-ext-diff', '--no-textconv', '--binary');
		// Scope untracked evidence to source roots; never inventory ignored secrets or capture output.
		const untracked = git(
			'ls-files',
			'--others',
			'--exclude-standard',
			'--full-name',
			'-z',
			'--',
			'src',
			'scripts',
			'tests',
			'docs',
			'.agent',
		)
			.split('\0')
			.filter(Boolean)
			.sort();
		const fingerprints = untracked.map((file) => [
			file,
			evidenceHash(readFileSync(path.join(root, file))),
		]);
		return {
			status: 'recorded',
			role: 'capture-workspace',
			head,
			indexSha256: evidenceHash(index),
			workingTreeSha256: evidenceHash(working),
			untrackedSourceSha256: evidenceHash(JSON.stringify(fingerprints)),
			dirty: Boolean(index || working || untracked.length),
		};
	} catch {
		return empty;
	}
}
