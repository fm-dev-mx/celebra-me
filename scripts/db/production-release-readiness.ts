/**
 * Release readiness gate for Production apply: trusted CI evidence for the exact clean HEAD, then
 * the local release-check. Remote CI is checked first because it takes seconds and is the usual
 * reason to stop (CI still running); both gates stay mandatory.
 */
import { OperatorError, operatorSymbol, writeHuman } from './operator-cli-ux.ts';
import {
	assertCleanGitWorktree,
	ensureValidReleaseCheckEvidence,
	readGitWorktreeState,
} from './release-check.ts';
import { loadRemoteChecks, requireReleaseChecks } from '../ops/release-readiness.ts';

export interface ReleaseReadiness {
	sha: string;
}

/**
 * Fail before a backup or the owner prompt when the release is not provably ready: local
 * release-check evidence for the clean HEAD, plus trusted CI checks on that exact SHA for schema.
 * The owner gate and the schema policy still verify the same evidence; they now reuse it.
 */
export interface ReleaseReadinessDeps {
	readCleanHeadSha?: () => string;
	loadChecks?: typeof loadRemoteChecks;
	ensureEvidence?: () => { sha: string };
}

/**
 * Remote CI evidence is checked first: it takes seconds and is the usual reason to stop (CI still
 * running for the commit), while the local release-check runs the full suite and build. Both gates
 * stay mandatory; only the order changes.
 */
export function assertReleaseReadinessFailFast(
	options: { remote: boolean },
	deps: ReleaseReadinessDeps = {},
): ReleaseReadiness {
	writeHuman(`${operatorSymbol('info')} Release: verificando evidencia antes del respaldo…`);
	let remoteSha: string | null = null;
	if (options.remote) {
		remoteSha = (
			deps.readCleanHeadSha ?? (() => assertCleanGitWorktree(readGitWorktreeState()))
		)();
		requireReleaseChecks(remoteSha, (deps.loadChecks ?? loadRemoteChecks)(remoteSha));
	}
	const evidence = (deps.ensureEvidence ?? ensureValidReleaseCheckEvidence)();
	if (remoteSha && evidence.sha !== remoteSha) {
		throw new OperatorError({
			code: 'OPERATOR_ERROR',
			title: 'HEAD cambió durante la verificación',
			cause: `CI verificado para ${remoteSha.slice(0, 12)}, release-check para ${evidence.sha.slice(0, 12)}.`,
			noChangesMessage: 'No changes were made to Production',
			retryCommand: 'pnpm prod:apply',
			remediation: ['Deje el checkout fijo y vuelva a ejecutar el comando.'],
		});
	}
	return { sha: evidence.sha };
}
