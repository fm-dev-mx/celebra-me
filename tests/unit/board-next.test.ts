import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = Date.parse('2026-10-24T20:00:00Z');
const ago = (minutes: number, from = NOW) => new Date(from - minutes * 60_000).toISOString();

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
		actualizado: ago(5),
		...fields,
	};
}

/** Run a snippet with `m` = model.mjs and `n` = next.mjs; its printed JSON is returned. */
function probe(code: string) {
	const href = (f: string) => pathToFileURL(path.join(BOARD, f)).href;
	const src = `const m = await import(process.argv[1]); const n = await import(process.argv[2]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, href('model.mjs'), href('next.mjs')],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

function makeBoard(tareas: Json[], extra: Record<string, Json[]> = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-next-'));
	dirs.push(dir);
	for (const [name, docs] of Object.entries({ tareas, ...extra })) {
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

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const readLog = (dir: string): Json[] =>
	readdirSync(path.join(dir, 'bitacora'))
		.filter((f) => f.endsWith('.jsonl'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);

describe('board messages (T126)', () => {
	it('keeps a message in the bitácora and lists it once in the reader inbox', () => {
		const dir = makeBoard([task('servicio')]);
		const sent = cli(dir, ['msg', 'T1', '--de=codex', '--para=claude', 'Revisión', 'lista']);
		expect(sent.status).toBe(0);
		expect(sent.out).toContain('mensaje para claude sobre T1 guardado');
		const [row] = readLog(dir);
		expect(row).toMatchObject({
			tarea: 'servicio',
			quien: 'codex',
			mensaje: { para: 'claude', texto: 'Revisión lista' },
		});

		const first = cli(dir, ['inbox', '--agente=claude']);
		expect(first.out).toContain('codex → claude sobre T1: Revisión lista');
		expect(cli(dir, ['inbox', '--agente=claude']).out).toBe(
			'Sin mensajes nuevos para claude.\n',
		);
		expect(cli(dir, ['inbox', '--agente=claude', '--todos']).out).toContain('Revisión lista');
		expect(cli(dir, ['inbox', '--agente=codex']).out).toContain('Sin mensajes nuevos');
		// A message changes no task, so the verifier asks for no new rev.
		expect(cli(dir, ['verify']).out).not.toContain('suba rev');
	});

	it('refuses a message without a known reader, writer, task or text', () => {
		const dir = makeBoard([task('servicio')]);
		expect(cli(dir, ['msg', 'servicio', '--de=codex', '--para=nadie', 'x']).err).toContain(
			'para debe ser coordinador|dueno|codex|gemini|claude',
		);
		expect(cli(dir, ['msg', 'servicio', '--de=alguien', '--para=claude', 'x']).err).toContain(
			'quien debe ser',
		);
		expect(cli(dir, ['msg', 'servicio', '--de=codex', '--para=claude']).err).toContain(
			'mensaje sin texto',
		);
		expect(cli(dir, ['msg', 'otra', '--de=codex', '--para=claude', 'x']).err).toContain(
			'no existe la tarea otra',
		);
	});
});

describe('owner messages about finished tasks (d265)', () => {
	it('drops a message to the owner once its task is finished or archived, but keeps it in inbox', () => {
		const r = probe(`
			const msg = (id, tarea) => ({ tarea, en: '2026-10-24T19:00:00Z', quien: 'claude', mensaje: { id, para: 'dueno', texto: id } });
			const t = (id, num, estado) => ({ id, num, titulo: id, estado, urgencia: 'normal', actor: 'sesion', agente: 'claude', requisitos: [], rev: 1, actualizado: '2026-10-24T19:00:00Z' });
			const board = {
				tareas: [t('abierta', 1, 'en curso'), t('unida', 2, 'unida'), t('hecha', 3, 'hecha'), t('revision', 4, 'en revision')],
				archivo: [t('archivada', 5, 'pendiente')],
				bitacora: [msg('m1', 'abierta'), msg('m2', 'unida'), msg('m3', 'hecha'), msg('m4', 'archivada'), msg('m5', 'revision'), msg('m6', 'perdida')],
			};
			console.log(JSON.stringify({
				usted: n.nextSections(board, { now: ${NOW} }).usted.map((x) => x.texto),
				inbox: n.unreadFor('dueno', board).map((x) => x.mensaje.id),
			}));`);
		expect(r.usted).toEqual([
			'Mensaje: claude → dueno sobre T1: m1',
			'Mensaje: claude → dueno sobre T4: m5',
			'Mensaje: claude → dueno sobre perdida: m6',
		]);
		expect(r.inbox).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
	});
});

describe('board heartbeat and session title (T126)', () => {
	it('renews the caller lock heartbeat on every command without a new rev', () => {
		const lock = { agente: 'codex', desde: ago(300), sesion: 'cx-1', carril: 'f10-libre' };
		const dir = makeBoard([task('servicio', { candado: lock }), task('otra')]);
		expect(cli(dir, ['list', '--agente=codex', '--sesion=cx-1']).status).toBe(0);
		const t = readTask(dir, 'servicio');
		expect(t.rev).toBe(1);
		expect(Date.parse(t.candado.latido)).toBeGreaterThan(Date.parse(lock.desde));
		// Another session of the same agent does not keep this lock alive.
		const before = readTask(dir, 'servicio').candado.latido;
		cli(dir, ['show', 'otra', '--agente=codex', '--sesion=cx-2']);
		expect(readTask(dir, 'servicio').candado.latido).toBe(before);
	});

	it('requires the session title only for tasks created under the contract', () => {
		const dir = makeBoard([task('vieja')]);
		const add = cli(dir, [
			'add',
			'nueva',
			'titulo=Nueva',
			'urgencia=normal',
			'actor=sesion',
			'agente=codex',
			'tipo=auditoria',
			'busca=Que funcione.\nTerminado cuando: pasa.',
			'carrilPlaneado=f10-libre',
			'--coordinador',
		]);
		expect(add.status).toBe(0);
		expect(readTask(dir, 'nueva').contrato).toBe(3);
		const claim = (id: string, ...rest: string[]) =>
			cli(dir, [
				'claim',
				id,
				'--agente=codex',
				'--sesion=cx-1',
				'--carril=f10-libre',
				...rest,
			]);
		expect(claim('nueva').err).toContain('falta --titulo="f10 · T2 · …"');
		expect(claim('nueva', '--titulo=f05 · T2 · Nueva').err).toContain(
			'--titulo debe ser «f10 · T2 · …»',
		);
		expect(claim('nueva', '--titulo=f10 · T2 · Nueva').status).toBe(0);
		expect(readTask(dir, 'nueva').candado.titulo).toBe('f10 · T2 · Nueva');
		// An open task from before the contract still claims without it.
		expect(
			cli(dir, [
				'claim',
				'vieja',
				'--agente=claude',
				'--sesion=local_1',
				'--carril=f11-preview',
			]).status,
		).toBe(0);
		expect(
			cli(dir, ['set', 'nueva', '--rev=2', 'contrato=2', '--agente=codex', '--sesion=cx-1'])
				.err,
		).toContain('contrato requiere su comando');
		// Releasing without --nombre keeps the claim's title as the session name.
		const rev = String(readTask(dir, 'nueva').rev);
		expect(
			cli(dir, ['release', 'nueva', '--agente=codex', '--sesion=cx-1', `--rev=${rev}`])
				.status,
		).toBe(0);
		expect(readTask(dir, 'nueva').sesion).toEqual({
			id: 'cx-1',
			agente: 'codex',
			nombre: 'f10 · T2 · Nueva',
		});
	});
});

describe('what is next (T126)', () => {
	const sha = (c: string) => c.repeat(40);

	it('flags silent locks and ready tasks nobody took', () => {
		const r = probe(`const now = ${NOW};
			const t = (id, num, x) => ({ id, num, titulo: id, estado: 'pendiente', urgencia: 'normal', actor: 'sesion', requisitos: [], prompt: 'p', rev: 1, actualizado: new Date(now - 45 * 60000).toISOString(), ...x });
			const board = { tareas: [
				t('codex-lista', 125, { agente: 'codex' }),
				t('claude-lista', 129, { agente: 'claude' }),
				t('reciente', 130, { agente: 'gemini', actualizado: new Date(now - 60000).toISOString() }),
				t('callada', 112, { estado: 'en curso', candado: { agente: 'claude', desde: new Date(now - 5 * 3600000).toISOString(), latido: new Date(now - 3 * 3600000).toISOString(), titulo: 'f07 · T112 · XV' } }),
				t('viva', 120, { estado: 'en curso', candado: { agente: 'claude', desde: new Date(now - 5 * 3600000).toISOString(), latido: new Date(now - 600000).toISOString() } }),
			] };
			const s = n.stalls(board, now);
			console.log(JSON.stringify({ dueno: s.dueno.map((x) => x.texto), detenidas: s.detenidas.map((x) => x.texto),
				sesion: n.coordinatorItems(board, { now }).map((x) => x.texto) }));`);
		expect(r).toEqual({
			dueno: ['Correr el despachador de Codex (T125) · lista hace 45 min'],
			detenidas: ['T112 · candado de claude sin latido hace 3 h · sesión «f07 · T112 · XV»'],
			sesion: [
				'Abrir una sesión de Claude para T129 · claude-lista · lista hace 45 min (detenida)',
			],
		});
	});

	it('tells the coordinator which reviews to merge, review again or pass on, and which PRs lack a task', () => {
		const r = probe(`const now = ${NOW};
			const base = { urgencia: 'normal', actor: 'sesion', requisitos: [], rev: 1, actualizado: '2026-10-24T19:00:00Z' };
			const done = { cierre: { resumen: 'ok', comprobaciones: [], saltadas: [], pendientes: [], en: '2026-10-24T19:00:00Z' } };
			const origin = (id, num, pr, extra = done) => ({ ...base, id, num, titulo: id, estado: 'en revision', pr, rama: 'feat/' + id, agente: 'claude', ...extra });
			const round = (o, num, sha, pendientes) => ({ ...base, id: o + '-revision', num, titulo: 'r', estado: 'hecha', origen: o, revisionSha: sha, agente: 'gemini',
				cierre: { resumen: 'ok', comprobaciones: [], saltadas: [], pendientes, en: '2026-10-24T19:00:00Z' } });
			const board = {
				tareas: [
					origin('aprobada', 1, '#501'), round('aprobada', 11, '${sha('a')}', []),
					origin('movida', 2, '#502'), round('movida', 12, '${sha('b')}', []),
					origin('hallazgos', 3, '#503'), round('hallazgos', 13, '${sha('c')}', [{ texto: 'arreglar', tarea: 'hallazgos' }]),
					origin('sin-revision', 4, '#504'),
					origin('sin-cierre', 5, '#505', {}), origin('unida-sin-cierre', 6, '#506', { estado: 'unida' }),
					origin('unida-con-cierre', 7, '#507', { ...done, estado: 'unida' }),
				],
				bitacora: [{ tarea: 'aprobada', en: '2026-10-24T19:30:00Z', quien: 'gemini', mensaje: { id: 'm1', para: 'coordinador', texto: 'Listo' } }],
			};
			const prs = [
				{ number: 501, headRefOid: '${sha('a')}', headRefName: 'feat/aprobada', title: 'A' },
				{ number: 502, headRefOid: '${sha('d')}', headRefName: 'feat/movida', title: 'B' },
				{ number: 503, headRefOid: '${sha('c')}', headRefName: 'feat/hallazgos', title: 'C' },
				{ number: 510, headRefOid: '${sha('e')}', headRefName: 'dependabot/x', title: 'Bump x' },
			];
			console.log(JSON.stringify({
				con: n.coordinatorItems(board, { prs, now }).map((x) => x.tipo + ': ' + x.texto),
				sin: n.coordinatorItems(board, { now }).map((x) => x.tipo),
			}));`);
		expect(r.con).toEqual([
			'unir: Unir T1 (PR #501): T11 aprobó aaaaaaa',
			'vuelta: Nueva vuelta de revisión: T2 (PR #502) cambió de bbbbbbb a ddddddd',
			'hallazgos: Pasar los hallazgos de T13 al autor de T3 (PR #503)',
			'cierre: Pedir el resumen de cierre de T5',
			'cierre: Pedir el resumen de cierre de T6',
			'sin-tarea: PR #510 sin tarea: Bump x',
			'mensaje: Mensaje: gemini → coordinador sobre T1: Listo',
		]);
		// Without GitHub an approval is still shown, marked unchecked, and no PR is «sin tarea».
		expect(r.sin).toEqual(['unir', 'unir', 'hallazgos', 'cierre', 'cierre', 'mensaje']);
	});

	it.each(['unida', 'hecha', 'comprobada', 'cancelada', 'archivada'])(
		'hides merge signals for a finished origin (%s), preserving history and other messages',
		(estado) => {
			const result = probe(`
				const origin = { id: 'origin', num: 1, estado: '${estado === 'archivada' ? 'unida' : estado}', pr: '#547' };
				const round = { id: 'origin-revision', num: 2, estado: 'hecha', origen: 'origin', pr: '#547' };
				const message = (id, tarea, texto) => ({ tarea, en: '${ago(5)}', quien: 'codex', mensaje: { id, para: 'coordinador', texto } });
				const board = { tareas: [round, ...${estado === 'archivada' ? '[]' : '[origin]'}],
					archivo: ${estado === 'archivada' ? '[{ ...origin, archivada: true }]' : '[]'},
					bitacora: [message('origin', 'origin', '#547@aaaaaaa · siguiente: unir'),
						message('round', 'origin-revision', '#547@aaaaaaa · siguiente: unir'),
						message('other', 'origin', 'Requiere seguimiento')] };
				const before = JSON.stringify(board);
				console.log(JSON.stringify({
					messages: n.coordinatorItems(board).filter(x => x.tipo === 'mensaje').map(x => x.texto),
					inbox: n.unreadFor('coordinador', board).map(x => x.mensaje.id),
					unchanged: JSON.stringify(board) === before }));`);
			expect(result.messages).toEqual([
				'Mensaje: codex → coordinador sobre T1: Requiere seguimiento',
			]);
			expect(result.inbox).toEqual(['origin', 'round', 'other']);
			expect(result.unchanged).toBe(true);
		},
	);

	it('uses open PR evidence for merge signals and review actions, retaining unknown signals offline', () => {
		const result = probe(`
			const sha = '${sha('a')}';
			const origin = (id, num, pr) => ({ id, num, pr, estado: 'en revision', agente: 'codex',
				cierre: { resumen: 'ok', comprobaciones: [], saltadas: [], pendientes: [] } });
			const round = (id, num) => ({ id: id + '-revision', num, origen: id, estado: 'hecha', revisionSha: sha,
				cierre: { resultado: { veredicto: 'aprobado', sha } } });
			const board = { tareas: [origin('open', 1, '#10'), round('open', 2),
				origin('merged', 3, '#11'), round('merged', 4), origin('closed', 5, '#12'), round('closed', 6),
				{ id: 'pending', num: 7, estado: 'pendiente', agente: 'codex' }],
				bitacora: ['open', 'merged', 'closed', 'pending', 'missing'].map((id, i) => ({ tarea: id,
					en: '${ago(5)}', quien: 'codex', mensaje: { id, para: 'coordinador',
						texto: (i < 3 ? '#' + (10 + i) + '@aaaaaaa · ' : '') + 'siguiente: unir' } })) };
			const items = (prs) => n.coordinatorItems(board, { prs }).filter(x => ['unir', 'mensaje'].includes(x.tipo))
				.map(x => x.tipo + ':' + (x.t?.id ?? 'missing'));
			console.log(JSON.stringify({ online: items([{ number: 10, headRefOid: sha }]),
				empty: items([]), offline: items(undefined) }));`);
		expect(result.online).toEqual([
			'unir:open',
			'mensaje:open',
			'mensaje:pending',
			'mensaje:missing',
		]);
		expect(result.empty).toEqual(['mensaje:pending', 'mensaje:missing']);
		expect(result.offline).toEqual([
			'unir:open',
			'unir:merged',
			'unir:closed',
			'mensaje:open',
			'mensaje:merged',
			'mensaje:closed',
			'mensaje:pending',
			'mensaje:missing',
		]);
	});

	it('keeps signals from completed review rounds of open tasks and checks the PR named in old signals', () => {
		const result = probe(`
			const board = { tareas: [{ id: 'origin', num: 1, estado: 'en curso', pr: '#20', agente: 'codex' },
				{ id: 'origin-revision', num: 2, estado: 'hecha', origen: 'origin', pr: '#20' }],
				bitacora: ['#20@aaaaaaa · siguiente: unir', '#19@bbbbbbb · siguiente: unir', 'siguiente: unir']
					.map((texto, id) => ({ tarea: 'origin-revision', en: '${ago(5)}', quien: 'codex',
						mensaje: { id: String(id), para: 'coordinador', texto } })) };
			const messages = (prs) => n.coordinatorItems(board, { prs }).filter(x => x.tipo === 'mensaje').map(x => x.texto);
			console.log(JSON.stringify({ online: messages([{ number: 20 }]), offline: messages(undefined) }));`);
		expect(result.online).toEqual([
			'Mensaje: codex → coordinador sobre T2: #20@aaaaaaa · siguiente: unir',
			'Mensaje: codex → coordinador sobre T2: siguiente: unir',
		]);
		expect(result.offline).toHaveLength(3);
	});

	it('shows an owner task only what to do and where', () => {
		const r =
			probe(`const t = { id: 'parecido', num: 134, titulo: 'Aceptar las fotos', estado: 'pendiente', urgencia: 'alta', actor: 'dueno', categoria: 'invitaciones', requisitos: [], rev: 1, actualizado: '2026-10-24T19:00:00Z',
				prompt: 'Abra la sesión.\\n\\nDÓNDE CORRE\\nEn la app de Claude, sesión f07 · T112.\\n\\nDECISIONES\\n- ninguna' };
			const board = { tareas: [t] };
			console.log(JSON.stringify({ lines: m.laneLines(t, board), prompt: m.promptWithLane(t, board) === t.prompt,
				donde: m.laneLines({ ...t, donde: 'Panel de Cloudflare' }, board), usted: n.nextSections(board).usted.map((x) => x.texto) }));`);
		expect(r).toEqual({
			lines: ['Dónde: En la app de Claude, sesión f07 · T112.'],
			prompt: true,
			donde: ['Dónde: Panel de Cloudflare'],
			usted: ['T134 · Aceptar las fotos · En la app de Claude, sesión f07 · T112.'],
		});
	});

	it('reads the lane table from git instead of the hand-written records', () => {
		const r = probe(`const board = {
				carriles: [{ id: 'f06-landing', orden: 3 }, { id: 'f05-plataforma', orden: 2 }, { id: 'f07-invitaciones', orden: 4 }],
				tareas: [{ id: 'que-sigue', num: 126, candado: { agente: 'claude', desde: '2026-10-24T19:00:00Z', carril: 'f05-plataforma', titulo: 'f05 · T126 · Qué sigue' } }],
			};
			const git = [{ id: 'f05-plataforma', rama: 'feat/board-whats-next', limpio: false }, { id: 'f06-landing', rama: null, limpio: true }, { id: 'f07-invitaciones', error: 'ENOENT' }];
			console.log(JSON.stringify(n.laneRows(board, git).map((l) => l.texto)));`);
		expect(r).toEqual([
			'f05-plataforma · feat/board-whats-next · con cambios · T126 de claude («f05 · T126 · Qué sigue»)',
			'f06-landing · HEAD suelto (libre) · limpio',
			'f07-invitaciones · sin leer git',
		]);
	});

	it('prints the three sections with GitHub in sigue and without it in list', () => {
		const real = Date.now();
		const dir = makeBoard([
			task('codex-lista', { agente: 'codex', actualizado: ago(40, real) }),
			task('callada', {
				estado: 'en curso',
				candado: { agente: 'claude', desde: ago(300, real), sesion: 'local_x' },
			}),
		]);
		const fixture = path.join(dir, 'vivo.json');
		writeFileSync(
			fixture,
			JSON.stringify({
				prs: [{ number: 9, headRefOid: sha('f'), headRefName: 'feat/z', title: 'Z' }],
				carriles: [],
			}),
		);
		const sigue = cli(dir, ['sigue'], { CELEBRA_BOARD_LIVE_FIXTURE: fixture });
		// T489: running a dispatcher is the coordinator's, so the owner's inbox stays empty.
		expect(sigue.out).toContain('Le toca a usted (0):');
		expect(sigue.out).toContain(
			'Le toca al coordinador (3):\n  - DÓNDE: Codex · proyecto f05-plataforma · chat nuevo «f05 · T1 · codex-lista»\n    Correr el despachador de Codex (T1)',
		);
		expect(sigue.out).toContain(
			'  - DÓNDE: Claude · la sesión de T2\n    Inspeccionar el candado de claude sin latido hace 5 h: T2 · callada\n  - PR #9 sin tarea: Z',
		);
		expect(sigue.out).toContain(
			'Detenidas (1):\n  - T2 · candado de claude sin latido hace 5 h',
		);
		const list = cli(dir, ['list']);
		expect(list.out).toContain('Usted: nada');
		expect(list.out).toContain('Le toca al coordinador (2):');
		expect(list.out).toContain('Sin leer GitHub');
	});
});
