import { runCommand as run, sanitizeEnv } from './run-command';
export { sanitizeEnv };

/** Hermetic CLI review fixtures: mock subprocesses in the child, never add a production bypass. */
export function runCommand(cmd: string, args: string[], options?: Parameters<typeof run>[2]) {
	if (!args[0]?.endsWith('board.mjs') || args[1] !== 'review') return run(cmd, args, options);
	const source = `
		import cp from 'node:child_process';
		import { syncBuiltinESMExports } from 'node:module';
		import { pathToFileURL } from 'node:url';
		const exec = cp.execFileSync, spawn = cp.spawnSync;
		const sha = process.argv.find(a => a.startsWith('--sha='))?.slice(6) ?? 'a'.repeat(40);
		const fixture = JSON.parse(process.env.BOARD_TEST_PREFLIGHT ?? '{}');
		cp.execFileSync = (cmd, args, opts) => {
			if (cmd !== 'gh') return exec(cmd, args, opts);
			if (fixture.fail) throw new Error('offline');
			return JSON.stringify({state:'OPEN',headRefOid:sha,baseRefOid:'b'.repeat(40),
				mergeable:'MERGEABLE',files:[{path:'docs/example.md'}],changedFiles:1,
				statusCheckRollup:[{name:'ci',status:'COMPLETED',conclusion:'SUCCESS'}],...fixture.pr});
		};
		cp.spawnSync = (cmd, args, opts) => cmd === 'git' && args[0] === 'merge-tree' && fixture.merge
			? fixture.merge : spawn(cmd, args, opts);
		syncBuiltinESMExports();
		await import(pathToFileURL(process.argv[1]).href);
	`;
	return run(cmd, ['--input-type=module', '-e', source, ...args], options);
}
