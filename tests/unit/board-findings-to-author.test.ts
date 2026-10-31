import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const MODULE = (name: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', name)).href;
const NOW = '2026-10-24T20:00:00Z';
const SHA = `3c35826${'b'.repeat(33)}`;

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs `code` with `next` and `findings` imported and returns what it prints as JSON. */
function probe(code: string) {
	const src = `const [next, findings] = await Promise.all(process.argv.slice(1).map((u) => import(u))); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, MODULE('next.mjs'), MODULE('findings.mjs')],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const json = (x: unknown) => JSON.stringify(x);

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'claude',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

const SESSION = { id: 'local_abc', agente: 'claude', nombre: 'f05 · T1 · codigo' };
// d255: `review` needs the origin's closing summary.
const ORIGIN = task('codigo', {
	num: 1,
	estado: 'en revision',
	pr: '#530',
	sesion: SESSION,
	cierre: { resumen: 'Hecho.', comprobaciones: [], saltadas: [], pendientes: [], en: NOW },
});

/** A closed review round of `codigo` with `veredicto` and its findings. */
function round(veredicto: string, hallazgos: Json[] = []): Json {
	return task('codigo-revision', {
		num: 2,
		estado: 'hecha',
		agente: 'gemini',
		origen: 'codigo',
		revisionSha: SHA,
		cierre: { resumen: 'Revisado.', en: NOW, resultado: { veredicto, sha: SHA, hallazgos } },
	});
}

const EMPTY_LISTS = [
	'--fallida=ninguna',
	'--riesgo=ninguno',
	'--duda=ninguna',
	'--excepcion=ninguna',
];

const FINDING = { p: 'P2', archivo: 'scripts/board/next.mjs:199', texto: 'Falta la prueba' };

describe('board findings to the author (d251): model', () => {
	it('builds the message only for a round that asks for changes and has a known author', () => {
		const board = (r: Json, origin: Json = ORIGIN) => ({ tareas: [origin, r], bitacora: [] });
		const r = probe(`
			const b = ${json(board(round('cambios', [FINDING])))};
			const notice = findings.findingsNotice(b.tareas[1], b);
			console.log(JSON.stringify({
				notice,
				row: findings.findingsRow(notice, 'm1', '${NOW}'),
				aprobado: findings.findingsNotice(${json(round('aprobado'))}, b),
				sinAutor: findings.findingsNotice(${json(round('cambios'))}, ${json(board(round('cambios'), { ...ORIGIN, agente: 'cualquiera', sesion: undefined }))}),
				vacio: findings.findingsNotice(${json(round('cambios'))}, b).texto,
			}));
		`);
		expect(r.notice).toEqual({
			tarea: 'codigo',
			de: 'gemini',
			para: 'claude',
			texto: 'T2 (vuelta 1) pide cambios en T1 (#530@3c35826) para la sesión «f05 · T1 · codigo»: P2 scripts/board/next.mjs:199 Falta la prueba',
			revision: 'codigo-revision',
			sesion: 'local_abc',
		});
		expect(r.row).toEqual({
			tarea: 'codigo',
			en: NOW,
			quien: 'gemini',
			mensaje: {
				id: 'm1',
				para: 'claude',
				texto: r.notice.texto,
				revision: 'codigo-revision',
				sesion: 'local_abc',
			},
		});
		expect(r.aprobado).toBeNull();
		expect(r.sinAutor).toBeNull();
		expect(r.vacio).toContain(': sin hallazgos escritos, vea el cierre de la revisión');
	});

	it('swaps «Pasar los hallazgos» for «Avisar al autor» once the round sent them (d269)', () => {
		const sent = {
			tarea: 'codigo',
			en: NOW,
			mensaje: { id: 'm1', para: 'claude', texto: 'x', revision: 'codigo-revision' },
		};
		const r = probe(`
			const tareas = ${json([ORIGIN, round('cambios', [FINDING])])};
			const tipos = (bitacora) => next.coordinatorItems({ tareas, bitacora }).map((i) => i.tipo + ': ' + i.texto);
			console.log(JSON.stringify({ antes: tipos([]), despues: tipos([${json(sent)}]) }));
		`);
		expect(r.antes).toEqual(['hallazgos: Pasar los hallazgos de T2 al autor de T1 (PR #530)']);
		expect(r.despues).toEqual([
			'avisar: Avisar al autor de T1 (PR #530): T2 pidió cambios en 3c35826 y el PR sigue en ese SHA (SHA del PR sin comprobar) · sesión «f05 · T1 · codigo»',
		]);
	});

	it('keeps «Avisar al autor» while the PR head is the round SHA and drops it after a new push (d269)', () => {
		const sent = {
			tarea: 'codigo',
			en: NOW,
			mensaje: { id: 'm1', para: 'claude', texto: 'x', revision: 'codigo-revision' },
		};
		const pr = (headRefOid: string) => [
			{ number: 530, headRefOid, headRefName: 'feat/codigo', title: 'Código' },
		];
		const r = probe(`
			const board = { tareas: ${json([{ ...ORIGIN, rama: 'feat/codigo' }, round('cambios', [FINDING])])}, bitacora: [${json(sent)}] };
			const items = (prs) => next.coordinatorItems(board, { prs }).map((i) => i.tipo + ': ' + i.texto);
			const approved = { ...board, tareas: [board.tareas[0], ${json(round('aprobado'))}] };
			console.log(JSON.stringify({
				igual: items(${json(pr(SHA))}),
				nuevo: items(${json(pr('d'.repeat(40)))}),
				aprobado: next.coordinatorItems(approved, { prs: ${json(pr(SHA))} }).map((i) => i.tipo),
			}));
		`);
		expect(r.igual).toEqual([
			'avisar: Avisar al autor de T1 (PR #530): T2 pidió cambios en 3c35826 y el PR sigue en ese SHA · sesión «f05 · T1 · codigo»',
		]);
		expect(r.nuevo).toEqual([
			'vuelta: Nueva vuelta de revisión: T1 (PR #530) cambió de 3c35826 a ddddddd',
		]);
		expect(r.aprobado).toEqual(['unir']);
	});
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-findings-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'answers.json'), '{}');
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const { id, ...doc } of tareas)
		writeFileSync(path.join(dir, 'tareas', `${id}.json`), JSON.stringify(doc));
	return dir;
}

function cli(dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			INIT_CWD: ROOT,
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
			CLAUDE_CODE_HOST_SESSION_ID: '',
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const messages = (dir: string) =>
	readdirSync(path.join(dir, 'bitacora'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.trim()
				.split('\n'),
		)
		.map((line) => JSON.parse(line))
		.filter((row) => row.mensaje);

describe('board findings to the author (d251): close', () => {
	it('sends the findings of a review closed with cambios to the author inbox once', () => {
		const dir = makeBoard([ORIGIN]);
		expect(
			cli(
				dir,
				'review',
				'codigo',
				`--sha=${SHA}`,
				'--agente=gemini',
				'--coordinador',
				'--quien=claude',
			).status,
		).toBe(0);
		const close = () =>
			cli(
				dir,
				'close',
				'codigo-revision',
				'--coordinador',
				'--quien=claude',
				'--resumen=Revisado.',
				...EMPTY_LISTS,
				'--veredicto=cambios',
				'--sha=3c35826',
				'--hallazgo=P2|scripts/board/next.mjs:199|Falta la prueba',
			);
		const first = close();
		expect(first.status).toBe(0);
		expect(first.out).toContain(
			'hallazgos enviados a claude sobre codigo (pnpm board inbox --agente=claude)',
		);
		expect(first.out.trim().split('\n').at(-1)).toContain('siguiente: corregir');

		const inbox = cli(dir, 'inbox', '--agente=claude');
		expect(inbox.out).toContain('gemini → claude sobre T1: T2 (vuelta 1) pide cambios en T1');
		expect(inbox.out).toContain('P2 scripts/board/next.mjs:199 Falta la prueba');

		// Closing again with the same findings writes no second message.
		expect(close().out).not.toContain('hallazgos enviados');
		expect(messages(dir)).toHaveLength(1);
		expect(cli(dir, 'inbox', '--agente=claude').out).toContain('Sin mensajes nuevos');
	});

	it('sends nothing for an approved round', () => {
		const dir = makeBoard([ORIGIN]);
		cli(
			dir,
			'review',
			'codigo',
			`--sha=${SHA}`,
			'--agente=gemini',
			'--coordinador',
			'--quien=claude',
		);
		const ok = cli(
			dir,
			'close',
			'codigo-revision',
			'--coordinador',
			'--quien=claude',
			'--resumen=Revisado.',
			...EMPTY_LISTS,
			'--veredicto=aprobado',
			'--sha=3c35826',
			'--hallazgo=ninguno',
		);
		expect(ok.status).toBe(0);
		expect(ok.out).not.toContain('hallazgos enviados');
		expect(cli(dir, 'inbox', '--agente=claude').out).toContain('Sin mensajes nuevos');
	});
});

describe('board findings to the author (d251): view', () => {
	it('serves every board module a served module imports', () => {
		const board = path.join(ROOT, 'scripts', 'board');
		const server = readFileSync(path.join(board, 'view-server.mjs'), 'utf8');
		const served = [...server.matchAll(/'\/([\w-]+\.mjs)'/g)].map((m) => m[1]);
		const imported = served.flatMap((f) =>
			[
				...readFileSync(path.join(board, f), 'utf8').matchAll(/from '\.\/([\w-]+\.mjs)'/g),
			].map((m) => m[1]),
		);
		expect(served).toContain('findings.mjs');
		expect(imported.filter((f) => !served.includes(f))).toEqual([]);
	});
});
