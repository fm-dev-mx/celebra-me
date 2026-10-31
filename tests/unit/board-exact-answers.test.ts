import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const task = {
	id: 'sample',
	num: 1,
	titulo: 'Ejemplo',
	estado: 'pendiente',
	agente: 'codex',
	actor: 'sesion',
	urgencia: 'normal',
	requisitos: [],
	rev: 1,
	prompt: 'PROMPT COMPLETO',
};
function fixture(fields: Record<string, unknown> = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-answer-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	writeFileSync(path.join(dir, 'tareas', 'sample.json'), JSON.stringify({ ...task, ...fields }));
	return dir;
}
function probe(dir: string, source: string) {
	const r = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
 import { run } from './scripts/board/board.mjs';
 import { loadBoard } from './scripts/board/store.mjs';
 import { promptWithLane } from './scripts/board/model.mjs';
 import { unreadFor, ownerMessages } from './scripts/board/next.mjs';
 import { liveBoard } from './scripts/board/view-payload.mjs';
 const dir = process.env.CELEBRA_BOARD_DIR;
 const exec = async (args, state='MERGED') => { let output; await run(args, {dir, prState:()=>state, out:s=>output=s}); return output; };
 const ask = (text='¿Cuál opción elige?') => exec(['msg','sample','--de=codex','--para=dueno',text,'--opcion=Primera','--opcion=Segunda']);
 ${source}`,
		],
		{ cwd: process.cwd(), env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }), allowFailure: true },
	);
	expect(r.stderr).toBe('');
	expect(r.status).toBe(0);
	return JSON.parse(String(r.stdout));
}

describe('exact board answers', () => {
	it('refuses unlinked decisions, bare ids, missing slugs and contradictory linkage before writing', () => {
		const r = probe(
			fixture(),
			`
  const results=[];
  for (const args of [[],['sample'],['tareas=missing'],['tareas=sample','--sin-tarea']]) {
   try { await exec(['decide','decision=Primera',...args]); results.push('accepted'); } catch(e) {results.push(e.message);}
  }
  console.log(JSON.stringify({results, decisions:loadBoard(dir).decisiones}));`,
		);
		expect(r.results).toEqual([
			expect.stringContaining('tareas=<slug> o --sin-tarea'),
			expect.stringContaining('un id suelto'),
			expect.stringContaining('existentes'),
			expect.stringContaining('no ambos'),
		]);
		expect(r.decisions).toEqual([]);
	});
	it('allows an explicit standalone decision', () => {
		const r = probe(
			fixture(),
			`await exec(['decide','decision=Regla general','--sin-tarea']); console.log(JSON.stringify(loadBoard(dir).decisiones[0]));`,
		);
		expect(r.tareas).toEqual([]);
	});
	it('answers a question even after the owner explicitly marked it read', () => {
		const r = probe(
			fixture(),
			`await ask(); await exec(['inbox','--agente=dueno','--leido']);
		await exec(['decide','tareas=sample','decision=Segunda']);
		console.log(JSON.stringify(loadBoard(dir).decisiones[0].respuestas));`,
		);
		expect(r).toEqual([
			expect.objectContaining({ pregunta: '¿Cuál opción elige?', opcion: 'Segunda' }),
		]);
	});
	it('uses the same answer delivery for generated prompts without saving it into the task prompt', () => {
		const r = probe(
			fixture({
				tipo: 'codigo',
				busca: 'Mejorar el tablero',
				rama: 'chore/example',
				carrilPlaneado: 'f11-preview',
				entregada: { agente: 'codex', desde: '2026-10-26T00:00:00Z' },
			}),
			`
		await ask(); await exec(['decide','tareas=sample','decision=Segunda']);
		const delivered=JSON.parse(await exec(['prompt','sample','--json']));
		console.log(JSON.stringify({delivered:delivered.prompt,stored:loadBoard(dir).tareas[0].prompt}));`,
		);
		expect(r.delivered).toContain('RESPUESTA');
		expect(r.delivered).not.toContain('AUTORIZO');
		expect(r.stored).toBe('PROMPT COMPLETO');
	});
	it('copies the exact answered question first, with the decision and no repeated prompt for an active agent', () => {
		const r = probe(
			fixture({ candado: { agente: 'codex', sesion: 's', desde: '2026-10-26T00:00:00Z' } }),
			`
   await ask(); await exec(['decide','tareas=sample','decision=Segunda']);
   const b=loadBoard(dir); const copied=promptWithLane(b.tareas[0], b);
   const cli=JSON.parse(await exec(['prompt','sample','--json']));
   console.log(JSON.stringify({copied, cli:cli.prompt, pending:ownerMessages(b).length,
    projected:promptWithLane(b.tareas[0],liveBoard(b))}));`,
		);
		expect(r.copied).toContain(
			'RESPUESTA · T1 sample\nPregunta: ¿Cuál opción elige?\nOpción elegida: Segunda\nDecisión: d001\nQué hacer ahora:',
		);
		expect(r.copied).not.toContain('PROMPT COMPLETO');
		expect(r.cli).toBe(r.copied);
		expect(r.projected).toBe(r.copied);
		expect(r.pending).toBe(0);
	});
	it('includes the full prompt only when there is no delivery or claim evidence', () => {
		const r = probe(
			fixture(),
			`await ask(); await exec(['decide','tareas=sample','decision=Primera']); const b=loadBoard(dir); console.log(JSON.stringify(promptWithLane(b.tareas[0],b)));`,
		);
		expect(r.indexOf('RESPUESTA')).toBe(0);
		expect(r).toContain('PROMPT COMPLETO');
	});
	it('requires a message id when several questions could be answered', () => {
		const r = probe(
			fixture(),
			`await ask(); await ask('¿Continuamos?'); let error;
   try {await exec(['decide','tareas=sample','decision=Primera']);}catch(e){error=e.message;}
   const id=unreadFor('dueno',loadBoard(dir))[0].mensaje.id;
   await exec(['decide','tareas=sample','decision=Segunda','--mensaje='+id]);
   console.log(JSON.stringify({error,remaining:unreadFor('dueno',loadBoard(dir)).length,answers:loadBoard(dir).decisiones[0].respuestas}));`,
		);
		expect(r.error).toContain('--mensaje');
		expect(r.remaining).toBe(1);
		expect(r.answers).toHaveLength(1);
	});
	it('expires an open question only after a coordinator revision and sends the updated prompt', () => {
		const r = probe(
			fixture({ candado: { agente: 'codex', sesion: 's', desde: '2026-10-26T00:00:00Z' } }),
			`await ask();
   await exec(['set','sample','--rev=1','--agente=codex','--sesion=s','ahora=Trabajo de sesión']);
   const before=ownerMessages(loadBoard(dir)).length;
   await exec(['set','sample','--rev=2','--coordinador', '--quien=claude','--sesion-archivada','prompt=PROMPT NUEVO']);
   const b=loadBoard(dir);
   console.log(JSON.stringify({before,after:ownerMessages(b).length,receipt:b.bitacora.find(r=>r.atendido),agent:unreadFor('codex',b)[0].mensaje.texto,prompt:promptWithLane(b.tareas[0],b)}));`,
		);
		expect(r.before).toBe(1);
		expect(r.after).toBe(0);
		expect(r.receipt.atendido.nota).toContain('vencida');
		expect(r.agent).toContain('PROMPT NUEVO');
		expect(r.prompt).toContain('PROMPT NUEVO');
	});
	it('does not carry an old answer into a revised task context', () => {
		const r = probe(
			fixture(),
			`await ask(); await exec(['decide','tareas=sample','decision=Primera']);
   await exec(['set','sample','--rev=1','--coordinador', '--quien=claude','prompt=PROMPT NUEVO']);
   const b=loadBoard(dir); console.log(JSON.stringify(promptWithLane(b.tareas[0],b)));`,
		);
		expect(r).not.toContain('RESPUESTA');
		expect(r).toContain('PROMPT NUEVO');
	});
	it('keeps a merge signal through inbox reads and rejects atendido, until verified merged', () => {
		const r = probe(
			fixture({ pr: '#10' }),
			`
   await exec(['msg','sample','--de=codex','--para=coordinador','T1 sample · siguiente: unir']);
   await exec(['inbox','--agente=coordinador']); let error, refused;
   try {await exec(['atendido','sample','--para=coordinador']);} catch(e){error=e.message;}
   try {await exec(['merged','sample','--coordinador', '--quien=claude'],'OPEN');}catch(e){refused=e.message;}
   const before=unreadFor('coordinador',loadBoard(dir)).length;
   await exec(['merged','sample','--coordinador', '--quien=claude']);
   console.log(JSON.stringify({error,refused,before,after:unreadFor('coordinador',loadBoard(dir)).length}));`,
		);
		expect(r.error).toContain('solo con pnpm board merged');
		expect(r.refused).toContain('no está unido');
		expect(r.before).toBe(1);
		expect(r.after).toBe(0);
	});
});
