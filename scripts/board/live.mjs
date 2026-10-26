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
import { WORKTREE_LANES } from '../shared/worktree-lane.ts';

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
	const up = (x) => String(x ?? '').toUpperCase();
	// A check run is done once its status is COMPLETED; a status context once its state left PENDING/EXPECTED.
	const running = (c) =>
		c.status !== undefined
			? up(c.status) !== 'COMPLETED'
			: c.state !== undefined && ['PENDING', 'EXPECTED'].includes(up(c.state));
	if (checks.some((c) => FAILED.has(up(c.conclusion || c.state)))) return 'rojo';
	if (checks.some(running)) return 'pendiente';
	return 'verde';
}

/** The Integration checkout that holds the board: `<root>/.agent/tmp/board`. */
const repoParent = (dir) => dirname(resolve(dir, '..', '..', '..'));
const pathKey = (path) =>
	process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);

/** One lane folder: `{id, rama, limpio}` (rama null = detached HEAD), or `{id, error}` when Git cannot read it. */
async function laneGit(parent, id, runGit) {
	const cwd = join(parent, laneFolder(id));
	try {
		const [branch, status] = await Promise.all([
			runGit('git', ['branch', '--show-current'], { ...opts, cwd }),
			runGit('git', ['status', '--porcelain'], { ...opts, cwd }),
		]);
		return { id, rama: branch.stdout.trim() || null, limpio: !status.stdout.trim() };
	} catch (e) {
		return { id, error: String(e.code ?? e.message) };
	}
}

/** Git state of the canonical lanes registered as worktrees, independent of stored lane JSON. */
export async function readLanes(dir, runGit = run) {
	const parent = repoParent(dir);
	let registered;
	try {
		const { stdout } = await runGit('git', ['worktree', 'list', '--porcelain', '-z'], {
			...opts,
			cwd: resolve(dir, '..', '..', '..'),
		});
		registered = new Set(
			stdout
				.split('\0')
				.filter((line) => line.startsWith('worktree '))
				.map((line) => pathKey(line.slice(9))),
		);
	} catch {
		return WORKTREE_LANES.map(({ id }) => ({ id, error: 'no se pudo leer git worktree list' }));
	}
	return Promise.all(
		WORKTREE_LANES.map(({ id }) =>
			registered.has(pathKey(resolve(parent, laneFolder(id))))
				? laneGit(parent, id, runGit)
				: { id, error: 'carril no registrado en git worktree list' },
		),
	);
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
const APP_MS = 5 * 60_000;
const appCache = new Map();
/** `readApp` once per root every few minutes: the live read runs every minute and on every `board sigue`. */
export async function readAppCached(root = codeRoot, now = Date.now()) {
	const hit = appCache.get(root);
	if (hit && now - hit.at < APP_MS) return hit.app;
	const app = await readApp(root);
	appCache.set(root, { at: now, app });
	return app;
}

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
export async function readLive(dir) {
	const fixture = process.env.CELEBRA_BOARD_LIVE_FIXTURE;
	if (fixture)
		return {
			prs: null,
			carriles: [],
			...JSON.parse(readFileSync(fixture, 'utf8')),
			en: new Date().toISOString(),
		};
	const [carriles, prs, app] = await Promise.all([
		readLanes(dir),
		readOpenPrs(dir),
		readAppCached(),
	]);
	return { carriles, prs: prs ?? null, app, en: new Date().toISOString() };
}
