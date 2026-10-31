import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const base = {
	agente: 'claude',
	actor: 'sesion',
	urgencia: 'normal',
	requisitos: [],
	rev: 3,
};
const doc = (collection: string, id: string, fields: Record<string, unknown>) => [
	collection,
	id,
	{ ...base, titulo: id, ...fields },
];
const signal = (tarea: string, id: string, pr: string) => ({
	tarea,
	en: '2026-10-25T16:57:00Z',
	quien: 'codex',
	mensaje: {
		id,
		para: 'coordinador',
		texto: `${tarea} · revision · aprobado · ${pr}@9a83436 · 0 hallazgos · siguiente: unir`,
	},
});

function fixture(docs: unknown[][], rows: unknown[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-stale-merge-'));
	dirs.push(dir);
	for (const [collection, id, fields] of docs) {
		mkdirSync(path.join(dir, String(collection)), { recursive: true });
		writeFileSync(path.join(dir, String(collection), `${id}.json`), JSON.stringify(fields));
	}
	mkdirSync(path.join(dir, 'bitacora'));
	writeFileSync(
		path.join(dir, 'bitacora', '2026-10-25.jsonl'),
		rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
	);
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
 import { unreadFor } from './scripts/board/next.mjs';
 const dir = process.env.CELEBRA_BOARD_DIR;
 const exec = async (args, state='MERGED') => { let output; await run(args, {dir, prState:()=>state, out:s=>output=s}); return output; };
 const unread = (opts) => unreadFor('coordinador', loadBoard(dir), opts).map((r) => r.mensaje.id);
 ${source}`,
		],
		{ cwd: process.cwd(), env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }), allowFailure: true },
	);
	expect(r.stderr).toBe('');
	expect(r.status).toBe(0);
	return JSON.parse(String(r.stdout));
}

describe('stale merge signals (T521)', () => {
	it('skips messages of archived tasks unless asked for them', () => {
		const dir = fixture(
			[
				doc('archivo', 'old-revision', { num: 2, estado: 'hecha', origen: 'old' }),
				doc('tareas', 'live', { num: 3, estado: 'en revision', pr: '#20' }),
			],
			[signal('old-revision', 'm1', '#10'), signal('live', 'm2', '#20')],
		);
		const r = probe(
			dir,
			`console.log(JSON.stringify({ plain: unread(), all: unread({ archived: true }) }));`,
		);
		expect(r).toEqual({ plain: ['m2'], all: ['m1', 'm2'] });
	});

	it("acknowledges a review round's signal when its origin is already unida", () => {
		const dir = fixture(
			[
				doc('tareas', 'feature', { num: 1, estado: 'unida', pr: '#30' }),
				doc('tareas', 'feature-revision', {
					num: 2,
					estado: 'comprobada',
					origen: 'feature',
				}),
			],
			[signal('feature-revision', 'm1', '#30')],
		);
		const r = probe(
			dir,
			`const out = await exec(['merged', 'feature', '--coordinador', '--quien=claude']);
  const acks = loadBoard(dir).bitacora.filter((x) => x.atendido).map((x) => x.atendido);
  console.log(JSON.stringify({ out, unread: unread(), acks }));`,
		);
		expect(r.out).toBe('feature ya está unida');
		expect(r.unread).toEqual([]);
		expect(r.acks).toEqual([{ para: 'coordinador', mensajes: ['m1'], nota: 'merged' }]);
	});

	it('acknowledges an archived task without changing it', () => {
		const dir = fixture(
			[
				doc('archivo', 'gone', { num: 5, estado: 'unida', pr: '#40' }),
				doc('archivo', 'gone-revision-2', { num: 6, estado: 'hecha', origen: 'gone' }),
			],
			[signal('gone-revision-2', 'm1', '#40')],
		);
		const r = probe(
			dir,
			`const out = await exec(['merged', 'T5', '--coordinador', '--quien=claude']);
  const b = loadBoard(dir);
  console.log(JSON.stringify({ out, all: unread({ archived: true }), rev: b.archivo.find((t) => t.id === 'gone').rev }));`,
		);
		expect(r).toEqual({ out: 'gone está archivada; 1 aviso atendido', all: [], rev: 3 });
	});

	it('still refuses an archived task whose PR is not merged', () => {
		const dir = fixture(
			[doc('archivo', 'gone', { num: 5, estado: 'cancelada', pr: '#40' })],
			[signal('gone', 'm1', '#40')],
		);
		const r = probe(
			dir,
			`let err = ''; try { await exec(['merged', 'gone', '--coordinador', '--quien=claude'], 'CLOSED'); } catch (e) { err = e.message; }
  console.log(JSON.stringify({ err, all: unread({ archived: true }) }));`,
		);
		expect(r.err).toContain('no está unido en GitHub (CLOSED)');
		expect(r.all).toEqual(['m1']);
	});
});
