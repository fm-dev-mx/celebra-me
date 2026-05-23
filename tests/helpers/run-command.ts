import { spawnSync } from 'child_process';

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
