import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const SERVER_PATH = path.join(ROOT, 'scripts', 'board', 'view-server.mjs');
const NOW = '2026-10-20T20:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];
/** A valid closing summary (d178), so a finished fixture task can be archived. */
const CIERRE = {
	resumen: 'Hecho.',
	comprobaciones: ['validate:changed'],
	saltadas: [],
	pendientes: [],
	en: NOW,
};

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'cualquiera',
		requisitos: [],
		prompt: `Sigue .agent/rules/board.md con tarea ${id}.\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeBoard(collections: Record<string, Json[]>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-cli-'));
	dirs.push(dir);
	writeFileSync(
		path.join(dir, 'answers.json'),
		JSON.stringify({
			'gh pr list --state open --json number,headRefName,title --limit 100': '[]',
			'git worktree list --porcelain': '',
			'git ls-remote --heads origin': '',
		}),
	);
	for (const [name, docs] of Object.entries(collections)) {
		mkdirSync(path.join(dir, name), { recursive: true });
		for (const [index, { id, ...doc }] of docs.entries())
			writeFileSync(
				path.join(dir, name, `${id}.json`),
				JSON.stringify(name === 'tareas' ? { num: index + 1, ...doc } : doc),
			);
	}
	return dir;
}

function board(dir: string, ...args: string[]) {
	return boardEnv(dir, {}, ...args);
}

function boardEnv(dir: string, env: NodeJS.ProcessEnv, ...args: string[]) {
	const agent = args.find((a) => a.startsWith('--agente='))?.slice(9) ?? 'codex';
	const auto = !('CLAUDE_CODE_HOST_SESSION_ID' in env);
	if (
		auto &&
		['claim', 'release'].includes(args[0]) &&
		!args.some((a) => a.startsWith('--sesion='))
	)
		args.push(`--sesion=${agent === 'claude' ? 'local_' : ''}${agent}-test`);
	if (args[0] === 'claim') {
		if (!args[1].endsWith('-revision') && !args.some((a) => a.startsWith('--carril=')))
			args.push('--carril=f10-libre');
		// T126: a task created under the contract needs the session title; tests that check it pass their own.
		if (!args.some((a) => a.startsWith('--titulo=')))
			args.push(`--titulo=${claimTitle(dir, args)}`);
	}
	if (['set', 'update'].includes(args[0]) && !args.some((a) => a.startsWith('--agente=')))
		args.push('--coordinador');
	// A bitácora row needs its writer; --agente names the new agent or the reviewer in these commands.
	if (
		['add', 'move', 'review', 'archive', 'unarchive'].includes(args[0]) &&
		!args.some((a) => a.startsWith('--quien=') || a === '--coordinador')
	)
		args.push('--coordinador');
	return exec(dir, env, args);
}

/** `f10 · T3 · prueba` for a claim in f10-libre of task 3; a review runs in f04. */
function claimTitle(dir: string, args: string[]) {
	const file = path.join(dir, 'tareas', `${args[1]}.json`);
	const byNumber = /^T\d+$/.test(args[1]) ? args[1].slice(1) : undefined;
	const num = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).num : byNumber;
	const given = args.find((a) => a.startsWith('--carril='))?.slice(9);
	const lane = given === 'integration' ? 'f04' : given;
	return `${/-revision(-\d+)?$/.test(args[1]) || !lane ? 'f04' : lane.split('-')[0]} · T${num} · prueba`;
}

/** Runs the CLI exactly as given, without the test defaults of `board`. */
function raw(dir: string, ...args: string[]) {
	return exec(dir, {}, args);
}

function exec(dir: string, env: NodeJS.ProcessEnv, args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			INIT_CWD: ROOT,
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
			CLAUDE_CODE_HOST_SESSION_ID: '',
			...env,
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

/** Every bitácora row, from the daily JSONL files. */
const readLog = (dir: string): Json[] =>
	readdirSync(path.join(dir, 'bitacora'))
		.filter((f) => f.endsWith('.jsonl'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

/** Name → text of every entry of a monthly .zip, read with scripts/board/zip.mjs. */
function zipEntries(file: string): Record<string, string> {
	const probe = `const { readZip } = await import(process.argv[1]);
		console.log(JSON.stringify(Object.fromEntries(readZip(process.argv[2]).map((e) => [e.name, e.data.toString('utf8')]))));`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			probe,
			pathToFileURL(path.join(ROOT, 'scripts/board/zip.mjs')).href,
			file,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(String(result.stdout));
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** T130: a session task added now names its kind and its QUÉ SE BUSCA. */
const TYPED = ['tipo=auditoria', 'busca=Que funcione.\nTerminado cuando: pasa.'];

describe('pnpm board', () => {
	it('assigns fixed numbers after the highest task or archive number, including finished tasks', () => {
		const dir = makeBoard({});
		const add = (id: string, ...extra: string[]) =>
			board(dir, 'add', id, `titulo=${id}`, 'urgencia=normal', 'actor=coordinador', ...extra);
		expect(add('first').status).toBe(0);
		expect(readTask(dir, 'first').num).toBe(1);
		expect(add('manual', 'num=100').status).toBe(2);
		expect(board(dir, 'set', 'first', '--rev=1', 'estado=cancelada').err).toContain(
			'falta --motivo',
		);
		// T129: the cancellation writes its cierre, so «Archivar» needs no separate close.
		expect(
			board(dir, 'set', 'first', '--rev=1', 'estado=cancelada', '--motivo=Duplicada.').status,
		).toBe(0);
		expect(readTask(dir, 'first').cierre).toMatchObject({ resumen: 'Duplicada.', riesgos: [] });
		expect(board(dir, 'archive', 'first', '--rev=2').status).toBe(0);
		expect(add('second').status).toBe(0);
		expect(readTask(dir, 'second').num).toBe(2);

		const reserved = makeBoard({
			tareas: [task('cancelled', { estado: 'cancelada', num: 21 })],
			archivo: [{ id: 'old', estado: 'comprobada', num: 40 }],
		});
		expect(
			board(
				reserved,
				'add',
				'new',
				'titulo=Nueva',
				'urgencia=normal',
				'actor=sesion',
				...TYPED,
			).status,
		).toBe(0);
		expect(readTask(reserved, 'new').num).toBe(41);
	});

	it('prints requisitos as readable text in list and show (T41)', () => {
		const dir = makeBoard({
			tareas: [
				task('board-agent-alignment', {
					num: 35,
					titulo: 'Dividir reglas del tablero',
					estado: 'en curso',
				}),
				task('sigue', {
					num: 36,
					requisitos: [{ tipo: 'tarea', ref: 'board-agent-alignment' }],
				}),
			],
		});
		expect(board(dir, 'list').out).toContain('— Espera T35 · Dividir reglas del tablero');
		const shown = board(dir, 'show', 'sigue').out;
		expect(shown).toContain('○ Termina T35 · Dividir reglas del tablero');
		expect(shown).not.toContain('tarea board-agent-alignment');
	});

	it('resolves show, claim and set by fixed number while preserving canonical ids and ownership', () => {
		const dir = makeBoard({ tareas: [task('numbered', { num: 31 })] });
		expect(JSON.parse(board(dir, 'show', 'T31', '--json').out).id).toBe('numbered');
		expect(board(dir, 'show', 'T310').status).toBe(2);
		expect(board(dir, 'claim', 'T31', '--agente=codex').status).toBe(0);
		expect(
			board(dir, 'set', 'T31', '--rev=2', '--agente=codex', '--sesion=other', 'ahora=stolen')
				.status,
		).toBe(2);
		expect(
			board(
				dir,
				'set',
				'T31',
				'--rev=1',
				'--agente=codex',
				'--sesion=codex-test',
				'ahora=stale',
			).status,
		).toBe(2);
		expect(
			board(
				dir,
				'set',
				'T31',
				'--rev=2',
				'--agente=codex',
				'--sesion=codex-test',
				'ahora=updated',
			).status,
		).toBe(0);
		expect(readTask(dir, 'numbered')).toMatchObject({ num: 31, rev: 3, ahora: 'updated' });
		expect(JSON.parse(board(dir, 'show', 'T31', '--json').out).id).toBe('numbered');
		expect(readdirSync(path.join(dir, 'tareas'))).toEqual(['numbered.json']);
		expect(
			board(dir, 'set', 'T31', '--rev=3', '--agente=codex', '--sesion=codex-test', 'num=32')
				.status,
		).toBe(2);
		const data = path.join(dir, 'data.json');
		writeFileSync(data, JSON.stringify({ num: 32 }));
		expect(
			board(
				dir,
				'set',
				'T31',
				'--rev=3',
				'--agente=codex',
				'--sesion=codex-test',
				`--data=${data}`,
			).status,
		).toBe(2);
		expect(readTask(dir, 'numbered').num).toBe(31);
	});

	it('rejects ambiguous fixed numbers instead of choosing a task to read or mutate', () => {
		const dir = makeBoard({ tareas: [task('one', { num: 3 }), task('two', { num: 3 })] });
		for (const cmd of ['show', 'set', 'claim']) {
			const result = board(dir, cmd, 'T3', '--agente=codex', '--rev=1', 'ahora=wrong');
			expect(result.status).toBe(2);
			expect(result.err).toContain('número de tarea repetido');
		}
		expect(readTask(dir, 'one').rev).toBe(1);
		expect(readTask(dir, 'two').rev).toBe(1);
	});

	it('lists a final review group like the view, including review-only boards and agent filters', () => {
		const dir = makeBoard({
			tareas: [
				task('ready', { num: 31 }),
				task('review', {
					estado: 'en revision',
					num: 32,
					actualizado: '2026-10-21T20:00:00Z',
				}),
				task('done', { estado: 'hecha', num: 33 }),
				task('merged', {
					estado: 'unida',
					pr: '#1',
					num: 34,
					actualizado: '2026-10-19T20:00:00Z',
				}),
				task('archived', { estado: 'hecha', archivada: NOW }),
				task('verified', { estado: 'comprobada' }),
				task('other', { estado: 'en revision', agente: 'claude' }),
			],
		});
		const result = board(dir, 'list', '--agente=codex');
		expect(result.status).toBe(0);
		expect(result.out).toContain('T31 ready');
		expect(result.out).toContain('En revisión (3):');
		expect(result.out.indexOf('En revisión')).toBeGreaterThan(result.out.indexOf('Usted:'));
		expect(result.out).toContain('T32 review');
		expect(result.out).not.toMatch(/archived|verified|other/);
		const rows = JSON.parse(board(dir, 'list', '--agente=codex', '--json').out);
		expect(rows.map((r: Json) => [r.num, r.n, r.stage])).toEqual([
			[31, 1, 'lista'],
			[32, null, 'revision'],
			[33, null, 'revision'],
			[34, null, 'revision'],
		]);
		expect(board(dir, 'next', '--agente=codex').out).toContain('T31 ready');
		expect(board(dir, 'show', 'T31').out).toContain('T31 ready');
		const only = makeBoard({ tareas: [task('only', { estado: 'en revision', num: 90 })] });
		expect(board(only, 'list').out).toContain('En revisión (1):');
		expect(board(only, 'list').out).toContain('T90 only');
		expect(JSON.parse(board(only, 'next', '--agente=codex', '--json').out)).toBeNull();
	});

	it('numbers a task saved without num on its next write and keeps that number after', () => {
		const dir = makeBoard({
			tareas: [task('vieja', { num: undefined }), task('otra', { num: 7 })],
			archivo: [{ id: 'archivada', num: 9, estado: 'hecha' }],
		});
		expect(readTask(dir, 'vieja').num).toBeUndefined();
		expect(board(dir, 'set', 'vieja', '--rev=1', 'ahora=uno').status).toBe(0);
		expect(readTask(dir, 'vieja')).toMatchObject({ num: 10, rev: 2 });
		expect(board(dir, 'set', 'vieja', '--rev=2', 'ahora=dos').status).toBe(0);
		expect(readTask(dir, 'vieja')).toMatchObject({ num: 10, rev: 3 });
		expect(readTask(dir, 'otra').num).toBe(7);
	});

	it('reports missing, invalid and duplicate numbers even on finished and archived tasks', () => {
		const dir = makeBoard({
			tareas: [
				task('missing', { num: undefined }),
				task('invalid', { num: 0 }),
				task('one', { num: 20 }),
				task('two', { num: 20, estado: 'cancelada', archivada: NOW }),
			],
		});
		const result = board(dir, 'verify', '--json');
		expect(result.status).toBe(1);
		const { inconsistencias } = JSON.parse(result.out);
		expect(inconsistencias).toEqual(
			expect.arrayContaining([
				{ id: 'missing', msg: expect.stringContaining('num debe ser') },
				{ id: 'invalid', msg: expect.stringContaining('num debe ser') },
				{ id: 'one', msg: expect.stringContaining('num repetido: T20') },
				{ id: 'two', msg: expect.stringContaining('num repetido: T20') },
			]),
		);
	});

	it('claims a derived implementation task with a lane even when it has an origin', () => {
		const dir = makeBoard({
			tareas: [task('derived', { origen: 'parent', carril: 'f10-libre' })],
		});
		expect(
			board(dir, 'claim', 'derived', '--agente=codex', '--carril=f07-invitaciones').status,
		).toBe(0);
		expect(readTask(dir, 'derived')).toMatchObject({
			origen: 'parent',
			carril: 'f07-invitaciones',
			candado: { carril: 'f07-invitaciones' },
		});
		expect(
			board(
				dir,
				'set',
				'derived',
				'--rev=2',
				'--agente=codex',
				'--sesion=codex-test',
				'estado=hecha',
			).status,
		).toBe(0);
	});

	it('recognizes a review by its SHA even without the review id suffix', () => {
		const dir = makeBoard({
			tareas: [task('audit', { origen: 'parent', revisionSha: 'a'.repeat(40) })],
		});
		const result = board(dir, 'claim', 'audit', '--agente=codex', '--carril=f07-invitaciones');
		expect(result.status).toBe(2);
		expect(result.err).toContain('omita --carril');
		expect(readTask(dir, 'audit').candado).toBeUndefined();
	});

	it('numbers the queue owner first, then by urgency, readiness and dependencies, and colors it', () => {
		const dir = makeBoard({
			tareas: [
				task('normal-lista'),
				task('alta-espera', {
					urgencia: 'alta',
					requisitos: [{ tipo: 'tarea', ref: 'base' }],
				}),
				task('base', { urgencia: 'baja' }),
				task('del-dueno', { toca: ['produccion'] }),
				task('sin-prompt', { prompt: undefined }),
			],
		});
		const { status, out } = board(dir, 'list', '--json');
		expect(status).toBe(0);
		const rows = JSON.parse(out) as { id: string; color: string }[];
		expect(rows.map((r) => [r.id, r.color])).toEqual([
			// d163: the owner's ready task comes first, whatever its urgency.
			['del-dueno', 'own'],
			// A blocked «alta» task still waits behind the task it needs.
			['base', 'auto'],
			['alta-espera', 'block'],
			['normal-lista', 'auto'],
			['sin-prompt', 'block'],
		]);
	});

	it('keeps a prerequisite before the owner task that waits for it', () => {
		const dir = makeBoard({
			tareas: [
				task('urgente', { urgencia: 'urgente' }),
				task('del-dueno', { actor: 'dueno', urgencia: 'baja' }),
				task('dueno-espera', {
					actor: 'dueno',
					requisitos: [{ tipo: 'tarea', ref: 'prep' }],
				}),
				task('prep', { estado: 'en curso' }),
			],
		});
		const rows = JSON.parse(board(dir, 'list', '--json').out) as {
			id: string;
			color: string;
		}[];
		// An owner task that is not ready yet is gray, so it keeps the usual order.
		expect(rows.map((r) => [r.id, r.color])).toEqual([
			['del-dueno', 'own'],
			['urgente', 'auto'],
			['prep', 'run'],
			['dueno-espera', 'block'],
		]);
	});

	it('keeps owner tasks and answers out of sight until their date and tasks are met', () => {
		const MODEL_PATH = path.join(ROOT, 'scripts', 'board', 'model.mjs');
		const tareas = [
			task('pronto', { urgencia: 'alta' }),
			task('dueno-fecha', {
				actor: 'dueno',
				requisitos: [{ tipo: 'fecha', ref: '2026-10-26T00:00:00Z' }],
			}),
			task('precio', {
				requisitos: [
					{ tipo: 'fecha', ref: '2026-12-10T00:00:00Z' },
					{ tipo: 'dueno', ref: 'Decidir el precio' },
				],
			}),
			task('base', { estado: 'en curso' }),
			task('tras-base', {
				requisitos: [
					{ tipo: 'tarea', ref: 'base' },
					{ tipo: 'dueno', ref: 'Elegir la foto' },
				],
			}),
			task('ya', { requisitos: [{ tipo: 'dueno', ref: 'Elegir el color' }] }),
		];
		// Prints the queue with colors and the owner answers due at a given time.
		const probe = String.raw`
			const m = await import(process.argv[1]);
			const board = { tareas: JSON.parse(process.argv[2]) };
			const at = (iso) => {
				const now = Date.parse(iso);
				return {
					queue: m.queue(board, now).map((t) => t.id + ':' + m.color(t, board, { now })),
					asks: m.ownerAsks(board, now).map(({ t, r }) => t.id + ':' + r.ref),
				};
			};
			console.log(JSON.stringify([at(process.argv[3]), at(process.argv[4])]));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(MODEL_PATH).href,
				JSON.stringify(tareas),
				NOW,
				'2026-12-11T00:00:00Z',
			],
			{ cwd: ROOT, allowFailure: true },
		);
		expect(result.status).toBe(0);
		const [before, after] = JSON.parse(String(result.stdout));
		expect(before.queue[0]).toBe('pronto:auto');
		// d276: a task that only waits for its date sits in the «Calendario», out of the queue.
		expect(before.queue).not.toContain('dueno-fecha:block');
		expect(before.asks).toEqual(['ya:Elegir el color']);
		expect(after.queue[0]).toBe('dueno-fecha:own');
		expect(after.asks).toEqual(expect.arrayContaining(['precio:Decidir el precio']));
		expect(after.asks).not.toContain('tras-base:Elegir la foto');
	});

	it('gives each agent only tasks it can finish alone', () => {
		const dir = makeBoard({
			tareas: [
				task('imagenes', { requiere: ['imagenes'] }),
				task('de-codex', { agente: 'codex' }),
				task('del-dueno', { actor: 'dueno' }),
			],
		});
		expect(JSON.parse(board(dir, 'next', '--agente=gemini', '--json').out).id).toBe('imagenes');
		expect(JSON.parse(board(dir, 'next', '--agente=claude', '--json').out)).toBeNull();
		expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out).id).toBe('de-codex');
		const claude = JSON.parse(board(dir, 'list', '--agente=claude', '--json').out);
		expect(claude.find((r: Json) => r.id === 'imagenes').color).toBe('block');
	});

	it('turns ready Codex or Gemini tasks green for the owner to paste, without changing claims', () => {
		const tareas = [
			task('normal'),
			task('de-codex', { agente: 'codex' }),
			task('de-gemini', { agente: 'gemini' }),
			task('imagenes', { requiere: ['imagenes'] }),
			task('cualquiera'),
			task('coordina', { actor: 'coordinador', agente: 'codex' }),
			task('apartada', {
				agente: 'codex',
				candado: { agente: 'codex', desde: NOW, sesion: 's1' },
			}),
			task('espera', { agente: 'codex', requisitos: [{ tipo: 'dueno', ref: 'Elegir' }] }),
		];
		// Prints, per task, who the owner pastes into and its color for everyone, Claude, Codex and Gemini
		// (an agent's color judges that agent's capabilities only; its tab hides other agents' tasks).
		const probe = String.raw`
			const m = await import(process.argv[1]);
			const board = JSON.parse(process.argv[2]);
			const color = (t, agente) => m.color(t, board, { agente });
			console.log(JSON.stringify({
				rows: board.tareas.map((t) => [t.id, m.ownerLaunches(t, board), color(t), color(t, 'claude'), color(t, 'codex'), color(t, 'gemini')]),
				queue: m.queue(board).map((t) => t.id),
				next: ['claude', 'codex', 'gemini'].map((a) => m.nextFor(a, board)?.id ?? null),
				claimable: board.tareas.filter((t) => m.claimable(t, 'codex', board)).map((t) => t.id),
			}));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(path.join(ROOT, 'scripts', 'board', 'model.mjs')).href,
				JSON.stringify({ tareas, decisiones: [] }),
			],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		const out = JSON.parse(String(result.stdout));
		expect(out.rows).toEqual([
			['normal', [], 'auto', 'auto', 'auto', 'auto'],
			['de-codex', ['codex'], 'own', 'auto', 'own', 'auto'],
			['de-gemini', ['gemini'], 'own', 'auto', 'auto', 'own'],
			// «cualquiera» that only Gemini can finish: the owner pastes it into Gemini.
			['imagenes', ['gemini'], 'own', 'block', 'block', 'own'],
			// «cualquiera» that Claude can finish starts alone.
			['cualquiera', [], 'auto', 'auto', 'auto', 'auto'],
			['coordina', [], 'auto', 'auto', 'auto', 'auto'],
			// Already claimed: the owner pasted it, so it is no longer theirs; its lock runs it (T172).
			['apartada', [], 'run', 'run', 'run', 'run'],
			['espera', [], 'block', 'block', 'block', 'block'],
		]);
		// d163: the paste tasks join the owner's turn at the top of the queue.
		expect(out.queue.slice(0, 3).sort()).toEqual(['de-codex', 'de-gemini', 'imagenes']);
		expect(out.next).toEqual(['cualquiera', 'de-codex', 'de-gemini']);
		// T172: a locked task is running, so nobody else can claim it.
		expect(out.claimable).toEqual(['normal', 'de-codex', 'cualquiera', 'coordina']);
	});

	it('labels paste tasks «Pegar en …» in the view with their own «Copiar prompt»', () => {
		const html = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');
		expect(html).toContain(
			"ownerLaunches, matches, isFinished, laneBusy, laneLines, promptWithLane, AGENT_REGISTRY } from '/model.mjs'",
		);
		expect(html).toContain("'Pegar en '+esc(to)");
		expect(html).toContain('data-copy="${esc(t.id)}">Copiar prompt</button>');
		expect(html).toContain("if(cp.dataset.copy!=='1')");
	});

	it('requires a #N pull request for review and merge states and normalizes its form', () => {
		const dir = makeBoard({
			tareas: [task('con-pr', { rama: 'fix/x' }), task('con-url'), task('auditoria')],
		});
		expect(board(dir, 'set', 'auditoria', '--rev=1', 'estado=en revision').status).toBe(0);
		const merged = board(dir, 'set', 'auditoria', '--rev=2', 'estado=unida');
		expect(merged.status).toBe(2);
		expect(merged.err).toContain('unida requiere pr=#<número>');
		const missing = board(dir, 'set', 'con-pr', '--rev=1', 'estado=en revision');
		expect(missing.status).toBe(2);
		expect(missing.err).toContain('en revision requiere pr=#<número>');
		expect(board(dir, 'set', 'con-pr', '--rev=1', 'estado=en revision', 'pr=475').status).toBe(
			0,
		);
		expect(readTask(dir, 'con-pr').pr).toBe('#475');
		const url = 'pr=https://github.com/fm-dev-mx/celebra-me/pull/473';
		expect(board(dir, 'set', 'con-url', '--rev=1', 'estado=unida', url).status).toBe(0);
		expect(readTask(dir, 'con-url').pr).toBe('#473');
		const bad = board(dir, 'set', 'con-url', '--rev=2', 'pr=pendiente');
		expect(bad.status).toBe(2);
		expect(bad.err).toContain('pr debe ser #<número>');
		const foreign = 'pr=https://github.com/otro/repo/pull/12';
		const other = board(dir, 'set', 'con-url', '--rev=2', foreign);
		expect(other.status).toBe(2);
		expect(other.err).toContain('pr de otro repositorio');
	});

	it('enforces the PR rule on a legacy record once a write touches its state', () => {
		const legacy = { pr: 'https://github.com/otro/repo/pull/12' };
		const dir = makeBoard({ tareas: [task('heredada', legacy)] });
		expect(board(dir, 'set', 'heredada', '--rev=1', 'ahora=sigue').status).toBe(0);
		const merged = board(dir, 'set', 'heredada', '--rev=2', 'estado=unida');
		expect(merged.status).toBe(2);
		expect(merged.err).toContain('pr de otro repositorio');
		expect(readTask(dir, 'heredada').estado).not.toBe('unida');
		expect(board(dir, 'set', 'heredada', '--rev=2', 'estado=unida', 'pr=12').status).toBe(0);
	});

	it('locks a task for one agent and refuses a move while locked', () => {
		const dir = makeBoard({ tareas: [task('compartida')] });
		expect(board(dir, 'claim', 'compartida', '--agente=codex').status).toBe(0);
		const other = board(dir, 'claim', 'compartida', '--agente=claude');
		expect(other.status).toBe(2);
		expect(other.err).toContain('ya la tiene codex');
		expect(board(dir, 'move', 'compartida', '--agente=claude').status).toBe(2);
		expect(board(dir, 'release', 'compartida', '--agente=codex').status).toBe(0);
		expect(board(dir, 'move', 'compartida', '--agente=claude').status).toBe(0);
		expect(readTask(dir, 'compartida')).toMatchObject({
			agente: 'claude',
			estado: 'pendiente',
			rev: 4,
		});
		// T172: claim starts the task and a release before it ends puts it back in the queue.
		expect(readLog(dir)).toEqual([
			expect.objectContaining({ de: 'pendiente', a: 'en curso', corrio: 'pnpm board claim' }),
			expect.objectContaining({
				de: 'en curso',
				a: 'pendiente',
				corrio: 'pnpm board release',
			}),
			expect.objectContaining({
				tarea: 'compartida',
				agente: { de: 'cualquiera', a: 'claude' },
				quien: 'coordinador',
			}),
		]);
	});

	it('records where a lock was taken and warns when a move lacks a capability', () => {
		const dir = makeBoard({ tareas: [task('fotos', { requiere: ['imagenes'] })] });
		const claim = board(
			dir,
			'claim',
			'fotos',
			'--agente=gemini',
			'--sesion=s1',
			'--carril=f08-demos',
			'--rama=feat/fotos',
			'--json',
		);
		expect(JSON.parse(claim.out).candado).toMatchObject({
			agente: 'gemini',
			sesion: 's1',
			carril: 'f08-demos',
			rama: 'feat/fotos',
		});
		board(dir, 'release', 'fotos', '--agente=gemini', '--sesion=s1');
		const move = board(dir, 'move', 'fotos', '--agente=codex');
		expect(move.status).toBe(0);
		expect(move.out).toContain('aviso: codex no tiene todo lo que pide requiere (imagenes)');
	});

	it('answers the aliases and keeps rotating backups of each overwrite', () => {
		const dir = makeBoard({ tareas: [task('alias')] });
		expect(JSON.parse(board(dir, 'get', 'alias', '--json').out).rev).toBe(1);
		for (let rev = 1; rev <= 7; rev++)
			expect(board(dir, 'update', 'alias', `--rev=${rev}`, `ahora=paso ${rev}`).status).toBe(
				0,
			);
		expect(readdirSync(path.join(dir, '.respaldos', 'tareas', 'alias'))).toHaveLength(2);
		expect(JSON.parse(board(dir, 'decision', 'decision=usar alias', '--json').out).id).toBe(
			'd001',
		);
		expect(JSON.parse(board(dir, 'log', '--json').out)[0].txt).toContain('usar alias');
		const verify = board(dir, 'verify', '--json');
		expect(verify.status).toBe(0);
		expect(JSON.parse(verify.out).inconsistencias).toEqual([]);
	});

	it('pins writes to the rev read, rejects bad shapes and logs estado changes', () => {
		const dir = makeBoard({ tareas: [task('pin')] });
		const stale = board(dir, 'set', 'pin', '--rev=0', 'estado=en curso');
		expect(stale.err).toContain('está en rev 1');
		expect(board(dir, 'set', 'pin', '--rev=1', 'urgencia=ya').err).toContain(
			'urgencia debe ser',
		);
		expect(board(dir, 'set', 'pin', '--rev=1', 'estado=en curso', '--quien=codex').status).toBe(
			0,
		);
		expect(readTask(dir, 'pin')).toMatchObject({ estado: 'en curso', rev: 2 });
		const [row] = readLog(dir);
		expect(row).toMatchObject({
			tarea: 'pin',
			de: 'pendiente',
			a: 'en curso',
			quien: 'codex',
		});
	});

	it('makes a cross-review executable before merge and binds completion to its SHA', () => {
		const dir = makeBoard({
			tareas: [
				task('origen', {
					agente: 'claude',
					rama: 'fix/origen',
					pr: 398,
					estado: 'en revision',
					cierre: CIERRE,
				}),
			],
		});
		const sha = 'a'.repeat(40);
		expect(board(dir, 'review', 'origen', '--agente=codex', `--sha=${sha}`).status).toBe(0);
		const reviewNum = readTask(dir, 'origen-revision').num;
		expect(reviewNum).toBe(2);
		expect(readTask(dir, 'origen-revision')).toMatchObject({
			agente: 'codex',
			origen: 'origen',
			rama: 'fix/origen',
			requisitos: [{ tipo: 'revision', ref: 'origen' }],
			revisionSha: sha,
		});
		expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out).id).toBe(
			'origen-revision',
		);
		expect(
			board(dir, 'claim', 'origen-revision', '--agente=codex', '--rama=fix/origen').status,
		).toBe(0);
		expect(
			board(
				dir,
				'set',
				'origen-revision',
				'--rev=2',
				'estado=hecha',
				'--agente=codex',
				'--sesion=codex-test',
			).status,
		).toBe(2);
		expect(
			board(
				dir,
				'set',
				'origen-revision',
				'--rev=2',
				'estado=hecha',
				'--agente=codex',
				'--sesion=codex-test',
				`--sha=${sha}`,
			).status,
		).toBe(0);
		expect(board(dir, 'release', 'origen-revision', '--agente=codex').status).toBe(0);
		expect(
			board(dir, 'review', 'origen', '--agente=codex', `--sha=${'b'.repeat(40)}`).status,
		).toBe(0);
		expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out)).toMatchObject({
			id: 'origen-revision-2',
			revisionSha: 'b'.repeat(40),
			vuelta: 2,
		});
		expect(readTask(dir, 'origen-revision')).toMatchObject({
			num: reviewNum,
			estado: 'hecha',
			revisionSha: sha,
		});
	});

	it('refuses a cross-review of a reopened cancelled task whose cierre breaks the contract (d255)', () => {
		const dir = makeBoard({
			tareas: [
				task('reabierta', {
					agente: 'claude',
					rama: 'feat/r',
					pr: 21,
					estado: 'pendiente',
					contrato: 2,
				}),
			],
		});
		const sha = 'a'.repeat(40);
		const cancel = board(
			dir,
			'set',
			'reabierta',
			'--rev=1',
			'estado=cancelada',
			'--motivo=Ya no hace falta.',
			'--coordinador',
		);
		expect(cancel.status).toBe(0);
		expect(readTask(dir, 'reabierta').cierre).toBeTruthy();
		expect(
			board(dir, 'set', 'reabierta', '--rev=2', 'estado=en revision', '--coordinador').status,
		).toBe(0);
		const refused = board(dir, 'review', 'reabierta', '--agente=codex', `--sha=${sha}`);
		expect(refused.status).toBe(2);
		expect(refused.err).toContain('reabierta su resumen de cierre no vale');
		expect(refused.err).toContain('falta cierre.resultado del código');
		expect(existsSync(path.join(dir, 'tareas', 'reabierta-revision.json'))).toBe(false);
		// «Le toca al coordinador» asks for it too, although the task has a cierre.
		expect(board(dir, 'sigue').out).toContain('Pedir el resumen de cierre de T1');
	});

	it('refuses a cross-review while the task has no closing summary (d255)', () => {
		const dir = makeBoard({
			tareas: [
				task('sin-cierre', {
					agente: 'claude',
					rama: 'feat/x',
					pr: 20,
					estado: 'en revision',
					contrato: 2,
				}),
			],
		});
		const sha = 'a'.repeat(40);
		const refused = board(dir, 'review', 'sin-cierre', '--agente=codex', `--sha=${sha}`);
		expect(refused.status).toBe(2);
		expect(refused.err).toContain('sin-cierre no tiene resumen de cierre (d255)');
		expect(refused.err).toContain('pnpm board close sin-cierre --resumen=');
		expect(existsSync(path.join(dir, 'tareas', 'sin-cierre-revision.json'))).toBe(false);
		// The coordinator gets no bypass either: it completes the summary with `close --coordinador`.
		expect(
			board(dir, 'review', 'sin-cierre', '--agente=codex', `--sha=${sha}`, '--coordinador')
				.status,
		).toBe(2);
		// The suggested command is complete for a `contrato: 2` task once each `…` is filled in.
		const suggested = /pnpm board close (.+)$/mu.exec(refused.err)?.[1] ?? '';
		const args = suggested
			.replace('<sha del PR>', sha)
			.replace('--resumen=…', '--resumen=Hecho.')
			.trim()
			.split(' ')
			.map((a) => a.replace('…', 'ninguna'));
		const closed = board(dir, 'close', ...args, '--coordinador');
		expect(closed.err).toBe('');
		expect(closed.status).toBe(0);
		expect(board(dir, 'review', 'sin-cierre', '--agente=codex', `--sha=${sha}`).status).toBe(0);
	});

	it('opens a new task per review round with its own prompt and picks the reviewer by d183', () => {
		const dir = makeBoard({
			tareas: [
				task('de-claude', {
					agente: 'claude',
					rama: 'feat/a',
					pr: 10,
					estado: 'en revision',
					cierre: CIERRE,
				}),
				task('de-codex', {
					agente: 'codex',
					rama: 'feat/b',
					pr: 11,
					estado: 'en revision',
					cierre: CIERRE,
				}),
				task('sin-autor', {
					rama: 'feat/c',
					pr: 12,
					estado: 'en revision',
					cierre: CIERRE,
				}),
			],
		});
		const [a, b, c] = ['a', 'b', 'c'].map((x) => x.repeat(40));
		expect(board(dir, 'review', 'de-claude', `--sha=${a}`).status).toBe(0);
		expect(readTask(dir, 'de-claude-revision')).toMatchObject({ agente: 'gemini', vuelta: 1 });
		expect(board(dir, 'review', 'de-codex', `--sha=${a}`).status).toBe(0);
		expect(readTask(dir, 'de-codex-revision').agente).toBe('claude');
		expect(board(dir, 'review', 'de-codex', '--agente=gemini', `--sha=${b}`).err).toContain(
			'd183: el trabajo de codex lo revisa claude',
		);
		expect(board(dir, 'review', 'sin-autor', `--sha=${a}`).err).toContain('falta --agente');
		// Same SHA: no new round.
		expect(board(dir, 'review', 'de-claude', `--sha=${a}`).out).toContain(
			`de-claude-revision ya revisa ${a}`,
		);
		expect(board(dir, 'review', 'de-claude', '--agente=codex', `--sha=${b}`).status).toBe(0);
		expect(board(dir, 'review', 'de-claude', `--sha=${c}`).status).toBe(0);
		const second = readTask(dir, 'de-claude-revision-2');
		expect(second).toMatchObject({
			agente: 'codex',
			vuelta: 2,
			revisionSha: b,
			origen: 'de-claude',
		});
		expect(second.titulo).toContain('vuelta 2 (bbbbbbb)');
		expect(second.prompt).toContain('SEGUNDA VUELTA');
		expect(second.prompt).toContain(`La vuelta anterior (de-claude-revision) revisó ${a}`);
		expect(second.prompt.split('\n')[0]).toBe(
			`f04 · T${second.num} · PR #10 · Revisión vuelta 2`,
		);
		expect(second.prompt).toContain(`\nsha: ${b}\n`);
		expect(second.prompt).toContain(`git diff ${a}..${b}`);
		expect(second.prompt).toContain('\nDECISIONES\n');
		const third = readTask(dir, 'de-claude-revision-3');
		expect(third).toMatchObject({ agente: 'gemini', vuelta: 3 });
		expect(third.prompt).toContain('TERCERA VUELTA');
		expect(third.prompt).toContain(`git diff ${b}..${c}`);
		expect(readTask(dir, 'de-claude-revision')).toMatchObject({ revisionSha: a, vuelta: 1 });
		const show = board(dir, 'show', 'de-claude-revision-2').out;
		expect(show).toContain('VUELTAS DE REVISIÓN');
		expect(show.indexOf('vuelta 1 · aaaaaaa')).toBeLessThan(show.indexOf('vuelta 2 · bbbbbbb'));
		expect(show.indexOf('vuelta 2 · bbbbbbb')).toBeLessThan(show.indexOf('vuelta 3 · ccccccc'));
		const html = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');
		expect(html).toContain('${roundsHtml(t)}');
	});

	it('refuses blocked, owner and closed claims and protects locks between sessions', () => {
		const dir = makeBoard({
			tareas: [
				task('blocked', { requisitos: [{ tipo: 'dueno', ref: 'approval' }] }),
				task('owner', { toca: ['produccion'] }),
				task('closed', { estado: 'hecha' }),
				task('first'),
				task('second'),
			],
		});
		for (const id of ['blocked', 'owner', 'closed'])
			expect(board(dir, 'claim', id, '--agente=codex').status).toBe(2);
		expect(board(dir, 'claim', 'first', '--agente=codex').status).toBe(0);
		expect(board(dir, 'claim', 'first', '--agente=codex', '--sesion=other').status).toBe(2);
		expect(board(dir, 'claim', 'second', '--agente=claude').status).toBe(2);
		expect(
			board(
				dir,
				'set',
				'first',
				'--rev=2',
				'ahora=stolen',
				'--agente=codex',
				'--sesion=other',
			).status,
		).toBe(2);
		expect(
			board(
				dir,
				'set',
				'first',
				'--rev=2',
				'candado=',
				'--agente=codex',
				'--sesion=codex-test',
			).status,
		).toBe(2);
		expect(board(dir, 'release', 'first', '--agente=codex', '--sesion=other').status).toBe(2);
		expect(readTask(dir, 'first').rev).toBe(2);
	});

	it('claims declared branches independently of task ids without inferring the caller branch', () => {
		const dir = makeBoard({
			tareas: [task('demo', { rama: 'feat/demo-xv-principal' }), task('audit')],
		});
		expect(board(dir, 'claim', 'demo', '--agente=codex').status).toBe(0);
		expect(readTask(dir, 'demo').candado.rama).toBe('feat/demo-xv-principal');
		board(dir, 'release', 'demo', '--agente=codex');
		expect(board(dir, 'claim', 'audit', '--agente=codex').status).toBe(0);
		expect(readTask(dir, 'audit').rama).toBeUndefined();
		expect(readTask(dir, 'audit').candado.rama).toBeUndefined();
	});

	it('accepts an explicit branch whose name differs from the task id', () => {
		const dir = makeBoard({ tareas: [task('landing')] });
		expect(board(dir, 'claim', 'landing', '--agente=codex', '--rama=feat/vitrina').status).toBe(
			0,
		);
		expect(readTask(dir, 'landing')).toMatchObject({
			rama: 'feat/vitrina',
			candado: { rama: 'feat/vitrina', carril: 'f10-libre' },
		});
	});

	it('allows only explicitly declared coordinator claims in canonical Integration', () => {
		const dir = makeBoard({ tareas: [task('coord', { actor: 'coordinador' }), task('code')] });
		expect(board(dir, 'claim', 'coord', '--agente=codex', '--carril=integration').status).toBe(
			2,
		);
		expect(
			board(dir, 'claim', 'code', '--agente=codex', '--carril=integration', '--coordinador')
				.status,
		).toBe(2);
		expect(readTask(dir, 'code').candado).toBeUndefined();
		expect(
			board(dir, 'claim', 'coord', '--agente=codex', '--carril=integration', '--coordinador')
				.status,
		).toBe(0);
		expect(readTask(dir, 'coord').candado).toMatchObject({
			carril: 'integration',
			sesion: 'codex-test',
			agente: 'codex',
		});
	});

	it('lets only the coordinator plan a canonical lane and claims it without --carril (d177)', () => {
		const dir = makeBoard({
			tareas: [
				task('planeada', { agente: 'codex' }),
				task('otra'),
				task('tercera'),
				// Finished before its release: the lock still holds the lane, for claim and for the card.
				task('vieja', {
					estado: 'hecha',
					candado: { agente: 'codex', desde: NOW, sesion: 's0', carril: 'f11-preview' },
				}),
			],
		});
		expect(raw(dir, 'plan', 'planeada', '--rev=1', '--carril=f10-libre').status).toBe(2);
		for (const lane of ['f04-integracion', 'integration'])
			expect(
				raw(dir, 'plan', 'planeada', '--rev=1', `--carril=${lane}`, '--coordinador').status,
			).toBe(2);
		// Every plan names the revision it read: a missing or stale one writes nothing.
		for (const rev of [[], ['--rev=5']])
			expect(
				raw(dir, 'plan', 'planeada', ...rev, '--carril=f10-libre', '--coordinador').status,
			).toBe(2);
		expect(readTask(dir, 'planeada')).toMatchObject({ rev: 1 });
		expect(readTask(dir, 'planeada').carrilPlaneado).toBeUndefined();
		const plan = raw(dir, 'plan', 'planeada', '--carril=f10-libre', '--coordinador', '--rev=1');
		expect(plan.status).toBe(0);
		expect(plan.out).toContain('Corre en: f10-libre · carpeta celebra-me-worktrees/f10-libre');
		expect(plan.out).toContain('Codex: abra el proyecto f10-libre');
		expect(readTask(dir, 'planeada')).toMatchObject({ carrilPlaneado: 'f10-libre', rev: 2 });
		// Only plan writes it: set refuses, and add needs the coordinator.
		expect(
			raw(dir, 'set', 'planeada', '--rev=2', 'carrilPlaneado=f09-docs', '--coordinador')
				.status,
		).toBe(2);
		const add = [
			'add',
			'nueva',
			'titulo=Nueva',
			'urgencia=normal',
			'actor=sesion',
			'carrilPlaneado=f09-docs',
			...TYPED,
		];
		expect(raw(dir, ...add).status).toBe(2);
		expect(raw(dir, ...add, '--coordinador').status).toBe(0);
		expect(readTask(dir, 'nueva').carrilPlaneado).toBe('f09-docs');
		// Clearing a plan also needs the revision read.
		expect(raw(dir, 'plan', 'nueva', '--carril=', '--coordinador').status).toBe(2);
		expect(raw(dir, 'plan', 'nueva', '--rev=1', '--carril=', '--coordinador').status).toBe(0);
		expect(readTask(dir, 'nueva').carrilPlaneado).toBeUndefined();
		// The prompt an agent receives starts with the lane.
		const next = raw(dir, 'next', '--agente=codex');
		expect(next.out).toContain('CARRIL\nCorre en: f10-libre');
		// A different lane needs the coordinator; the planned one needs no flag.
		const other = raw(
			dir,
			'claim',
			'planeada',
			'--agente=codex',
			'--sesion=s1',
			'--carril=f09-docs',
		);
		expect(other.status).toBe(2);
		expect(other.err).toContain('corre en f10-libre');
		expect(raw(dir, 'claim', 'planeada', '--agente=codex', '--sesion=s1').status).toBe(0);
		expect(readTask(dir, 'planeada')).toMatchObject({
			carril: 'f10-libre',
			candado: { carril: 'f10-libre', sesion: 's1' },
		});
		// Locked: the plan cannot move, and a task planned in the same lane says it is busy.
		expect(
			raw(dir, 'plan', 'planeada', '--rev=3', '--carril=f09-docs', '--coordinador').status,
		).toBe(2);
		expect(
			raw(dir, 'plan', 'otra', '--rev=1', '--carril=f10-libre', '--coordinador').status,
		).toBe(0);
		const show = raw(dir, 'show', 'otra');
		expect(show.out).toContain('f10 ocupado por T1; espere o pida otro carril');
		expect(raw(dir, 'claim', 'otra', '--agente=claude', '--sesion=local_s2').status).toBe(2);
		const moved = raw(
			dir,
			'claim',
			'otra',
			'--agente=claude',
			'--sesion=local_s2',
			'--carril=f12-release',
			'--coordinador',
		);
		expect(moved.status).toBe(0);
		expect(readTask(dir, 'otra')).toMatchObject({
			carril: 'f12-release',
			carrilPlaneado: 'f10-libre',
		});
		expect(
			raw(dir, 'plan', 'tercera', '--rev=1', '--carril=f11-preview', '--coordinador').out,
		).toContain('f11 ocupado por T4; espere o pida otro carril');
		expect(raw(dir, 'claim', 'tercera', '--agente=codex', '--sesion=s3').status).toBe(2);
	});

	it('shows «Corre en» on the card and the sheet and copies the prompt with its lane', () => {
		const html = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');
		expect(html).toContain('${runsHtml(t)}');
		expect(html).toContain('<div class="runbox">');
		expect(html).toContain('navigator.clipboard.writeText(text)');
		expect(html).toContain('const laneId=taskLane;');
		expect(html).toContain(
			'${taskLane(t)&&!runLines(t).length?`<span class="nm">${esc(taskLane(t))}</span>`:',
		);
		expect(html).toContain('const laneOf=t=>S.board.carriles.find(l=>l.id===taskLane(t));');
		expect(html).toContain("['Carril',taskLane(t)?");
		// Closing the sheet returns focus to the card's title button, not to the unfocusable article.
		expect(html).toContain('"] .tbtn`);if(b)b.focus()');
		expect(html).toMatch(
			/@media \(pointer:coarse\),\(max-width:560px\)\{\.sha\{[^}]*min-height:44px/,
		);
	});

	it('puts free lanes first within an urgency and keeps owner tasks and prerequisites ahead', () => {
		const lock = { agente: 'codex', desde: NOW, sesion: 's1', carril: 'f08-demos' };
		const tareas = [
			task('ocupada', { agente: 'claude', carrilPlaneado: 'f08-demos' }),
			task('sin-carril'),
			task('libre', { agente: 'claude', carrilPlaneado: 'f09-docs' }),
			task('origen', { estado: 'en revision', pr: '#7', rama: 'feat/x' }),
			task('origen-revision', { requisitos: [{ tipo: 'revision', ref: 'origen' }] }),
			task('dueno', { actor: 'dueno', urgencia: 'baja' }),
			task('urgente-ocupada', { urgencia: 'alta', carrilPlaneado: 'f08-demos' }),
			task('base', { carrilPlaneado: 'f08-demos' }),
			task('tras-base', {
				carrilPlaneado: 'f10-libre',
				requisitos: [{ tipo: 'tarea', ref: 'base' }],
			}),
			task('tiene', { num: 10, estado: 'en curso', candado: lock }),
		];
		const probe = String.raw`
			const m = await import(process.argv[1]);
			const board = { tareas: JSON.parse(process.argv[2]) };
			const at = (id) => board.tareas.find((t) => t.id === id);
			console.log(JSON.stringify({
				queue: m.queue(board).map((t) => t.id),
				ranks: ['libre', 'ocupada', 'sin-carril', 'origen-revision', 'tiene'].map((id) => m.laneRank(at(id), board)),
				lines: ['libre', 'ocupada', 'origen-revision', 'tiene', 'sin-carril'].map((id) => m.laneLines(at(id), board)),
				prompt: m.promptWithLane(at('origen-revision'), board),
			}));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(path.join(ROOT, 'scripts', 'board', 'model.mjs')).href,
				JSON.stringify(tareas),
			],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(result.status).toBe(0);
		const out = JSON.parse(String(result.stdout));
		// d163 owner first, then urgency; within «normal» a free lane (or a review) before a busy one or none,
		// «tiene» runs in the lane its own lock holds, and «base» still comes right before the task waiting for it.
		expect(out.queue).toEqual([
			'dueno',
			'urgente-ocupada',
			'libre',
			'origen-revision',
			'tiene',
			'base',
			'tras-base',
			'ocupada',
			'sin-carril',
		]);
		expect(out.ranks).toEqual([0, 2, 3, 0, 0]);
		const runs = 'Corre en: Integración (carpeta celebra-me), solo lectura';
		expect(out.lines).toEqual([
			['Corre en: f09-docs · carpeta celebra-me-worktrees/f09-docs', 'carril libre'],
			[
				'Corre en: f08-demos · carpeta celebra-me-worktrees/f08-demos',
				'f08 ocupado por T10; espere o pida otro carril',
			],
			[runs],
			[],
			// No planned lane: a free one is suggested (d191).
			[
				'Carril sugerido: f05-plataforma, libre (tarea sin categoría) · carpeta celebra-me-worktrees/f05-plataforma',
				'Codex o Gemini: abra el proyecto f05-plataforma',
			],
		]);
		expect(out.prompt.startsWith(`CARRIL\n${runs}\n\n`)).toBe(true);
	});

	it('prefers the lane of a task category without requiring it (d191)', () => {
		const lock = (carril: string) => ({ agente: 'codex', desde: NOW, sesion: 's1', carril });
		const tareas = [
			task('fuera', { agente: 'claude', categoria: 'docs', carrilPlaneado: 'f06-landing' }),
			task('sin-plan', { agente: 'claude', categoria: 'herramientas' }),
			task('propia', { agente: 'claude', categoria: 'docs', carrilPlaneado: 'f09-docs' }),
			task('demo-ocupada', { agente: 'claude', categoria: 'demos' }),
			task('sin-categoria', { agente: 'claude' }),
			task('tiene-f08', { num: 20, estado: 'en curso', candado: lock('f08-demos') }),
			task('tiene-f05', { num: 21, estado: 'en curso', candado: lock('f05-plataforma') }),
			task('mala', { categoria: 'otra' }),
		];
		const probe = String.raw`
			const m = await import(process.argv[1]);
			const board = { tareas: JSON.parse(process.argv[2]) };
			const at = (id) => board.tareas.find((t) => t.id === id);
			const ids = ['fuera', 'sin-plan', 'propia', 'demo-ocupada', 'sin-categoria'];
			console.log(JSON.stringify({
				lanes: m.CATEGORIA_CARRIL,
				queue: m.queue(board).map((t) => t.id).filter((id) => ids.includes(id)),
				ranks: ids.map((id) => m.laneRank(at(id), board)),
				suggested: ids.map((id) => m.suggestedLane(at(id), board)),
				lines: ['sin-plan', 'demo-ocupada', 'sin-categoria'].map((id) => m.laneLines(at(id), board)),
				mismatch: [m.categoryMismatch(at('fuera'), 'f06-landing'), m.categoryMismatch(at('propia'), 'f09-docs')],
				issues: m.taskIssues(at('mala')),
			}));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(path.join(ROOT, 'scripts', 'board', 'model.mjs')).href,
				JSON.stringify(tareas),
			],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(result.status).toBe(0);
		const out = JSON.parse(String(result.stdout));
		expect(out.lanes).toEqual({
			plataforma: 'f05-plataforma',
			landing: 'f06-landing',
			invitaciones: 'f07-invitaciones',
			demos: 'f08-demos',
			docs: 'f09-docs',
			herramientas: 'f10-libre',
			preview: 'f11-preview',
			release: 'f12-release',
		});
		// Its category's free lane first, then another free lane, then a busy one, then none.
		expect(out.ranks).toEqual([1, 0, 0, 2, 3]);
		expect(out.queue).toEqual(['propia', 'sin-plan', 'fuera', 'demo-ocupada', 'sin-categoria']);
		expect(out.suggested).toEqual([
			null,
			{ carril: 'f10-libre', propio: true },
			null,
			{ carril: 'f06-landing', propio: false },
			{ carril: 'f06-landing', propio: false },
		]);
		expect(out.lines).toEqual([
			[
				'Carril sugerido: f10-libre (categoría herramientas), libre · carpeta celebra-me-worktrees/f10-libre',
			],
			[
				'Carril sugerido: f06-landing, libre; f08-demos de su categoría demos está ocupado por T20 · carpeta celebra-me-worktrees/f06-landing',
			],
			[
				'Carril sugerido: f06-landing, libre (tarea sin categoría) · carpeta celebra-me-worktrees/f06-landing',
			],
		]);
		expect(out.mismatch).toEqual([
			'aviso: f06-landing no es el carril de su categoría docs (f09-docs)',
			null,
		]);
		expect(out.issues).toEqual([expect.stringContaining('categoria debe ser plataforma/')]);
	});

	it('plans a lane outside the category with a warning and suggests one in next (d191)', () => {
		const dir = makeBoard({
			tareas: [
				task('docs', { agente: 'codex', categoria: 'docs' }),
				task('herramienta', {
					agente: 'claude',
					categoria: 'herramientas',
					urgencia: 'alta',
				}),
			],
		});
		const plan = raw(dir, 'plan', 'docs', '--rev=1', '--carril=f06-landing', '--coordinador');
		expect(plan.status).toBe(0);
		expect(plan.out).toContain(
			'aviso: f06-landing no es el carril de su categoría docs (f09-docs)',
		);
		expect(readTask(dir, 'docs')).toMatchObject({ carrilPlaneado: 'f06-landing', rev: 2 });
		expect(raw(dir, 'show', 'docs').out).toContain(
			'  aviso: f06-landing no es el carril de su categoría docs (f09-docs)',
		);
		expect(raw(dir, 'next', '--agente=claude').out).toContain(
			'CARRIL\nCarril sugerido: f10-libre (categoría herramientas), libre',
		);
		expect(raw(dir, 'set', 'docs', '--rev=2', 'categoria=otra', '--coordinador').status).toBe(
			2,
		);
	});

	it('shows where a review runs in show and next, and plan still refuses it a lane', () => {
		const dir = makeBoard({
			tareas: [
				task('origen', { estado: 'en revision', pr: '#7', rama: 'feat/x' }),
				task('origen-revision', {
					agente: 'gemini',
					requisitos: [{ tipo: 'revision', ref: 'origen' }],
				}),
				task('libre', { agente: 'codex', carrilPlaneado: 'f09-docs' }),
			],
		});
		const runs = 'Corre en: Integración (carpeta celebra-me), solo lectura';
		expect(raw(dir, 'show', 'origen-revision').out).toContain(`  ${runs}`);
		expect(raw(dir, 'next', '--agente=gemini').out).toContain(`CARRIL\n${runs}\n`);
		expect(raw(dir, 'next', '--agente=codex').out).toContain('carril libre');
		const plan = raw(
			dir,
			'plan',
			'origen-revision',
			'--rev=1',
			'--carril=f10-libre',
			'--coordinador',
		);
		expect(plan.status).toBe(2);
		expect(plan.err).toContain('una revisión no tiene carril planeado');
	});

	it.each(['unknown', 'f04-integracion', ''])(
		'rejects non-canonical or missing lane %s without writing',
		(lane) => {
			const dir = makeBoard({ tareas: [task('location')] });
			const result = board(dir, 'claim', 'location', '--agente=codex', `--carril=${lane}`);
			expect(result.status).toBe(2);
			expect(result.err).toContain('carril canónico');
			expect(readTask(dir, 'location')).toMatchObject({ rev: 1 });
			expect(readTask(dir, 'location').candado).toBeUndefined();
		},
	);

	it('rejects lane claims on a review child without changing its revision or lock', () => {
		const dir = makeBoard({
			tareas: [
				task('origin', { pr: 474, estado: 'en revision' }),
				task('origin-revision', {
					origen: 'origin',
					requisitos: [{ tipo: 'revision', ref: 'origin' }],
				}),
			],
		});
		const result = board(
			dir,
			'claim',
			'origin-revision',
			'--agente=codex',
			'--carril=f10-libre',
		);
		expect(result.status).toBe(2);
		expect(result.err).toContain('omita --carril');
		expect(readTask(dir, 'origin-revision').rev).toBe(1);
		expect(readTask(dir, 'origin-revision').candado).toBeUndefined();
	});

	it('claims a soloLectura task without --carril in the lane it announces', () => {
		const dir = makeBoard({ tareas: [task('doc-audit', { soloLectura: true })] });
		const announced = 'Corre en: Integración (carpeta celebra-me), solo lectura';
		expect(board(dir, 'show', 'doc-audit').out).toContain(announced);
		const result = raw(dir, 'claim', 'doc-audit', '--agente=codex', '--sesion=codex-test');
		expect(result.status).toBe(0);
		const claimed = readTask(dir, 'doc-audit');
		expect(claimed.candado.agente).toBe('codex');
		// No lock lane: taskLane falls back to READONLY_LANE, the lane `show` announces.
		expect(claimed.candado.carril).toBeUndefined();
		expect(board(dir, 'show', 'doc-audit').out).toContain(announced);
	});

	it('keeps lock, lane and prompt on Integration when a soloLectura task is given a lane', () => {
		const dir = makeBoard({
			tareas: [
				task('doc-audit', { soloLectura: true }),
				task('doc-planned', { soloLectura: true, carrilPlaneado: 'f10-libre' }),
			],
		});
		const announced = 'Corre en: Integración (carpeta celebra-me), solo lectura';
		const explicit = board(dir, 'claim', 'doc-audit', '--agente=codex', '--carril=f10-libre');
		expect(explicit.status).toBe(2);
		expect(explicit.err).toContain('omita --carril');
		expect(readTask(dir, 'doc-audit').candado).toBeUndefined();
		const plan = board(
			dir,
			'plan',
			'doc-audit',
			'--rev=1',
			'--carril=f10-libre',
			'--coordinador',
		);
		expect(plan.status).toBe(2);
		expect(plan.err).toContain('no tiene carril planeado');
		expect(readTask(dir, 'doc-audit').carrilPlaneado).toBeUndefined();
		// A legacy planned lane is refused, never inherited, so the lock never disagrees with the prompt.
		const planned = raw(dir, 'claim', 'doc-planned', '--agente=codex', '--sesion=codex-test');
		expect(planned.status).toBe(2);
		expect(planned.err).toContain('plan --carril=');
		expect(readTask(dir, 'doc-planned').candado).toBeUndefined();
		for (const id of ['doc-audit', 'doc-planned']) {
			const shown = board(dir, 'show', id).out;
			expect(shown).toContain(announced);
			expect(shown).not.toContain('Corre en: f10-libre');
		}
		expect(
			board(dir, 'plan', 'doc-planned', '--rev=1', '--carril=', '--coordinador').status,
		).toBe(0);
		expect(
			raw(dir, 'claim', 'doc-planned', '--agente=codex', '--sesion=codex-test').status,
		).toBe(0);
		expect(readTask(dir, 'doc-planned').candado.carril).toBeUndefined();
	});

	it('requires successful or explicitly archived prerequisites and a current decision', () => {
		const dir = makeBoard({
			tareas: [
				task('cancelled', { estado: 'cancelada' }),
				task('wait', { requisitos: [{ tipo: 'tarea', ref: 'cancelled' }] }),
				task('missing', { requisitos: [{ tipo: 'tarea', ref: 'absent' }] }),
				task('old-decision', { requisitos: [{ tipo: 'decision', ref: 'd1', ok: true }] }),
				task('archived', { requisitos: [{ tipo: 'tarea', ref: 'finished' }] }),
			],
			decisiones: [{ id: 'd1', vigente: false }],
			archivo: [{ id: 'finished', estado: 'comprobada' }],
		});
		expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out).id).toBe('archived');
	});

	it.each([
		['tareas', 'cancelada', false],
		['archivo', 'cancelada', false],
		['tareas', 'en curso', false],
		['tareas', 'hecha', true],
		['tareas', 'unida', true],
		['tareas', 'comprobada', true],
		['archivo', 'comprobada', true],
		['archivo', undefined, false],
	])(
		'rechecks a task prerequisite in %s with state %s despite stored ok:true',
		(collection, estado, ok) => {
			const dependency = estado ? [task('dependency', { estado })] : [];
			const dir = makeBoard({
				tareas: [
					task('dependent', {
						requisitos: [{ tipo: 'tarea', ref: 'dependency', ok: true }],
					}),
					...(collection === 'tareas' ? dependency : []),
				],
				archivo: collection === 'archivo' ? dependency : [],
			});
			const shown = JSON.parse(board(dir, 'show', 'dependent', '--json').out);
			expect(shown.requisitos[0].ok).toBe(ok);
			expect(shown.stage).toBe(ok ? 'lista' : 'bloqueada');
			expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out)?.id ?? null).toBe(
				ok ? 'dependent' : null,
			);
			expect(board(dir, 'claim', 'dependent', '--agente=codex').status).toBe(ok ? 0 : 2);
		},
	);

	it.each([false, true, undefined])(
		'rechecks a decision with vigente=%s despite stored ok:true',
		(vigente) => {
			const dir = makeBoard({
				tareas: [
					task('dependent', { requisitos: [{ tipo: 'decision', ref: 'd1', ok: true }] }),
				],
				decisiones: vigente === undefined ? [] : [{ id: 'd1', vigente }],
			});
			expect(JSON.parse(board(dir, 'show', 'dependent', '--json').out).requisitos[0].ok).toBe(
				vigente === true,
			);
			expect(board(dir, 'claim', 'dependent', '--agente=codex').status).toBe(
				vigente === true ? 0 : 2,
			);
		},
	);

	it('refuses a bitácora row without a known writer and writes nothing', () => {
		const dir = makeBoard({ tareas: [task('base')] });
		const add = ['add', 'nueva', 'titulo=Nueva', 'urgencia=normal', 'actor=sesion', ...TYPED];
		expect(raw(dir, ...add).err).toContain('falta quién escribe la fila');
		expect(raw(dir, ...add, '--quien=sesion').err).toContain(
			'quien debe ser claude/codex/gemini/coordinador/dueno, no sesion',
		);
		expect(readdirSync(path.join(dir, 'tareas'))).toEqual(['base.json']);
		expect(raw(dir, ...add, '--quien=dueño').status).toBe(0);
		expect(
			board(dir, 'plan', 'nueva', '--rev=1', '--carril=f11-preview', '--coordinador').status,
		).toBe(0);
		const files = readdirSync(path.join(dir, 'bitacora'));
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
		expect(readLog(dir)).toEqual([
			expect.objectContaining({ tarea: 'nueva', de: '', a: 'pendiente', quien: 'dueno' }),
			expect.objectContaining({
				tarea: 'nueva',
				carril: { de: '', a: 'f11-preview' },
				quien: 'coordinador',
			}),
		]);
		expect(readLog(dir)[1]).not.toHaveProperty('de');
	});

	it('converts the old one-file-per-row bitácora into daily files without losing a row', () => {
		const dir = makeBoard({
			tareas: [task('a')],
			bitacora: [
				{
					id: '20261023T101500Z-a',
					tarea: 'a',
					de: '',
					a: 'pendiente',
					en: '2026-10-23T10:15:00Z',
					quien: '',
					corrio: 'pnpm board add',
					salio: '',
				},
				{
					id: 'b-20261023-a',
					tarea: 'a',
					de: 'pendiente',
					a: 'en_curso',
					en: '2026-10-23T11:00:00Z',
					quien: 'f09 · Tablero v3',
					corrio: '',
					salio: '',
				},
				{
					id: '2026-10-22-a-hecha',
					tarea: 'a',
					de: 'codex',
					a: 'claude',
					en: '2026-10-22T09:00:00Z',
					quien: 'dueño',
					corrio: 'pnpm board move',
					salio: '',
				},
				{
					id: 'a-2026-10-24T0100Z',
					tarea: 'a',
					de: 'sin carril',
					a: 'f12-release',
					en: '2026-10-24T01:00:00Z',
					quien: 'coordinador',
					corrio: 'pnpm board plan',
					salio: '',
					enlace: 'x',
				},
				{
					id: 'a-raya',
					tarea: 'a',
					de: '—',
					a: '—',
					en: '2026-10-24T02:00:00Z',
					quien: 'sesión',
					corrio: 'nota',
					salio: '',
				},
			],
		});
		const dry = board(dir, 'migrate-log', '--dry-run', '--json');
		expect(JSON.parse(dry.out)).toMatchObject({
			filas: 5,
			sinQuien: 3,
			agente: 1,
			carril: 1,
			escrito: false,
		});
		expect(readdirSync(path.join(dir, 'bitacora'))).toHaveLength(5);
		const run = JSON.parse(board(dir, 'migrate-log', '--json').out);
		expect(run).toMatchObject({
			filas: 5,
			escrito: true,
			dias: ['2026-10-22', '2026-10-23', '2026-10-24'],
		});
		expect(readdirSync(path.join(dir, 'bitacora')).sort()).toEqual([
			'2026-10-22.jsonl',
			'2026-10-23.jsonl',
			'2026-10-24.jsonl',
		]);
		expect(readdirSync(run.respaldo)).toHaveLength(5);
		const rows = readLog(dir);
		expect(rows).toHaveLength(5);
		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					archivo: '20261023T101500Z-a.json',
					de: '',
					a: 'pendiente',
					legado: true,
				}),
				expect.objectContaining({
					archivo: 'b-20261023-a.json',
					a: 'en curso',
					quienTexto: 'f09 · Tablero v3',
				}),
				expect.objectContaining({
					archivo: '2026-10-22-a-hecha.json',
					agente: { de: 'codex', a: 'claude' },
					quien: 'dueno',
				}),
				expect.objectContaining({
					archivo: 'a-2026-10-24T0100Z.json',
					carril: { de: '', a: 'f12-release' },
					enlace: 'x',
				}),
				expect.objectContaining({
					archivo: 'a-raya.json',
					de: '',
					a: '',
					quienTexto: 'sesión',
				}),
			]),
		);
		expect(rows.filter((r) => r.quien === undefined)).toHaveLength(3);
		expect(JSON.parse(board(dir, 'history', '--json').out).map((r: Json) => r.txt)).toContain(
			'a agente codex → claude pnpm board move',
		);
		expect(JSON.parse(board(dir, 'migrate-log', '--json').out)).toMatchObject({ filas: 0 });
	});

	it('archives only finished, unlocked tasks and logs archive and unarchive', () => {
		const dir = makeBoard({
			tareas: [
				task('done', { estado: 'comprobada', num: 34, cierre: CIERRE }),
				task('open'),
				task('held', {
					estado: 'unida',
					candado: { agente: 'claude', desde: NOW, carril: 'f12-release' },
				}),
			],
		});
		expect(board(dir, 'archive', 'done', '--rev=2').err).toMatch(/cambió/);
		expect(board(dir, 'archive', 'done', '--rev=1', '--quien=claude').status).toBe(0);
		const archived = readTask(dir, 'done');
		expect(archived.archivada).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(archived.rev).toBe(2);
		expect(board(dir, 'archive', 'done').status).toBe(0);
		expect(readTask(dir, 'done').rev).toBe(2);
		expect(board(dir, 'unarchive', 'done').status).toBe(0);
		expect(readTask(dir, 'done').archivada).toBeUndefined();
		const rows = readLog(dir);
		expect(rows.map((r) => [r.tarea, r.de, r.a, r.corrio]).sort()).toEqual([
			['done', 'archivada', 'comprobada', 'pnpm board unarchive'],
			['done', 'comprobada', 'archivada', 'pnpm board archive'],
		]);
		expect(board(dir, 'archive', 'open').err).toMatch(/solo se archivan tareas finalizadas/);
		expect(board(dir, 'archive', 'held').err).toMatch(/candado de claude/);
		expect(board(dir, 'set', 'done', '--rev=3', `archivada=${NOW}`).err).toMatch(/archivada/);
		expect(readTask(dir, 'open').archivada).toBeUndefined();
		expect(readTask(dir, 'held').rev).toBe(1);
	});

	it('writes the closing summary with close and refuses a pendiente without its task (d178)', () => {
		const lock = {
			agente: 'claude',
			desde: NOW,
			sesion: 'local_claude-test',
			carril: 'f11-preview',
		};
		const dir = makeBoard({
			tareas: [
				task('demos', {
					num: 11,
					estado: 'en revision',
					rama: 'feat/demos',
					pr: '#485',
					candado: lock,
				}),
				task('segunda-vuelta', { num: 58 }),
			],
		});
		const close = (...args: string[]) =>
			raw(dir, 'close', 'demos', '--agente=claude', '--sesion=local_claude-test', ...args);
		const before = readTask(dir, 'demos');
		expect(close('--resumen=Textos', '--pendiente=Falta la segunda vuelta').err).toContain(
			'pendiente sin tarea: «Falta la segunda vuelta»',
		);
		expect(close('--resumen=Textos', '--pendiente=Falta algo→T999').err).toContain(
			'apunta a T999, que no está en el tablero',
		);
		expect(close('--resumen=Textos', '--pendiente=Yo misma→T11').err).toContain(
			'la misma tarea',
		);
		expect(close('--pendiente=ninguno').err).toContain('cierre sin resumen');
		expect(raw(dir, 'close', 'demos', '--agente=codex', '--resumen=x').err).toMatch(
			/otra sesión/,
		);
		expect(readTask(dir, 'demos')).toEqual(before);
		const ok = close(
			'--resumen=Textos de las demos en «usted».',
			'--resumen=RSVP con sus textos.',
			'--comprobacion=validate:changed',
			'--comprobacion=type-check',
			'--saltada=ninguna',
			'--pendiente=Falta la segunda vuelta de revisión→T58',
		);
		expect(ok.status).toBe(0);
		expect(readTask(dir, 'demos').cierre).toEqual({
			resumen: 'Textos de las demos en «usted».\nRSVP con sus textos.',
			comprobaciones: ['validate:changed', 'type-check'],
			saltadas: [],
			pendientes: [{ texto: 'Falta la segunda vuelta de revisión', tarea: 'segunda-vuelta' }],
			en: expect.stringMatching(/^\d{4}-/),
			quien: 'claude',
		});
		// The coordinator completes it later; the flags it omits keep their value.
		expect(raw(dir, 'close', 'demos', '--coordinador', '--commit=6fb99dca7').status).toBe(0);
		const shown = raw(dir, 'show', 'demos').out;
		expect(shown).toContain('en revision (PR #485, 6fb99dca7)');
		expect(shown).toContain('Comprobaciones: validate:changed, type-check. Saltadas: ninguna.');
		expect(shown).toContain('Pendiente: Falta la segunda vuelta de revisión → T58');
		expect(readTask(dir, 'demos').cierre).toMatchObject({
			quien: 'coordinador',
			commit: '6fb99dca7',
		});
		expect(
			raw(
				dir,
				'set',
				'demos',
				'--rev=3',
				'--agente=claude',
				'--sesion=local_claude-test',
				'cierre={}',
			).err,
		).toMatch(/cierre requiere su comando/);
	});

	it('refuses to archive a finished task without its closing summary, never an unarchive (d178)', () => {
		const dir = makeBoard({
			tareas: [
				task('sin-cierre', { estado: 'unida', pr: '#12' }),
				task('vieja', { estado: 'comprobada', archivada: NOW }),
				task('huerfano', {
					estado: 'hecha',
					cierre: { ...CIERRE, pendientes: [{ texto: 'Algo', tarea: 'borrada' }] },
				}),
			],
		});
		expect(board(dir, 'archive', 'sin-cierre').err).toContain(
			'sin-cierre: Falta el resumen de cierre',
		);
		expect(raw(dir, 'show', 'sin-cierre').out).toContain(
			'CIERRE\n  Falta el resumen de cierre',
		);
		expect(board(dir, 'archive', 'huerfano').err).toContain(
			'Falta el resumen de cierre: el pendiente «Algo» apunta a borrada',
		);
		expect(board(dir, 'unarchive', 'vieja').status).toBe(0);
		expect(raw(dir, 'close', 'sin-cierre', '--coordinador', '--resumen=Unida.').status).toBe(0);
		expect(board(dir, 'archive', 'sin-cierre').status).toBe(0);
		expect(readTask(dir, 'sin-cierre').archivada).toBeDefined();
	});

	it('shows the closing summary above «Archivar» and disables it with its reason', () => {
		const html = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');
		expect(html).toContain("import { archiveBlock, signalLine } from '/cierre.mjs';");
		expect(html).toContain('const why=!arch&&!t.candado&&archiveBlock(t,S.board)');
		expect(html).toContain("${t.candado||why?'disabled':''}");
		expect(html).toMatch(
			/cierreHtml\(t\):`<p class="nopend">Sin resumen de cierre\.<\/p>`\}\s*<div class="fa"><button/,
		);
		expect(html).toContain('<h3>Cómo terminó</h3>${statusHtml(t)}${cierreHtml(t)}');
	});

	it('lets a coordinator release only a legacy lock without sesion', () => {
		const lock = { agente: 'claude', desde: NOW, carril: 'f12-release' };
		const dir = makeBoard({
			tareas: [
				task('legacy', { estado: 'unida', candado: lock }),
				// d274: a heartbeat under 2 h old keeps the session's lock out of the coordinator's reach.
				task('owned', {
					estado: 'unida',
					candado: { ...lock, sesion: 's1', latido: new Date().toISOString() },
				}),
			],
		});
		expect(board(dir, 'release', 'legacy', '--agente=claude').err).toMatch(/otra sesión/);
		expect(board(dir, 'release', 'legacy', '--agente=codex', '--coordinador').err).toMatch(
			/el candado es de claude/,
		);
		expect(board(dir, 'release', 'legacy', '--agente=claude', '--coordinador').status).toBe(0);
		expect(readTask(dir, 'legacy').candado).toBeUndefined();
		expect(board(dir, 'release', 'owned', '--agente=claude', '--coordinador').err).toMatch(
			/otra sesión/,
		);
		expect(readTask(dir, 'owned').candado.sesion).toBe('s1');
		expect(board(dir, 'release', 'owned', '--agente=claude', '--sesion=s1').status).toBe(0);
	});

	it('takes the Claude app session id from the environment and refuses other ids', () => {
		const dir = makeBoard({ tareas: [task('propia'), task('mano')] });
		const app = { CLAUDE_CODE_HOST_SESSION_ID: 'local_abc' };
		const claim = boardEnv(dir, app, 'claim', 'propia', '--agente=claude', '--json');
		expect(claim.status).toBe(0);
		expect(JSON.parse(claim.out).candado.sesion).toBe('local_abc');
		const internal = board(dir, 'claim', 'mano', '--agente=claude', '--sesion=5424a3c1');
		expect(internal.status).toBe(2);
		expect(internal.err).toMatch(/local_.*CLAUDE_CODE_HOST_SESSION_ID/);
		const empty = boardEnv(
			dir,
			{ CLAUDE_CODE_HOST_SESSION_ID: '' },
			'claim',
			'mano',
			'--agente=claude',
		);
		expect(empty.err).toMatch(/variable CLAUDE_CODE_HOST_SESSION_ID está vacía/);
		expect(readTask(dir, 'mano').candado).toBeUndefined();
		expect(
			board(dir, 'claim', 'mano', '--agente=codex', '--sesion=chat-1', '--carril=f09-docs')
				.status,
		).toBe(0);
		expect(readTask(dir, 'mano').candado.sesion).toBe('chat-1');
	});

	it('keeps the released session in sesion as history', () => {
		const lock = { agente: 'claude', desde: NOW, carril: 'f12-release' };
		const dir = makeBoard({
			tareas: [
				task('nombrada', { candado: { ...lock, sesion: 'local_a' } }),
				task('heredada', {
					candado: { ...lock, sesion: 'local_b' },
					sesion: { id: 'local_b', nombre: 'f12 · T9 · Vieja' },
				}),
			],
		});
		const app = { CLAUDE_CODE_HOST_SESSION_ID: 'local_a' };
		expect(
			boardEnv(
				dir,
				app,
				'release',
				'nombrada',
				'--agente=claude',
				'--nombre=f12 · T8 · Nueva',
			).status,
		).toBe(0);
		expect(readTask(dir, 'nombrada')).toMatchObject({
			sesion: { id: 'local_a', agente: 'claude', nombre: 'f12 · T8 · Nueva' },
		});
		expect(readTask(dir, 'nombrada').candado).toBeUndefined();
		expect(
			board(dir, 'release', 'heredada', '--agente=claude', '--sesion=local_b').status,
		).toBe(0);
		expect(readTask(dir, 'heredada').sesion).toEqual({
			id: 'local_b',
			agente: 'claude',
			nombre: 'f12 · T9 · Vieja',
		});
	});

	it('searches by T number, id, title and «ahora» without case or accents', () => {
		const probe = String.raw`
			const { matches } = await import(process.argv[1]);
			const t = { num: 34, id: 'fotos-serenata', titulo: 'Fotos Serenáta', ahora: 'Espera la reseña de Codex' };
			console.log(JSON.stringify([
				matches(t, 'SERENATA'), matches(t, 't34'), matches(t, 'T340'), matches({ ...t, num: 340 }, 'T34'),
				matches(t, 'resena codex'), matches(t, 'fotos-ser'), matches(t, 'olivia'), matches(t, '  '),
			]));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(path.join(ROOT, 'scripts', 'board', 'model.mjs')).href,
			],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
		);
		expect(JSON.parse(String(result.stdout))).toEqual([
			true,
			true,
			false,
			false,
			true,
			true,
			false,
			true,
		]);
	});

	it('archives from the view only for same-origin JSON requests to 127.0.0.1', () => {
		const dir = makeBoard({
			tareas: [task('done', { estado: 'hecha', cierre: CIERRE }), task('open')],
		});
		// Posts once per header set and prints each status, then the stored task.
		const probe = String.raw`
			import { request } from 'node:http';
			const { serveView } = await import(process.argv[1]);
			const { viewArchiver } = await import(process.argv[2]);
			const dir = process.env.CELEBRA_BOARD_DIR;
			const readOnly = await serveView(dir, 0);
			const server = await serveView(dir, 0, { archive: viewArchiver(dir) });
			const port = server.address().port;
			const own = 'http://127.0.0.1:' + port;
			const post = (headers, body, to = port) => new Promise((ok) => {
				const req = request({ host: '127.0.0.1', port: to, path: '/api/archivar', method: 'POST', headers }, (res) => {
					res.resume();
					res.on('end', () => ok(res.statusCode));
				});
				req.end(JSON.stringify(body));
			});
			const json = { 'content-type': 'application/json' };
			const ro = readOnly.address().port;
			const out = [
				await post({ ...json, origin: 'http://127.0.0.1:' + ro }, { id: 'done', archivar: true }, ro),
				await post({ ...json, origin: 'http://evil.example' }, { id: 'done', archivar: true }),
				await post({ ...json }, { id: 'done', archivar: true }),
				await post({ ...json, origin: own, host: 'localhost:' + port }, { id: 'done', archivar: true }),
				await post({ origin: own, 'content-type': 'text/plain' }, { id: 'done', archivar: true }),
				await post({ ...json, origin: own, 'sec-fetch-site': 'cross-site' }, { id: 'done', archivar: true }),
				await post({ ...json, origin: own }, { id: 'open', archivar: true }),
				await post({ ...json, origin: own }, { id: 'done', archivar: 'si' }),
				await post({ ...json, origin: own, 'sec-fetch-site': 'same-origin' }, { id: 'done', archivar: true, rev: 1 }),
			];
			console.log(JSON.stringify(out));
			for (const s of [server, readOnly]) {
				s.closeAllConnections();
				s.close();
			}
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				pathToFileURL(SERVER_PATH).href,
				pathToFileURL(SCRIPT_PATH).href,
			],
			{
				cwd: ROOT,
				allowFailure: true,
				env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, INIT_CWD: ROOT }),
			},
		);
		expect(JSON.parse(String(result.stdout))).toEqual([
			405, 403, 403, 403, 403, 403, 409, 400, 200,
		]);
		expect(readTask(dir, 'done').archivada).toBeDefined();
		expect(readTask(dir, 'open').archivada).toBeUndefined();
		const [row] = readLog(dir);
		expect(row).toMatchObject({ tarea: 'done', a: 'archivada', quien: 'dueno' });
	});

	it('exposes agent/lane/state reads and keeps a single Gemini identity', () => {
		const dir = makeBoard({ tareas: [task('art', { requiere: ['imagenes'] })] });
		const agents = JSON.parse(board(dir, 'agentes', '--json').out);
		expect(agents.map((a: Json) => a.id)).toEqual(['claude', 'codex', 'gemini']);
		expect(agents.find((a: Json) => a.id === 'gemini').capacidades).toContain('imagenes');
		expect(board(dir, 'agentes', 'antigravity', '--coordinador', '--rev=0').status).toBe(2);
		expect(
			board(
				dir,
				'agentes',
				'gemini',
				'--rev=0',
				'--coordinador',
				'capacidades=["imagenes"]',
				'--json',
			).status,
		).toBe(0);
		expect(JSON.parse(board(dir, 'next', '--agente=gemini', '--json').out).id).toBe('art');
		expect(JSON.parse(board(dir, 'carril', '--json').out)).toEqual([]);
		expect(JSON.parse(board(dir, 'estado', '--json').out)).toBeNull();
	});

	it('pushes the board to the view as soon as a write lands', () => {
		const dir = makeBoard({ tareas: [task('viva', { ahora: 'x'.repeat(100_000) })] });
		// Opens the stream, writes through the CLI, and prints the tasks of every pushed board.
		const probe = String.raw`
			import { request } from 'node:http';
			import { spawnSync } from 'node:child_process';
			const { serveView } = await import(process.argv[1]);
			const server = await serveView(process.env.CELEBRA_BOARD_DIR, 0);
			const seen = [];
			let writtenAt = 0;
			const done = (code) => { console.log(JSON.stringify(seen)); server.closeAllConnections(); server.close(); process.exit(code); };
			setTimeout(() => done(1), 8000);
			request({ port: server.address().port, path: '/api/stream' }, (res) => {
				let buf = '';
				res.on('data', (chunk) => {
					buf += chunk;
					const frames = buf.split('\n\n');
					buf = frames.pop();
					for (const m of frames) {
						if (!m.startsWith('data: ')) continue;
						seen.push(JSON.parse(m.slice(6)).tareas.map((t) => t.id + ':' + t.estado));
						if (seen.length === 1) {
							writtenAt = Date.now();
							spawnSync(process.execPath, [process.argv[2], 'set', 'viva', '--rev=1', 'estado=en curso', '--coordinador']);
						} else done(Date.now() - writtenAt < 1000 ? 0 : 1);
					}
				});
			}).end();
		`;
		const result = runCommand(
			process.execPath,
			['--input-type=module', '-e', probe, pathToFileURL(SERVER_PATH).href, SCRIPT_PATH],
			{
				cwd: ROOT,
				allowFailure: true,
				env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, INIT_CWD: ROOT }),
			},
		);
		expect(result.status).toBe(0);
		expect(JSON.parse(String(result.stdout))).toEqual([['viva:pendiente'], ['viva:en curso']]);
	});

	it('recovers missed events and corrupt JSON, and delivers to two SSE clients within one second', () => {
		const dir = makeBoard({ tareas: [task('recovery')] });
		const probe = String.raw`
			import { request } from 'node:http';
			import { EventEmitter } from 'node:events';
			import { readFileSync, writeFileSync } from 'node:fs';
			import { join } from 'node:path';
			const { serveView } = await import(process.argv[1]);
			const watchers=[];
			const watchFactory=()=>{ const w=new EventEmitter();w.close=()=>{};watchers.push(w);return w; };
			const options={reconcileMs:100,heartbeatMs:100,watchFactory};
			let server=await serveView(process.env.CELEBRA_BOARD_DIR,0,options);
			const file=join(process.env.CELEBRA_BOARD_DIR,'tareas','recovery.json');
			const original=readFileSync(file,'utf8');
			const get=()=>new Promise((resolve,reject)=>{
				request({host:'127.0.0.1',port:server.address().port,path:'/api/board'},res=>{
					let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
				}).on('error',reject).end();
			});
			const wait=async(fn)=>{for(let i=0;i<40;i++){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('condition timed out');};
			const sockets=[];const seen=[[],[]];
			try {
				for(let i=0;i<2;i++)await new Promise(resolve=>{
					const req=request({host:'127.0.0.1',port:server.address().port,path:'/api/stream'},res=>{
						let buf='';res.on('data',c=>{buf+=c;const frames=buf.split('\n\n');buf=frames.pop();
							for(const frame of frames)if(frame.startsWith('data: ')){seen[i].push(JSON.parse(frame.slice(6)).tareas[0].estado);resolve();}});
					});sockets.push(req);req.end();
				});
				const changed={...JSON.parse(original),estado:'en curso'};
				const start=Date.now();writeFileSync(file,JSON.stringify(changed));
				await wait(()=>seen.every(s=>s.includes('en curso')));
				const latency=Date.now()-start;
				writeFileSync(file,'{invalid');
				await wait(async()=> (await get()).status===503);
				writeFileSync(file,original);
				await wait(async()=> (await get()).status===200);
				watchers[0].emit('error',new Error('missed watcher'));
				await wait(()=>watchers.length>1);
				await wait(async()=> (await get()).status===200);
				for(const req of sockets)req.destroy();
				await new Promise(r=>{server.closeAllConnections();server.close(r);});
				server=await serveView(process.env.CELEBRA_BOARD_DIR,0,options);
				if((await get()).status!==200)throw new Error('restart did not converge');
				console.log(JSON.stringify({latency,clients:seen.length,recovered:true,restarted:true}));
				if(latency>=1000)process.exitCode=1;
			}finally{for(const req of sockets)req.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));}
		`;
		const result = runCommand(
			process.execPath,
			['--input-type=module', '-e', probe, pathToFileURL(SERVER_PATH).href],
			{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }) },
		);
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			clients: 2,
			recovered: true,
			restarted: true,
		});
	});

	it('serializes simultaneous claims and task numbers without stealing a live file lock', () => {
		const dir = makeBoard({ tareas: [task('race')] });
		const probe = String.raw`
			import { spawn } from 'node:child_process';
			import { readFileSync, writeFileSync, utimesSync, unlinkSync } from 'node:fs';
			import { join } from 'node:path';
			const { withLock }=await import(process.argv[2]);
			const run=(session)=>new Promise(resolve=>{
				const p=spawn(process.execPath,[process.argv[1],'claim','race','--agente=codex','--sesion='+session,'--carril=f10-libre','--rama=fix/race'],{stdio:'ignore'});
				p.on('exit',resolve);
			});
			const codes=await Promise.all([run('one'),run('two')]);
			const task=JSON.parse(readFileSync(join(process.env.CELEBRA_BOARD_DIR,'tareas','race.json'),'utf8'));
			const add=(id)=>new Promise(resolve=>{
				const p=spawn(process.execPath,[process.argv[1],'add',id,'titulo='+id,'urgencia=normal','actor=coordinador','--coordinador'],{stdio:'ignore'});
				p.on('exit',resolve);
			});
			const added=await Promise.all([add('first'),add('second')]);
			const nums=['first','second'].map(id=>JSON.parse(readFileSync(join(process.env.CELEBRA_BOARD_DIR,'tareas',id+'.json'),'utf8')).num).sort();
			const lock=join(process.env.CELEBRA_BOARD_DIR,'.lock');writeFileSync(lock,'live');utimesSync(lock,1,1);
			let refused=false;try{withLock(process.env.CELEBRA_BOARD_DIR,()=>{}, {waitMs:0});}catch{refused=true;}
			const retained=readFileSync(lock,'utf8');unlinkSync(lock);
			console.log(JSON.stringify({codes:codes.sort(),rev:task.rev,added,nums,refused,retained}));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				probe,
				SCRIPT_PATH,
				pathToFileURL(path.join(ROOT, 'scripts/board/store.mjs')).href,
			],
			{ cwd: ROOT, env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir }) },
		);
		expect(JSON.parse(result.stdout)).toEqual({
			codes: [0, 2],
			rev: 2,
			added: [0, 0],
			nums: [2, 3],
			refused: true,
			retained: 'live',
		});
	});
});

describe('closing cleanup (d186)', () => {
	it('moves the prompt of a task reaching unida to the month .zip and drops its lane and lock', () => {
		const candado = { agente: 'codex', sesion: 'codex-test', carril: 'f10-libre', desde: NOW };
		const dir = makeBoard({
			tareas: [
				task('cerrar', {
					estado: 'en revision',
					pr: '#7',
					rama: 'chore/cerrar',
					carril: 'f10-libre',
					candado: { ...candado, rama: 'chore/cerrar' },
					cierre: CIERRE,
				}),
				task('abierta', { estado: 'en curso', carril: 'f09-docs' }),
			],
		});
		const r = raw(
			dir,
			'set',
			'cerrar',
			'--rev=1',
			'estado=unida',
			'--agente=codex',
			'--sesion=codex-test',
		);
		expect(r.status).toBe(0);
		const t = readTask(dir, 'cerrar');
		expect(t).not.toHaveProperty('prompt');
		expect(t).not.toHaveProperty('carril');
		expect(t).not.toHaveProperty('candado');
		expect(t.sesion).toEqual({ id: 'codex-test', agente: 'codex' });
		expect(t.cierre).toEqual(CIERRE);
		const month = String(t.actualizado).slice(0, 7);
		expect(zipEntries(path.join(dir, 'mensual', `${month}.zip`))).toEqual({
			'prompts/cerrar.rev2.md': task('cerrar').prompt,
		});
		// An open task keeps its prompt and lane.
		expect(board(dir, 'set', 'abierta', '--rev=1', 'ahora=sigue').status).toBe(0);
		expect(readTask(dir, 'abierta')).toMatchObject({
			carril: 'f09-docs',
			prompt: expect.any(String),
		});
	});

	it('keeps the prompt a closing write clears explicitly', () => {
		const dir = makeBoard({
			tareas: [task('x', { estado: 'hecha', evidencia: { salio: 'ok' } })],
		});
		expect(board(dir, 'set', 'x', '--rev=1', 'estado=comprobada', 'prompt=').status).toBe(0);
		const month = String(readTask(dir, 'x').actualizado).slice(0, 7);
		expect(zipEntries(path.join(dir, 'mensual', `${month}.zip`))).toEqual({
			'prompts/x.rev2.md': task('x').prompt,
		});
	});

	it('keeps every closed prompt in the same month file', () => {
		const dir = makeBoard({
			tareas: [
				task('a', { estado: 'hecha', evidencia: { salio: 'ok' } }),
				task('b', { estado: 'hecha', evidencia: { salio: 'ok' } }),
			],
		});
		expect(board(dir, 'set', 'a', '--rev=1', 'estado=comprobada').status).toBe(0);
		expect(board(dir, 'set', 'b', '--rev=1', 'estado=comprobada').status).toBe(0);
		const month = String(readTask(dir, 'a').actualizado).slice(0, 7);
		expect(Object.keys(zipEntries(path.join(dir, 'mensual', `${month}.zip`))).sort()).toEqual([
			'prompts/a.rev2.md',
			'prompts/b.rev2.md',
		]);
	});
});

describe('light backups (d185)', () => {
	const copies = (dir: string, id: string) => {
		try {
			return readdirSync(path.join(dir, '.respaldos', 'tareas', id)).sort();
		} catch {
			return [];
		}
	};

	it('keeps 2 copies per document and none for a finished task', () => {
		const dir = makeBoard({
			tareas: [
				task('abierta', { estado: 'en curso' }),
				task('lista', { estado: 'hecha', evidencia: { salio: 'ok' } }),
			],
		});
		for (let rev = 1; rev <= 4; rev++)
			expect(board(dir, 'set', 'abierta', `--rev=${rev}`, `ahora=paso ${rev}`).status).toBe(
				0,
			);
		expect(copies(dir, 'abierta')).toHaveLength(2);
		expect(board(dir, 'set', 'lista', '--rev=1', 'ahora=cerrada').status).toBe(0);
		expect(copies(dir, 'lista')).toEqual([]);
	});

	it('lists surplus copies with --dry-run and removes them only with --aplicar', () => {
		const dir = makeBoard({
			tareas: [
				task('abierta', { estado: 'en curso' }),
				task('vieja', { estado: 'cancelada', cierre: CIERRE }),
			],
		});
		const seed = (id: string, names: string[]) => {
			mkdirSync(path.join(dir, '.respaldos', 'tareas', id), { recursive: true });
			for (const n of names)
				writeFileSync(path.join(dir, '.respaldos', 'tareas', id, n), '{}');
		};
		seed('abierta', ['1.json', '2.json', '3.json', '4.json', '5.json']);
		seed('vieja', ['1.json', '2.json']);
		seed('compactada', ['1.json']);
		const dry = raw(dir, 'prune-backups', '--dry-run', '--json');
		expect(dry.status).toBe(0);
		const listed = JSON.parse(dry.out);
		expect(listed.aplicado).toBe(false);
		expect(listed.sobran.map((x: Json) => x.archivo).sort()).toEqual([
			'.respaldos/tareas/abierta/1.json',
			'.respaldos/tareas/abierta/2.json',
			'.respaldos/tareas/abierta/3.json',
			'.respaldos/tareas/compactada/1.json',
			'.respaldos/tareas/vieja/1.json',
			'.respaldos/tareas/vieja/2.json',
		]);
		expect(copies(dir, 'abierta')).toHaveLength(5);
		expect(raw(dir, 'prune-backups').out).toContain('Para quitarlos: --aplicar');
		expect(copies(dir, 'abierta')).toHaveLength(5);
		expect(raw(dir, 'prune-backups', '--aplicar').status).toBe(0);
		expect(copies(dir, 'abierta')).toEqual(['4.json', '5.json']);
		expect(copies(dir, 'vieja')).toEqual([]);
		expect(readdirSync(path.join(dir, '.respaldos', 'tareas'))).toEqual(['abierta']);
	});
});

describe('monthly archive (d187)', () => {
	const old = '2026-10-01T10:00:00Z';
	const finished = (id: string, fields: Json = {}) =>
		task(id, { estado: 'unida', pr: '#492', cierre: CIERRE, archivada: old, ...fields });

	it('summarizes tasks archived 7+ days ago, keeps them in the .zip and restores one', () => {
		const dir = makeBoard({
			tareas: [
				finished('tablero-arreglos-cli'),
				finished('reciente', { archivada: new Date().toISOString() }),
				finished('sin-pr', { estado: 'cancelada', pr: undefined }),
				task('espera', { requisitos: [{ tipo: 'tarea', ref: 'tablero-arreglos-cli' }] }),
			],
		});
		const original = readFileSync(
			path.join(dir, 'tareas', 'tablero-arreglos-cli.json'),
			'utf8',
		);
		const dry = raw(dir, 'compact', '--antes=7d', '--dry-run');
		expect(dry.status).toBe(0);
		expect(dry.out).toContain('Se resumirían 2 tareas archivadas:');
		expect(dry.out).toContain('T1 tablero-arreglos-cli · unida · PR #492 · 2026-10-01');
		expect(readdirSync(path.join(dir, 'tareas'))).toHaveLength(4);

		expect(raw(dir, 'compact', '--antes=7d').status).toBe(0);
		expect(readdirSync(path.join(dir, 'tareas')).sort()).toEqual([
			'espera.json',
			'reciente.json',
		]);
		expect(readFileSync(path.join(dir, 'mensual', 'resumen-2026-10.md'), 'utf8')).toBe(
			'# Tareas resumidas · 2026-10\n\n- T1 tablero-arreglos-cli · unida · PR #492 · 2026-10-01\n- T3 sin-pr · cancelada · 2026-10-01\n',
		);
		const zip = zipEntries(path.join(dir, 'mensual', '2026-10.zip'));
		expect(zip['tareas/tablero-arreglos-cli.json']).toBe(original);
		expect(
			JSON.parse(
				readFileSync(path.join(dir, 'archivo', 'tablero-arreglos-cli.json'), 'utf8'),
			),
		).toMatchObject({
			num: 1,
			estado: 'unida',
			pr: '#492',
			zip: 'mensual/2026-10.zip',
		});
		// The archivo record still meets requisitos and keeps the number taken.
		expect(JSON.parse(board(dir, 'show', 'espera', '--json').out).requisitos[0].ok).toBe(true);
		expect(
			board(dir, 'add', 'nueva', 'titulo=Nueva', 'urgencia=normal', 'actor=coordinador')
				.status,
		).toBe(0);
		expect(readTask(dir, 'nueva').num).toBe(5);

		expect(raw(dir, 'restore', 'tablero-arreglos-cli', '--dry-run').out).toContain(
			'se restauraría',
		);
		expect(readdirSync(path.join(dir, 'tareas'))).not.toContain('tablero-arreglos-cli.json');
		expect(raw(dir, 'restore', 'tablero-arreglos-cli').status).toBe(0);
		expect(readTask(dir, 'tablero-arreglos-cli')).toEqual(JSON.parse(original));
		expect(readdirSync(path.join(dir, 'archivo'))).toEqual(['sin-pr.json']);
		expect(raw(dir, 'restore', 'tablero-arreglos-cli').err).toContain('ya está en el tablero');
	});

	it('keeps a compacted id reserved and one summary line per task across restore cycles', () => {
		const dir = makeBoard({ tareas: [finished('same')] });
		expect(raw(dir, 'compact', '--antes=7d').status).toBe(0);
		const dup = board(
			dir,
			'add',
			'same',
			'titulo=Otra',
			'urgencia=normal',
			'actor=coordinador',
		);
		expect(dup.status).toBe(2);
		expect(dup.err).toContain('same está compactada: use pnpm board restore same');
		expect(raw(dir, 'restore', 'same').status).toBe(0);
		expect(raw(dir, 'compact', '--antes=7d').status).toBe(0);
		expect(readFileSync(path.join(dir, 'mensual', 'resumen-2026-10.md'), 'utf8')).toBe(
			'# Tareas resumidas · 2026-10\n\n- T1 same · unida · PR #492 · 2026-10-01\n',
		);
	});

	it('refuses an age that is not <n>d', () => {
		const dir = makeBoard({ tareas: [finished('x')] });
		const r = raw(dir, 'compact', '--antes=semana');
		expect(r.status).toBe(2);
		expect(r.err).toContain('--antes debe ser <n>d');
	});

	it('leaves replaced decisions out of history unless --todas', () => {
		const dir = makeBoard({
			decisiones: [
				{ id: 'd001', decision: 'Vieja', en: NOW, vigente: false },
				{ id: 'd002', decision: 'Nueva', en: NOW, vigente: true },
			],
		});
		const txt = (...args: string[]) =>
			JSON.parse(raw(dir, 'history', '--json', ...args).out).map((r: Json) => r.txt);
		expect(txt()).toEqual(['d002 Nueva']);
		expect(txt('--todas').sort()).toEqual(['d001 (reemplazada) Vieja', 'd002 Nueva']);
	});
});

describe('subtasks and calendar (d174, d276)', () => {
	it('stores padre by id, refuses a loop and lists the subtasks and the calendar', () => {
		const dir = makeBoard({
			tareas: [
				task('madre'),
				task('hija', { fase: 1 }),
				task('espera-fecha', {
					requisitos: [{ tipo: 'fecha', ref: '2099-01-05T15:00:00Z' }],
				}),
			],
		});
		expect(board(dir, 'set', 'hija', '--rev=1', 'padre=T1').status).toBe(0);
		const hija = JSON.parse(readFileSync(path.join(dir, 'tareas', 'hija.json'), 'utf8'));
		expect(hija.padre).toBe('madre');
		expect(board(dir, 'set', 'madre', '--rev=1', 'padre=hija').err).toContain(
			'padre forma un ciclo: madre → hija → madre',
		);
		expect(board(dir, 'set', 'madre', '--rev=1', 'padre=nadie').err).toContain(
			'padre nadie no está en el tablero',
		);
		const shown = board(dir, 'show', 'madre').out;
		expect(shown).toContain('Subtareas · 0/1 (0 %)');
		expect(shown).toContain('○ T2 · F1 · hija · pendiente');
		expect(board(dir, 'show', 'hija').out).toContain('Parte de T1 · madre · 0/1 listas');
		const list = board(dir, 'list').out;
		expect(list).not.toContain('· espera-fecha');
		expect(list.trimEnd().split('\n').at(-1)).toMatch(/^Calendario \(1\): próxima T3 el /);
	});
});
