#!/usr/bin/env node
/**
 * Runs the project-agnostic board core (fm-dev-mx/tablero) from a local checkout, never from
 * node_modules: the repository is private, so CI and deploys must not need it (owner decision, 10-30).
 *
 * The checkout defaults to `../tablero` beside the Integration checkout (found through the Git common
 * dir, like the board store); TABLERO_DIR overrides it. It must sit at the commit pinned in
 * `tablero.config.json` → `nucleo`. The config is the Integration checkout's, so every lane shares one
 * data directory; an explicit `--config=<file>` wins.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILE = 'tablero.config.json';

export function integrationRoot(cwd = process.cwd()) {
	const common = execFileSync(
		'git',
		['rev-parse', '--path-format=absolute', '--git-common-dir'],
		{
			cwd,
			encoding: 'utf8',
		},
	).trim();
	return dirname(common);
}

/** The core checkout: TABLERO_DIR (relative to cwd) or `../tablero` beside the Integration checkout. */
export function coreDir({ env = process.env, cwd = process.cwd(), root } = {}) {
	if (env.TABLERO_DIR) return resolve(cwd, env.TABLERO_DIR);
	return resolve(root ?? integrationRoot(cwd), '..', 'tablero');
}

function headOf(dir) {
	try {
		return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

/** Returns the problem that stops the core from running, or null. */
export function coreProblem(dir, pinned, head) {
	if (!existsSync(join(dir, 'src', 'cli.ts'))) {
		return [
			`The board core is not at ${dir}.`,
			'Clone the private repository beside the Integration checkout:',
			`  git clone git@github.com:fm-dev-mx/tablero.git ../tablero && git -C ../tablero checkout ${pinned ?? '<nucleo>'}`,
			'or set TABLERO_DIR to an existing checkout.',
		].join('\n');
	}
	head ??= headOf(dir);
	if (pinned && head !== pinned) {
		return [
			`The board core at ${dir} is at ${head || 'an unknown commit'}, not the pinned ${pinned}.`,
			`Run: git -C "${dir}" fetch && git -C "${dir}" checkout ${pinned}`,
		].join('\n');
	}
	return null;
}

function main(argv) {
	const explicit = argv.find((arg) => arg.startsWith('--config='));
	const root = integrationRoot();
	const config = explicit ? resolve(explicit.slice('--config='.length)) : join(root, CONFIG_FILE);
	if (!existsSync(config)) {
		process.stderr.write(`No ${CONFIG_FILE} at ${config}.\n`);
		return 1;
	}
	const pinned = JSON.parse(readFileSync(config, 'utf8')).nucleo;
	const dir = coreDir({ root });
	const problem = coreProblem(dir, pinned);
	if (problem) {
		process.stderr.write(`${problem}\n`);
		return 1;
	}
	const args = [
		join(dir, 'src', 'cli.ts'),
		...argv.filter((arg) => arg !== explicit),
		`--config=${config}`,
	];
	const run = spawnSync(process.execPath, args, { stdio: 'inherit' });
	return run.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2));
}
