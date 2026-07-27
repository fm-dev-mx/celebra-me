/**
 * branch-lane-disposable-remediate.ts — Verified disposable-test rebuild for branch-lane.
 *
 * This is automated **low-risk remediation**, not read-only diagnosis.
 * It may run only when the target is conclusively the repository disposable-test database.
 * Persistent-local, Preview, and Production are never acceptable rebuild targets.
 */

import { spawnSync } from 'node:child_process';
import {
	DISPOSABLE_DB_URL,
	DISPOSABLE_TEST,
	LOCAL_DB_URL,
	classifyDbTarget,
	redactDbUrl,
	type ClassificationResult,
} from './db-target-config.ts';
import { createFinding, type Finding } from './branch-lane-status.ts';

export interface DisposableTargetCheck {
	id: string;
	ok: boolean;
	/** Non-secret detail (redacted URLs only). */
	detail: string;
}

export interface DisposableTargetVerification {
	verified: boolean;
	status: 'Pass' | 'Hard blocked';
	finding: Finding;
	checks: DisposableTargetCheck[];
	/** Canonical disposable URL only when verified; never log raw secrets beyond redact. */
	verifiedDbUrl: string | null;
}

export type ClassifyFn = (dbUrl: string) => ClassificationResult;
export type ContainerNameFn = () => string | null;

export interface VerifyDisposableRebuildInput {
	/** Candidate URL; defaults to canonical DISPOSABLE_DB_URL. */
	dbUrl?: string;
	classify?: ClassifyFn;
	/** Returns running container name on the disposable port, or null if unknown. */
	resolveContainerName?: ContainerNameFn;
	/** When true, require Docker container name match (default true when resolver provided). */
	requireContainerNameMatch?: boolean;
}

function defaultResolveContainerName(): string | null {
	const result = spawnSync(
		'docker',
		['ps', '--filter', `name=${DISPOSABLE_TEST.containerName}`, '--format', '{{.Names}}'],
		{ encoding: 'utf8' },
	);
	if (result.status !== 0) return null;
	const name = String(result.stdout || '').trim();
	return name || null;
}

/**
 * Prove the rebuild target is unequivocally disposable-test before any mutation.
 */
export function verifyDisposableRebuildTarget(
	input: VerifyDisposableRebuildInput = {},
): DisposableTargetVerification {
	const dbUrl = (input.dbUrl ?? DISPOSABLE_DB_URL).trim();
	const classify = input.classify ?? classifyDbTarget;
	const checks: DisposableTargetCheck[] = [];

	const classification = classify(dbUrl);
	checks.push({
		id: 'classify-target',
		ok: classification.target === 'disposable-test',
		detail: `classified=${classification.target}; ${classification.reason}`,
	});

	const redacted = redactDbUrl(dbUrl);
	const looksLikePersistent =
		dbUrl === LOCAL_DB_URL ||
		classification.target === 'persistent-local' ||
		/:(54322)\b/.test(dbUrl);
	checks.push({
		id: 'not-persistent-local',
		ok: !looksLikePersistent,
		detail: looksLikePersistent
			? `Rejected persistent-local candidate (${redacted})`
			: 'Not persistent-local',
	});

	const forbiddenTargets = new Set(['production', 'preview', 'persistent-local', 'unknown']);
	checks.push({
		id: 'not-remote-or-unknown',
		ok: !forbiddenTargets.has(classification.target),
		detail: `target=${classification.target}`,
	});

	const portOk = dbUrl.includes(`:${DISPOSABLE_TEST.dbPort}`);
	checks.push({
		id: 'disposable-port',
		ok: portOk,
		detail: portOk
			? `Port ${DISPOSABLE_TEST.dbPort} present in URL`
			: `Expected port ${DISPOSABLE_TEST.dbPort} missing from ${redacted}`,
	});

	const canonicalHostOk = DISPOSABLE_TEST.dbHosts.some(
		(host) => dbUrl.includes(`@${host}:`) || dbUrl.includes(`@[${host}]:`),
	);
	checks.push({
		id: 'local-loopback-host',
		ok: canonicalHostOk,
		detail: canonicalHostOk
			? 'Host is a disposable-test loopback alias'
			: `Host is not a disposable-test loopback alias (${redacted})`,
	});

	const shouldCheckContainer = input.requireContainerNameMatch !== false;
	if (shouldCheckContainer) {
		const resolveName = input.resolveContainerName ?? defaultResolveContainerName;
		let containerName: string | null;
		try {
			containerName = resolveName();
		} catch {
			containerName = null;
		}
		const containerOk = containerName === DISPOSABLE_TEST.containerName;
		checks.push({
			id: 'container-name',
			ok: containerOk,
			detail: containerOk
				? `Container ${DISPOSABLE_TEST.containerName} confirmed`
				: `Container identity not proven (saw=${containerName ?? 'none'}; expected=${DISPOSABLE_TEST.containerName})`,
		});
	}

	const verified = checks.every((c) => c.ok);
	if (!verified) {
		const failed = checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
		return {
			verified: false,
			status: 'Hard blocked',
			verifiedDbUrl: null,
			checks,
			finding: createFinding({
				id: 'disposable-rebuild-target-unverified',
				status: 'Hard blocked',
				cause: `Disposable rebuild target could not be proven safe. Failed checks: ${failed.join('; ')}`,
				impact: 'Automatic disposable remediation aborted; persistent-local/Preview/Production were not mutated.',
				owner: 'human',
				remediation:
					`Prove the target is disposable-test only: host in [${DISPOSABLE_TEST.dbHosts.join(', ')}], ` +
					`port ${DISPOSABLE_TEST.dbPort}, container name ${DISPOSABLE_TEST.containerName}, ` +
					`classifyDbTarget === disposable-test. Then resume branch-lane.`,
				nextStep:
					'Fix disposable environment identity (start celebra-me-test-db on 54332) and re-invoke branch-lane.',
			}),
		};
	}

	return {
		verified: true,
		status: 'Pass',
		verifiedDbUrl: DISPOSABLE_DB_URL,
		checks,
		finding: createFinding({
			id: 'disposable-rebuild-target-verified',
			status: 'Pass',
			cause: `Rebuild target verified as disposable-test (${redacted}, container ${DISPOSABLE_TEST.containerName}).`,
			impact: 'Safe to run governed disposable reset + apply-migrations remediation.',
			owner: 'agent',
			remediation: 'Execute pnpm db:disposable:reset (applies workspace migrations).',
			nextStep: 'Run verified disposable remediation, then re-audit persistent-local.',
		}),
	};
}

