/**
 * What the board reads live from Git and GitHub, never stored (T126): each lane folder's branch and whether
 * it is clean, the open PRs with their head SHA and CI state, and (d284) the app version and the board code's
 * last commit. `pnpm board carriles|sigue` and the view use it.
 * CELEBRA_BOARD_LIVE_FIXTURE names a JSON file `{carriles, prs}` that replaces both reads in hermetic tests.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { laneFolder } from './model.mjs';

const run = promisify(execFile);
const opts = { encoding: 'utf8', windowsHide: true, timeout: 20_000 };
/** The checkout this board code runs from: the Integration checkout under `pnpm board:serve`. */
const codeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAILED = new Set([
	'FAILURE',
	'ERROR',
	'TIMED_OUT',
	'CANCELLED',
	'ACTION_REQUIRED',
	'STARTUP_FAILURE',
]);

/** d284: a PR's checks in one word: `rojo` if any failed, `pendiente` while any runs, else `verde`; null without checks. */
export function ciOf(rollup) {
	const checks = Array.isArray(rollup) ? rollup : [];
	if (!checks.length) return null;
	const states = checks.map((c) =>
		String(c.conclusion || c.state || c.status || '').toUpperCase(),
	);
	if (states.some((s) => FAILED.has(s))) return 'rojo';
	if (states.some((s) => !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(s))) return 'pendiente';
	return 'verde';
}

/** The Integration checkout that holds the board: `<root>/.agent/tmp/board`. */
const repoParent = (dir) => dirname(resolve(dir, '..', '..', '..'));

/** One lane folder: `{id, rama, limpio}` (rama null = detached HEAD), or `{id, error}` when Git cannot read it. */
async function laneGit(parent, id) {
	const cwd = join(parent, laneFolder(id));
	try {
		const [branch, status] = await Promise.all([
			run('git', ['branch', '--show-current'], { ...opts, cwd }),
			run('git', ['status', '--porcelain'], { ...opts, cwd }),
		]);
		return { id, rama: branch.stdout.trim() || null, limpio: !status.stdout.trim() };
	} catch (e) {
		return { id, error: String(e.code ?? e.message) };
	}
}

/** Git state of every lane record of the board in `dir`. */
function readLanes(dir, board) {
	const parent = repoParent(dir);
	return Promise.all((board.carriles ?? []).map((l) => laneGit(parent, l.id)));
}

/** Open PRs `[{number, headRefOid, headRefName, title, ci}]`, or undefined when `gh` fails. */
async function readOpenPrs(dir) {
	try {
		const { stdout } = await run(
			'gh',
			[
				'pr',
				'list',
				'--state',
				'open',
				'--limit',
				'100',
				'--json',
				'number,headRefOid,headRefName,title,statusCheckRollup',
			],
			{ ...opts, cwd: resolve(dir, '..', '..', '..') },
		);
		return JSON.parse(stdout).map(({ statusCheckRollup, ...pr }) => ({
			...pr,
			ci: ciOf(statusCheckRollup),
		}));
	} catch {
		return undefined;
	}
}

/** d284: `{version, tablero: {sha, en}}`: package.json's version and the last commit that touched scripts/board. */
export async function readApp(root = codeRoot) {
	const app = {};
	try {
		app.version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
	} catch {
		// No package.json: the footer leaves the version out.
	}
	try {
		const { stdout } = await run(
			'git',
			['log', '-1', '--format=%h%x09%cI', '--', 'scripts/board'],
			{ ...opts, cwd: root },
		);
		const [sha, en] = stdout.trim().split('\t');
		if (sha) app.tablero = { sha, en };
	} catch {
		// Not a Git checkout: the footer leaves the board commit out.
	}
	return app;
}

/** Both reads at once: `{carriles, prs, app, en}`, the `vivo` field the view receives. */
export async function readLive(dir, board) {
	const fixture = process.env.CELEBRA_BOARD_LIVE_FIXTURE;
	if (fixture)
		return {
			prs: null,
			carriles: [],
			...JSON.parse(readFileSync(fixture, 'utf8')),
			en: new Date().toISOString(),
		};
	const [carriles, prs, app] = await Promise.all([
		readLanes(dir, board),
		readOpenPrs(dir),
		readApp(),
	]);
	return { carriles, prs: prs ?? null, app, en: new Date().toISOString() };
}
