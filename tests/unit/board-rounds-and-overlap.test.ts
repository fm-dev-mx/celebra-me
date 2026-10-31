import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const SHA = 'a'.repeat(40);
const OLD = 'c'.repeat(40);
const EN = '2026-10-26T03:00:00Z';
const REPORT = '.agent/tmp/reports/t298-pr582-review/review.md';
const CIERRE = {
	resumen: 'Hecho',
	comprobaciones: [],
	saltadas: [],
	pendientes: [],
	en: '2026-10-25T00:00:00Z',
};

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const temp = (prefix: string) => {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
};

/** A board directory with these tasks and bitácora rows. */
function makeBoard(tareas: Json[], bitacora: Json[] = []) {
	const dir = temp('board-rounds-');
	mkdirSync(path.join(dir, 'tareas'));
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	if (bitacora.length) {
		mkdirSync(path.join(dir, 'bitacora'));
		writeFileSync(
			path.join(dir, 'bitacora', '2026-10-26.jsonl'),
			bitacora.map((r) => JSON.stringify(r)).join('\n') + '\n',
		);
	}
	return dir;
}

function board(dir: string, ...args: string[]) {
	const r = runCommand(process.execPath, [BOARD, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }),
	});
	return { status: r.status, out: String(r.stdout), err: String(r.stderr) };
}

const read = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const logRows = (dir: string) =>
	readdirSync(path.join(dir, 'bitacora'))
		.filter((f) => f.endsWith('.jsonl'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l)),
		);

