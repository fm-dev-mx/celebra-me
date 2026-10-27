import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

/**
 * T297 (U-03): `pnpm board claim` and `release` run from a lane check that lane and branch and drive the lane's
 * git-safety session. The checkout is a throwaway repository under a canonical lane path.
 */
const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const NOW = '2026-10-26T12:00:00Z';
const BRANCH = 'feat/claim-lane';
const BASELINE = 'git-safety-baseline.feat-claim-lane.json';

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string) {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function makeBoard(tareas: Json[]) {
	const dir = temp('board-t297-');
	mkdirSync(path.join(dir, 'tareas'));
	for (const [i, t] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${t.id}.json`),
			JSON.stringify({
				num: i + 1,
				titulo: t.id,
				estado: 'pendiente',
				urgencia: 'normal',
				actor: 'sesion',
				agente: 'cualquiera',
				requisitos: [],
				rev: 1,
				actualizado: NOW,
				prompt: `T1 · ${t.id}\nDECISIONES\n- ninguna`,
				...t,
			}),
		);
	return dir;
}

const git = (cwd: string, ...args: string[]) =>
	runCommand(
		'git',
		[
			'-c',
			'user.email=t@example.com',
			'-c',
			'user.name=t',
			'-c',
			'commit.gpgsign=false',
			...args,
		],
		{ cwd },
	);

/** An Integration repository `<tmp>/celebra-me` on develop with one commit. */
function makeIntegration() {
	const root = path.join(temp('lanes-'), 'celebra-me');
	mkdirSync(root);
	git(root, 'init', '-q', '-b', 'develop');
	git(root, 'commit', '-q', '--allow-empty', '-m', 'base');
	return root;
}

/** A linked worktree at `<tmp>/celebra-me-worktrees/<lane>`, with HEAD on `branch` (or detached). */
function makeLane(lane: string, branch: string | null = BRANCH) {
	const root = makeIntegration();
	const cwd = path.join(root, '..', 'celebra-me-worktrees', lane);
	if (branch) git(root, 'worktree', 'add', '-q', '-b', branch, cwd);
	else git(root, 'worktree', 'add', '-q', '--detach', cwd);
	return cwd;
}

function cli(dir: string, checkout: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			CELEBRA_BOARD_CHECKOUT: checkout,
			CLAUDE_CODE_HOST_SESSION_ID: '',
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const CLAIM = ['--agente=codex', '--sesion=codex-test', `--rama=${BRANCH}`];

describe('pnpm board claim from a lane (T297)', () => {
	it('refuses a claim from another lane or another branch and writes nothing', () => {
		const dir = makeBoard([{ id: 'tarea', carrilPlaneado: 'f05-plataforma' }]);

		const otherLane = cli(dir, makeLane('f06-landing'), 'claim', 'tarea', ...CLAIM);
		expect(otherLane.status).toBe(2);
		expect(otherLane.err).toContain(
			'esta carpeta es f06-landing, pero tarea corre en f05-plataforma',
		);

		const detached = cli(dir, makeLane('f05-plataforma', null), 'claim', 'tarea', ...CLAIM);
		expect(detached.status).toBe(2);
		expect(detached.err).toContain(
			`f05-plataforma está en HEAD separado, no en ${BRANCH}: primero git switch -c ${BRANCH} origin/develop`,
		);
		expect(readTask(dir, 'tarea').candado).toBeUndefined();
	});

	it('opens the git-safety session on claim, keeps it on a repeated claim and finishes it on release', () => {
		const dir = makeBoard([{ id: 'tarea', carrilPlaneado: 'f05-plataforma' }]);
		const lane = makeLane('f05-plataforma');
		const baseline = path.join(lane, '.agent', 'tmp', BASELINE);

		const claim = cli(dir, lane, 'claim', 'tarea', ...CLAIM);
		expect(claim.status).toBe(0);
		expect(claim.out).toContain(`git-safety: sesión ${BRANCH} abierta`);
		expect(existsSync(baseline)).toBe(true);
		expect(readTask(dir, 'tarea')).toMatchObject({
			estado: 'en curso',
			candado: { carril: 'f05-plataforma', rama: BRANCH },
		});

		const again = cli(dir, lane, 'claim', 'tarea', ...CLAIM);
		expect(again.status).toBe(0);
		expect(again.out).toContain(`git-safety: la sesión ${BRANCH} ya estaba abierta`);
		const elsewhere = cli(dir, makeLane('f06-landing'), 'claim', 'tarea', ...CLAIM);
		expect(elsewhere.status).toBe(2);
		expect(elsewhere.err).toContain('el candado de tarea está en f05-plataforma');

		const badOp = cli(
			dir,
			lane,
			'release',
			'tarea',
			'--agente=codex',
			'--sesion=codex-test',
			'--git-safety=branch-switch',
		);
		expect(badOp.status).toBe(2);
		expect(badOp.err).toContain('--git-safety debe ser commit|history');
		expect(readTask(dir, 'tarea').candado).toBeDefined();

		git(lane, 'commit', '-q', '--allow-empty', '-m', 'work');
		const release = cli(
			dir,
			lane,
			'release',
			'tarea',
			'--agente=codex',
			'--sesion=codex-test',
			'--git-safety=commit',
		);
		expect(release.status).toBe(0);
		expect(release.out).toContain(`git-safety: sesión ${BRANCH} cerrada (commit)`);
		expect(existsSync(baseline)).toBe(false);
		expect(readTask(dir, 'tarea')).toMatchObject({ estado: 'pendiente' });
	});

	it('reports a git-safety session that does not close, keeping the board write and the evidence', () => {
		const dir = makeBoard([{ id: 'tarea', carrilPlaneado: 'f05-plataforma' }]);
		const lane = makeLane('f05-plataforma');
		expect(cli(dir, lane, 'claim', 'tarea', ...CLAIM).status).toBe(0);

		// No commit was made, so declaring one is drift git-safety refuses.
		const release = cli(
			dir,
			lane,
			'release',
			'tarea',
			'--agente=codex',
			'--sesion=codex-test',
			'--git-safety=commit',
		);
		expect(release.status).toBe(1);
		expect(release.out).toContain(`git-safety: la sesión ${BRANCH} no cerró`);
		expect(existsSync(path.join(lane, '.agent', 'tmp', BASELINE))).toBe(true);
		expect(readTask(dir, 'tarea').candado).toBeUndefined();
	});

	it('checks nothing from Integration or for a review round, which holds no lane', () => {
		const dir = makeBoard([
			{ id: 'tarea', carrilPlaneado: 'f05-plataforma' },
			{
				id: 'tarea-revision',
				origen: 'tarea',
				revisionSha: 'a'.repeat(40),
				agente: 'codex',
			},
		]);
		const fromIntegration = cli(dir, makeIntegration(), 'claim', 'tarea', ...CLAIM);
		expect(fromIntegration.status).toBe(0);
		expect(fromIntegration.out).not.toContain('git-safety');

		const review = cli(
			dir,
			makeLane('f06-landing', null),
			'claim',
			'tarea-revision',
			'--agente=codex',
			'--sesion=codex-review',
		);
		expect(review.status).toBe(0);
		expect(review.out).not.toContain('git-safety');
	});
});
