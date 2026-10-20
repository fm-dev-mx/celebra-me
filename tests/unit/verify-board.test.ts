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
	return { id, titulo: id, estado: 'en-curso', espera: '', rev: 1, actualizado: NOW, ...fields };
}

function makeExport(tareas: Json[], extra: { sesiones?: Json[]; decisiones?: Json[] } = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'verify-board-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const t of tareas)
		writeFileSync(path.join(dir, 'tareas', `${t.id}.json`), JSON.stringify(t));
	if (extra.decisiones) {
		mkdirSync(path.join(dir, 'decisiones'));
		for (const d of extra.decisiones)
			writeFileSync(path.join(dir, 'decisiones', `${d.id}.json`), JSON.stringify(d));
	}
	if (extra.sesiones)
		writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify(extra.sesiones));
	return dir;
}

function verify(dir: string, answers: Record<string, string>) {
	const fixture = path.join(dir, 'answers.json');
	writeFileSync(fixture, JSON.stringify(answers));
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
				{ id: 'd002', msg: 'reemplaza a una decisión inexistente: d999' },
			]),
		);
		expect(report.avisos).toEqual(
			expect.arrayContaining([
				{ id: 'otro-id', msg: 'id distinto de la rama sin prefijo (rama-real)' },
				{ id: 'd002', msg: 'decisión sin vigente: true|false' },
			]),
		);
	});
});
