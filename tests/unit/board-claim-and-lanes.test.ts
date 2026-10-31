import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = '2026-10-25T12:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'cualquiera',
		requisitos: [],
		prompt: `T1 · ${id}\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeBoard(collections: Record<string, Json[]>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-t172-'));
	dirs.push(dir);
	for (const [name, docs] of Object.entries(collections)) {
		mkdirSync(path.join(dir, name), { recursive: true });
		for (const [i, { id, ...doc }] of docs.entries())
			writeFileSync(
				path.join(dir, name, `${id}.json`),
				JSON.stringify(name === 'tareas' ? { num: i + 1, ...doc } : doc),
			);
	}
	return dir;
}

function cli(dir: string, args: string[], env: NodeJS.ProcessEnv = {}) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '', ...env }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readJson = (dir: string, collection: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, collection, `${id}.json`), 'utf8'));

const readLog = (dir: string): Json[] =>
	readdirSync(path.join(dir, 'bitacora'))
		.filter((f) => f.endsWith('.jsonl'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);

/** Run a snippet with `f` = format.mjs, `m` = model.mjs and `t` = trace.mjs; its printed JSON is returned. */
function probe(code: string) {
	const href = (file: string) => pathToFileURL(path.join(BOARD, file)).href;
	const src = `const f = await import(process.argv[1]); const m = await import(process.argv[2]); const t = await import(process.argv[3]); ${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			href('format.mjs'),
			href('model.mjs'),
			href('trace.mjs'),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const CLAIM = [
	'--agente=codex',
	'--sesion=codex-test',
	'--carril=f10-libre',
	'--titulo=f10 · T1 · prueba',
];

describe('T172 claim lifecycle', () => {
	it('moves a pendiente task to en curso with a bitácora row, and release puts it back', () => {
		const dir = makeBoard({ tareas: [task('corre')] });
		expect(cli(dir, ['claim', 'corre', ...CLAIM]).status).toBe(0);
		expect(readJson(dir, 'tareas', 'corre')).toMatchObject({ estado: 'en curso' });
		const show = JSON.parse(cli(dir, ['show', 'corre', '--json']).out);
		expect(show).toMatchObject({ stage: 'curso', color: 'run' });
		expect(readLog(dir)).toEqual([
			expect.objectContaining({
				tarea: 'corre',
				de: 'pendiente',
				a: 'en curso',
				quien: 'codex',
				corrio: 'pnpm board claim',
			}),
		]);
		const release = cli(dir, ['release', 'corre', '--agente=codex', '--sesion=codex-test']);
		expect(release.status).toBe(0);
		expect(readJson(dir, 'tareas', 'corre')).toMatchObject({ estado: 'pendiente' });
		expect(readJson(dir, 'tareas', 'corre').candado).toBeUndefined();
		expect(cli(dir, ['claim', 'corre', ...CLAIM]).status).toBe(0);
	});

	it('reads a lock taken before T172 on a pendiente task as running', () => {
		const out = probe(`
			const tk = { id: 'x', estado: 'pendiente', requisitos: [], candado: { agente: 'codex', desde: '${NOW}' } };
			const board = { tareas: [tk], decisiones: [] };
			console.log(JSON.stringify([m.stage(tk, board), m.stage({ ...tk, candado: undefined }, board)]));
		`);
		expect(out[0]).toBe('curso');
		expect(out[1]).not.toBe('curso');
	});
});

describe('T172 who added and followed up a task', () => {
	it('stamps agregadaPor on add, preferring the real agent over --coordinador', () => {
		const dir = makeBoard({ tareas: [] });
		const add = cli(dir, [
			'add',
			'nueva',
			'titulo=Nueva',
			'urgencia=normal',
			'actor=coordinador',
			'--agente=gemini',
			'--coordinador',
		]);
		expect(add.status).toBe(0);
		expect(readJson(dir, 'tareas', 'nueva')).toMatchObject({ agregadaPor: 'gemini' });
		expect(readJson(dir, 'tareas', 'nueva').seguimientoPor).toBeUndefined();
	});

	it('stamps seguimientoPor on follow-up writes and refuses it through set', () => {
		const dir = makeBoard({ tareas: [task('sigue', { agregadaPor: 'gemini' })] });
		expect(
			cli(dir, ['set', 'sigue', '--rev=1', 'ahora=Revisada', '--coordinador']).status,
		).toBe(0);
		expect(readJson(dir, 'tareas', 'sigue')).toMatchObject({
			agregadaPor: 'gemini',
			seguimientoPor: 'coordinador',
		});
		expect(cli(dir, ['move', 'sigue', '--agente=codex', '--quien=claude']).status).toBe(0);
		expect(readJson(dir, 'tareas', 'sigue')).toMatchObject({ seguimientoPor: 'claude' });
		const forged = cli(dir, ['set', 'sigue', '--rev=3', 'agregadaPor=codex', '--coordinador']);
		expect(forged.status).toBe(2);
		expect(forged.err).toContain('agregadaPor requiere su comando');
	});

	it('shows the trace in show and falls back to the bitácora for older tasks', () => {
		const dir = makeBoard({ tareas: [task('vieja')] });
		mkdirSync(path.join(dir, 'bitacora'));
		writeFileSync(
			path.join(dir, 'bitacora', '2026-10-25.jsonl'),
			[
				{
					tarea: 'vieja',
					en: '2026-10-25T10:00:00Z',
					quien: 'gemini',
					de: '',
					a: 'pendiente',
				},
				{
					tarea: 'vieja',
					en: '2026-10-25T11:00:00Z',
					quien: 'coordinador',
					de: 'pendiente',
					a: 'bloqueada',
				},
			]
				.map((r) => JSON.stringify(r))
				.join('\n') + '\n',
		);
		expect(cli(dir, ['show', 'vieja']).out).toContain('  agregó gemini · seg. coordinador\n');
	});

	it('traceOf prefers stored fields and omits a follow-up by the same writer', () => {
		const out = probe(`
			const bitacora = [{ tarea: 'a', en: '1', quien: 'codex', de: '', a: 'pendiente' }, { tarea: 'a', en: '2', quien: 'codex', de: 'pendiente', a: 'en curso' }];
			console.log(JSON.stringify([
				f.traceOf({ id: 'a' }, { bitacora }),
				f.traceOf({ id: 'a', agregadaPor: 'dueno', seguimientoPor: 'claude' }, { bitacora }),
				f.traceOf({ id: 'b' }, { bitacora }),
				f.traceText({ id: 'a', agregadaPor: 'dueno', seguimientoPor: 'claude' }, { bitacora }),
				t.traceActor({ quien: 'coordinador', agente: 'claude', coordinador: true }),
				t.traceActor({ coordinador: true }),
			]));
		`);
		expect(out).toEqual([
			{ agregada: 'codex' },
			{ agregada: 'dueno', seguimiento: 'claude' },
			null,
			{
				text: 'agregó usted · seg. claude',
				title: 'Agregada por usted; último seguimiento de claude',
			},
			'claude',
			'coordinador',
		]);
	});

	it('keeps the view note quieter than the task number, with no agent chip', () => {
		const html = readFileSync(path.join(BOARD, 'view.html'), 'utf8');
		expect(html).toContain(
			'.by{font:500 .72rem var(--mono);color:var(--faint);white-space:nowrap}',
		);
		expect(html).toMatch(/const byHtml=t=>\{[^}]*<span class="by" title=/);
		expect(html).not.toMatch(/agChip\([^)]*trace/);
	});
});

describe('T172 live lanes and replaced decisions', () => {
	it('carril without an id reads the lanes live and drops the hand-written runtime fields', () => {
		const dir = makeBoard({
			tareas: [
				task('ocupa', {
					estado: 'en curso',
					candado: {
						agente: 'claude',
						desde: NOW,
						sesion: 'local_x',
						carril: 'f05-plataforma',
					},
				}),
			],
			carriles: [
				{
					id: 'f05-plataforma',
					orden: 2,
					puerto: '4325',
					uso: 'Plataforma',
					estado: 'libre',
					nota: 'vieja',
					tarea: 'otra',
					rev: 4,
				},
			],
		});
		const fixture = path.join(dir, 'vivo.json');
		writeFileSync(
			fixture,
			JSON.stringify({ carriles: [{ id: 'f05-plataforma', rama: 'feat/x', limpio: false }] }),
		);
		const r = cli(dir, ['carril', '--json'], { CELEBRA_BOARD_LIVE_FIXTURE: fixture });
		expect(r.status).toBe(0);
		const lanes = JSON.parse(r.out);
		expect(lanes).toHaveLength(9);
		expect(lanes[0].id).toBe('integration');
		const lane = lanes.find((l: Json) => l.id === 'f05-plataforma');
		expect(lane).toMatchObject({
			id: 'f05-plataforma',
			uso: 'Plataforma (en retiro)',
			puerto: 4325,
			rama: 'feat/x',
			limpio: false,
			tarea: 'ocupa',
		});
		expect(lane).not.toHaveProperty('rev');
		expect(lane).not.toHaveProperty('nota');
		expect(lane).not.toHaveProperty('estado');
		const text = cli(dir, ['carril'], { CELEBRA_BOARD_LIVE_FIXTURE: fixture }).out;
		expect(text).toContain('f05-plataforma · feat/x · con cambios · T1 de claude');
	});

	it('ignores malformed static lane files and refuses writes to the code-owned catalog', () => {
		const dir = makeBoard({ tareas: [] });
		mkdirSync(path.join(dir, 'carriles'));
		writeFileSync(path.join(dir, 'carriles', 'integration.json'), '{invalid');
		const fixture = path.join(dir, 'vivo.json');
		writeFileSync(fixture, JSON.stringify({ carriles: [] }));
		const result = cli(dir, ['carril', '--json'], { CELEBRA_BOARD_LIVE_FIXTURE: fixture });
		expect(result.status).toBe(0);
		expect(JSON.parse(result.out)).toHaveLength(9);
		const write = cli(dir, ['carril', 'f05-plataforma', '--rev=0', 'puerto=9000']);
		expect(write.status).not.toBe(0);
		expect(write.err).toContain('WORKTREE_LANES');
		expect(readdirSync(path.join(dir, 'carriles'))).toEqual(['integration.json']);
	});

	it('decide links a replacement cited in the text and refuses a mismatch', () => {
		const dir = makeBoard({
			decisiones: [
				{ id: 'd001', decision: 'Vieja', en: NOW, vigente: true },
				{ id: 'd002', decision: 'Otra', en: NOW, vigente: true },
			],
		});
		const linked = cli(dir, [
			'decide',
			'--sin-tarea',
			'decision=Nueva regla (reemplaza d001)',
			'motivo=x',
		]);
		expect(linked.status).toBe(0);
		expect(linked.out).toContain('d003 registrada (reemplaza d001)');
		expect(readJson(dir, 'decisiones', 'd001')).toMatchObject({ vigente: false });
		expect(readJson(dir, 'decisiones', 'd003')).toMatchObject({ reemplaza: 'd001' });
		const mismatch = cli(dir, [
			'decide',
			'--sin-tarea',
			'decision=Otra regla (reemplaza d002)',
			'reemplaza=d003',
		]);
		expect(mismatch.status).toBe(2);
		expect(mismatch.err).toContain('cita reemplaza d002 pero reemplaza=d003');
		const two = cli(dir, ['decide', '--sin-tarea', 'decision=Junta (reemplaza d002 y d003)']);
		expect(two.status).toBe(2);
		expect(two.err).toContain('indique cuál con reemplaza=dNNN');
		expect(readJson(dir, 'decisiones', 'd002')).toMatchObject({ vigente: true });
	});
});
