import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SYNC_PATH = path.join(ROOT, 'scripts', 'board', 'sync.mjs');
const NOW = '2026-10-20T20:00:00Z';
const DEVELOP = 'd'.repeat(40);

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const CIERRE = { resumen: 'Hecho.', comprobaciones: [], saltadas: [], pendientes: [], en: NOW };

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'unida',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'claude',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

const pr = (number: number, headRefName: string, state = 'MERGED') => ({
	number,
	headRefName,
	state,
	isDraft: false,
	title: headRefName,
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-hygiene-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

/** Run an async module snippet with `m` = the imported sync module; its printed JSON is returned. */
function probe(code: string, env: Json = {}) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(SYNC_PATH).href],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv(env as NodeJS.ProcessEnv) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const lane = (name: string, fields: Json = {}) => ({
	lane: name,
	path: `w/${name}`,
	rama: null,
	head: 'a'.repeat(40),
	limpio: true,
	...fields,
});

describe('board:sync hygiene (d268)', () => {
	it('moves checked tasks to comprobada, never archives (d278) and compacts old archives', () => {
		const dir = makeBoard([
			task('unida-ok', { num: 1, pr: '#10', cierre: CIERRE }),
			task('unida-sin-cierre', { num: 2, pr: '#11' }),
			task('con-candado', {
				num: 3,
				estado: 'hecha',
				rama: 'feat/c',
				candado: {
					agente: 'claude',
					desde: NOW,
					sesion: 'local_x',
					carril: 'f05-plataforma',
				},
			}),
			task('pr-abierto', { num: 4, pr: '#13', estado: 'hecha' }),
			task('cancelada', { num: 5, estado: 'cancelada', cierre: CIERRE }),
			task('origen', { num: 6, estado: 'en revision', pr: '#13', rama: 'feat/origen' }),
			task('origen-revision', {
				num: 7,
				estado: 'hecha',
				origen: 'origen',
				revisionSha: 'b'.repeat(40),
				pr: '#13',
				cierre: CIERRE,
			}),
			task('vieja', {
				num: 8,
				estado: 'comprobada',
				cierre: CIERRE,
				archivada: '2026-01-02T00:00:00Z',
			}),
			task('tres-dias', {
				num: 9,
				estado: 'comprobada',
				cierre: CIERRE,
				archivada: new Date(Date.now() - 3 * 86400000).toISOString(),
			}),
			task('un-dia', {
				num: 10,
				estado: 'comprobada',
				cierre: CIERRE,
				archivada: new Date(Date.now() - 86400000).toISOString(),
			}),
		]);
		const sources = {
			worktrees: [],
			local: [],
			remote: [],
			prs: [
				pr(10, 'fix/unida-ok'),
				pr(11, 'fix/b'),
				pr(12, 'fix/c'),
				pr(13, 'feat/origen', 'OPEN'),
			],
		};
		const run = (dryRun: boolean) =>
			`console.log(JSON.stringify(await m.run({ dryRun: ${dryRun}, dir: process.env.CELEBRA_BOARD_DIR, sources: () => (${JSON.stringify(sources)}), runner: (cmd) => (cmd.startsWith('git ls-remote') ? { ok: true, output: 'abc123 refs/heads/feat/c' } : { ok: false, output: '', error: 'sin red' }) })));`;

		const dry = probe(run(true), { CELEBRA_BOARD_DIR: dir });
		expect(dry.higiene.comprobadas.map((c: Json) => [c.id, c.ok])).toEqual([
			['unida-ok', null],
			['unida-sin-cierre', null],
		]);
		expect(dry.higiene.almacen.resumidas).toEqual([
			expect.stringMatching(/^T8 vieja · comprobada · 2026-01-02$/),
			expect.stringMatching(/^T9 tres-dias · comprobada · /),
		]);
		expect(readTask(dir, 'unida-ok').rev).toBe(1);
		expect(existsSync(path.join(dir, 'tareas', 'vieja.json'))).toBe(true);

		const real = probe(run(false), { CELEBRA_BOARD_DIR: dir });
		expect(real.higiene.comprobadas.every((c: Json) => c.ok)).toBe(true);
		expect(readTask(dir, 'unida-ok')).toMatchObject({
			estado: 'comprobada',
			evidencia: { cmd: 'gh pr view 10 --json state', salio: '{"state":"MERGED"}' },
		});
		// A lock keeps its task for its session; an open PR is not evidence.
		expect(readTask(dir, 'con-candado').estado).toBe('hecha');
		expect(readTask(dir, 'pr-abierto').estado).toBe('hecha');
		// d278: only the owner archives, so finished tasks with a valid cierre stay in «Finalizadas».
		expect(real.higiene).not.toHaveProperty('archivadas');
		for (const id of ['unida-ok', 'unida-sin-cierre', 'cancelada', 'origen-revision'])
			expect(readTask(dir, id).archivada).toBeUndefined();
		// Only archives older than two days move to the monthly zip.
		expect(existsSync(path.join(dir, 'tareas', 'vieja.json'))).toBe(false);
		expect(existsSync(path.join(dir, 'archivo', 'vieja.json'))).toBe(true);
		expect(existsSync(path.join(dir, 'archivo', 'tres-dias.json'))).toBe(true);
		expect(existsSync(path.join(dir, 'tareas', 'un-dia.json'))).toBe(true);
	});

	it('detaches only free, clean lanes at origin/develop and reports the rest', () => {
		const board = {
			tareas: [
				task('ocupada', {
					estado: 'en curso',
					candado: { agente: 'codex', desde: NOW, carril: 'f06-landing' },
				}),
				task('abierta', { estado: 'en revision', carril: 'f07-invitaciones' }),
			],
		};
		const src = {
			develop: DEVELOP,
			prs: [pr(20, 'feat/unida'), pr(21, 'feat/abierta', 'OPEN')],
			worktrees: [
				lane('celebra-me', { rama: 'develop' }),
				lane('f05-plataforma'),
				lane('f06-landing'),
				lane('f07-invitaciones'),
				lane('f08-demos', { head: DEVELOP }),
				lane('f09-docs', { rama: 'feat/unida' }),
				lane('f10-libre', { rama: 'feat/abierta' }),
				lane('f11-preview', { limpio: false }),
				lane('f12-release', { limpio: null }),
			],
		};
		const out = probe(
			`console.log(JSON.stringify(m.lanePlan(${JSON.stringify(board)}, ${JSON.stringify(src)})));`,
		);
		expect(out.alinear.map((l: Json) => l.lane)).toEqual(['f05-plataforma', 'f09-docs']);
		expect(out.avisos.map((a: Json) => a.texto)).toEqual([
			'carril f10-libre libre en la rama feat/abierta sin PR unido: no se alinea',
			'carril f11-preview libre con cambios sin confirmar en aaaaaaa: no se alinea',
		]);
		const none = probe(
			`console.log(JSON.stringify(m.lanePlan(${JSON.stringify(board)}, ${JSON.stringify({ ...src, develop: null })})));`,
		);
		expect(none).toEqual({ alinear: [], avisos: [] });
	});

	it('rechecks each lane inside the store lock before switching and fails closed on drift', () => {
		const dir = makeBoard([]);
		const names = ['f05-plataforma', 'f09-docs', 'f10-libre', 'f11-preview', 'f12-release'];
		const src = { develop: DEVELOP, prs: [], worktrees: names.map((n) => lane(n)) };
		// Each lane as Git answers right before the switch: f10's HEAD moved, f11 got changes, f12 refuses.
		const state = {
			'w/f10-libre': { head: 'c'.repeat(40) },
			'w/f11-preview': { status: ' M src/a.ts' },
		};
		const claim = {
			titulo: 'otra',
			estado: 'en curso',
			urgencia: 'normal',
			actor: 'sesion',
			agente: 'codex',
			requisitos: [],
			rev: 1,
			actualizado: NOW,
			candado: { agente: 'codex', desde: NOW, carril: 'f09-docs' },
		};
		const code = `const fs = await import('node:fs');
			const path = await import('node:path');
			const dir = process.env.CELEBRA_BOARD_DIR;
			const state = ${JSON.stringify(state)};
			const calls = [];
			const git = (args, cwd) => {
				const lane = { head: '${'a'.repeat(40)}', status: '', ...state[cwd] };
				if (args[0] === 'branch') return '';
				if (args[0] === 'rev-parse') return lane.head;
				if (args[0] === 'status') return lane.status;
				calls.push([cwd, ...args]);
				// A session claims f09-docs while f05 is being switched: the plan already listed f09 as free.
				if (cwd.endsWith('f05-plataforma'))
					fs.writeFileSync(path.join(dir, 'tareas', 'otra.json'), JSON.stringify(${JSON.stringify(claim)}));
				if (cwd.endsWith('f12-release')) throw new Error('bloqueado');
				return '';
			};
			const r = await m.hygiene(dir, ${JSON.stringify(src)}, { dryRun: DRY, git });
			console.log(JSON.stringify({ calls, carriles: r.carriles }));`;
		const dry = probe(code.replace('DRY', 'true'), { CELEBRA_BOARD_DIR: dir });
		expect(dry.calls).toEqual([]);
		expect(dry.carriles.map((c: Json) => c.ok)).toEqual([null, null, null, null, null]);
		const real = probe(code.replace('DRY', 'false'), { CELEBRA_BOARD_DIR: dir });
		expect(real.calls).toEqual([
			['w/f05-plataforma', 'switch', '--detach', '--quiet', DEVELOP],
			['w/f12-release', 'switch', '--detach', '--quiet', DEVELOP],
		]);
		expect(real.carriles.map((c: Json) => [c.lane, c.ok, c.resultado])).toEqual([
			['f05-plataforma', true, undefined],
			['f09-docs', false, 'carril f09-docs tomado después del plan: no se alinea'],
			['f10-libre', false, 'carril f10-libre cambió de HEAD desde el plan: no se alinea'],
			['f11-preview', false, 'carril f11-preview tiene cambios sin confirmar: no se alinea'],
			['f12-release', false, 'bloqueado'],
		]);
	});
});
