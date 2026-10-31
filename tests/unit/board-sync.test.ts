import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SYNC_PATH = path.join(ROOT, 'scripts', 'board', 'sync.mjs');
const BOARD_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const SERVER_PATH = path.join(ROOT, 'scripts', 'board', 'view-server.mjs');
const NOW = '2026-10-20T20:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'en curso',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'codex',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

const pr = (number: number, headRefName: string, state = 'OPEN', isDraft = false) => ({
	number,
	headRefName,
	state,
	isDraft,
	title: headRefName,
});

const SOURCES = {
	worktrees: [{ lane: 'f07-invitaciones', path: 'x/f07-invitaciones', rama: 'feat/en-carril' }],
	local: ['feat/en-carril', 'feat/solo-local'],
	remote: ['feat/en-origin'],
	prs: [
		pr(10, 'fix/unido', 'MERGED'),
		pr(11, 'feat/abierto'),
		pr(12, 'feat/borrador', 'OPEN', true),
		pr(13, 'fix/cerrado', 'CLOSED'),
		pr(14, 'fix/con-candado', 'MERGED'),
		pr(15, 'docs/por-convencion'),
		pr(16, 'fix/old-name', 'MERGED'),
		pr(17, 'fix/old-name'),
		pr(18, 'fix/candado-abierto'),
	],
};

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-sync-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