/** Call `fn` exported by board module `file` with JSON `args`; its JSON result comes back. */
function call(file: string, fn: string, ...args: unknown[]) {
	const href = pathToFileURL(path.join(ROOT, 'scripts', 'board', file)).href;
	const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m[${JSON.stringify(fn)}](...${JSON.stringify(args)}) ?? null))`;
	const r = runCommand(process.execPath, ['--input-type=module', '-e', src, href], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (r.status !== 0) throw new Error(String(r.stderr));
	return JSON.parse(String(r.stdout));
}

const origin = (fields: Json = {}) => ({
	id: 'codigo',
	num: 1,
	titulo: 'Código',
	estado: 'en revision',
	agente: 'codex',
	pr: '#10',
	urgencia: 'normal',
	actor: 'sesion',
	requisitos: [],
	rev: 1,
	cierre: CIERRE,
	...fields,
});

const round = (id: string, n: number, fields: Json = {}) => ({
	id,
	num: 10 + n,
	titulo: `Vuelta ${n}`,
	origen: 'codigo',
	revisionSha: OLD,
	vuelta: n,
	estado: 'en curso',
	agente: 'claude',
	urgencia: 'normal',
	actor: 'sesion',
	requisitos: [],
	rev: 1,
	...fields,
});

const message = (tarea: string, para: string, texto: string, id: string, quien = 'codex') => ({
	tarea,
	en: EN,
	quien,
	mensaje: { id, para, texto },
});

describe('d291 review rounds without a verdict', () => {
	it('reviews the whole PR after a round replaced without a verdict and carries what it left', () => {
		const dir = makeBoard(
			[origin(), round('codigo-revision', 1)],
			[
				message(
					'codigo-revision',
					'coordinador',
					`En ${OLD.slice(0, 7)} confirmé 3 P2: ratchet SCSS 7>4. Informe: ${REPORT}.`,
					'm1',
				),
			],
		);
		const r = runCommand(
			process.execPath,
			[BOARD, 'review', 'codigo', `--sha=${SHA}`, '--coordinador', '--quien=claude'],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }) },
		);
		expect(r.status).toBe(0);
		const next = read(dir, 'codigo-revision-2');
		expect(next.prompt).toContain('SEGUNDA VUELTA');
		expect(next.prompt).not.toContain('diff incremental');
		expect(next.prompt).not.toContain(`git diff ${OLD}..${SHA}`);
		expect(next.prompt).toContain('T11 terminó sin veredicto (cancelada o reemplazada)');
		expect(next.prompt).toContain('2. Revise el diff completo del PR en aaaaaaa.');
		expect(next.prompt).toContain('- T11 · codex → coordinador: En ccccccc confirmé 3 P2');
		expect(next.prompt).toContain(`Informe: ${REPORT} (en Integración; léalo si existe).`);
		expect(next.prompt).toContain('- d291: la vuelta anterior no dejó veredicto');
		expect(read(dir, 'codigo-revision').estado).toBe('cancelada');
	});

	it('walks back over every round since the last verdict and stops at an answered one', () => {
		const answered = round('codigo-revision', 1, {
			estado: 'hecha',
			cierre: { ...CIERRE, resultado: { veredicto: 'cambios', sha: OLD, hallazgos: [] } },
		});
		const cancelled = round('codigo-revision-2', 2, {
			estado: 'cancelada',
			cierre: {
				...CIERRE,
				resumen: 'Reemplazada por la vuelta 3',
				resultado: {
					hallazgos: [{ p: 'P2', archivo: 'src/a.ts:4', texto: 'falta prueba' }],
				},
			},
		});
		const open = round('codigo-revision-3', 3);
		const bitacora = [message('codigo-revision-3', 'dueno', '¿Autoriza otra vuelta?', 'm3')];
		const left = call('rounds.mjs', 'leftByUnanswered', 'codigo', {
			tareas: [origin(), answered, cancelled, open],
			bitacora,
		});
		expect(left).toEqual({
			vueltas: ['T12', 'T13'],
			notas: [
				'T12 · hallazgo: P2 src/a.ts:4 falta prueba',
				'T13 · codex → dueno: ¿Autoriza otra vuelta?',
			],
			informes: [],
		});
		expect(
			call('rounds.mjs', 'leftByUnanswered', 'codigo', { tareas: [origin(), answered] }),
		).toBeNull();
		expect(call('rounds.mjs', 'leftByUnanswered', 'codigo', { tareas: [origin()] })).toBeNull();
	});

	it('keeps only the newest notes of a long chain and counts the dropped ones', () => {
		const open = round('codigo-revision', 1);
		const bitacora = Array.from({ length: 25 }, (_, i) => ({
			...message('codigo-revision', 'coordinador', `nota ${i}`, `m${i}`),
			en: `2026-10-26T10:${String(i).padStart(2, '0')}:00Z`,
		}));
		const { notas } = call('rounds.mjs', 'leftByUnanswered', 'codigo', {
			tareas: [origin(), open],
			bitacora,
		});
		expect(notas).toHaveLength(20);
		expect(notas[0]).toBe('… 6 notas anteriores omitidas');
		expect(notas[1]).toBe('T11 · codex → coordinador: nota 6');
		expect(notas[19]).toBe('T11 · codex → coordinador: nota 24');
	});
});

describe('d291 handled messages', () => {
	const tareas = [origin({ estado: 'en curso' })];
	const rows = [
		message('codigo', 'dueno', 'Primera pregunta', 'q1'),
		message('codigo', 'dueno', 'Segunda pregunta', 'q2'),
		message('codigo', 'coordinador', 'Aviso al coordinador', 'c1'),
	];

	it('takes answered owner messages out of «Le toca a usted» with one bitácora row', () => {
		const dir = makeBoard(tareas, rows);
		expect(board(dir, 'list').out).toContain(
			'Mensaje: codex → dueno sobre T1: Primera pregunta',
		);
		const one = board(
			dir,
			'atendido',
			'T1',
			'--para=dueno',
			'--mensaje=q1',
			'--coordinador',
			'--quien=claude',
		);
		expect(one.status).toBe(0);
		expect(one.out).toContain('1 mensaje para dueno sobre T1 atendido: q1');
		let list = board(dir, 'list').out;
		expect(list).not.toContain('Primera pregunta');
		expect(list).toContain('Segunda pregunta');
		expect(board(dir, 'atendido', 'codigo', '--para=dueno', '--quien=dueno').status).toBe(0);
		list = board(dir, 'list').out;
		expect(list).not.toContain('Segunda pregunta');
		expect(list).toContain('Aviso al coordinador');
		expect(
			board(
				dir,
				'atendido',
				'codigo',
				'--para=coordinador',
				'--coordinador',
				'--quien=claude',
			).status,
		).toBe(0);
		expect(board(dir, 'list').out).not.toContain('Aviso al coordinador');
		const marks = logRows(dir).filter((r) => r.atendido);
		expect(marks).toEqual([
			expect.objectContaining({
				tarea: 'codigo',
				quien: 'claude',
				atendido: { para: 'dueno', mensajes: ['q1'] },
			}),
			expect.objectContaining({
				quien: 'dueno',
				atendido: { para: 'dueno', mensajes: ['q2'] },
			}),
			expect.objectContaining({ atendido: { para: 'coordinador', mensajes: ['c1'] } }),
		]);
		// inbox --todos still lists them; the verifier accepts the rows and asks for no new rev.
		expect(board(dir, 'inbox', '--agente=dueno', '--todos').out).toContain('Primera pregunta');
		const verify = JSON.parse(board(dir, 'verify', '--json').out);
		expect(JSON.stringify(verify.inconsistencias ?? [])).not.toContain('bitácora');
	});

	it('refuses agents, unknown ids, nothing to mark and a row without a writer', () => {
		const dir = makeBoard(tareas, rows);
		expect(
			board(dir, 'atendido', 'codigo', '--para=codex', '--coordinador', '--quien=claude').err,
		).toContain('un agente lee los suyos con pnpm board inbox');
		expect(
			board(
				dir,
				'atendido',
				'codigo',
				'--para=dueno',
				'--mensaje=zz',
				'--coordinador',
				'--quien=claude',
			).err,
		).toContain('zz no es un mensaje sin atender para dueno sobre T1; los hay: q1, q2');
		expect(board(dir, 'atendido', 'codigo', '--para=dueno').err).toContain(
			'falta quién escribe',
		);
		expect(
			board(dir, 'atendido', 'codigo', '--para=dueno', '--coordinador', '--quien=claude')
				.status,
		).toBe(0);
		expect(
			board(dir, 'atendido', 'codigo', '--para=dueno', '--coordinador', '--quien=claude').err,
		).toContain('no hay mensajes sin atender para dueno sobre T1');
	});

	it('validates the atendido row shape and names it in the history', () => {
		const row = (atendido: unknown) => ({ tarea: 't', en: EN, quien: 'dueno', atendido });
		expect(call('model.mjs', 'logRowIssues', row({ para: 'dueno', mensajes: ['q1'] }))).toEqual(
			[],
		);
		expect(call('model.mjs', 'logRowIssues', row({ para: 'codex', mensajes: [] }))).toEqual([
			'atendido.para debe ser dueno|coordinador',
			'atendido.mensajes debe listar los id de los mensajes',
		]);
		expect(call('model.mjs', 'logChange', row({ para: 'dueno', mensajes: ['q1', 'q2'] }))).toBe(
			'atendido por dueno: 2 para dueno',
		);
	});
});

/** A Git repository with a base commit and branches `a`, `b` and `c` built by `edit` per branch. */
function repo(files: Record<string, Record<string, string>>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-overlap-'));
	const git = (...args: string[]) =>
		runCommand('git', args, { cwd: dir, env: sanitizeEnv({}) }).stdout.trim();
	git('init', '-b', 'develop');
	git('config', 'user.name', 'Fixture');
	git('config', 'user.email', 'fixture@example.invalid');
	git('config', 'commit.gpgsign', 'false');
	const commit = (content: Record<string, string>) => {
		for (const [file, text] of Object.entries(content)) {
			mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
			writeFileSync(path.join(dir, file), text);
			git('add', file);
		}
		git('-c', 'core.hooksPath=disabled-hooks', 'commit', '-m', 'fixture');
		return git('rev-parse', 'HEAD');
	};
	const heads: Record<string, string> = {};
	heads.base = commit(files.base);
	for (const name of Object.keys(files).filter((k) => k !== 'base')) {
		git('switch', '-q', '-c', name, heads.base);
		heads[name] = commit(files[name]);
	}
	return { dir, heads };
}

const BOARD_FILE = 'scripts/board/board.mjs';
const LINES = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].join('\n') + '\n';

describe('d270 board PRs wait only for a real merge-tree conflict (d291)', () => {
	// One repository for the block: afterEach removes only the board directories.
	let dir = '';
	let heads: Record<string, string> = {};
	beforeAll(() => {
		({ dir, heads } = repo({
			base: { [BOARD_FILE]: LINES },
			top: { [BOARD_FILE]: LINES.replace('uno', 'UNO') },
			bottom: { [BOARD_FILE]: LINES.replace('seis', 'SEIS') },
			clash: { [BOARD_FILE]: LINES.replace('uno', 'Uno!') },
		}));
	});
	afterAll(() => rmSync(dir, { recursive: true, force: true }));
	const merge = (a: string, b: string) => {
		const href = pathToFileURL(path.join(ROOT, 'scripts', 'board', 'overlap.mjs')).href;
		const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m.mergeConflicts(process.argv[2], process.argv[3])))`;
		return JSON.parse(
			runCommand(process.execPath, ['--input-type=module', '-e', src, href, a, b], {
				cwd: dir,
			}).stdout,
		);
	};

	it('tells a shared file from a real conflict with git merge-tree', () => {
		expect(merge(heads.top, heads.bottom)).toEqual({ estado: 'limpio', archivos: [] });
		expect(merge(heads.top, heads.clash)).toEqual({
			estado: 'conflicto',
			archivos: [BOARD_FILE],
		});
		expect(merge(heads.top, 'f'.repeat(40))).toEqual({ estado: 'sin-verificar', archivos: [] });
	});

	it('lets a PR that only shares files open, and holds it on a conflict, a full line or missing evidence', () => {
		const verdict = (others: Json[], ownFiles = [BOARD_FILE]) =>
			call('overlap.mjs', 'overlapVerdict', { ownFiles, others });
		const clean = { estado: 'limpio', archivos: [] };
		expect(verdict([], ['src/a.ts'])).toMatchObject({ aplica: false, puede: true });
		expect(verdict([{ number: 7, files: [BOARD_FILE], merge: clean }])).toEqual({
			aplica: true,
			puede: true,
			lineas: [`#7: sin conflicto (comparten ${BOARD_FILE})`],
		});
		expect(
			verdict([
				{
					number: 7,
					files: [BOARD_FILE],
					merge: { estado: 'conflicto', archivos: [BOARD_FILE] },
				},
			]),
		).toMatchObject({ puede: false, lineas: [`#7: conflicto real en ${BOARD_FILE}`] });
		expect(
			verdict([
				{
					number: 7,
					files: ['docs/core/coordinator-board.md'],
					merge: { estado: 'sin-verificar', archivos: [] },
				},
			]),
		).toMatchObject({ puede: false });
		const full = verdict([
			{ number: 7, files: ['scripts/board/next.mjs'], merge: clean },
			{ number: 8, files: ['.agent/rules/board.md'], merge: clean },
		]);
		expect(full.puede).toBe(false);
		expect(full.lineas[0]).toBe('ya hay 2 PR del tablero abiertos (#7, #8): espere su turno');
	});

	it('pnpm board solape reads the open PRs and exits 1 only while it must wait', () => {
		const boardDir = makeBoard([
			origin({
				id: 'tablero',
				estado: 'en curso',
				agente: 'claude',
				rama: 'feat/top',
				pr: undefined,
			}),
		]);
		const solape = (prs: Json[]) => {
			const src = `
				import cp from 'node:child_process';
				import { syncBuiltinESMExports } from 'node:module';
				import { pathToFileURL } from 'node:url';
				const exec = cp.execFileSync;
				cp.execFileSync = (cmd, args, opts) => cmd === 'gh' ? process.env.PRS : exec(cmd, args, opts);
				syncBuiltinESMExports();
				await import(pathToFileURL(process.argv[1]).href);
			`;
			const r = runCommand(
				process.execPath,
				[
					'--input-type=module',
					'-e',
					src,
					BOARD,
					'solape',
					'tablero',
					`--sha=${heads.top}`,
				],
				{
					cwd: dir,
					allowFailure: true,
					env: sanitizeEnv({ CELEBRA_BOARD_DIR: boardDir, PRS: JSON.stringify(prs) }),
				},
			);
			return { status: r.status, out: String(r.stdout), err: String(r.stderr) };
		};
		const pr = (number: number, head: string, files: string[]) => ({
			number,
			headRefOid: head,
			headRefName: `feat/${number}`,
			title: `PR ${number}`,
			files: files.map((p) => ({ path: p })),
		});
		const own = { ...pr(5, heads.top, [BOARD_FILE]), headRefName: 'feat/top' };
		const ok = solape([
			own,
			pr(7, heads.bottom, [BOARD_FILE]),
			pr(9, heads.clash, ['src/x.ts']),
		]);
		expect(ok.status).toBe(0);
		expect(ok.out).toContain('T1 (feat/top@');
		expect(ok.out).toContain('puede abrir su PR');
		expect(ok.out).toContain(`#7: sin conflicto (comparten ${BOARD_FILE})`);
		expect(ok.out).not.toContain('#9');
		const wait = solape([own, pr(8, heads.clash, [BOARD_FILE])]);
		expect(wait.status).toBe(1);
		expect(wait.out).toContain('espera');
		expect(wait.out).toContain(`#8: conflicto real en ${BOARD_FILE}`);
		const bad = solape([own, pr(6, 'not-a-sha', [BOARD_FILE])]);
		expect(bad.status).toBe(1);
		expect(bad.out).toContain('#6: UNVERIFIED');
	});
});
