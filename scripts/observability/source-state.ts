/**
 * Read-only git source identity for observability snapshots.
 * Failures degrade fields — never throw to callers.
 */

import { execSync } from 'node:child_process';
import type { ObservabilitySourceState } from './types.ts';

function tryGit(args: string): string | null {
	try {
		return execSync(`git ${args}`, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 5_000,
		}).trim();
	} catch {
		return null;
	}
}

export function readObservabilitySourceState(): ObservabilitySourceState {
	const branch = tryGit('rev-parse --abbrev-ref HEAD');
	const commitSha = tryGit('rev-parse HEAD');
	const porcelain = tryGit('status --porcelain');

	if (branch === null && commitSha === null && porcelain === null) {
		return {
			branch: null,
			commitSha: null,
			workingTreeDirty: null,
			degraded: true,
			detail: 'Git source probes unavailable',
		};
	}

	const degraded = branch === null || commitSha === null || porcelain === null;
	return {
		branch,
		commitSha,
		workingTreeDirty: porcelain === null ? null : porcelain.length > 0,
		degraded,
		detail: degraded ? 'Partial git source identity' : undefined,
	};
}