/** Run an async module snippet with `m` = the imported module; its printed JSON is returned. */
function probe(file: string, code: string, env: Json = {}) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(file).href],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv(env as NodeJS.ProcessEnv) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pnpm board:sync', () => {
	it('plans PR states, releases locks of merged PRs (d170) and only reports closed PRs, open locks and bare branches', () => {
		const board = {
			tareas: [
				task('unido', { num: 1, rama: 'fix/unido', estado: 'en revision', pr: '10' }),
				task('abierto', { num: 2, rama: 'feat/abierto', estado: 'pendiente' }),
				task('borrador', { num: 3, rama: 'feat/borrador' }),
				task('cerrado', { num: 4, rama: 'fix/cerrado' }),
				task('con-candado', {
					num: 5,
					rama: 'fix/con-candado',
					candado: { agente: 'claude', desde: NOW },
				}),
				task('por-convencion', { num: 6 }),
				task('renombrada', { num: 7, rama: 'fix/old-name' }),
				task('en-carril', { num: 8, rama: 'feat/en-carril' }),
				task('en-origin', { num: 9, rama: 'feat/en-origin' }),
				task('solo-local', { num: 10, rama: 'feat/solo-local' }),
				task('ya-unida', { num: 11, rama: 'fix/unido', estado: 'unida', pr: '#10' }),
				task('abierto-revision', {
					num: 12,
					origen: 'abierto',
					rama: 'feat/abierto',
					estado: 'pendiente',
				}),
				task('candado-abierto', {
					num: 13,
					rama: 'fix/candado-abierto',
					candado: { agente: 'codex', desde: NOW },
				}),
				task('candado-cerrada', {
					num: 14,
					rama: 'fix/con-candado',
					estado: 'unida',
					pr: '#14',
					candado: { agente: 'claude', desde: NOW, sesion: 'local_x' },
				}),
			],
		};
		const p = probe(
			SYNC_PATH,
			`console.log(JSON.stringify(m.plan(${JSON.stringify(board)}, ${JSON.stringify(SOURCES)})));`,
		);
		expect(
			p.cambios
				.filter((c: Json) => c.cmd === 'merged')
				.map((c: Json) => [c.id, c.pr, c.texto]),
		).toEqual([
			[
				'con-candado',
				'#14',
				'T5 con-candado → PR #14 unido: pasa a unida · suelta el candado de claude (d170)',
			],
			[
				'candado-cerrada',
				'#14',
				'T14 candado-cerrada → PR #14 unido · suelta el candado de claude (d170)',
			],
		]);
		expect(
			p.cambios.filter((c: Json) => !c.cmd).map((c: Json) => [c.id, c.set, c.texto]),
		).toEqual([
			['unido', { estado: 'unida' }, 'T1 unido → PR #10 unido: pasa a unida'],
			[
				'abierto',
				{ pr: '#11', estado: 'en revision' },
				'T2 abierto → PR #11 abierto: pasa a en revision',
			],
			['borrador', { pr: '#12' }, 'T3 borrador → PR #12 en borrador'],
			[
				'por-convencion',
				{ pr: '#15', rama: 'docs/por-convencion', estado: 'en revision' },
				'T6 por-convencion → PR #15 abierto: pasa a en revision · rama docs/por-convencion',
			],
			[
				'renombrada',
				{ pr: '#17', estado: 'en revision' },
				'T7 renombrada → PR #17 abierto: pasa a en revision',
			],
		]);
		expect(p.omitidas.map((o: Json) => o.texto)).toEqual([
			'T13 candado-abierto → PR #18 abierto: pasa a en revision (tiene candado de codex: lo cambia su sesión)',
		]);
		expect(p.avisos.map((a: Json) => a.texto)).toEqual([
			'T4 cerrado: PR #13 cerrado sin unir',
			'T8 en-carril: rama feat/en-carril en el carril f07-invitaciones, sin PR',
			'T9 en-origin: rama feat/en-origin en origin, sin PR',
			'T10 solo-local: rama feat/solo-local solo local, sin PR',
		]);
	});

	it('flags an old lock without new commits on origin and never a recent or still-pushing one', () => {
		const old = '2026-10-20T08:00:00Z';
		const board = {
			tareas: [
				task('sin-commits', {
					num: 1,
					rama: 'feat/sin-commits',
					candado: { agente: 'claude', desde: old, rama: 'feat/sin-commits' },
				}),
				task('con-commit', {
					num: 2,
					rama: 'feat/con-commit',
					candado: { agente: 'codex', desde: old },
				}),
				task('reciente', {
					num: 3,
					rama: 'feat/sin-commits',
					candado: { agente: 'claude', desde: '2026-10-20T18:00:00Z' },
				}),
				task('sin-rama', { num: 4, candado: { agente: 'gemini', desde: old } }),
				task('borrada', {
					num: 5,
					rama: 'feat/borrada',
					candado: { agente: 'claude', desde: old },
				}),
			],
		};
		const src = {
			...SOURCES,
			remoteDates: {
				'feat/sin-commits': '2026-10-20T07:00:00Z',
				'feat/con-commit': '2026-10-20T12:00:00Z',
			},
		};
		const now = Date.parse(NOW);
		const out = probe(
			SYNC_PATH,
			`const b = ${JSON.stringify(board)}, s = ${JSON.stringify(src)};
			console.log(JSON.stringify({
				def: m.plan(b, s, { now: ${now} }).candadosViejos.map((c) => c.texto),
				wide: m.staleLocks(b, s, { now: ${now}, hours: 24 }).length,
				hours: [m.lockHours(['--horas=2'], {}), m.lockHours([], { CELEBRA_BOARD_LOCK_HOURS: '12' }), m.lockHours([], {}), m.lockHours(['--horas=x'], {})],
			}));`,
		);
		expect(out.def).toEqual([
			'T1 sin-commits: posible sesión cerrada — candado de claude desde hace 12 h, sin commits nuevos en origin/feat/sin-commits',
			'T4 sin-rama: posible sesión cerrada — candado de gemini desde hace 12 h, sin rama',
			'T5 borrada: posible sesión cerrada — candado de claude desde hace 12 h, rama feat/borrada no está en origin',
		]);
		expect(out.wide).toBe(0);
		expect(out.hours).toEqual([2, 12, 6, 6]);
	});

	it('pnpm board merged drops any lock only for a PR merged on GitHub and refuses the rest', () => {
		const lock = { agente: 'codex', desde: NOW, sesion: 'local_otra' };
		const dir = makeBoard([
			task('unida-ya', { pr: '#20', estado: 'en revision', rama: 'fix/x', candado: lock }),
			task('sigue-abierta', {
				pr: '#21',
				estado: 'en revision',
				rama: 'fix/y',
				candado: lock,
			}),
			task('sin-pr', { candado: lock }),
			task('rev-hija', {
				pr: '#20',
				estado: 'en curso',
				origen: 'x',
				revisionSha: 'a'.repeat(40),
			}),
		]);
		const out = probe(
			BOARD_PATH,
			`const states = { '#20': 'MERGED', '#21': 'OPEN' };
			const prState = (pr) => states[pr] ?? '';
			const dir = process.env.CELEBRA_BOARD_DIR;
			const tryRun = async (argv) => { try { let s = ''; await m.run(argv, { dir, prState, out: (x) => (s = x) }); return s; } catch (e) { return 'ERR ' + e.message; } };
			console.log(JSON.stringify([
				await tryRun(['merged', 'unida-ya']),
				await tryRun(['merged', 'unida-ya', '--coordinador', '--quien=claude']),
				await tryRun(['merged', 'unida-ya', '--coordinador', '--quien=claude']),
				await tryRun(['merged', 'sigue-abierta', '--coordinador', '--quien=claude']),
				await tryRun(['merged', 'sin-pr', '--coordinador', '--quien=claude']),
				await tryRun(['merged', 'rev-hija', '--coordinador', '--quien=claude']),
			]));`,
			{ CELEBRA_BOARD_DIR: dir },
		);
		expect(out).toEqual([
			'ERR merged requiere --coordinador (d170)',
			'unida-ya unida (rev 2); candado de codex suelto',
			'unida-ya ya está unida',
			'ERR #21 no está unido en GitHub (OPEN)',
			'ERR sin-pr no tiene pr: indique --pr=#<número>',
			'ERR rev-hija es la revisión de x (se cierra con su --sha); use pnpm board merged x --coordinador --quien=claude',
		]);
		expect(readTask(dir, 'unida-ya').candado).toBeUndefined();
		expect(readTask(dir, 'unida-ya').sesion).toEqual({ id: 'local_otra', agente: 'codex' });
		expect(readTask(dir, 'sigue-abierta').candado).toEqual(lock);
	});

	it('links an open PR by its canonical «T<n> <id>» reference only when it is the only one (d159)', () => {
		const ref = (number: number, head: string, title: string, body = '', state = 'OPEN') => ({
			...pr(number, head, state),
			title,
			body,
		});
		const prs = [
			ref(30, 'feat/otra-cosa', 'feat(board): faster sync (T20 por-titulo)'),
			ref(31, 'feat/z', 'feat: z', 'Summary\n\n- Board task: T21 por-cuerpo\n'),
			ref(
				32,
				'feat/y',
				'feat: y',
				'Requires T22 en-prosa first.\n- T22 en-prosa waits for it',
			),
			ref(33, 'feat/a', 'T23 doble part one'),
			ref(34, 'feat/b', 'T23 doble part two'),
			ref(35, 'feat/c', 'T24 corto-largo'),
			ref(36, 'feat/d', 'T25 cerrado-ya', '', 'MERGED'),
			ref(37, 'feat/propia', 'T26 con-rama'),
		];
		const tasks = [
			task('por-titulo', { num: 20 }),
			task('por-cuerpo', { num: 21, rama: 'feat/sin-pr-aun' }),
			task('en-prosa', { num: 22 }),
			task('doble', { num: 23 }),
			task('corto', { num: 24 }),
			task('cerrado-ya', { num: 25 }),
			task('con-rama', { num: 26, rama: 'feat/propia' }),
			task('periodica', { num: 27, cada: 'semana' }),
		];
		const out = probe(
			SYNC_PATH,
			`const prs = ${JSON.stringify(prs)};
			console.log(JSON.stringify(${JSON.stringify(tasks)}.map((t) => [t.id, m.matchPr(t, prs)?.number ?? null])));`,
		);
		expect(out).toEqual([
			['por-titulo', 30],
			// A declared branch is the only match: a PR naming the task from another head is reported instead.
			['por-cuerpo', null],
			['en-prosa', null],
			['doble', null],
			['corto', null],
			['cerrado-ya', null],
			['con-rama', 37],
			['periodica', null],
		]);
		const p = probe(
			SYNC_PATH,
			`console.log(JSON.stringify(m.plan({ tareas: ${JSON.stringify(tasks.slice(0, 1))} }, { worktrees: [], local: [], remote: [], prs: ${JSON.stringify(prs)} })));`,
		);
		expect(p.cambios.map((c: Json) => [c.id, c.set])).toEqual([
			['por-titulo', { pr: '#30', rama: 'feat/otra-cosa', estado: 'en revision' }],
		]);
		const named = probe(
			SYNC_PATH,
			`console.log(JSON.stringify(m.plan({ tareas: ${JSON.stringify(tasks.slice(1, 2))} }, { worktrees: [], local: [], remote: [], prs: ${JSON.stringify(prs)} })));`,
		);
		expect(named.cambios).toEqual([]);
		expect(named.avisos.map((a: Json) => a.texto)).toEqual([
			'T21 por-cuerpo: rama feat/sin-pr-aun sin PR, pero el PR #31 (rama feat/z) nombra la tarea: corrija rama o pr',
		]);
	});

	it('matches a title reference literally, with or without a PR body (P3 of PR #607)', () => {
		const prs = [
			{ ...pr(40, 'feat/x', 'OPEN'), title: 'feat: T28 v1x2 tweak' },
			{ ...pr(41, 'feat/w', 'OPEN'), title: 'feat: T29 v1.2 tweak' },
		];
		const out = probe(
			SYNC_PATH,
			`const prs = ${JSON.stringify(prs)};
			console.log(JSON.stringify([m.namesTask(prs[0], { num: 28, id: 'v1.2' }), m.namesTask(prs[1], { num: 29, id: 'v1.2' }), m.namesTask({ title: 'x' }, { num: 29, id: 'v1.2' })]));`,
		);
		expect(out).toEqual([false, true, false]);
	});

	it('deletes the branch a freed lane left only when origin/develop contains it (d268)', () => {
		const dir = makeBoard([]);
		const develop = 'd'.repeat(40);
		const head = 'a'.repeat(40);
		const lanes = [
			['f05-plataforma', null],
			['f09-docs', 'feat/unida'],
			['f10-libre', 'feat/squash'],
			['f11-preview', 'feat/en-otro'],
		].map(([lane, rama]) => ({ lane, path: `w/${lane}`, rama, head, limpio: true }));
		const src = {
			develop,
			worktrees: lanes,
			prs: ['feat/unida', 'feat/squash', 'feat/en-otro'].map((b, i) =>
				pr(40 + i, b, 'MERGED'),
			),
		};
		const code = `const lanes = ${JSON.stringify(lanes)};
			const calls = [];
			const git = (args, cwd) => {
				const l = lanes.find((x) => x.path === cwd);
				if (args[1] === '--show-current') return l.rama ?? '';
				if (args[0] === 'rev-parse') return l.head;
				if (args[0] === 'status') return '';
				calls.push([cwd, ...args]);
				if (args[0] === 'merge-base' && cwd.endsWith('f10-libre')) throw Object.assign(new Error('exit 1'), { status: 1 });
				if (args[0] === 'branch' && cwd.endsWith('f11-preview'))
					throw Object.assign(new Error('x'), { stderr: "error: cannot delete branch 'feat/en-otro' used by worktree\\nmore" });
				return '';
			};
			const r = await m.hygiene(process.env.CELEBRA_BOARD_DIR, ${JSON.stringify(src)}, { dryRun: DRY, git });
			console.log(JSON.stringify({ calls, carriles: r.carriles, lines: m.summary({ prueba: DRY, cambios: [], omitidas: [], avisos: [], higiene: r }) }));`;
		const dry = probe(SYNC_PATH, code.replaceAll('DRY', 'true'), { CELEBRA_BOARD_DIR: dir });
		expect(dry.calls).toEqual([]);
		expect(dry.lines).toContain(
			'Carril: [prueba] carril f09-docs libre: de la rama feat/unida a origin/develop (ddddddd); borra la rama local feat/unida si ya está en origin/develop',
		);
		const real = probe(SYNC_PATH, code.replaceAll('DRY', 'false'), {
			CELEBRA_BOARD_DIR: dir,
		});
		const detach = (lane: string) => [`w/${lane}`, 'switch', '--detach', '--quiet', develop];
		const ancestor = (lane: string, rama: string) => [
			`w/${lane}`,
			'merge-base',
			'--is-ancestor',
			`refs/heads/${rama}`,
			develop,
		];
		expect(real.calls).toEqual([
			detach('f05-plataforma'),
			detach('f09-docs'),
			ancestor('f09-docs', 'feat/unida'),
			['w/f09-docs', 'branch', '-d', '--quiet', '--', 'feat/unida'],
			detach('f10-libre'),
			ancestor('f10-libre', 'feat/squash'),
			detach('f11-preview'),
			ancestor('f11-preview', 'feat/en-otro'),
			['w/f11-preview', 'branch', '-d', '--quiet', '--', 'feat/en-otro'],
		]);
		expect(real.carriles.map((c: Json) => [c.lane, c.ok, c.podada, c.resultado])).toEqual([
			['f05-plataforma', true, undefined, undefined],
			['f09-docs', true, true, undefined],
			['f10-libre', true, false, 'rama feat/squash no está en origin/develop: se queda'],
			[
				'f11-preview',
				true,
				false,
				"rama feat/en-otro no se borró: error: cannot delete branch 'feat/en-otro' used by worktree",
			],
		]);
		expect(real.lines).toContain(
			'Carril: carril f10-libre libre: de la rama feat/squash a origin/develop (ddddddd); borra la rama local feat/squash si ya está en origin/develop (rama feat/squash no está en origin/develop: se queda)',
		);
	});

	it('reads lanes from git worktree list', () => {
		const out = probe(
			SYNC_PATH,
			`console.log(JSON.stringify(m.parseWorktrees('worktree D:/a/celebra-me\\nHEAD 1\\nbranch refs/heads/develop\\n\\nworktree D:/w/f07-invitaciones\\nHEAD 2\\ndetached\\n')));`,
		);
		expect(out).toEqual([
			{ lane: 'celebra-me', path: 'D:/a/celebra-me', rama: 'develop', head: '1' },
			{ lane: 'f07-invitaciones', path: 'D:/w/f07-invitaciones', rama: null, head: '2' },
		]);
	});

	it('writes through pnpm board set with a log row, writes nothing on dry-run and reports a stale rev', () => {
		const dir = makeBoard([
			task('unido', { num: 1, rama: 'fix/unido', estado: 'en revision', pr: '10' }),
			task('abierto', { num: 2, rama: 'feat/abierto', estado: 'pendiente' }),
			task('con-candado', {
				num: 5,
				rama: 'fix/con-candado',
				candado: {
					agente: 'claude',
					desde: NOW,
					sesion: 'local_otra',
					carril: 'f07-invitaciones',
				},
			}),
		]);
		const run = (dryRun: boolean) =>
			`console.log(JSON.stringify(await m.run({ dryRun: ${dryRun}, dir: process.env.CELEBRA_BOARD_DIR, sources: () => (${JSON.stringify(SOURCES)}) })));`;
		const dry = probe(SYNC_PATH, run(true), { CELEBRA_BOARD_DIR: dir });
		expect(dry.prueba).toBe(true);
		expect(dry.cambios.map((c: Json) => c.ok)).toEqual([null, null, null]);
		expect(readTask(dir, 'con-candado').candado).toBeDefined();
		expect(readTask(dir, 'unido').rev).toBe(1);

		const real = probe(SYNC_PATH, run(false), { CELEBRA_BOARD_DIR: dir });
		expect(real.cambios.map((c: Json) => c.ok)).toEqual([true, true, true]);
		// d268: the hygiene then finds both merged PRs on GitHub and moves the tasks on to comprobada.
		const evidencia = {
			cmd: expect.stringMatching(/^gh pr view 1[04] --json state$/),
			salio: '{"state":"MERGED"}',
		};
		const freed = readTask(dir, 'con-candado');
		expect(freed).toMatchObject({ estado: 'comprobada', pr: '#14', rev: 3, evidencia });
		expect(freed.candado).toBeUndefined();
		expect(readTask(dir, 'unido')).toMatchObject({
			estado: 'comprobada',
			pr: '#10',
			rev: 3,
			evidencia,
		});
		expect(real.higiene.comprobadas.map((c: Json) => [c.id, c.ok])).toEqual([
			['unido', true],
			['con-candado', true],
		]);
		expect(readTask(dir, 'abierto')).toMatchObject({ estado: 'en revision', pr: '#11' });
		const rows = readdirSync(path.join(dir, 'bitacora')).flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);
		expect(rows).toContainEqual(
			expect.objectContaining({
				tarea: 'unido',
				a: 'unida',
				quien: 'claude',
				corrio: 'pnpm board:sync',
				salio: 'PR #10 MERGED',
			}),
		);
		expect(rows).toContainEqual(
			expect.objectContaining({
				tarea: 'con-candado',
				a: 'unida',
				quien: 'claude',
				salio: 'PR #14 MERGED',
			}),
		);

		const stale = probe(
			SYNC_PATH,
			`console.log(JSON.stringify(await m.apply([{ id: 'abierto', rev: 1, set: { ahora: 'x' }, texto: 't', salio: 's' }], process.env.CELEBRA_BOARD_DIR)));`,
			{ CELEBRA_BOARD_DIR: dir },
		);
		expect(stale[0].ok).toBe(false);
		expect(stale[0].resultado).toContain('rev 2');
	});
});

