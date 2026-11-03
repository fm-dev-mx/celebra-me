#!/usr/bin/env node
/**
 * Runs the project-agnostic board core (fm-dev-mx/tablero) from a local checkout, never from
 * node_modules: the repository is private, so CI and deploys must not need it (owner decision, 10-30).
 *
 * The checkout defaults to `../tablero` beside the Integration checkout (found through the Git common
 * dir, like the board store); TABLERO_DIR overrides it. The default checkout must sit on a commit of
 * `origin/main`; celebra-me tracks no core version, so updating the core needs no change here. Each
 * start appends the running commit to `<datos>/nucleo.log` when it changed, the local trail for a
 * rollback. The config is the Integration checkout's, so every lane shares one data directory; an
 * explicit `--config=<file>` wins.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILE = 'tablero.config.json';
export const CORE_LOG = 'nucleo.log';

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

function isReleased(dir, head) {
	try {
		execFileSync('git', ['-C', dir, 'merge-base', '--is-ancestor', head, 'origin/main'], {
			stdio: 'ignore',
		});
		return true;
	} catch {
		return false;
	}
}

/** Returns the problem that stops the core from running, or null. */
export function coreProblem(dir, head, released) {
	if (!existsSync(join(dir, 'src', 'cli.ts'))) {
		return [
			`The board core is not at ${dir}.`,
			'Clone the private repository beside the Integration checkout:',
			'  git clone git@github.com:fm-dev-mx/tablero.git ../tablero',
			'or set TABLERO_DIR to an existing checkout.',
		].join('\n');
	}
	head ??= headOf(dir);
	released ??= Boolean(head) && isReleased(dir, head);
	if (!released) {
		return [
			`The board core at ${dir} is at ${head || 'an unknown commit'}, which is not on origin/main.`,
			`Run: git -C "${dir}" fetch && git -C "${dir}" checkout --detach origin/main`,
			'or set TABLERO_DIR to run another checkout on purpose.',
		].join('\n');
	}
	return null;
}

/** Appends `<ISO date> <commit>` to the log when the commit differs from its last line. */
export function recordCore(dataDir, head, now = new Date()) {
	if (!head) return false;
	const log = join(dataDir, CORE_LOG);
	const last = existsSync(log)
		? readFileSync(log, 'utf8').trimEnd().split('\n').pop()?.split(' ')[1]
		: undefined;
	if (last === head) return false;
	mkdirSync(dataDir, { recursive: true });
	appendFileSync(log, `${now.toISOString()} ${head}\n`);
	return true;
}

function main(argv) {
	const explicit = argv.find((arg) => arg.startsWith('--config='));
	const root = integrationRoot();
	const config = explicit ? resolve(explicit.slice('--config='.length)) : join(root, CONFIG_FILE);
	if (!existsSync(config)) {
		process.stderr.write(`No ${CONFIG_FILE} at ${config}.\n`);
		return 1;
	}
	const dir = coreDir({ root });
	const head = headOf(dir);
	const problem = coreProblem(dir, head, process.env.TABLERO_DIR ? true : undefined);
	if (problem) {
		process.stderr.write(`${problem}\n`);
		return 1;
	}
	const { datos = '.agent/tmp/tablero' } = JSON.parse(readFileSync(config, 'utf8'));
	try {
		recordCore(resolve(dirname(config), datos), head);
	} catch {
		// The trail is a convenience; it never stops the board.
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
