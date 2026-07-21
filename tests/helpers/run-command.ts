import { spawnSync } from 'child_process';

/**
 * Return a copy of `process.env` with `VALIDATION_BASE_SHA` and
 * `VALIDATION_HEAD_SHA` removed, optionally merged with extra vars.
 *
 * Fixture tests that create ephemeral Git repositories and exercise
 * working-tree detection must use this to prevent real PR SHAs (set by
 * the GitHub Actions workflow) from leaking into the temporary repo and
 * causing `fatal: bad object` errors.
 *
 * Explicit-range tests that deliberately set fixture-local base/head
 * SHAs should pass those directly instead of using this helper, so the
 * explicit range remains the source of truth.
 */
export function sanitizeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const env = { ...process.env, ...extra };
	delete env.VALIDATION_BASE_SHA;
	delete env.VALIDATION_HEAD_SHA;
	return env;
}

export function runCommand(
	cmd: string,
	args: string[],
	options: { cwd: string; allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {
		cwd: process.cwd(),
	},
) {
	const result = spawnSync(cmd, args, {
		cwd: options.cwd,
		encoding: 'utf8',
		env: options.env ?? process.env,
	});

	if (result.error) throw result.error;
	if (!options.allowFailure && (result.status ?? 1) !== 0) {
		throw new Error(
			`Command failed: ${cmd} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`,
		);
	}

	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}