describe('board view sync endpoint', () => {
	it('accepts a POST only from its own origin with the page token, and checks the Host of every request', () => {
		const dir = makeBoard([]);
		const code = String.raw`
			import { request } from 'node:http';
			const calls = [];
			const server = await m.serveView(process.env.CELEBRA_BOARD_DIR, 0, {
				sync: async (opts) => { calls.push(opts); return { cambios: [], avisos: [], omitidas: [] }; },
			});
			const port = server.address().port;
			const send = (method, p, headers = {}, body) => new Promise((ok) => {
				const req = request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
					let data = ''; res.on('data', (c) => data += c); res.on('end', () => ok({ status: res.statusCode, data }));
				});
				if (body) req.write(body);
				req.end();
			});
			const page = await send('GET', '/');
			const token = page.data.match(/name="board-token" content="([a-f0-9]{64})"/)?.[1];
			const origin = 'http://127.0.0.1:' + port;
			const json = { 'content-type': 'application/json' };
			const body = JSON.stringify({ dryRun: true });
			const out = {
				page: page.status,
				hasToken: !!token,
				placeholderLeft: page.data.includes('__BOARD_TOKEN__'),
				noToken: (await send('POST', '/api/sync', { ...json, origin }, body)).status,
				wrongToken: (await send('POST', '/api/sync', { ...json, origin, 'x-board-token': 'f'.repeat(64) }, body)).status,
				noOrigin: (await send('POST', '/api/sync', { ...json, 'x-board-token': token }, body)).status,
				foreignOrigin: (await send('POST', '/api/sync', { ...json, origin: 'https://evil.example', 'x-board-token': token }, body)).status,
				formPost: (await send('POST', '/api/sync', { 'content-type': 'text/plain', origin, 'x-board-token': token }, body)).status,
				reboundHost: (await send('GET', '/', { host: 'evil.example:' + port })).status,
				otherPost: (await send('POST', '/api/board', { ...json, origin, 'x-board-token': token }, body)).status,
				ok: (await send('POST', '/api/sync', { ...json, origin, 'x-board-token': token }, body)).status,
				localhostOk: (await send('POST', '/api/sync', { ...json, host: 'localhost:' + port, origin: 'http://localhost:' + port, 'x-board-token': token }, '{}')).status,
				calls,
			};
			server.closeAllConnections();
			server.close();
			console.log(JSON.stringify(out));
			process.exit(0);
		`;
		const out = probe(SERVER_PATH, code, { CELEBRA_BOARD_DIR: dir });
		expect(out).toEqual({
			page: 200,
			hasToken: true,
			placeholderLeft: false,
			noToken: 403,
			wrongToken: 403,
			noOrigin: 403,
			foreignOrigin: 403,
			formPost: 403,
			reboundHost: 421,
			otherPost: 405,
			ok: 200,
			localhostOk: 200,
			calls: [{ dryRun: true }, { dryRun: false }],
		});
	});
});
