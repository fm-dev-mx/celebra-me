import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const SHA = 'a'.repeat(40);
const OLD = '2026-10-01T08:00:00Z';
const LISTS = ['--fallida=ninguna', '--riesgo=ninguno', '--duda=ninguna', '--excepcion=ninguna'];
const BUSCA = 'busca=Ajustar la ruta.\\nTerminado cuando: responde.';

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Call `fn` exported by board module `file` with JSON `args`; its JSON result comes back. */
function call(file: string, fn: string, ...args: unknown[]) {
	const href = pathToFileURL(path.join(ROOT, 'scripts', 'board', file)).href;
	const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m[${JSON.stringify(fn)}](...${JSON.stringify(args)}) ?? null))`;
	const result = runCommand(process.execPath, ['--input-type=module', '-e', src, href], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: id,
		estado: 'en curso',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'codex',
		requisitos: [],
		prompt: `Sigue .agent/rules/board.md con tarea ${id}.\nDECISIONES\n- ninguna`,
		rev: 1,
		actualizado: OLD,
		...fields,
	};
}

/** A Codex session's lock whose last heartbeat was at `latido`. */
const lock = (latido: string) => ({ agente: 'codex', sesion: 's1', desde: OLD, latido });

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-faster-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'answers.json'), '{}');
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [i, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: i + 1, ...doc }),
		);
	return dir;
}

/** `pnpm board` in `dir`; `pr` is what the hermetic gh fixture answers `review` with. */
function board(dir: string, args: string[], { pr, env = {} }: { pr?: Json; env?: Json } = {}) {
	const r = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			HOME: dir,
			USERPROFILE: dir,
			INIT_CWD: ROOT,
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
			CLAUDE_CODE_HOST_SESSION_ID: '',
			...(pr ? { BOARD_TEST_PREFLIGHT: JSON.stringify({ pr }) } : {}),
			...env,
		}),
	});
	return { status: r.status, out: String(r.stdout), err: String(r.stderr) };
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));
const exists = (dir: string, id: string) =>
	readdirSync(path.join(dir, 'tareas')).includes(`${id}.json`);
/** Every bitácora row written in `dir`. */
const logRows = (dir: string) => {
	const log = path.join(dir, 'bitacora');
	return readdirSync(log)
		.flatMap((f) => readFileSync(path.join(log, f), 'utf8').trim().split('\n'))
		.map((l) => JSON.parse(l));
};
/** Every bitácora message row written in `dir`. */
const messages = (dir: string) => logRows(dir).filter((r) => r.mensaje);

const CIERRE = {
	resumen: 'Hecho.',
	comprobaciones: ['validate:changed'],
	saltadas: [],
	pendientes: [],
	en: OLD,
};
const inReview = () =>
	task('de-claude', {
		agente: 'claude',
		rama: 'feat/a',
		pr: '#10',
		estado: 'en revision',
		cierre: CIERRE,
	});
const files = (...paths: string[]) => ({
	files: paths.map((p) => ({ path: p })),
	changedFiles: paths.length,
});

describe('risk-based reviewer (d288)', () => {
	it('sends Claude low and medium risk to a subagent and keeps Gemini or Codex for high risk and release', () => {
		const pick = (paths: string[], t?: Json) =>
			call(
				'reviewer.mjs',
				'pickReviewer',
				'claude',
				{ tareas: [] },
				{ files: paths, now: 0, task: t },
			);
		expect(pick(['scripts/board/board.mjs'])).toMatchObject({
			agente: 'claude',
			revisor: 'subagente',
			motivo: 'riesgo bajo (d288): subagente de claude',
		});
		expect(pick(['src/components/Hero.astro', 'docs/x.md'])).toMatchObject({
			agente: 'claude',
			revisor: 'subagente',
			motivo: 'riesgo medio (d288): subagente de claude',
		});
		expect(pick(['supabase/migrations/1_x.sql']).agente).toBe('gemini');
		const release = pick(['docs/x.md'], { tipo: 'release' });
		expect(release.agente).toBe('gemini');
		expect(release.motivo).toContain('riesgo bajo, release');
		expect(pick(['docs/x.md'], { categoria: 'release' }).agente).toBe('gemini');
		const issue = (o: Json) => call('model.mjs', 'reviewerIssue', 'claude', 'claude', o);
		expect(issue({ subagent: true })).toBeNull();
		expect(issue({})).toContain('d288');
	});

	it('opens a subagent round for a medium-risk PR by Claude', () => {
		const dir = makeBoard([inReview()]);
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`], {
			pr: files('src/components/Hero.astro'),
		});
		expect(r.err).toBe('');
		expect(r.out).toContain('creada para claude (vuelta 1) · riesgo medio (d288)');
		expect(r.out).toContain('Revisor: subagente de claude (d288, riesgo bajo o medio)');
		const round = readTask(dir, 'de-claude-revision');
		expect(round).toMatchObject({ agente: 'claude', revisor: 'subagente' });
		expect(round.prompt).toContain('Riesgo bajo o medio (d288)');
		expect(round.prompt).toContain('\ndecisiones: d183, d288\n');
	});
});

