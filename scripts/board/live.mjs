/**
 * What the board reads live from Git and GitHub, never stored (T126): each lane folder's branch and whether
 * it is clean, and the open PRs with their head SHA. `pnpm board carriles|sigue` and the view use it.
 * CELEBRA_BOARD_LIVE_FIXTURE names a JSON file `{carriles, prs}` that replaces both reads in hermetic tests.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { laneFolder } from './model.mjs';

const run = promisify(execFile);
const opts = { encoding: 'utf8', windowsHide: true, timeout: 20_000 };

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

/** Open PRs `[{number, headRefOid, headRefName, title}]`, or undefined when `gh` fails. */
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
				'number,headRefOid,headRefName,title',
			],
			{ ...opts, cwd: resolve(dir, '..', '..', '..') },
		);
		return JSON.parse(stdout);
	} catch {
		return undefined;
	}
}

/** Both reads at once: `{carriles, prs, en}`, the `vivo` field the view receives. */
export async function readLive(dir, board) {
	const fixture = process.env.CELEBRA_BOARD_LIVE_FIXTURE;
	if (fixture)
		return {
			prs: null,
			carriles: [],
			...JSON.parse(readFileSync(fixture, 'utf8')),
			en: new Date().toISOString(),
		};
	const [carriles, prs] = await Promise.all([readLanes(dir, board), readOpenPrs(dir)]);
	return { carriles, prs: prs ?? null, en: new Date().toISOString() };
}
