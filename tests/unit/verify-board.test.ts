import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'verify-board.mjs');
const NOW = '2026-10-20T20:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

function task(id: string, fields: Json): Json {
	return {
		id,
		titulo: id,
		estado: 'en curso',
		urgencia: 'normal',
		actor: 'sesion',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeExport(
	tareas: Json[],
	extra: { sesiones?: Json[]; decisiones?: Json[]; archivo?: Json[] } = {},
) {
	const dir = mkdtempSync(path.join(tmpdir(), 'verify-board-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const [index, t] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${t.id}.json`),
			JSON.stringify({ num: index + 1, ...t }),
		);
	if (extra.decisiones) {
		mkdirSync(path.join(dir, 'decisiones'));
		for (const d of extra.decisiones)
			writeFileSync(path.join(dir, 'decisiones', `${d.id}.json`), JSON.stringify(d));
	}
	if (extra.archivo) {
		mkdirSync(path.join(dir, 'archivo'));
		for (const a of extra.archivo)
			writeFileSync(path.join(dir, 'archivo', `${a.id}.json`), JSON.stringify(a));
	}
	if (extra.sesiones)
		writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify(extra.sesiones));
	return dir;
}

function verify(dir: string, answers: Record<string, unknown>) {
	const fixture = path.join(dir, 'answers.json');
	writeFileSync(
		fixture,
		JSON.stringify({
			'gh pr list --state open --json number,headRefName,title --limit 100': '[]',
			'git worktree list --porcelain': '',
			...answers,
		}),
	);
	const result = runCommand(process.execPath, [SCRIPT_PATH, dir, '--json'], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_COMMAND_FIXTURE: fixture, INIT_CWD: ROOT }),
	});
	return { status: result.status, report: JSON.parse(result.stdout) };
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('board:verify', () => {
	it.each([
		'gh api repos/o/r/pulls/1 --raw-field title=changed',
		'curl -s --output audit-output.txt https://example.invalid',
		'gh pr view 1 --json state --web',
		'git ls-remote origin refs/heads/x;whoami',
		'git -c core.sshCommand=evil ls-remote origin refs/heads/x',
	])('refuses stored command side effects: %s', (cmd) => {
		const dir = makeExport([task('unsafe', { chequeo: { cmd } })]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('RECHAZADO');
	});

	it('keeps failed and malformed checks UNVERIFIED, even when stdout looks successful', () => {
		const dir = makeExport([
			task('failed', { pr: 1, estado: 'hecha' }),
			task('invalid', { pr: 2 }),
		]);
		const { report } = verify(dir, {
			'gh pr view 1 --json state': {
				ok: false,
				output: '{"state":"MERGED"}',
				error: 'timeout',
			},
			'gh pr view 2 --json state': 'not-json',
			'gh pr list --state open --json number,headRefName,title --limit 100': 'not-json',
			'git worktree list --porcelain': { ok: false, output: '', error: 'timeout' },
		});
		expect(report.filas.map((r: Json) => r.veredicto)).toEqual(['UNVERIFIED', 'UNVERIFIED']);
		expect(report.comprobar).toEqual([]);
		expect(report.cobertura).toEqual({ prs: 'UNVERIFIED', ramas: 'UNVERIFIED' });
	});

	it('accepts a structured PR check without an arbitrary shell command', () => {
		const dir = makeExport([task('structured', { chequeo: { tipo: 'pr', pr: 3 } })]);
		expect(
			verify(dir, { 'gh pr view 3 --json state': '{"state":"MERGED"}' }).report.filas[0]
				.veredicto,
		).toContain('CUMPLE');
	});
	it('does not certify a review after the PR head changes', () => {
		const dir = makeExport([
			task('origin-revision', {
				origen: 'origin',
				pr: 4,
				estado: 'hecha',
				revisionSha: 'a'.repeat(40),
			}),
		]);
		const { report } = verify(dir, {
			'gh pr view 4 --json headRefOid': JSON.stringify({ headRefOid: 'b'.repeat(40) }),
		});
		expect(report.filas[0].veredicto).toBe('NO CUMPLE');
		expect(report.comprobar).toEqual([]);
	});
	it('reports dependency cycles instead of treating the queue as healthy', () => {
		const dir = makeExport([
			task('a', { requisitos: [{ tipo: 'tarea', ref: 'b' }] }),
			task('b', { requisitos: [{ tipo: 'tarea', ref: 'a' }] }),
		]);
		expect(verify(dir, {}).report.inconsistencias).toEqual(
			expect.arrayContaining([
				{ id: 'a', msg: 'ciclo de requisitos' },
				{ id: 'b', msg: 'ciclo de requisitos' },
			]),
		);
	});
	it('derives the implicit check from pr and proposes comprobada for a merged «unida» task', () => {
		const dir = makeExport([
			task('olivia-gallery', { estado: 'unida', pr: '#398', rama: 'fix/olivia-gallery' }),
		]);
		const { status, report } = verify(dir, {
			'gh pr view 398 --json state': '{"state":"MERGED"}',
		});
		expect(status).toBe(0);
		expect(report.filas[0]).toMatchObject({
			veredicto: 'CUMPLE → comprobada',
			implicito: true,
		});
		expect(report.comprobar).toEqual([
			{
				id: 'olivia-gallery',
				evidencia: { cmd: 'gh pr view 398 --json state', salio: '{"state":"MERGED"}' },
			},
		]);
	});

	it('falls back to git ls-remote for a branch without PR', () => {
		const dir = makeExport([task('guest-slug', { rama: 'feat/guest-slug' })]);
		const ref = 'abc123\trefs/heads/feat/guest-slug';
		const { report } = verify(dir, { 'git ls-remote origin refs/heads/feat/guest-slug': ref });
		expect(report.filas[0]).toMatchObject({
			veredicto: 'CUMPLE (¿ya está unida?)',
			implicito: true,
		});
		expect(report.comprobar).toEqual([]);
	});

	it('reports a task with neither chequeo, pr nor rama as SIN CHEQUEO', () => {
		const dir = makeExport([task('suelta', {})]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('SIN CHEQUEO');
	});

	it('refuses an explicit chequeo outside the read-only list', () => {
		const dir = makeExport([task('mala', { chequeo: { cmd: 'git push origin develop' } })]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('RECHAZADO');
	});

	it('lists open PRs and worktree branches that no task claims', () => {
		const dir = makeExport([task('olivia-gallery', { pr: 398 })]);
		const { report } = verify(dir, {
			'gh pr view 398 --json state': '{"state":"OPEN"}',
			'gh pr list --state open --json number,headRefName,title --limit 100': JSON.stringify([
				{ number: 398, headRefName: 'fix/olivia-gallery', title: 'Olivia' },
				{ number: 401, headRefName: 'feat/guest-slug', title: 'Guest link slug' },
			]),
			'git worktree list --porcelain': [
				'worktree D:/code/celebra-me',
				'branch refs/heads/develop',
				'',
				'worktree D:/code/wt/a',
				'branch refs/heads/feat/guest-slug',
				'',
				'worktree D:/code/wt/b',
				'branch refs/heads/chore/sin-tarea',
			].join('\n'),
		});
		expect(report.filas[0].veredicto).toBe('NO CUMPLE');
		expect(report.prsSinTarea).toEqual([
			{ pr: 401, rama: 'feat/guest-slug', titulo: 'Guest link slug' },
		]);
		expect(report.ramasSinTarea).toEqual(['chore/sin-tarea']);
	});

	it('flags open tasks whose session is archived', () => {
		const dir = makeExport(
			[
				task('america-footer', { sesion: { id: 'local_47f9', nombre: 'América' } }),
				task('viva', { rama: 'fix/viva' }),
			],
			{
				sesiones: [
					{ id: 'local_47f9', archivada: true },
					{ id: 'local_1', rama: 'fix/viva', archivada: false },
				],
			},
		);
		expect(verify(dir, {}).report.sesionArchivada).toEqual([
			{ id: 'america-footer', sesion: 'local_47f9', nombre: 'América' },
		]);
	});

	it('fails on inconsistencies and warns on id/branch and decision drift', () => {
		const dir = makeExport(
			[
				task('cerrada', { estado: 'comprobada', evidencia: {} }),
				task('otro-id', { rama: 'fix/rama-real', rev: 0 }),
				task('vieja', { espera: 'usted', urgencia: 'ya' }),
				task('espera', {
					requisitos: [
						{ tipo: 'tarea', ref: 'archivada' },
						{ tipo: 'decision', ref: 'd404' },
					],
				}),
			],
			{
				decisiones: [
					{ id: 'd001', vigente: false },
					{ id: 'd002', reemplaza: 'd999' },
				],
			},
		);
		const { status, report } = verify(dir, {});
		expect(status).toBe(1);
		expect(report.inconsistencias).toEqual(
			expect.arrayContaining([
				{ id: 'cerrada', msg: 'comprobada sin evidencia' },
				{ id: 'otro-id', msg: 'rev debe ser un entero desde 1' },
				{ id: 'vieja', msg: 'urgencia debe ser urgente/alta/normal/baja' },
				{ id: 'vieja', msg: 'espera y deps ya no existen: use requisitos' },
				{ id: 'd002', msg: 'reemplaza a una decisión inexistente: d999' },
			]),
		);
		expect(report.avisos).toEqual(
			expect.arrayContaining([
				{ id: 'otro-id', msg: 'id distinto de la rama sin prefijo (rama-real)' },
				{ id: 'd002', msg: 'decisión sin vigente: true|false' },
				{ id: 'espera', msg: 'requisito a una tarea fuera del tablero: archivada' },
				{ id: 'espera', msg: 'requisito a una decisión inexistente: d404' },
			]),
		);
	});

	it('warns about every open task without a planned lane, and ready ones sharing one (d177)', () => {
		const ready = (id: string, fields: Json = {}) =>
			task(id, {
				estado: 'pendiente',
				prompt: `Task ${id}.
DECISIONES
- none`,
				...fields,
			});
		const dir = makeExport(
			[
				ready('sin-carril', { num: 30 }),
				ready('uno', { carrilPlaneado: 'f10-libre' }),
				ready('dos', { carrilPlaneado: 'f10-libre' }),
				ready('sola', { carrilPlaneado: 'f12-release' }),
				ready('rara', { carrilPlaneado: 'f13-nuevo' }),
				ready('del-coordinador', { actor: 'coordinador' }),
				ready('del-dueno', { actor: 'dueno' }),
				// The lane its lock holds is where it runs.
				ready('apartada', { candado: { agente: 'codex', desde: NOW, carril: 'f09-docs' } }),
				task('en-curso', {}),
				ready('bloqueada', { requisitos: [{ tipo: 'dueno', ref: 'Elegir' }] }),
				// Reviews run read-only in Integration; finished tasks no longer run.
				ready('uno-revision', { requisitos: [{ tipo: 'revision', ref: 'uno' }] }),
				task('terminada', { estado: 'hecha' }),
				// Ready because its prerequisite is archived as done, so it needs a lane too.
				ready('tras-archivada', { requisitos: [{ tipo: 'tarea', ref: 'archivada' }] }),
			],
			{ archivo: [{ id: 'archivada', estado: 'hecha' }] },
		);
		const { report } = verify(dir, {});
		const lanes = report.avisos.filter((a: { msg: string }) => /carril/.test(a.msg));
		// The export numbers every task, so each warning names its T<n>.
		const missing = (id: string, num = String.raw`T\d+`) => ({
			id,
			msg: expect.stringMatching(
				new RegExp(
					`^${num} sin carril planeado: pnpm board plan ${id} --rev=1 --carril=<carril> --coordinador$`,
				),
			),
		});
		const shared = 'carril f10-libre planeado para 2 tareas listas: ';
		expect(lanes).toHaveLength(8);
		expect(lanes).toEqual(
			expect.arrayContaining([
				missing('sin-carril', 'T30'),
				missing('del-coordinador'),
				missing('del-dueno'),
				missing('en-curso'),
				missing('bloqueada'),
				missing('tras-archivada'),
				{ id: 'uno', msg: expect.stringContaining(shared) },
				{ id: 'dos', msg: expect.stringContaining(shared) },
			]),
		);
		expect(report.inconsistencias).toContainEqual({
			id: 'rara',
			msg: 'carril planeado no canónico: f13-nuevo',
		});
	});
});