describe('low-risk paths (d290)', () => {
	it('adds .gitignore, docs and .agent outside its rules to the low-risk list', () => {
		const level = (paths: string[]) => call('prompt.mjs', 'reviewLevel', paths);
		expect(level(['.gitignore', 'scripts/board/board.mjs'])).toBe('bajo');
		expect(level(['docs/core/x.md', '.agent/kinds/codigo.yaml', '.agent/plans/a.yaml'])).toBe(
			'bajo',
		);
		// Agent rules are governance: a PR that changes one is high risk, even next to docs.
		expect(level(['.agent/rules/board.md'])).toBe('alto');
		expect(level(['docs/x.md', '.agent/rules/git-safety.md'])).toBe('alto');
		expect(call('prompt.mjs', 'lowRisk', ['.gitignore.bak'])).toBe(false);
	});
});

describe('review waits for a green CI (d288)', () => {
	const pending = { statusCheckRollup: [{ name: 'ci', status: 'IN_PROGRESS', conclusion: '' }] };

	it('keeps the round waiting while CI runs, without writing it', () => {
		const dir = makeBoard([inReview()]);
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--espera-min=0'], {
			pr: { ...files('docs/x.md'), ...pending },
		});
		expect(r.status).toBe(2);
		expect(r.err).toContain('el CI de #10@aaaaaaa sigue corriendo: la vuelta queda en espera');
		expect(exists(dir, 'de-claude-revision')).toBe(false);
	});

	it('polls with the board unlocked and gives up when the wait runs out', () => {
		const dir = makeBoard([inReview()]);
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--espera-min=0.002'], {
			pr: { ...files('docs/x.md'), statusCheckRollup: [] },
			env: { CELEBRA_BOARD_CI_POLL_MS: '20' },
		});
		expect(r.status).toBe(2);
		expect(r.out).toContain('aún no empieza; la vuelta se crea cuando esté verde…');
		expect(r.err).toContain('(esperé 0.002 min)');
		expect(exists(dir, 'de-claude-revision')).toBe(false);
		expect(readdirSync(dir)).not.toContain('.lock');
	});

	it('refuses a red CI and names the failed checks', () => {
		const dir = makeBoard([inReview()]);
		const red = {
			statusCheckRollup: [
				{ name: 'unit', status: 'COMPLETED', conclusion: 'FAILURE' },
				{ name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS' },
				{ context: 'deploy', state: 'ERROR' },
			],
		};
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`], {
			pr: { ...files('docs/x.md'), ...red },
		});
		expect(r.status).toBe(2);
		expect(r.err).toContain('el CI de #10@aaaaaaa falló (unit, deploy)');
		expect(exists(dir, 'de-claude-revision')).toBe(false);
	});

	it('creates the round of a PR without any check only with --sin-ci, and records it', () => {
		const dir = makeBoard([inReview()]);
		const none = { ...files('docs/x.md'), statusCheckRollup: [] };
		const waiting = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--espera-min=0.001'], {
			pr: none,
			env: { CELEBRA_BOARD_CI_POLL_MS: '20' },
		});
		expect(waiting.err).toContain('aún no empieza: la vuelta queda en espera');
		expect(waiting.err).toContain('agregue --sin-ci');
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--sin-ci'], { pr: none });
		expect(r.status).toBe(0);
		expect(r.out).toContain('Sin CI: GitHub no lista ningún check en #10@aaaaaaa');
		expect(readTask(dir, 'de-claude-revision').revisionSha).toBe(SHA);
		expect(logRows(dir)).toContainEqual(
			expect.objectContaining({
				tarea: 'de-claude-revision',
				corrio: 'pnpm board review --sin-ci',
				salio: 'GitHub no lista ningún check en #10@aaaaaaa',
			}),
		);
	});

	it('refuses --sin-ci while any check exists, and a red CI keeps its own refusal', () => {
		const dir = makeBoard([inReview()]);
		const green = [{ name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }];
		for (const rollup of [pending.statusCheckRollup, green]) {
			const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--sin-ci'], {
				pr: { ...files('docs/x.md'), statusCheckRollup: rollup },
			});
			expect(r.status).toBe(2);
			expect(r.err).toContain('--sin-ci solo vale cuando GitHub no lista ningún check');
		}
		const red = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--sin-ci'], {
			pr: {
				...files('docs/x.md'),
				statusCheckRollup: [{ name: 'unit', status: 'COMPLETED', conclusion: 'FAILURE' }],
			},
		});
		expect(red.err).toContain('el CI de #10@aaaaaaa falló (unit)');
		const valued = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--sin-ci=si']);
		expect(valued.err).toContain('--sin-ci no lleva valor');
		expect(exists(dir, 'de-claude-revision')).toBe(false);
	});

	it('refuses a negative wait', () => {
		const dir = makeBoard([inReview()]);
		const r = board(dir, ['review', 'de-claude', `--sha=${SHA}`, '--espera-min=-1']);
		expect(r.err).toContain('--espera-min debe ser un número de minutos desde 0');
	});
});

describe('close finishes the task (d290)', () => {
	const closeArgs = (id: string, ...extra: string[]) => [
		'close',
		id,
		'--resumen=Hecho.',
		'--comprobacion=validate:changed',
		'--saltada=ninguna',
		'--pendiente=ninguno',
		...LISTS,
		...extra,
	];
	const owner = ['--agente=codex', '--sesion=s1'];

	it('leaves a task without PR hecha and frees its lock', () => {
		const dir = makeBoard([task('a', { candado: lock(new Date().toISOString()) })]);
		const r = board(dir, closeArgs('a', ...owner));
		expect(r.err).toBe('');
		expect(r.out).toContain('a con cierre (rev 2) · hecha');
		const t = readTask(dir, 'a');
		expect(t.estado).toBe('hecha');
		expect(t.candado).toBeUndefined();
	});

	it('leaves a task with a PR en revision and keeps its lock for the review', () => {
		const dir = makeBoard([
			task('b', { rama: 'feat/b', candado: lock(new Date().toISOString()) }),
		]);
		const r = board(dir, closeArgs('b', ...owner, '--pr=#12'));
		expect(r.err).toBe('');
		expect(readTask(dir, 'b')).toMatchObject({ estado: 'en revision', pr: '#12' });
		expect(readTask(dir, 'b').candado).toBeDefined();
	});

	it('keeps the estado of a partial close', () => {
		const dir = makeBoard([task('c', { candado: lock(new Date().toISOString()) })]);
		const r = board(dir, ['close', 'c', '--resumen=A medias.', ...owner]);
		expect(r.status).toBe(0);
		expect(readTask(dir, 'c').estado).toBe('en curso');
	});
});

describe('coordinator over an inactive lock (d290)', () => {
	it('lets the coordinator set an inactive session task and notes it for that session', () => {
		const dir = makeBoard([task('d', { candado: lock(OLD) })]);
		const r = board(dir, [
			'set',
			'd',
			'--rev=1',
			'estado=pendiente',
			'--coordinador',
			'--quien=claude',
		]);
		expect(r.err).toBe('');
		expect(r.out).toContain(`sin latido desde ${OLD} (más de 30 min); anotado`);
		const t = readTask(dir, 'd');
		expect(t.estado).toBe('pendiente');
		expect(t.candado).toBeUndefined();
		const [note] = messages(dir);
		expect(note).toMatchObject({ tarea: 'd', quien: 'coordinador' });
		expect(note.mensaje).toMatchObject({ para: 'codex', sesion: 's1' });
		expect(note.mensaje.texto).toContain('el coordinador corrió «pnpm board set»');
	});

	it('refuses the coordinator over a live lock unless the session is archived', () => {
		const dir = makeBoard([task('e', { candado: lock(new Date().toISOString()) })]);
		const refused = board(dir, [
			'set',
			'e',
			'--rev=1',
			'ahora=x',
			'--coordinador',
			'--quien=claude',
		]);
		expect(refused.status).toBe(2);
		expect(refused.err).toContain('el candado de codex sigue activo');
		const r = board(dir, [
			'set',
			'e',
			'--rev=1',
			'ahora=x',
			'--coordinador',
			'--quien=claude',
			'--sesion-archivada',
		]);
		expect(r.err).toBe('');
		expect(r.out).toContain('la sesión s1 está archivada; anotado');
		// A state that keeps the task open keeps the lock.
		expect(readTask(dir, 'e').candado).toBeDefined();
	});

	it('lets the coordinator close an inactive session task as hecha, noted; a live one keeps its estado', () => {
		const args = [
			'--coordinador',
			'--quien=claude',
			'--resumen=Hecho.',
			'--comprobacion=ninguna',
			'--saltada=ninguna',
			'--pendiente=ninguno',
			...LISTS,
		];
		const dir = makeBoard([
			task('f', { candado: lock(OLD) }),
			task('g', { candado: lock(new Date().toISOString()) }),
		]);
		expect(board(dir, ['close', 'f', ...args]).err).toBe('');
		expect(readTask(dir, 'f')).toMatchObject({ estado: 'hecha' });
		expect(readTask(dir, 'f').candado).toBeUndefined();
		expect(messages(dir).map((m) => m.mensaje.texto)).toEqual([
			expect.stringContaining('«pnpm board close» sobre el candado de codex'),
		]);
		expect(board(dir, ['close', 'g', ...args]).status).toBe(0);
		expect(readTask(dir, 'g')).toMatchObject({ estado: 'en curso' });
	});
});

describe('operacion picks its kind by destino (d290)', () => {
	const add = (dir: string, ...extra: string[]) =>
		board(dir, [
			'add',
			'op',
			'titulo=Op',
			'urgencia=normal',
			'actor=sesion',
			'agente=claude',
			'tipo=operacion',
			BUSCA,
			'carrilPlaneado=f11-preview',
			...extra,
			'--coordinador',
			'--quien=claude',
		]);

	it('uses the Cloudflare template and the base one by default', () => {
		const dir = makeBoard([]);
		expect(add(dir, 'destino=cloudflare').err).toBe('');
		const cf = readTask(dir, 'op').prompt;
		expect(cf).toContain('docs/operations/cloudflare-platform.md');
		expect(cf).not.toContain('.agent/rules/database.md');
		expect(
			board(dir, ['set', 'op', '--rev=1', 'destino=base', '--coordinador', '--quien=claude'])
				.err,
		).toBe('');
		expect(readTask(dir, 'op').prompt).toContain('.agent/rules/database.md');
	});

	it('refuses an unknown destino and a destino outside operacion', () => {
		const dir = makeBoard([]);
		expect(add(dir, 'destino=aws').err).toContain('destino debe ser base/cloudflare');
		const r = board(dir, [
			'add',
			'x',
			'titulo=X',
			'urgencia=normal',
			'actor=sesion',
			'agente=claude',
			'tipo=auditoria',
			BUSCA,
			'destino=cloudflare',
			'--coordinador',
			'--quien=claude',
		]);
		expect(r.err).toContain('destino solo en tareas tipo=operacion');
	});
});

describe('failures say why (d290)', () => {
	it('prints the reason of an unexpected error in one line, and as JSON with --json', () => {
		const dir = makeBoard([task('h')]);
		const r = board(dir, [
			'set',
			'h',
			'--rev=1',
			'--data=no-existe.json',
			'--coordinador',
			'--quien=claude',
			'--json',
		]);
		expect(r.status).toBe(1);
		expect(r.err.trim().split('\n')).toHaveLength(1);
		expect(r.err).toMatch(/^pnpm board set: ENOENT/);
		expect(JSON.parse(r.out)).toMatchObject({
			codigo: 1,
			error: expect.stringContaining('ENOENT'),
		});
	});

	it('keeps a refusal message as it was and adds the JSON line', () => {
		const dir = makeBoard([task('i')]);
		const r = board(dir, ['set', 'i', 'ahora=x', '--json']);
		expect(r.status).toBe(2);
		expect(r.err.trim()).toBe('falta --rev=<n> (la versión que leyó)');
		expect(JSON.parse(r.out)).toEqual({
			error: 'falta --rev=<n> (la versión que leyó)',
			codigo: 2,
		});
	});
});
