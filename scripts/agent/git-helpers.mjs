/** Shared Git execution and entry-point detection; callers retain their existing policies. */
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ env?: NodeJS.ProcessEnv, maxBuffer?: number,
 *   stdio?: import('node:child_process').SpawnSyncOptionsWithStringEncoding['stdio'],
 *   trim?: 'none' | 'both' | 'end', normalizeNewlines?: boolean,
 *   throwOnError?: boolean, allowFailure?: boolean }} [options]
 */
export function runGit(args, cwd, options = {}) {
	const result = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		...(options.env === undefined ? {} : { env: options.env }),
		...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }),
		...(options.stdio === undefined ? {} : { stdio: options.stdio }),
	});
	if (options.throwOnError && result.error) throw result.error;
	const status = result.status ?? 1;
	if (options.allowFailure === false && status !== 0) {
		const detail = String(result.stderr || result.stdout || '').trim();
		throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
	}
	/** @param {string | null} value */
	const output = (value) => {
		let text = String(value ?? '');
		if (options.normalizeNewlines) text = text.replace(/\r\n/g, '\n');
		return options.trim === 'both'
			? text.trim()
			: options.trim === 'end'
				? text.trimEnd()
				: text;
	};
	return { status, stdout: output(result.stdout), stderr: output(result.stderr) };
}

/** Git Safety's strict runner, kept as an export for existing consumers.
 * @param {string} repoRoot @param {string[]} args
 * @param {{ allowFailure?: boolean }} [options]
 */
export function git(repoRoot, args, options = {}) {
	return runGit(args, repoRoot, {
		maxBuffer: 10 * 1024 * 1024,
		trim: 'end',
		normalizeNewlines: true,
		throwOnError: true,
		allowFailure: options.allowFailure ?? false,
	});
}

/** @param {string} cwd @param {string[]} args @param {NodeJS.ProcessEnv} env */
export function gitOutput(cwd, args, env) {
	const result = runGit(args, cwd, { env, trim: 'both' });
	return result.status === 0 ? result.stdout : null;
}

/**
 * Preserve exact-path and legacy filename-based entry points without executing imported CLIs.
 * @param {string} moduleUrl
 * @param {{ argv1?: string, suffix?: string, pattern?: RegExp,
 *   basenameOnly?: boolean, resolveModulePath?: boolean }} [options]
 */
export function isMainModule(moduleUrl = '', options = {}) {
	const invoked = options.argv1 ?? process.argv[1];
	if (options.pattern)
		return options.pattern.test(
			options.basenameOnly ? basename(invoked ?? '') : (invoked ?? ''),
		);
	if (!invoked) return false;
	if (options.suffix) return invoked.replaceAll('\\', '/').endsWith(options.suffix);
	const modulePath = fileURLToPath(moduleUrl);
	return resolve(invoked) === (options.resolveModulePath ? resolve(modulePath) : modulePath);
}
