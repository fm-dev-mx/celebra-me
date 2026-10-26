/**
 * Production apply refreshes its own disposable migration proof.
 *
 * The disposable-test container is shared by every lane, so another lane's reset or an apply from a
 * different checkout can leave the receipt stale between releases. Before a schema plan reaches the
 * owner gate, a stale receipt is rebuilt on disposable-test only (reset, then a full apply) and
 * re-checked. Persistent Local, Preview and Production databases are never touched here.
 */
import { spawnSync } from 'node:child_process';
import {
	assertCurrentDisposableMigrationProof,
	type DisposableProofValidation,
	resetDisposableLiveStateCache,
} from './disposable-migration-proof.ts';
import { PROJECT_ROOT } from './db-workflow-lib.ts';
import { operatorSymbol, writeHuman } from './operator-cli-ux.ts';

export const DISPOSABLE_PROOF_REFRESH_COMMANDS = [
	['db:disposable:reset'],
	// Same invocation as the reset's own apply (`scripts/db/disposable-test-env.ts`).
	[
		'exec',
		'tsx',
		'scripts/db/migrate-cli.ts',
		'--target',
		'disposable-test',
		'--apply',
		'--non-interactive',
	],
] as const;

export interface DisposableProofRefreshDeps {
	assess?: () => DisposableProofValidation;
	/** Runs one `pnpm` script and returns its exit status. */
	runPnpm?: (args: readonly string[]) => number | null;
	log?: (line: string) => void;
	/** Drops this process's memoized container state once the subprocesses changed it. */
	resetLiveState?: () => void;
}

export interface DisposableProofRefreshResult {
	refreshed: boolean;
	reason: string;
}

export class DisposableProofRefreshError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DisposableProofRefreshError';
	}
}

/** Child output goes to stderr so `--json` keeps stdout as a single document. */
function defaultRunPnpm(args: readonly string[]): number | null {
	// pnpm is a `.cmd` shim on Windows; run it through cmd.exe like `runCommand` does.
	const [file, spawnArgs] =
		process.platform === 'win32'
			? ['cmd.exe', ['/d', '/s', '/c', 'pnpm', ...args]]
			: ['pnpm', [...args]];
	const result = spawnSync(file, spawnArgs, { cwd: PROJECT_ROOT, stdio: ['ignore', 2, 2] });
	return result.error ? null : result.status;
}

/** Only a plan that includes schema consumes the disposable proof. */
export function schemaInScope(args: { schema: boolean; inspectAll: boolean }): boolean {
	return args.schema || args.inspectAll;
}

export function ensureFreshDisposableProof(
	deps: DisposableProofRefreshDeps = {},
): DisposableProofRefreshResult {
	const assess = deps.assess ?? assertCurrentDisposableMigrationProof;
	const runPnpm = deps.runPnpm ?? defaultRunPnpm;
	const log = deps.log ?? writeHuman;
	const resetLiveState = deps.resetLiveState ?? resetDisposableLiveStateCache;

	const before = assess();
	if (before.ok) return { refreshed: false, reason: before.reason };

	log(
		`${operatorSymbol('info')} Prueba disposable vieja: ${before.reason}\n` +
			'  Se reconstruye solo en disposable-test (reset y apply completo) antes del plan.',
	);
	for (const args of DISPOSABLE_PROOF_REFRESH_COMMANDS) {
		const command = `pnpm ${args.join(' ')}`;
		log(`${operatorSymbol('info')} ${command}`);
		const status = runPnpm(args);
		if (status !== 0) {
			throw new DisposableProofRefreshError(
				`No se pudo renovar la prueba disposable: «${command}» terminó con código ${status ?? 'desconocido'}. ` +
					'Revise que Docker esté activo y vuelva a correr pnpm prod:apply. No se escribió en Production.',
			);
		}
	}

	// The reset and apply ran in child processes; the memoized state still shows the old container.
	resetLiveState();
	const after = assess();
	if (!after.ok) {
		throw new DisposableProofRefreshError(
			`La prueba disposable sigue sin validar después de renovarla: ${after.reason} ` +
				'No se escribió en Production.',
		);
	}
	log(`${operatorSymbol('ok')} Prueba disposable renovada: ${after.reason}`);
	return { refreshed: true, reason: after.reason };
}

/** Refreshes the proof when the plan includes schema; any other scope leaves disposable alone. */
export function refreshDisposableProofForPlan(
	args: { schema: boolean; inspectAll: boolean },
	deps: DisposableProofRefreshDeps = {},
): DisposableProofRefreshResult | null {
	return schemaInScope(args) ? ensureFreshDisposableProof(deps) : null;
}
