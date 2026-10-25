/** Read-only merge evidence for a review, pinned to GitHub's current base and head. */
import { execFileSync, spawnSync } from 'node:child_process';
import { UsageError } from './cli.mjs';

export function reviewPreflight(task, sha) {
	let pr;
	try {
		pr = JSON.parse(
			execFileSync(
				'gh',
				[
					'pr',
					'view',
					String(task.pr).replace(/^#/, ''),
					'--json',
					'state,headRefOid,baseRefOid,mergeable,files,changedFiles',
				],
				{
					encoding: 'utf8',
					timeout: 20000,
					windowsHide: true,
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			),
		);
	} catch {
		throw new UsageError(
			'UNVERIFIED: no se pudo comprobar el merge del PR; vuelva a intentar.',
		);
	}
	if (pr?.state !== 'OPEN' || pr.headRefOid !== sha)
		throw new UsageError(
			'el PR debe estar OPEN y su cabeza debe coincidir con --sha; actualice la evidencia.',
		);
	if (!['MERGEABLE', 'CONFLICTING'].includes(pr.mergeable))
		throw new UsageError('UNVERIFIED: GitHub aún no confirma mergeable; vuelva a intentar.');
	// GitHub caps the files connection; incomplete evidence must never classify as docs-only.
	const files =
		Array.isArray(pr.files) &&
		pr.files.every((f) => typeof f?.path === 'string') &&
		pr.files.length === pr.changedFiles
			? pr.files.map((f) => f.path)
			: undefined;
	if (pr.mergeable === 'MERGEABLE') return { files, conflicts: null };
	let conflicts = [];
	if (/^[a-f0-9]{40}$/.test(pr.baseRefOid)) {
		const merge = spawnSync(
			'git',
			['merge-tree', '--write-tree', '--name-only', '-z', pr.baseRefOid, sha],
			{ encoding: 'utf8', timeout: 20000, windowsHide: true },
		);
		if (merge.status === 1) {
			const paths = String(merge.stdout).split('\0\0')[0].split('\0');
			if (/^[a-f0-9]{40}$/.test(paths[0])) conflicts = paths.slice(1).filter(Boolean);
		}
	}
	return { files, conflicts };
}
