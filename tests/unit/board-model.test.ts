import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');

/** Run a module snippet with `m` = the imported board module; its printed JSON is returned. */
function probe(file: string, code: string) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(path.join(BOARD, file)).href],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

describe('board model shared rules', () => {
	it('tells a review child from follow-up work that only names an origin', () => {
		expect(
			probe(
				'model.mjs',
				`console.log(JSON.stringify([
					{ id: 'x-revision', origen: 'x' },
					{ id: 'x-revision-2', origen: 'x' },
					{ id: 'otra', revisionSha: 'a'.repeat(40) },
					{ id: 'seguimiento', origen: 'x' },
					{ id: 'x-revisiones' },
				].map(m.isReview)))`,
			),
		).toEqual([true, true, true, false, false]);
	});

	it('labels, orders and parses PRs the same way for every caller', () => {
		expect(
			probe(
				'model.mjs',
				`console.log(JSON.stringify({
					label: [m.taskLabel({ id: 'a', num: 3 }), m.taskLabel({ id: 'b' })],
					tag: [m.taskTag({ id: 'a', num: 3 }), m.taskTag({ id: 'b' })],
					orden: [m.ordenOf({ orden: 0 }), m.ordenOf({})],
					pr: ['#398', 398, 'https://github.com/fm-dev-mx/celebra-me/pull/12', 'https://github.com/otro/repo/pull/5', 'nada', undefined].map(m.prNumber),
					rama: m.taskIdFromBranch('fix/olivia-gallery'),
					cerradas: ['hecha', 'unida', 'comprobada', 'cancelada', 'en revision'].map((estado) => m.isFinished({ estado })),
				}))`,
			),
		).toEqual({
			label: ['T3 a', 'b'],
			tag: ['T3', 'b'],
			orden: [0, 999],
			pr: [398, 398, 12, null, null, null],
			rama: 'olivia-gallery',
			cerradas: [true, true, true, true, false],
		});
	});

	it('validates who wrote a bitácora row, its estados and its single change', () => {
		expect(
			probe(
				'model.mjs',
				`const en = '2026-10-24T01:00:00Z';
				const row = (x) => ({ tarea: 't', en, quien: 'claude', ...x });
				console.log(JSON.stringify({
					quien: [m.quienOf({ quien: 'dueño' }), m.quienOf({ coordinador: true, agente: 'codex' }), m.quienOf({ agente: 'gemini' }), m.quienOf({})],
					issues: [
						row({ de: 'pendiente', a: 'en curso' }),
						row({ de: 'hecha', a: 'archivada' }),
						row({ de: '', a: 'en_curso' }),
						row({ quien: 'sesion', de: '', a: 'pendiente' }),
						row({ agente: { de: 'codex', a: 'claude' } }),
						row({ carril: { de: '', a: 'f10-libre' } }),
						row({ de: 'pendiente', a: 'hecha', agente: { de: 'codex', a: 'claude' } }),
						{ tarea: 't', en, legado: true, de: '', a: 'pendiente' },
					].map(m.logRowIssues),
					change: [m.logChange(row({ de: 'hecha', a: 'unida' })), m.logChange(row({ carril: { de: '', a: 'f10' } }))],
				}))`,
			),
		).toEqual({
			quien: ['dueno', 'coordinador', 'gemini', null],
			issues: [
				[],
				[],
				['estado desconocido en a: en_curso'],
				['quien debe ser claude/codex/gemini/coordinador/dueno, no sesion'],
				[],
				[],
				['la fila cambia una sola cosa: estado (de/a), agente o carril'],
				[],
			],
			change: ['hecha → unida', 'carril — → f10'],
		});
	});

	it('keeps one stale-lock threshold and one lane rule', () => {
		expect(
			probe(
				'model.mjs',
				`const now = Date.parse('2026-10-20T20:00:00Z');
				const lanes = [{ id: 'integration', segment: null }, { id: 'f11-preview', segment: 'f11-preview' }];
				console.log(JSON.stringify({
					horas: m.STALE_LOCK_HOURS,
					viejo: [5, 6, 10].map((h) => m.isStaleLock({ desde: new Date(now - h * 3600000).toISOString() }, now)),
					carril: [
						m.laneAllowed('f11-preview', { actor: 'sesion' }, lanes),
						m.laneAllowed('integration', { actor: 'sesion' }, lanes),
						m.laneAllowed('integration', { actor: 'coordinador' }, lanes),
						m.laneAllowed('f13-nuevo', { actor: 'coordinador' }, lanes),
					],
					lane: [
						m.taskLane({ candado: { carril: 'f10' }, carrilPlaneado: 'f11' }),
						m.taskLane({ carrilPlaneado: 'f11', carril: 'f12' }),
						m.taskLane({ carril: 'f12' }),
						m.taskLane({ id: 'demo-revision' }),
						m.taskLane({ id: 'doc-audit', soloLectura: true }),
						m.taskLane({ id: 'nada' }),
					],
					readonly: [m.READONLY_LANE, m.isReadOnly({ id: 'demo-revision' }), m.isReadOnly({ id: 'normal' })],
				}))`,
			),
		).toEqual({
			horas: 6,
			viejo: [false, true, true],
			carril: [true, false, true, false],
			lane: ['f10', 'f11', 'f12', 'f04-integracion', 'f04-integracion', null],
			readonly: ['f04-integracion', true, false],
		});
		expect(probe('sync.mjs', 'console.log(JSON.stringify(m.STALE_LOCK_HOURS))')).toBe(6);
	});
});
