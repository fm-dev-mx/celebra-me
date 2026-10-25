/** GitHub lookups the board CLI makes through the gh command. */
import { execFileSync } from 'node:child_process';
import { UsageError } from './cli.mjs';

/** `gh pr view <n> --json state` → OPEN, MERGED or CLOSED. */
export function ghPrState(pr) {
	return execFileSync(
		'gh',
		['pr', 'view', String(pr).replace(/^#/, ''), '--json', 'state', '--jq', '.state'],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
	).trim();
}

export function reviewSha(task, flags) {
	const sha =
		typeof flags.sha === 'string'
			? flags.sha
			: execFileSync(
					'gh',
					[
						'pr',
						'view',
						String(task.pr).replace(/^#/, ''),
						'--json',
						'headRefOid',
						'--jq',
						'.headRefOid',
					],
					{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
				).trim();
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new UsageError('falta un SHA completo del PR (--sha=<40 hex>)');
	return sha;
}
