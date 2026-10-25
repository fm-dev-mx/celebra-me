/**
 * Runs every command of `pnpm ci:static` in two parallel lanes for Repository CI: the type check
 * followed by the production build, and the remaining checks in their declared order. The build
 * waits for the type check because both sync Astro's content data store, and two concurrent writers
 * fail with `UnknownFilesystemError`. The commands come
 * from `package.json`, so a check added to `ci:static` runs here too, and an unassigned or
 * duplicated command fails before anything starts.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

/** The Astro commands, in order, in one lane; every other `ci:static` command runs in `checks`. */
const ASTRO_LANE = ['pnpm type-check', 'pnpm build:app'];

export type StaticLanes = Record<'astro' | 'checks', string[]>;

interface LaneResult {
	name: string;
	failure?: { command: string; code: number | null };
	seconds: number;
}

/** Splits `ci:static` into lanes, keeping the declared order inside `checks`. */
export function planStaticLanes(ciStatic: string): StaticLanes {
	const commands = ciStatic.split('&&').map((command) => command.trim());
	if (commands.some((command) => !/^pnpm [\w:-]+$/u.test(command)))
		throw new Error(`ci:static must chain plain pnpm scripts: ${ciStatic}`);
	if (new Set(commands).size !== commands.length)
		throw new Error(`ci:static repeats a command: ${ciStatic}`);
	for (const command of ASTRO_LANE)
		if (!commands.includes(command)) throw new Error(`ci:static no longer runs ${command}.`);
	return {
		astro: [...ASTRO_LANE],
		checks: commands.filter((command) => !ASTRO_LANE.includes(command)),
	};
}

function runCommand(lane: string, command: string): Promise<number | null> {
	const prefix = (chunk: Buffer): string =>
		chunk
			.toString()
			.replace(/\r?\n$/u, '')
			.split(/\r?\n/u)
			.map((line) => `[${lane}] ${line}\n`)
			.join('');
	return new Promise((resolve) => {
		process.stdout.write(`[${lane}] $ ${command}\n`);
		const child = spawn(command, { shell: true, env: process.env });
		child.stdout.on('data', (chunk: Buffer) => process.stdout.write(prefix(chunk)));
		child.stderr.on('data', (chunk: Buffer) => process.stderr.write(prefix(chunk)));
		child.on('close', resolve);
	});
}

async function runLane(name: string, commands: readonly string[]): Promise<LaneResult> {
	const started = Date.now();
	const seconds = () => Math.round((Date.now() - started) / 1000);
	for (const command of commands) {
		const code = await runCommand(name, command);
		if (code !== 0) return { name, failure: { command, code }, seconds: seconds() };
	}
	return { name, seconds: seconds() };
}

async function main(): Promise<void> {
	const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
		scripts?: Record<string, string>;
	};
	const lanes = planStaticLanes(manifest.scripts?.['ci:static'] ?? '');
	const results = await Promise.all(
		Object.entries(lanes).map(([name, commands]) => runLane(name, commands)),
	);
	for (const { name, failure, seconds } of results)
		console.log(
			failure
				? `[${name}] FAILED in ${seconds}s: ${failure.command} exited ${failure.code}`
				: `[${name}] passed in ${seconds}s`,
		);
	process.exitCode = results.some((result) => result.failure) ? 1 : 0;
}

if (process.argv[1] && /^ci-static-parallel\.(?:ts|js)$/u.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
