/**
 * Execution-local probe session: memoized read-only psql with optional async parallelism.
 * Server-only. No persistent cache, no mutation authorization, no UI coupling.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT, runPsql, type CommandResult } from '../db/db-workflow-lib.ts';
import { redactCredentials } from '../db/db-target-config.ts';

export interface StatusProbeSessionOptions {
	/** Per-query wall-clock budget (ms). */
	timeoutMs?: number;
	/** Force default_transaction_read_only when set (default true). */
	readOnly?: boolean;
}

export interface StatusProbeDebugCounters {
	invocations: number;
	memoHits: number;
	timeoutDegraded: boolean;
}

function memoKey(dbUrl: string, sql: string): string {
	return createHash('sha256').update(`${dbUrl}\0${sql}`).digest('hex');
}

function urlKey(dbUrl: string): string {
	return createHash('sha256').update(dbUrl).digest('hex');
}

function buildReadOnlyEnv(base: NodeJS.ProcessEnv, readOnly: boolean): NodeJS.ProcessEnv {
	if (!readOnly) return { ...base };
	const existing = base.PGOPTIONS?.trim() ?? '';
	const flag = '-c default_transaction_read_only=on';
	if (existing.includes('default_transaction_read_only')) return { ...base };
	return {
		...base,
		PGOPTIONS: existing ? `${existing} ${flag}` : flag,
	};
}

/** Redact connection strings from probe stdout/stderr without truncating query payloads. */
export function redactProbeIo(text: string, secrets: readonly string[] = []): string {
	let out = text;
	for (const secret of secrets) {
		if (secret) out = out.split(secret).join('<redacted>');
	}
	return redactCredentials(out);
}

/**
 * Non-blocking psql for concurrent environment probes.
 * Mirrors runPsql tuples-only defaults used by status probes.
 */
export function runPsqlAsync(
	sql: string,
	dbUrl: string,
	options: {
		timeoutMs?: number;
		readOnly?: boolean;
		tuplesOnly?: boolean;
		redact?: readonly string[];
	} = {},
): Promise<CommandResult> {
	const args = ['--set', 'ON_ERROR_STOP=1'];
	if (options.tuplesOnly !== false) {
		args.push('--tuples-only', '--no-align', '--field-separator', '|');
	}
	args.push('--dbname', dbUrl);

	const env = buildReadOnlyEnv(process.env, options.readOnly !== false);
	const secrets = [dbUrl, ...(options.redact ?? [])];

	return new Promise((resolve) => {
		const child = spawn('psql', args, {
			cwd: PROJECT_ROOT,
			env,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
		});

		let stdout = '';
		let stderr = '';
		let settled = false;
		const finish = (status: number | null) => {
			if (settled) return;
			settled = true;
			resolve({
				status,
				stdout: redactProbeIo(stdout, secrets),
				stderr: redactProbeIo(stderr, secrets),
			});
		};

		const timer =
			typeof options.timeoutMs === 'number' && options.timeoutMs > 0
				? setTimeout(() => {
						child.kill('SIGKILL');
						finish(1);
					}, options.timeoutMs)
				: undefined;

		child.stdout?.on('data', (chunk: Buffer | string) => {
			stdout += chunk.toString('utf8');
		});
		child.stderr?.on('data', (chunk: Buffer | string) => {
			stderr += chunk.toString('utf8');
		});
		child.on('error', () => {
			if (timer) clearTimeout(timer);
			finish(1);
		});
		child.on('close', (code) => {
			if (timer) clearTimeout(timer);
			finish(code);
		});
		child.stdin?.write(sql);
		child.stdin?.end();
	});
}

export class StatusProbeSession {
	readonly timeoutMs: number | undefined;
	readonly readOnly: boolean;
	invocations = 0;
	memoHits = 0;
	timeoutDegraded = false;

	readonly #memo = new Map<string, CommandResult>();
	readonly #connectivity = new Map<string, boolean>();
	readonly #inflight = new Map<string, Promise<CommandResult>>();

	constructor(options: StatusProbeSessionOptions = {}) {
		this.timeoutMs = options.timeoutMs;
		this.readOnly = options.readOnly !== false;
	}

	get debugCounters(): StatusProbeDebugCounters {
		return {
			invocations: this.invocations,
			memoHits: this.memoHits,
			timeoutDegraded: this.timeoutDegraded,
		};
	}

	markTimeoutDegraded(): void {
		this.timeoutDegraded = true;
	}

	psqlSync(
		sql: string,
		dbUrl: string,
		options: { tuplesOnly?: boolean; throwOnError?: boolean } = {},
	): CommandResult {
		const key = memoKey(dbUrl, sql);
		const cached = this.#memo.get(key);
		if (cached) {
			this.memoHits += 1;
			return cached;
		}
		this.invocations += 1;
		const result = runPsql(sql, dbUrl, {
			tuplesOnly: options.tuplesOnly,
			throwOnError: options.throwOnError ?? false,
			...(typeof this.timeoutMs === 'number' ? { timeoutMs: this.timeoutMs } : {}),
			env: buildReadOnlyEnv(process.env, this.readOnly),
			redact: [dbUrl],
		});
		this.#memo.set(key, result);
		return result;
	}

	async psql(
		sql: string,
		dbUrl: string,
		options: { tuplesOnly?: boolean } = {},
	): Promise<CommandResult> {
		const key = memoKey(dbUrl, sql);
		const cached = this.#memo.get(key);
		if (cached) {
			this.memoHits += 1;
			return cached;
		}
		const inflight = this.#inflight.get(key);
		if (inflight) {
			this.memoHits += 1;
			return inflight;
		}
		const pending = (async () => {
			this.invocations += 1;
			const result = await runPsqlAsync(sql, dbUrl, {
				timeoutMs: this.timeoutMs,
				readOnly: this.readOnly,
				tuplesOnly: options.tuplesOnly,
				redact: [dbUrl],
			});
			this.#memo.set(key, result);
			this.#inflight.delete(key);
			return result;
		})();
		this.#inflight.set(key, pending);
		return pending;
	}

	probeConnectivitySync(dbUrl: string): boolean {
		const key = urlKey(dbUrl);
		const cached = this.#connectivity.get(key);
		if (cached !== undefined) {
			this.memoHits += 1;
			return cached;
		}
		const res = this.psqlSync('select 1;', dbUrl, { tuplesOnly: true, throwOnError: false });
		const ok = res.status === 0 && res.stdout.trim() === '1';
		this.#connectivity.set(key, ok);
		return ok;
	}

	async probeConnectivity(dbUrl: string): Promise<boolean> {
		const key = urlKey(dbUrl);
		const cached = this.#connectivity.get(key);
		if (cached !== undefined) {
			this.memoHits += 1;
			return cached;
		}
		const res = await this.psql('select 1;', dbUrl, { tuplesOnly: true });
		const ok = res.status === 0 && res.stdout.trim() === '1';
		this.#connectivity.set(key, ok);
		return ok;
	}
}

/** Bounded parallel map — max `concurrency` tasks in flight. */
export async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const limit = Math.max(1, Math.min(concurrency, items.length || 1));
	const results = new Array<R>(items.length);
	let next = 0;

	async function worker(): Promise<void> {
		for (;;) {
			const index = next;
			next += 1;
			if (index >= items.length) return;
			results[index] = await fn(items[index]!, index);
		}
	}

	await Promise.all(Array.from({ length: limit }, () => worker()));
	return results;
}
