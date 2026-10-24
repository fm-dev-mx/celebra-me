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
	writeFileSync(
		path.join(dir, 'answers.json'),
		JSON.stringify({
			'gh pr list --state open --json number,headRefName,title --limit 100': '[]',
			'git worktree list --porcelain': '',
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
	const agent = args.find((a) => a.startsWith('--agente='))?.slice(9) ?? 'codex';
	if (['claim', 'release'].includes(args[0]) && !args.some((a) => a.startsWith('--sesion=')))
		args.push(`--sesion=${agent}-test`);
	if (args[0] === 'claim') {
		if (!args[1].endsWith('-revision') && !args.some((a) => a.startsWith('--carril=')))
			args.push('--carril=f10-libre');
	}
	if (['set', 'update'].includes(args[0]) && !args.some((a) => a.startsWith('--agente=')))
		args.push('--coordinador');
	const result = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			INIT_CWD: ROOT,
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('pnpm board', () => {
	it('assigns fixed numbers after the highest task or archive number, including finished tasks', () => {
		const dir = makeBoard({});
		const add = (id: string, ...extra: string[]) =>
			board(dir, 'add', id, `titulo=${id}`, 'urgencia=normal', 'actor=coordinador', ...extra);
		expect(add('first').status).toBe(0);
		expect(readTask(dir, 'first').num).toBe(1);
		expect(add('manual', 'num=100').status).toBe(2);
		expect(board(dir, 'set', 'first', '--rev=1', 'estado=cancelada').status).toBe(0);
		expect(board(dir, 'archive', 'first', '--rev=2').status).toBe(0);
		expect(add('second').status).toBe(0);
		expect(readTask(dir, 'second').num).toBe(2);

		const reserved = makeBoard({
			tareas: [task('cancelled', { estado: 'cancelada', num: 21 })],
			archivo: [{ id: 'old', estado: 'comprobada', num: 40 }],
		});
		expect(
			board(reserved, 'add', 'new', 'titulo=Nueva', 'urgencia=normal', 'actor=sesion').status,
		).toBe(0);
		expect(readTask(reserved, 'new').num).toBe(41);
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
			// Already claimed: the owner pasted it, so it is no longer theirs.
			['apartada', [], 'auto', 'auto', 'auto', 'auto'],
			['espera', [], 'block', 'block', 'block', 'block'],
		]);
		// d163: the paste tasks join the owner's turn at the top of the queue.
		expect(out.queue.slice(0, 3).sort()).toEqual(['de-codex', 'de-gemini', 'imagenes']);
		expect(out.next).toEqual(['cualquiera', 'de-codex', 'de-gemini']);
		expect(out.claimable).toEqual(['normal', 'de-codex', 'cualquiera', 'coordina', 'apartada']);
	});

	it('labels paste tasks «Pegar en …» in the view with their own «Copiar prompt»', () => {
		const html = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');
		expect(html).toContain(
			"ownerLaunches, matches, isFinished, AGENT_REGISTRY } from '/model.mjs'",
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

	it('makes a cross-review executable before merge and binds completion to its SHA', () => {
		const dir = makeBoard({
			tareas: [
				task('origen', {
					agente: 'claude',
					rama: 'fix/origen',
					pr: 398,
					estado: 'en revision',
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
		expect(JSON.parse(board(dir, 'next', '--agente=codex', '--json').out).revisionSha).toBe(
			'b'.repeat(40),
		);
		expect(readTask(dir, 'origen-revision').num).toBe(reviewNum);
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

	it('archives only finished, unlocked tasks and logs archive and unarchive', () => {
		const dir = makeBoard({
			tareas: [
				task('done', { estado: 'comprobada', num: 34 }),
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
		const rows = readdirSync(path.join(dir, 'bitacora')).map((f) =>
			JSON.parse(readFileSync(path.join(dir, 'bitacora', f), 'utf8')),
		);
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

	it('lets a coordinator release only a legacy lock without sesion', () => {
		const lock = { agente: 'claude', desde: NOW, carril: 'f12-release' };
		const dir = makeBoard({
			tareas: [
				task('legacy', { estado: 'unida', candado: lock }),
				task('owned', { estado: 'unida', candado: { ...lock, sesion: 's1' } }),
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
		const dir = makeBoard({ tareas: [task('done', { estado: 'hecha' }), task('open')] });
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
		const [row] = readdirSync(path.join(dir, 'bitacora')).map((f) =>
			JSON.parse(readFileSync(path.join(dir, 'bitacora', f), 'utf8')),
		);
		expect(row).toMatchObject({ tarea: 'done', a: 'archivada', quien: 'dueño' });
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
				const p=spawn(process.execPath,[process.argv[1],'add',id,'titulo='+id,'urgencia=normal','actor=coordinador'],{stdio:'ignore'});
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
