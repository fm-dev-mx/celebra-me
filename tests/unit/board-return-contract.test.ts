import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const MODULE = (name: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', name)).href;
const NOW = '2026-10-24T20:00:00Z';
const SHA_A = 'a'.repeat(40);
const SHA_B = `3c35826${'b'.repeat(33)}`;

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs `code` with `model`, `next`, `format` and `cierre` (as `closing`) imported and returns what it prints as JSON. */
function probe(code: string) {
	const src = `const [model, next, format, closing] = await Promise.all(process.argv.slice(1).map((u) => import(u))); ${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			MODULE('model.mjs'),
			MODULE('next.mjs'),
			MODULE('format.mjs'),
			MODULE('cierre.mjs'),
		],
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

/** The cierre of a task under the full contract, without its resultado. */
const FULL = {
	resumen: 'Hecho.',
	comprobaciones: ['validate:changed'],
	saltadas: [],
	pendientes: [],
	fallidas: [],
	riesgos: [],
	dudas: [],
	excepcion: [],
	en: NOW,
};

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-return-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'answers.json'), '{}');
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [index, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: index + 1, ...doc }),
		);
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

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const EMPTY_LISTS = [
	'--fallida=ninguna',
	'--riesgo=ninguno',
	'--duda=ninguna',
	'--excepcion=ninguna',
];

describe('board return contract (T129): model', () => {
	it('asks the Handoff lists and the typed resultado only of tasks under contrato 2', () => {
		const r = probe(`
			const code = { id: 'c', estado: 'en revision', pr: '#530', contrato: 2 };
			const review = { id: 'c-revision', origen: 'c', revisionSha: '${SHA_B}', estado: 'hecha', contrato: 2 };
			const cierre = { resumen: 'Hecho.', comprobaciones: [], saltadas: [], pendientes: [], en: '${NOW}' };
			const issues = (t, c) => closing.cierreIssues({ ...t, cierre: c }, { tareas: [t] });
			console.log(JSON.stringify({
				old: issues({ ...code, contrato: 1 }, cierre),
				missing: issues(code, cierre),
				code: issues(code, { ...${json(FULL)}, resultado: { pr: '#530', sha: '${SHA_B}', nivel: 'ci' } }),
				badLevel: issues(code, { ...${json(FULL)}, resultado: { pr: '#530', sha: '${SHA_B}', nivel: 'todo' } }),
				review: issues(review, { ...${json(FULL)}, resultado: { veredicto: 'aprobado', sha: '3c35826', hallazgos: [] } }),
				wrongSha: issues(review, { ...${json(FULL)}, resultado: { veredicto: 'aprobado', sha: '${SHA_A}', hallazgos: [] } }),
				p1: issues(review, { ...${json(FULL)}, resultado: { veredicto: 'aprobado', sha: '3c35826', hallazgos: [{ p: 'P1', archivo: 'x.mjs:1', texto: 'roto' }] } }),
				badFinding: issues(review, { ...${json(FULL)}, resultado: { veredicto: 'cambios', sha: '3c35826', hallazgos: [{ p: 'P5', texto: 'x' }] } }),
				cancelled: issues({ ...code, estado: 'cancelada' }, ${json(FULL)}),
				shape: model.taskIssues({ id: 'x', titulo: 'x', urgencia: 'normal', actor: 'sesion', requisitos: [], rev: 1, actualizado: '${NOW}', contrato: 2, cierre }),
			}));`);
		expect(r.old).toEqual([]);
		expect(r.missing).toEqual([
			'falta cierre.fallidas (--fallida=… o --fallida=ninguna)',
			'falta cierre.riesgos (--riesgo=… o --riesgo=ninguna)',
			'falta cierre.dudas (--duda=… o --duda=ninguna)',
			'falta cierre.excepcion (--excepcion=… o --excepcion=ninguna)',
			'falta cierre.resultado del código (--sha, --nivel)',
		]);
		expect(r.code).toEqual([]);
		expect(r.badLevel).toEqual(['resultado.nivel debe ser validate:changed/type-check/ci']);
		expect(r.review).toEqual([]);
		expect(r.wrongSha).toEqual([`resultado.sha ${SHA_A} no es el SHA revisado (3c35826)`]);
		expect(r.p1).toEqual(['una revisión aprobada no tiene hallazgos P1']);
		expect(r.badFinding).toEqual([
			'hallazgo inválido: escriba --hallazgo="P0-P3|archivo|texto"',
		]);
		expect(r.cancelled).toEqual([]);
		// Other writes (sync, merged) never fail for a missing return: only close and «Archivar» ask for it.
		expect(r.shape).toEqual([]);
	});

	it('prints the one-line signal from the cierre', () => {
		const r = probe(`
			const board = { tareas: [{ id: 'sig', num: 9 }] };
			const review = { id: 'c-revision', num: 125, origen: 'c', pr: '#518', revisionSha: '${SHA_B}', estado: 'hecha',
				cierre: { resultado: { veredicto: 'aprobado', sha: '3c35826', hallazgos: [] } } };
			const changes = { ...review, cierre: { resultado: { veredicto: 'cambios', sha: '3c35826', hallazgos: [{ p: 'P2', archivo: 'a', texto: 'b' }] } } };
			const code = { id: 'c', num: 129, pr: '#530', estado: 'en revision', cierre: { resultado: { pr: '#530', sha: '${SHA_A}', nivel: 'ci' } } };
			const plain = { id: 'p', num: 3, estado: 'hecha', cierre: { pendientes: [{ texto: 'luego', tarea: 'sig' }] } };
			const cancelled = { id: 'x', num: 4, estado: 'cancelada', cierre: { resumen: 'Duplicada.' } };
			console.log(JSON.stringify([review, changes, code, plain, cancelled].map((t) => closing.signalLine(t, board))));`);
		expect(r).toEqual([
			'T125 · revision · aprobado · #518@3c35826 · 0 hallazgos · siguiente: unir',
			'T125 · revision · cambios · #518@3c35826 · 1 hallazgo · siguiente: corregir',
			'T129 · codigo · en revision · #530@aaaaaaa · nivel ci · siguiente: revisión cruzada',
			'T3 · hecha · siguiente: T9',
			'T4 · cancelada · Duplicada.',
		]);
	});

	it('marks the origin «lista para unir» only when the last round approved the current PR head', () => {
		const r = probe(`
			const origin = { id: 'c', estado: 'en revision', pr: '#530' };
			const round = (veredicto, sha = '${SHA_B}') => ({ id: 'c-revision', origen: 'c', revisionSha: sha, estado: 'hecha',
				cierre: { pendientes: [], resultado: { veredicto, sha: sha.slice(0, 7), hallazgos: [] } } });
			const ready = (r, prs) => Boolean(next.readyToMerge(origin, { tareas: [origin, r] }, prs));
			const head = (sha) => [{ number: 530, headRefOid: sha }];
			console.log(JSON.stringify({
				approved: ready(round('aprobado')),
				atHead: ready(round('aprobado'), head('${SHA_B}')),
				moved: ready(round('aprobado'), head('${SHA_A}')),
				changes: ready(round('cambios')),
				verdict: next.reviewVerdict(round('bloqueado')),
				chip: format.outcomeOf(round('cambios')),
				findings: format.findingsOf({ cierre: { resultado: { hallazgos: [{ p: 'P3' }, { p: 'P0' }, { p: 'P2' }] } } }).map((h) => h.p),
			}));`);
		expect(r).toEqual({
			approved: true,
			atHead: true,
			moved: false,
			changes: false,
			verdict: 'bloqueado',
			chip: { key: 'warn', label: 'Pide cambios' },
			findings: ['P0', 'P2', 'P3'],
		});
	});
});

describe('board return contract (T129): CLI', () => {
	it('refuses a close without the full return and prints the signal when complete', () => {
		const dir = makeBoard([
			task('codigo', { estado: 'en revision', pr: '#530', contrato: 2 }),
			task('vieja', { estado: 'hecha', pr: '#400', contrato: 1 }),
		]);
		const close = (id: string, ...args: string[]) =>
			cli(dir, 'close', id, '--coordinador', '--resumen=Hecho.', ...args);

		const missing = close('codigo');
		expect(missing.status).toBe(2);
		expect(missing.err).toContain('falta cierre.fallidas');
		expect(missing.err).toContain('falta cierre.resultado del código');
		expect(close('codigo', ...EMPTY_LISTS, `--sha=${SHA_A}`, '--nivel=todo').err).toContain(
			'resultado.nivel debe ser',
		);

		const ok = close(
			'codigo',
			...EMPTY_LISTS.filter((f) => !f.startsWith('--riesgo=')),
			'--riesgo=El CSS no se probó en Safari',
			`--sha=${SHA_A}`,
			'--nivel=ci',
		);
		expect(ok.status).toBe(0);
		expect(ok.out.trim().split('\n').at(-1)).toBe(
			'T1 · codigo · en revision · #530@aaaaaaa · nivel ci · siguiente: revisión cruzada',
		);
		expect(readTask(dir, 'codigo').cierre).toMatchObject({
			fallidas: [],
			riesgos: ['El CSS no se probó en Safari'],
			resultado: { pr: '#530', sha: SHA_A, nivel: 'ci' },
		});
		// A task opened before the contract keeps closing as it did.
		expect(close('vieja').status).toBe(0);
	});

	it('cancels a replaced review round with its cierre and closes a review with its verdict', () => {
		const dir = makeBoard([
			task('codigo', {
				estado: 'en revision',
				pr: '#530',
				contrato: 2,
				cierre: {
					resumen: 'ok',
					comprobaciones: [],
					saltadas: [],
					pendientes: [],
					en: NOW,
				},
			}),
		]);
		const review = (sha: string) =>
			cli(dir, 'review', 'codigo', `--sha=${sha}`, '--coordinador');
		expect(review(SHA_A).status).toBe(0);
		const second = review(SHA_B);
		expect(second.out).toContain('codigo-revision cancelada');
		const replaced = readTask(dir, 'codigo-revision');
		expect(replaced.estado).toBe('cancelada');
		expect(replaced.cierre.resumen).toBe(
			'Reemplazada por la vuelta 2 (3c35826): el PR cambió de aaaaaaa.',
		);
		expect(cli(dir, 'archive', 'codigo-revision', '--coordinador').status).toBe(0);

		const close = (...args: string[]) =>
			cli(
				dir,
				'close',
				'codigo-revision-2',
				'--coordinador',
				'--resumen=Revisado.',
				...EMPTY_LISTS,
				...args,
			);
		expect(close('--veredicto=aprobado', `--sha=${SHA_A}`, '--hallazgo=ninguno').err).toContain(
			'no es el SHA revisado',
		);
		expect(
			close('--veredicto=aprobado', '--sha=3c35826', '--hallazgo=P1|board.mjs:9|Rompe close')
				.err,
		).toContain('una revisión aprobada no tiene hallazgos P1');
		const ok = close(
			'--veredicto=aprobado',
			'--sha=3c35826',
			'--hallazgo=P3|view.html:1|Texto largo',
		);
		expect(ok.status).toBe(0);
		expect(ok.out.trim().split('\n').at(-1)).toBe(
			'T3 · revision · aprobado · #530@3c35826 · 1 hallazgo · siguiente: unir',
		);
		expect(readTask(dir, 'codigo-revision-2').cierre.resultado.hallazgos).toEqual([
			{ p: 'P3', archivo: 'view.html:1', texto: 'Texto largo' },
		]);
	});
});