export interface DisposableRemediationResult {
	verification: DisposableTargetVerification;
	executed: boolean;
	exitCode: number | null;
	/** Non-secret command summary. */
	commandSummary: string;
	finding: Finding;
}

export type CommandRunner = (
	command: string,
	args: string[],
) => { status: number | null; stdout: string; stderr: string; errorMessage?: string };

function defaultCommandRunner(
	command: string,
	args: string[],
): { status: number | null; stdout: string; stderr: string; errorMessage?: string } {
	const result = spawnSync(command, args, {
		encoding: 'utf8',
		// Windows needs a shell to resolve pnpm/npx.cmd shims.
		shell: process.platform === 'win32',
	});
	return {
		status: result.status,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
		errorMessage: result.error ? String(result.error.message) : undefined,
	};
}

/**
 * Execute disposable rebuild only after conclusive target verification.
 * Uses the existing governed path: disposable-test-env reset (includes apply-migrations).
 */
export function executeVerifiedDisposableRebuild(input?: {
	dbUrl?: string;
	verify?: VerifyDisposableRebuildInput;
	run?: CommandRunner;
}): DisposableRemediationResult {
	const verification = verifyDisposableRebuildTarget({
		dbUrl: input?.dbUrl,
		...input?.verify,
	});
	if (!verification.verified) {
		return {
			verification,
			executed: false,
			exitCode: null,
			commandSummary: 'No command executed (target unverified).',
			finding: verification.finding,
		};
	}

	const run = input?.run ?? defaultCommandRunner;
	const commandSummary = 'npx tsx scripts/db/disposable-test-env.ts reset';
	const result = run('npx', ['tsx', 'scripts/db/disposable-test-env.ts', 'reset']);
	if (result.status !== 0) {
		const detail = result.errorMessage
			? `exit ${result.status}; ${result.errorMessage}`
			: `exit ${result.status}`;
		return {
			verification,
			executed: true,
			exitCode: result.status,
			commandSummary,
			finding: createFinding({
				id: 'disposable-rebuild-failed',
				status: 'Fail',
				cause: `Verified disposable remediation failed (${detail}).`,
				impact: 'Disposable reference may be partial; persistent-local/Preview/Production were not targeted. Resume after fixing disposable env.',
				owner: 'agent',
				remediation:
					'Re-verify target, inspect disposable container logs, re-run pnpm db:disposable:reset, then resume branch-lane.',
				nextStep:
					'Diagnose disposable reset failure; checkpoint remains valid for unaffected steps.',
			}),
		};
	}

	return {
		verification,
		executed: true,
		exitCode: 0,
		commandSummary,
		finding: createFinding({
			id: 'disposable-rebuild-complete',
			status: 'Pass',
			cause: 'Verified disposable-test rebuild completed via governed disposable-test-env reset.',
			impact: 'Canonical disposable schema should now match workspace migrations.',
			owner: 'agent',
			remediation: 'Re-run pnpm db:local:audit and continue branch-lane.',
			nextStep: 'Re-audit persistent-local; update checkpoint; defer auth until stable.',
		}),
	};
}

function printJson(value: unknown): void {
	const serialized = `${JSON.stringify(value, null, 2)}\n`;
	if (
		/postgres(ql)?:\/\//i.test(serialized) &&
		!/postgres(ql)?:\/\/[^\s"]*:<redacted>@/i.test(serialized)
	) {
		// Defense: never print raw connection strings from accidental fields
		throw new Error('Refusing to print output that appears to contain secrets.');
	}
	process.stdout.write(serialized);
}

function main(): number {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		console.log(`Usage:
  tsx scripts/db/branch-lane-disposable-remediate.ts --verify-only
  tsx scripts/db/branch-lane-disposable-remediate.ts --execute

Verifies disposable-test identity before any rebuild. Never targets other databases.
`);
		return 0;
	}

	if (args.includes('--verify-only')) {
		const verification = verifyDisposableRebuildTarget();
		printJson({
			kind: 'disposable-target-verification',
			verified: verification.verified,
			status: verification.status,
			finding: verification.finding,
			checks: verification.checks,
		});
		return verification.verified ? 0 : 2;
	}

	if (args.includes('--execute')) {
		const result = executeVerifiedDisposableRebuild();
		printJson({
			kind: 'disposable-remediation',
			verified: result.verification.verified,
			executed: result.executed,
			exitCode: result.exitCode,
			commandSummary: result.commandSummary,
			status: result.finding.status,
			finding: result.finding,
			checks: result.verification.checks,
		});
		if (!result.verification.verified) return 2;
		return result.exitCode === 0 ? 0 : 1;
	}

	console.error('Specify --verify-only or --execute');
	return 2;
}

if (process.argv[1]?.replaceAll('\\', '/').includes('branch-lane-disposable-remediate')) {
	try {
		process.exit(main());
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
