import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/master-watch.mjs')).href;
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function fixture() {
	const root = mkdtempSync(path.join(tmpdir(), 'board-watch-escalation-'));
	dirs.push(root);
	const dir = path.join(root, 'board');
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	return { root, dir };
}

function probe(code: string, root: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		import { readFileSync, writeFileSync, existsSync } from 'node:fs';
		import { join } from 'node:path';
		const m = await import(process.argv[1]); const root = process.argv[2];
		const dir = join(root, 'board');
		const { setMaster } = await import(new URL('./master-config.mjs', process.argv[1]));
		const { loadBoard } = await import(new URL('./store.mjs', process.argv[1]));
		const { ownerActions } = await import(new URL('./format.mjs', process.argv[1]));
		${code}`,
			MODULE,
			root,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
	return JSON.parse(result.stdout);
}

describe('T442 board watcher notices, escalation and merge queue', () => {
	it('A: automatically notifies coordinator on claim, close and blocked review', () => {
		const { root } = fixture();
		const result = probe(
			`
			const now = Date.parse('2026-10-29T10:00:00Z');
			const claimTask = {
				id: 'task-a',
				num: 1,
				titulo: 'Task A',
				tipo: 'codigo',
				estado: 'en curso',
				agente: 'gemini',
				candado: {
					agente: 'gemini',
					desde: new Date(now - 60_000).toISOString(),
					carril: 'f11-preview',
					rama: 'feat/a',
				},
			};
			const closeTask = {
				id: 'task-b',
				num: 2,
				titulo: 'Task B',
				tipo: 'codigo',
				estado: 'en revision',
				agente: 'codex',
				cierre: {
					en: new Date(now - 120_000).toISOString(),
					quien: 'codex',
					resumen: 'Done task B',
					comprobaciones: ['pnpm test'],
					saltadas: [],
					pendientes: [],
					resultado: { nivel: 'type-check', sha: 'abcdef1234567890abcdef1234567890abcdef12' },
				},
			};
			const blockedReview = {
				id: 'task-c-revision',
				num: 3,
				titulo: 'Review C',
				tipo: 'revision',
				origen: 'task-c',
				estado: 'hecha',
				agente: 'claude',
				revisionSha: '1111111111111111111111111111111111111111',
				cierre: {
					en: new Date(now - 180_000).toISOString(),
					quien: 'claude',
					resumen: 'Found blockers',
					comprobaciones: ['pnpm test'],
					saltadas: [],
					pendientes: [],
					resultado: {
						veredicto: 'bloqueado',
						hallazgos: [{ tipo: 'bug', texto: 'regression' }],
						sha: '1111111111111111111111111111111111111111',
					},
				},
			};

			writeFileSync(join(dir, 'tareas', 'task-a.json'), JSON.stringify(claimTask));
			writeFileSync(join(dir, 'tareas', 'task-b.json'), JSON.stringify(closeTask));
			writeFileSync(join(dir, 'tareas', 'task-c-revision.json'), JSON.stringify(blockedReview));

			setMaster(dir, 'claude', 'master-claude');
			const pass1 = await m.runMasterWatch({ dir, now, deliver: () => {} });
			const b1 = loadBoard(dir);
			const msgs1 = (b1.bitacora ?? []).filter(r => r.mensaje?.para === 'coordinador');

			// Second pass must deduplicate and send nothing new
			const pass2 = await m.runMasterWatch({ dir, now: now + 60_000, deliver: () => {} });
			const b2 = loadBoard(dir);
			const msgs2 = (b2.bitacora ?? []).filter(r => r.mensaje?.para === 'coordinador');

			console.log(JSON.stringify({
				msgs1: msgs1.map(m => ({ id: m.mensaje.id, texto: m.mensaje.texto, para: m.mensaje.para })),
				msgsCount1: msgs1.length,
				msgsCount2: msgs2.length,
			}));`,
			root,
		);

		expect(result.msgsCount1).toBe(3);
		expect(result.msgsCount2).toBe(3);
		expect(result.msgs1).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: expect.stringMatching(/^aviso-claim-task-a-/),
					texto: expect.stringContaining('T1 tomada por gemini en f11-preview'),
				}),
				expect.objectContaining({
					id: expect.stringMatching(/^aviso-cierre-task-b-/),
					texto: expect.stringContaining('T2 · codigo · en revision'),
				}),
				expect.objectContaining({
					id: expect.stringMatching(/^aviso-bloqueado-task-c-revision-/),
					texto: expect.stringContaining('T3 · revision · bloqueado'),
				}),
			]),
		);
	});

	it('B: escalates unclaimed tasks and silent locks through 10m, 30m, and 60m', () => {
		const { root } = fixture();
		const result = probe(
			`
			const base = Date.parse('2026-10-29T12:00:00Z');
			const taskDelivered = {
				id: 'unclaimed-task',
				num: 10,
				titulo: 'Unclaimed Task',
				estado: 'pendiente',
				agente: 'codex',
				actor: 'sesion',
				requisitos: [],
				prompt: 'sample prompt',
				rev: 1,
				entregada: {
					agente: 'codex',
					desde: new Date(base).toISOString(),
				},
			};
			const taskSilentLock = {
				id: 'silent-lock-task',
				num: 11,
				titulo: 'Silent Lock Task',
				estado: 'en curso',
				agente: 'gemini',
				candado: {
					agente: 'gemini',
					desde: new Date(base).toISOString(),
					latido: new Date(base).toISOString(),
					carril: 'f11-preview',
					rama: 'feat/silent',
				},
			};

			writeFileSync(join(dir, 'tareas', 'unclaimed-task.json'), JSON.stringify(taskDelivered));
			writeFileSync(join(dir, 'tareas', 'silent-lock-task.json'), JSON.stringify(taskSilentLock));

			setMaster(dir, 'codex', 'master-codex');
			setMaster(dir, 'gemini', 'master-gemini');

			const deliveredWakes = [];
			const deliver = (agent, thread, text) => deliveredWakes.push({ agent, text });

			// At 9 min: delivered task does NOT wake master yet (under 10m)
			await m.runMasterWatch({ dir, now: base + 9 * 60_000, deliver });
			const wakes9m = deliveredWakes.length;

			// At 10 min: wakes assigned master (codex) again
			await m.runMasterWatch({ dir, now: base + 10 * 60_000, deliver });
			const wakes10m = [...deliveredWakes];

			// At 29 min: no 30m escalation to coordinator yet
			await m.runMasterWatch({ dir, now: base + 29 * 60_000, deliver });
			const b29 = loadBoard(dir);
			const coord29Escalations = (b29.bitacora ?? []).filter(
				r => r.mensaje?.para === 'coordinador' && (r.mensaje?.id?.startsWith('aviso-escalacion') || r.mensaje?.id?.startsWith('aviso-candado'))
			);

			// At 30 min: notifies coordinator for unclaimed task and silent lock
			await m.runMasterWatch({ dir, now: base + 30 * 60_000, deliver });
			const b30 = loadBoard(dir);
			const coord30Escalations = (b30.bitacora ?? []).filter(
				r => r.mensaje?.para === 'coordinador' && (r.mensaje?.id?.startsWith('aviso-escalacion') || r.mensaje?.id?.startsWith('aviso-candado'))
			);

			// At 60 min: surfaces silent lock in owner action list (ownerActions)
			const b60 = loadBoard(dir);
			const actions60 = ownerActions(b60, { now: base + 60 * 60_000 });
			const silentOwnerRows = actions60.filter(a => a.tipo === 'detenida');

			console.log(JSON.stringify({
				wakes9m,
				wakes10mCount: wakes10m.length,
				wakes10mAgent: wakes10m[0]?.agent,
				wakes10mHasText: wakes10m[0]?.text?.includes('unclaimed after 10m'),
				coord29EscalationsCount: coord29Escalations.length,
				coord30Texts: coord30Escalations.map(r => r.mensaje.texto),
				silentOwnerRowsCount: silentOwnerRows.length,
				silentOwnerVerbo: silentOwnerRows[0]?.verbo,
			}));`,
			root,
		);

		expect(result.wakes9m).toBe(0);
		expect(result.wakes10mCount).toBe(1);
		expect(result.wakes10mAgent).toBe('codex');
		expect(result.wakes10mHasText).toBe(true);
		expect(result.coord29EscalationsCount).toBe(0);
		expect(result.coord30Texts).toEqual(
			expect.arrayContaining([
				expect.stringContaining('sin tomar tras 30 min sin reclamo'),
				expect.stringContaining('candado de gemini sin latido hace 30 min'),
			]),
		);
		expect(result.silentOwnerRowsCount).toBeGreaterThanOrEqual(1);
		expect(result.silentOwnerVerbo).toBe('Inspeccionar');
	});

	it('C: sends listo para unir #N only when approved review SHA equals PR head and CI is green', () => {
		const { root } = fixture();
		const result = probe(
			`
			const now = Date.parse('2026-10-29T14:00:00Z');
			const approvedSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
			const otherSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

			const originTask = {
				id: 'feat-core',
				num: 20,
				titulo: 'Feat Core',
				estado: 'en revision',
				pr: '#600',
				agente: 'codex',
				cierre: {
					en: new Date(now - 100_000).toISOString(),
					quien: 'codex',
					resumen: 'Code ready',
					comprobaciones: ['pnpm test'],
					saltadas: [],
					pendientes: [],
				},
			};
			const reviewRound = {
				id: 'feat-core-revision',
				num: 21,
				titulo: 'Review Feat Core',
				tipo: 'revision',
				origen: 'feat-core',
				pr: '#600',
				estado: 'hecha',
				agente: 'claude',
				revisionSha: approvedSha,
				cierre: {
					en: new Date(now - 50_000).toISOString(),
					quien: 'claude',
					resumen: 'Looks great',
					comprobaciones: ['pnpm test'],
					saltadas: [],
					pendientes: [],
					resultado: {
						veredicto: 'aprobado',
						sha: approvedSha,
						hallazgos: [],
					},
				},
			};

			writeFileSync(join(dir, 'tareas', 'feat-core.json'), JSON.stringify(originTask));
			writeFileSync(join(dir, 'tareas', 'feat-core-revision.json'), JSON.stringify(reviewRound));

			let prMock = null;
			const readPr = async () => prMock;

			// Case 1: Missing PR evidence -> no notice
			prMock = null;
			await m.runMasterWatch({ dir, now, readPr });
			const b1 = loadBoard(dir);
			const msgs1 = (b1.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			// Case 2: Stale PR head (head moved to otherSha) -> no notice
			prMock = {
				state: 'OPEN',
				headRefOid: otherSha,
				statusCheckRollup: [{ conclusion: 'SUCCESS', status: 'COMPLETED' }],
			};
			await m.runMasterWatch({ dir, now, readPr });
			const b2 = loadBoard(dir);
			const msgs2 = (b2.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			// Case 3: PR head matches but CI is pending -> no notice
			prMock = {
				state: 'OPEN',
				headRefOid: approvedSha,
				statusCheckRollup: [{ status: 'IN_PROGRESS' }],
			};
			await m.runMasterWatch({ dir, now, readPr });
			const b3 = loadBoard(dir);
			const msgs3 = (b3.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			// Case 4: PR head matches but CI failed -> no notice
			prMock = {
				state: 'OPEN',
				headRefOid: approvedSha,
				statusCheckRollup: [{ conclusion: 'FAILURE', status: 'COMPLETED' }],
			};
			await m.runMasterWatch({ dir, now, readPr });
			const b4 = loadBoard(dir);
			const msgs4 = (b4.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			// Case 5: Exact SHA match and CI is green -> sends listo para unir #600
			prMock = {
				state: 'OPEN',
				headRefOid: approvedSha,
				statusCheckRollup: [{ conclusion: 'SUCCESS', status: 'COMPLETED' }],
			};
			await m.runMasterWatch({ dir, now, readPr });
			const b5 = loadBoard(dir);
			const msgs5 = (b5.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			// Deduplication check: repeated pass does not send again
			await m.runMasterWatch({ dir, now: now + 10_000, readPr });
			const b6 = loadBoard(dir);
			const msgs6 = (b6.bitacora ?? []).filter(r => r.mensaje?.texto?.includes('listo para unir'));

			console.log(JSON.stringify({
				msgs1: msgs1.length,
				msgs2: msgs2.length,
				msgs3: msgs3.length,
				msgs4: msgs4.length,
				msgs5Count: msgs5.length,
				msgs5Text: msgs5[0]?.mensaje?.texto,
				msgs6Count: msgs6.length,
			}));`,
			root,
		);

		expect(result.msgs1).toBe(0);
		expect(result.msgs2).toBe(0);
		expect(result.msgs3).toBe(0);
		expect(result.msgs4).toBe(0);
		expect(result.msgs5Count).toBe(1);
		expect(result.msgs5Text).toContain('listo para unir #600');
		expect(result.msgs5Text).toContain('siguiente: unir');
		expect(result.msgs6Count).toBe(1);
	});

	it('never mutates board or records receipts in dry-run mode', () => {
		const { root } = fixture();
		const result = probe(
			`
			const now = Date.parse('2026-10-29T16:00:00Z');
			const task = {
				id: 'dry-task',
				num: 30,
				titulo: 'Dry Run Task',
				estado: 'en curso',
				agente: 'codex',
				candado: {
					agente: 'codex',
					desde: new Date(now).toISOString(),
					carril: 'f10-libre',
				},
			};
			writeFileSync(join(dir, 'tareas', 'dry-task.json'), JSON.stringify(task));

			const printed = [];
			await m.runMasterWatch({ dir, now, dryRun: true, out: (t) => printed.push(t) });
			const b = loadBoard(dir);
			const msgs = (b.bitacora ?? []).filter(r => r.tarea === 'dry-task');
			const stateSaved = existsSync(join(root, 'board-master-watch.json'));

			console.log(JSON.stringify({
				msgsCount: msgs.length,
				stateSaved,
				printedCount: printed.length,
				printedHasClaim: printed.some(p => p.includes('T30') || p.includes('dry-task')),
			}));`,
			root,
		);

		expect(result.msgsCount).toBe(0);
		expect(result.stateSaved).toBe(false);
		expect(result.printedCount).toBeGreaterThanOrEqual(1);
		expect(result.printedHasClaim).toBe(true);
	});
});
