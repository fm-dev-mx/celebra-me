import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const href = (file: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', file)).href;

/** Run a snippet with `m` = model.mjs and subtasks.mjs and `board` = the given board; its printed JSON is returned. */
function probe(board: unknown, code: string) {
	const src = `const m = { ...(await import(process.argv[1])), ...(await import(process.argv[2])) }; const board = ${JSON.stringify(board)}; ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, href('model.mjs'), href('subtasks.mjs')],
		{
			cwd: ROOT,
			allowFailure: true,
			env: sanitizeEnv({}),
		},
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const PROMPT = 'T1 · x\n\nDECISIONES\n- ninguna';
const task = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	titulo: id,
	estado: 'pendiente',
	requisitos: [],
	prompt: PROMPT,
	actor: 'sesion',
	urgencia: 'normal',
	...extra,
});

const NOW = Date.parse('2026-10-25T18:00:00Z');

describe('board subtasks (d174)', () => {
	const board = {
		tareas: [
			task('madre', { num: 1 }),
			task('b', { num: 3, padre: 'madre', fase: 2, estado: 'en curso' }),
			task('a', { num: 2, padre: 'madre', fase: 1, estado: 'unida' }),
			task('c', { num: 4, grupo: 'madre', fase: 2, estado: 'en revision', pr: '#9' }),
			task('d', { num: 5, padre: 'madre', fase: 3 }),
			task('x', { num: 6, padre: 'madre', fase: 3, estado: 'cancelada' }),
			task('suelta1', { num: 7, grupo: 'iniciativa' }),
		],
		archivo: [{ id: 'z', num: 8, titulo: 'z', estado: 'comprobada', padre: 'madre', fase: 1 }],
	};

	it('gathers live and archived subtasks ordered by phase, orden and number', () => {
		expect(
			probe(
				board,
				`console.log(JSON.stringify(m.subtasksOf(board.tareas[0], board).map((x) => x.id)))`,
			),
		).toEqual(['a', 'z', 'b', 'c', 'd', 'x']);
	});

	it('counts progress without cancelled subtasks and finds the current phase', () => {
		expect(
			probe(board, `console.log(JSON.stringify(m.groupProgress(board.tareas[0], board)))`),
		).toEqual({
			total: 5,
			hechas: 2,
			enCurso: 1,
			enRevision: 1,
			pendientes: 1,
			pct: 40,
			faseActual: 2,
			totalFases: 3,
		});
		expect(
			probe(
				board,
				`console.log(JSON.stringify(m.progressText(m.groupProgress(board.tareas[0], board))))`,
			),
		).toBe('Fase 2 de 3 · 2 de 5 completadas (40 %)');
	});

	it('marks each subtask and links a subtask back to its mother or group', () => {
		expect(
			probe(
				board,
				`console.log(JSON.stringify([
					board.tareas.map(m.subtaskMark).join(''),
					m.parentText(board.tareas[1], board),
					m.parentText(board.tareas[6], board),
					m.parentText(board.tareas[0], board),
					m.headlessGroup(board.tareas[6], board),
					m.subtaskText(board.tareas[1]),
				]))`,
			),
		).toEqual([
			'○●✓●○–○',
			'Parte de T1 · madre · 2/5 listas',
			'Parte de el grupo iniciativa · 0/1 listas',
			'',
			'iniciativa',
			'T3 · F2 · b · en curso',
		]);
	});

	it('prints the show block with a bar and a checklist', () => {
		const lines = probe(
			board,
			`console.log(JSON.stringify(m.subtaskLines(board.tareas[0], board)))`,
		);
		expect(lines[0]).toBe('\nSubtareas · 2/5 (40 %)  [████░░░░░░]');
		expect(lines[1]).toBe('  Fase 2 de 3');
		expect(lines).toContain('  ✓ T2 · F1 · a · unida');
	});

	it('refuses a mother that is the task itself, missing, or a loop', () => {
		expect(
			probe(
				{
					tareas: [task('p', { padre: 'q' }), task('q', { padre: 'r' }), task('r')],
				},
				`console.log(JSON.stringify([
					m.parentIssue({ ...board.tareas[2], padre: 'p' }, board),
					m.parentIssue({ ...board.tareas[2], padre: 'nadie' }, board),
					m.parentIssue(board.tareas[0], board),
					m.taskIssues({ ...board.tareas[2], padre: 'r', fase: 0, rev: 1, actualizado: '2026-10-25T00:00:00Z' }),
				]))`,
			),
		).toEqual([
			'padre forma un ciclo: r → p → q → r',
			'padre nadie no está en el tablero',
			null,
			['padre no puede ser la misma tarea', 'fase debe ser un entero desde 1'],
		]);
	});
});

describe('board calendar (d276)', () => {
	const board = {
		tareas: [
			task('fecha-sola', {
				num: 10,
				requisitos: [{ tipo: 'fecha', ref: '2026-11-03T15:00:00Z' }],
			}),
			task('dos-fechas', {
				num: 11,
				requisitos: [
					{ tipo: 'fecha', ref: '2026-10-27T15:00:00Z' },
					{ tipo: 'fecha', ref: '2026-10-28T15:00:00Z' },
				],
			}),
			task('fecha-y-tarea', {
				num: 12,
				requisitos: [
					{ tipo: 'fecha', ref: '2026-10-27T15:00:00Z' },
					{ tipo: 'tarea', ref: 'otra' },
				],
			}),
			task('otra', { num: 13 }),
			task('ya-llego', {
				num: 14,
				requisitos: [{ tipo: 'fecha', ref: '2026-10-20T15:00:00Z' }],
			}),
			task('sin-prompt', {
				num: 15,
				prompt: undefined,
				requisitos: [{ tipo: 'fecha', ref: '2026-10-27T15:00:00Z' }],
			}),
		],
	};

	it('moves tasks that only wait for a date out of the queue', () => {
		expect(
			probe(
				board,
				`console.log(JSON.stringify([
					m.queue(board, ${NOW}).map((t) => t.id).sort(),
					m.calendar(board, ${NOW}).map((x) => [x.t.id, x.fecha]),
				]))`,
			),
		).toEqual([
			['fecha-y-tarea', 'otra', 'sin-prompt', 'ya-llego'],
			[
				['dos-fechas', '2026-10-28T15:00:00Z'],
				['fecha-sola', '2026-11-03T15:00:00Z'],
			],
		]);
	});

	it('brings a task back to the queue the day its date arrives', () => {
		const later = Date.parse('2026-11-03T15:00:00Z');
		expect(
			probe(
				board,
				`console.log(JSON.stringify(m.queue(board, ${later}).map((t) => t.id).includes('fecha-sola')))`,
			),
		).toBe(true);
	});

	it('groups the calendar by week and writes the list line', () => {
		expect(
			probe(
				board,
				`console.log(JSON.stringify([
					m.calendarWeeks(board, ${NOW}).map((w) => [w.semana, w.tareas.map((x) => x.t.id)]),
					m.calendarLine(board, ${NOW}),
					m.calendarLine({ tareas: [] }, ${NOW}),
				]))`,
			),
		).toEqual([
			[
				['2026-10-26', ['dos-fechas']],
				['2026-11-02', ['fecha-sola']],
			],
			expect.stringMatching(/^Calendario \(2\): próxima T11 el mié,? 28 (de )?oct/),
			'',
		]);
	});
});
