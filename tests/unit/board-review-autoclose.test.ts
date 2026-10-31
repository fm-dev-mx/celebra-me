import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const OLD = '2026-10-01T08:00:00Z';
const SHA = `3c35826${'b'.repeat(33)}`;

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ORIGIN: Json = {
	id: 'codigo',
	titulo: 'codigo',
	estado: 'en revision',
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'claude',
	requisitos: [],
	rev: 1,
	actualizado: OLD,
	pr: '#530',
	cierre: { resumen: 'Hecho.', comprobaciones: [], saltadas: [], pendientes: [], en: OLD },
};

const LISTS = ['--fallida=ninguna', '--riesgo=ninguno', '--duda=ninguna', '--excepcion=ninguna'];

/** A Gemini session's lock whose last heartbeat was at `latido`. */
const lock = (latido: string) => ({
	agente: 'gemini',
	sesion: 'local_gemini',
	desde: OLD,
	latido,
	titulo: 'f04 · T2 · revisión',
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-autoclose-'));
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

const read = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));
const patch = (dir: string, id: string, fields: Json) =>
	writeFileSync(
		path.join(dir, 'tareas', `${id}.json`),
		JSON.stringify({ ...read(dir, id), ...fields }),
	);

/** A board with round 1 of `codigo` under review, en curso and locked by a Gemini session. */
function reviewing(latido = OLD) {
	const dir = makeBoard([ORIGIN]);
	const opened = cli(
		dir,
		'review',
		'codigo',
		`--sha=${SHA}`,
		'--agente=gemini',
		'--coordinador',
		'--quien=claude',
	);
	expect(opened.status).toBe(0);
	patch(dir, 'codigo-revision', { estado: 'en curso', candado: lock(latido) });
	return dir;
}

const closeReview = (dir: string, ...extra: string[]) =>
	cli(
		dir,
		'close',
		'codigo-revision',
		'--coordinador',
		'--quien=claude',
		'--resumen=Revisado.',
		...LISTS,
		'--sha=3c35826',
		...extra,
	);

describe('board review autoclose (d274): close', () => {
	it.each(['aprobado', 'cambios', 'bloqueado'])(
		'leaves a review closed with %s hecha and frees its lock',
		(veredicto) => {
			const dir = reviewing(new Date().toISOString());
			const hallazgo =
				veredicto === 'aprobado' ? '--hallazgo=ninguno' : '--hallazgo=P2|a.mjs:1|Falta';
			const r = closeReview(dir, `--veredicto=${veredicto}`, hallazgo);
			expect(r.status).toBe(0);
			const t = read(dir, 'codigo-revision');
			expect(t.estado).toBe('hecha');
			expect(t.candado).toBeUndefined();
			expect(t.sesion).toEqual({
				id: 'local_gemini',
				agente: 'gemini',
				nombre: 'f04 · T2 · revisión',
			});
			expect(r.out).toContain('hecha');
		},
	);

	it('keeps a review without a verdict en curso with its lock', () => {
		const dir = reviewing();
		patch(dir, 'codigo-revision', { contrato: undefined });
		const r = cli(
			dir,
			'close',
			'codigo-revision',
			'--coordinador',
			'--quien=claude',
			'--resumen=A medias.',
		);
		expect(r.status).toBe(0);
		const t = read(dir, 'codigo-revision');
		expect(t.estado).toBe('en curso');
		expect(t.candado).toBeDefined();
	});

	it('leaves a code task as it was', () => {
		const dir = makeBoard([
			{ ...ORIGIN, estado: 'en curso', pr: undefined, cierre: undefined, candado: lock(OLD) },
		]);
		const r = cli(
			dir,
			'close',
			'codigo',
			'--coordinador',
			'--quien=claude',
			'--resumen=Hecho.',
		);
		expect(r.status).toBe(0);
		expect(read(dir, 'codigo')).toMatchObject({ estado: 'en curso', candado: lock(OLD) });
	});
});

describe('board review autoclose (d274): release --coordinador', () => {
	const release = (dir: string, id: string) =>
		cli(dir, 'release', id, '--agente=gemini', '--coordinador', '--quien=claude');

	it('frees a lock silent for 2 h once the review has its verdict, and the review is hecha', () => {
		const dir = reviewing();
		patch(dir, 'codigo-revision', {
			cierre: {
				resumen: 'Revisado.',
				comprobaciones: [],
				saltadas: [],
				pendientes: [],
				fallidas: [],
				riesgos: [],
				dudas: [],
				excepcion: [],
				en: OLD,
				resultado: { veredicto: 'aprobado', sha: '3c35826', hallazgos: [] },
			},
		});
		const r = release(dir, 'codigo-revision');
		expect(r.status).toBe(0);
		expect(r.out).toContain('codigo-revision libre');
		expect(read(dir, 'codigo-revision')).toMatchObject({ estado: 'hecha' });
		expect(read(dir, 'codigo-revision').candado).toBeUndefined();
	});

	it('frees a silent code task with a cierre back to pendiente', () => {
		const dir = makeBoard([
			{ ...ORIGIN, estado: 'en curso', pr: undefined, candado: lock(OLD) },
		]);
		const r = release(dir, 'codigo');
		expect(r.status).toBe(0);
		expect(read(dir, 'codigo')).toMatchObject({ estado: 'pendiente' });
		expect(read(dir, 'codigo').candado).toBeUndefined();
	});

	it('refuses a silent lock whose task has no valid cierre', () => {
		const dir = reviewing();
		const r = release(dir, 'codigo-revision');
		expect(r.status).not.toBe(0);
		expect(r.err).toContain(
			'codigo-revision no tiene un cierre válido (Falta el resumen de cierre)',
		);
		expect(r.err).toContain('solo se suelta después de «close»');
		expect(read(dir, 'codigo-revision').candado).toEqual(lock(OLD));
	});

	it('still asks for the session of a lock with a recent heartbeat', () => {
		const recent = new Date(Date.now() - 30 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
		const dir = makeBoard([
			{ ...ORIGIN, estado: 'en curso', pr: undefined, candado: lock(recent) },
		]);
		const r = release(dir, 'codigo');
		expect(r.status).not.toBe(0);
		expect(r.err).toContain('el candado pertenece a otra sesión');
		expect(read(dir, 'codigo').candado).toEqual(lock(recent));
	});

	it('needs --coordinador to free a silent lock', () => {
		const dir = makeBoard([
			{ ...ORIGIN, estado: 'en curso', pr: undefined, candado: lock(OLD) },
		]);
		const r = cli(dir, 'release', 'codigo', '--agente=gemini');
		expect(r.status).not.toBe(0);
		expect(r.err).toContain('el candado pertenece a otra sesión');
	});
});
