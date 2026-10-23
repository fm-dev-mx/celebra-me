import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
	for (const [name, docs] of Object.entries(collections)) {
		mkdirSync(path.join(dir, name), { recursive: true });
		for (const { id, ...doc } of docs)
			writeFileSync(path.join(dir, name, `${id}.json`), JSON.stringify(doc));
	}
	return dir;
}

function board(dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, INIT_CWD: ROOT }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pnpm board', () => {
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
		expect(before.queue).toContain('dueno-fecha:block');
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

	it('locks a task for one agent and refuses a move while locked', () => {
		const dir = makeBoard({ tareas: [task('compartida')] });
		expect(board(dir, 'claim', 'compartida', '--agente=codex').status).toBe(0);
		const other = board(dir, 'claim', 'compartida', '--agente=claude');
		expect(other.status).toBe(2);
		expect(other.err).toContain('ya la tiene codex');
		expect(board(dir, 'move', 'compartida', '--agente=claude').status).toBe(2);
		expect(board(dir, 'release', 'compartida', '--agente=codex').status).toBe(0);
		expect(board(dir, 'move', 'compartida', '--agente=claude').status).toBe(0);
		expect(readTask(dir, 'compartida')).toMatchObject({ agente: 'claude', rev: 4 });
		const log = readdirSync(path.join(dir, 'bitacora'));
		expect(log).toHaveLength(1);
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
		board(dir, 'release', 'fotos', '--agente=gemini');
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
		expect(readdirSync(path.join(dir, '.respaldos', 'tareas', 'alias'))).toHaveLength(5);
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
		const [row] = readdirSync(path.join(dir, 'bitacora'));
		expect(JSON.parse(readFileSync(path.join(dir, 'bitacora', row), 'utf8'))).toMatchObject({
			tarea: 'pin',
			de: 'pendiente',
			a: 'en curso',
			quien: 'codex',
		});
	});

	it('creates a cross-review child task that waits for its origin', () => {
		const dir = makeBoard({
			tareas: [task('origen', { agente: 'claude', rama: 'fix/origen' })],
		});
		expect(board(dir, 'review', 'origen', '--agente=codex').status).toBe(0);
		expect(readTask(dir, 'origen-revision')).toMatchObject({
			agente: 'codex',
			origen: 'origen',
			rama: 'fix/origen',
			requisitos: [{ tipo: 'tarea', ref: 'origen' }],
		});
	});

	it('pushes the board to the view as soon as a write lands', () => {
		const dir = makeBoard({ tareas: [task('viva')] });
		// Opens the stream, writes through the CLI, and prints the tasks of every pushed board.
		const probe = String.raw`
			import { request } from 'node:http';
			import { spawnSync } from 'node:child_process';
			const { serveView } = await import(process.argv[1]);
			const server = await serveView(process.env.CELEBRA_BOARD_DIR, 0);
			const seen = [];
			const done = (code) => { console.log(JSON.stringify(seen)); server.closeAllConnections(); server.close(); process.exit(code); };
			setTimeout(() => done(1), 8000);
			request({ port: server.address().port, path: '/api/stream' }, (res) => {
				let buf = '';
				res.on('data', (chunk) => {
					buf += chunk;
					for (const m of buf.split('\n\n').slice(0, -1)) {
						if (!m.startsWith('data: ')) continue;
						seen.push(JSON.parse(m.slice(6)).tareas.map((t) => t.id + ':' + t.estado));
						if (seen.length === 1)
							spawnSync(process.execPath, [process.argv[2], 'set', 'viva', '--rev=1', 'estado=en curso']);
						else done(0);
					}
					buf = buf.slice(buf.lastIndexOf('\n\n') + 2);
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

	it('imports a v2 export, turning espera and deps into requisitos', () => {
		const src = makeBoard({
			tareas: [
				{
					id: 'vieja',
					titulo: 'Vieja',
					estado: 'pendiente',
					espera: 'usted',
					usted: [{ t: 'Aprobar el PR' }],
					deps: ['otra'],
					toca: ['release'],
					rev: 3,
					actualizado: NOW,
				},
			],
			decisiones: [{ id: 'd001', decision: 'x', vigente: true }],
		});
		const dir = makeBoard({});
		const mapa = path.join(src, 'mapa.json');
		writeFileSync(mapa, JSON.stringify({ vieja: { urgencia: 'alta' } }));
		const { status, out } = board(dir, 'import', src, `--mapa=${mapa}`);
		expect(status).toBe(0);
		expect(out).toContain('1 tareas');
		const t = readTask(dir, 'vieja');
		expect(t).toMatchObject({
			urgencia: 'alta',
			agente: 'claude',
			actor: 'dueno',
			toca: ['main', 'produccion'],
			requisitos: [
				{ tipo: 'tarea', ref: 'otra' },
				{ tipo: 'dueno', ref: 'Aprobar el PR', ok: false },
			],
		});
		expect(t.espera).toBeUndefined();
		expect(board(dir, 'import', src).status).toBe(2);
	});
});
