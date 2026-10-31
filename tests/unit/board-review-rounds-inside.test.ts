import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';
import { patchBoardDoc, readBoardDoc } from '../helpers/board-doc';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const SYNC_PATH = path.join(ROOT, 'scripts', 'board', 'sync.mjs');
const OLD = '2026-10-01T08:00:00Z';
const SHA = `3c35826${'b'.repeat(33)}`;
const SHA2 = `4d46937${'c'.repeat(33)}`;

type Json = Record<string, any>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ORIGIN: Json = {
	id: 'codigo',
	num: 1,
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

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-rounds-inside-'));
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

const fileOf = (dir: string, id: string) => path.join(dir, 'tareas', `${id}.json`);
const onDisk = (dir: string, id: string): Json => JSON.parse(readFileSync(fileOf(dir, id), 'utf8'));

/** Opens a round on `sha` and closes it with `veredicto`, as the coordinator would. */
function reviewRound(dir: string, id: string, sha: string, veredicto: string) {
	const opened = cli(
		dir,
		'review',
		'codigo',
		`--sha=${sha}`,
		'--agente=gemini',
		'--coordinador',
		'--quien=claude',
	);
	expect(opened.status).toBe(0);
	patchBoardDoc(dir, id, { estado: 'en curso' });
	const hallazgo =
		veredicto === 'aprobado' ? '--hallazgo=ninguno' : '--hallazgo=P2|a.mjs:1|Falta';
	const closed = cli(
		dir,
		'close',
		id,
		'--coordinador',
		'--quien=claude',
		'--resumen=Revisado.',
		...LISTS,
		`--sha=${sha.slice(0, 7)}`,
		`--veredicto=${veredicto}`,
		hallazgo,
	);
	expect(closed.status).toBe(0);
}

describe('board review rounds inside the task (T529)', () => {
	it('keeps a round inside its task, with no file or number of its own', () => {
		const dir = makeBoard([ORIGIN]);
		const r = cli(
			dir,
			'review',
			'codigo',
			`--sha=${SHA}`,
			'--agente=gemini',
			'--coordinador',
			'--quien=claude',
		);
		expect(r.status).toBe(0);
		expect(existsSync(fileOf(dir, 'codigo-revision'))).toBe(false);
		const parent = onDisk(dir, 'codigo');
		expect(parent.rondas.map((x: Json) => x.id)).toEqual(['codigo-revision']);
		expect(parent.rondas[0].num).toBeUndefined();
		expect(parent.rondas[0].origen).toBeUndefined();
		expect(readBoardDoc(dir, 'codigo-revision')).toMatchObject({
			origen: 'codigo',
			ronda: true,
		});
		const shown = cli(dir, 'show', 'codigo');
		expect(shown.status).toBe(0);
		expect(shown.out).toContain('codigo-revision');
	});

	it('returns the task en curso on cambios and opens round 2 inside it after the author closes again', () => {
		const dir = makeBoard([ORIGIN]);
		reviewRound(dir, 'codigo-revision', SHA, 'cambios');
		expect(onDisk(dir, 'codigo').estado).toBe('en curso');

		const reclosed = cli(
			dir,
			'close',
			'codigo',
			'--coordinador',
			'--quien=claude',
			'--resumen=Hallazgos corregidos.',
			...LISTS,
			'--comprobacion=pnpm validate:changed',
			'--saltada=ninguna',
			'--pendiente=ninguno',
			'--pr=#530',
			'--nivel=type-check',
			`--sha=${SHA2.slice(0, 7)}`,
		);
		expect(reclosed.status).toBe(0);
		expect(onDisk(dir, 'codigo').estado).toBe('en revision');

		const second = cli(
			dir,
			'review',
			'codigo',
			`--sha=${SHA2}`,
			'--agente=gemini',
			'--coordinador',
			'--quien=claude',
		);
		expect(second.status).toBe(0);
		expect(existsSync(fileOf(dir, 'codigo-revision-2'))).toBe(false);
		expect(onDisk(dir, 'codigo').rondas.map((x: Json) => x.id)).toEqual([
			'codigo-revision',
			'codigo-revision-2',
		]);
		expect(readBoardDoc(dir, 'codigo-revision-2')).toMatchObject({
			vuelta: 2,
			revisionSha: SHA2,
		});
	});

	it('lets board:sync leave a task a review sent back en curso where it is', () => {
		const board = {
			tareas: [
				{ ...ORIGIN, estado: 'en curso', rama: 'docs/codigo' },
				{
					id: 'codigo-revision',
					origen: 'codigo',
					ronda: true,
					tipo: 'revision',
					estado: 'hecha',
				},
			],
		};
		const prs = [
			{
				number: 530,
				state: 'OPEN',
				isDraft: false,
				headRefName: 'docs/codigo',
				title: 'T1',
				body: '',
			},
		];
		const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m.plan(${JSON.stringify(board)}, { worktrees: [], local: [], remote: [], prs: ${JSON.stringify(prs)} })));`;
		const result = runCommand(
			process.execPath,
			['--input-type=module', '-e', src, pathToFileURL(SYNC_PATH).href],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(result.status).toBe(0);
		const plan = JSON.parse(String(result.stdout));
		expect(plan.cambios.filter((c: Json) => c.id === 'codigo')).toEqual([]);
	});
});
