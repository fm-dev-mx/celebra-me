/**
 * Runs the read-only operator CLIs for the dev-only console and parses their `--json` output.
 * The console never runs anything else: no `--apply`, no fetch, no write command of any kind.
 */
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SnapshotResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The first `git worktree list` entry is the Integration checkout, where prod:apply runs. */
export async function resolveIntegrationCheckout(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain']);
		const first = stdout.split(/\r?\n/).find((line) => line.startsWith('worktree '));
		if (first) return resolve(first.slice('worktree '.length).trim());
	} catch {
		// Falls back to the dev server checkout below.
	}
	return process.cwd();
}

function parseJsonOutput<T>(stdout: string): T {
	const start = stdout.indexOf('{');
	if (start === -1) throw new Error('La salida no contiene JSON.');
	return JSON.parse(stdout.slice(start)) as T;
}

async function runTsxJson<T>(
	script: string,
	args: readonly string[],
	cwd: string,
	timeoutMs: number,
): Promise<SnapshotResult<T>> {
	const env = { ...process.env };
	delete env.CELEBRA_OPS_CONSOLE;
	try {
		const { stdout } = await execFileAsync(
			process.execPath,
			['--import', 'tsx', script, ...args],
			{
				cwd,
				env,
				timeout: timeoutMs,
				maxBuffer: 32 * 1024 * 1024,
				windowsHide: true,
			},
		);
		return { ok: true, data: parseJsonOutput<T>(stdout) };
	} catch (error) {
		const output = error as { stdout?: string; message?: string };
		if (output.stdout?.includes('{')) {
			try {
				return { ok: true, data: parseJsonOutput<T>(output.stdout) };
			} catch {
				// Reports the original failure below.
			}
		}
		return { ok: false, error: (output.message ?? String(error)).split(/\r?\n/)[0] ?? '' };
	}
}

const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/ops/ops-console-snapshot.ts');

export function runGitSnapshot<T>(): Promise<SnapshotResult<T>> {
	return runTsxJson<T>(SNAPSHOT_SCRIPT, ['--section', 'git', '--json'], process.cwd(), 60_000);
}

export function runPreflightSnapshot<T>(checkout: string): Promise<SnapshotResult<T>> {
	return runTsxJson<T>(SNAPSHOT_SCRIPT, ['--section', 'preflight', '--json'], checkout, 90_000);
}

/** Integration's own `pnpm dbs --json`, so the view matches what the owner's terminal prints. */
export function runDbsSnapshot<T>(checkout: string): Promise<SnapshotResult<T>> {
	return runTsxJson<T>('scripts/provision/dbs-cli.ts', ['--json'], checkout, 180_000);
}
