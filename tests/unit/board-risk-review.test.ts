import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const NOW = '2026-10-25T18:00:00.000Z';
const SHA = 'a'.repeat(40);

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Call `fn` exported by board module `file` in a module child with JSON `args`; its JSON result comes back. */
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
		num: 1,
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

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-risk-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [i, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ ...doc, num: i + 1 }),
		);
	return dir;
}

/** `pnpm board` in `dir`; `files` is the PR inventory the hermetic gh fixture answers `review` with. */
function board(dir: string, files: string[] | null, ...args: string[]) {
	const env: NodeJS.ProcessEnv = { CELEBRA_BOARD_DIR: dir, HOME: dir, USERPROFILE: dir };
	if (files)
		env.BOARD_TEST_PREFLIGHT = JSON.stringify({
			pr: { files: files.map((p) => ({ path: p })), changedFiles: files.length },
		});
	const r = runCommand(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv(env),
	});
	return { status: r.status, out: String(r.stdout), err: String(r.stderr) };
}

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

const CIERRE = {
	resumen: 'Hecho.',
	comprobaciones: ['validate:changed'],
	saltadas: [],
	pendientes: [],
	en: NOW,
};
const byClaude = () =>
	task('de-claude', {
		agente: 'claude',
		rama: 'feat/a',
		pr: 10,
		estado: 'en revision',
		cierre: CIERRE,
	});

describe('risk-based review (d282)', () => {
	it('calls a PR low risk only when every file is board or agent tooling, tests, docs or .agent', () => {
		const level = (files: unknown) => call('prompt.mjs', 'reviewLevel', files);
		expect(level(['scripts/board/model.mjs', 'tests/unit/board-cli.test.ts'])).toBe('bajo');
		expect(
			level(['scripts/agent/git-safety.mjs', '.agent/kinds/codigo.yaml', 'docs/x.md']),
		).toBe('bajo');
		// Anything published, persistent or secret lifts the risk, even next to board files.
		for (const p of [
			'supabase/migrations/1_x.sql',
			'src/content/events/andrea.json',
			'wrangler.jsonc',
			'docs/core/production-release.md',
			'scripts/agent/secrets.mjs',
			'tests/unit/payments-flow.test.ts',
		])
			expect(level(['scripts/board/model.mjs', p])).not.toBe('bajo');
		expect(level(['scripts/board/model.mjs', 'supabase/x.sql'])).toBe('alto');
		expect(level(['src/components/Hero.astro'])).toBe('medio');
		// Missing or empty evidence is never low risk.
		expect(level(null)).toBe('alto');
		expect(level([])).toBe('alto');
	});

	it('lets Claude review Claude only on a low-risk PR', () => {
		const issue = (a: string, r: string, o?: Json) =>
			call('model.mjs', 'reviewerIssue', a, r, o);
		expect(issue('claude', 'claude', { subagent: true })).toBeNull();
		expect(issue('claude', 'claude', {})).toContain('d288');
		expect(issue('codex', 'codex', { subagent: true })).toBe(
			'la revisión cruzada requiere otro agente',
		);
		expect(issue('claude', 'gemini', { subagent: true })).toBeNull();
	});

	it('picks a Claude subagent for a low-risk PR by Claude and Gemini or Codex otherwise', () => {
		const pick = (files: unknown) =>
			call('reviewer.mjs', 'pickReviewer', 'claude', { tareas: [] }, { files, now: 0 });
		expect(pick(['scripts/board/board.mjs'])).toEqual({
			agente: 'claude',
			revisor: 'subagente',
			motivo: 'riesgo bajo (d288): subagente de claude',
		});
		expect(pick(['scripts/board/board.mjs', 'supabase/x.sql']).agente).toBe('gemini');
		// Codex or Gemini work still goes to Claude as a normal cross review.
		expect(
			call('reviewer.mjs', 'pickReviewer', 'codex', { tareas: [] }, { files: ['docs/x.md'] }),
		).toEqual({ agente: 'claude', motivo: '' });
	});

	it('opens a subagent round for a board-only PR and prints the author session its steps', () => {
		const dir = makeBoard([byClaude()]);
		const r = board(
			dir,
			['scripts/board/board.mjs', 'tests/unit/x.test.ts'],
			'review',
			'de-claude',
			`--sha=${SHA}`,
		);
		expect(r.err).toBe('');
		expect(r.status).toBe(0);
		expect(r.out).toContain(
			'de-claude-revision creada para claude (vuelta 1) · riesgo bajo (d288)',
		);
		expect(r.out).toContain('Revisor: subagente de claude (d288, riesgo bajo o medio)');
		expect(r.out).toContain(
			'pnpm board claim de-claude-revision --agente=claude --titulo="f05 · T2 · PR #10 · Revisión"',
		);
		expect(r.out).toContain(
			'Lance un subagente Agent con contexto limpio y dele solo el PR #10',
		);
		expect(r.out).toContain(`--veredicto=<el del subagente> --sha=${SHA}`);
		const round = readTask(dir, 'de-claude-revision');
		expect(round).toMatchObject({ agente: 'claude', revisor: 'subagente', revisionSha: SHA });
		expect(round.prompt).toContain('Riesgo bajo o medio (d288)');
		expect(round.prompt).toContain('No tome ni cierre la tarea del tablero');
		expect(round.prompt).toContain('\ndecisiones: d183, d288\n');
		expect(round.prompt).not.toContain('pnpm board claim de-claude-revision');
	});

	it('sends a PR with supabase/ to Gemini or Codex and refuses Claude for it', () => {
		const dir = makeBoard([byClaude()]);
		const files = ['scripts/board/board.mjs', 'supabase/migrations/1_x.sql'];
		const refused = board(dir, files, 'review', 'de-claude', '--agente=claude', `--sha=${SHA}`);
		expect(refused.status).toBe(2);
		expect(refused.err).toContain('d288: un subagente de claude revisa el trabajo de claude');
		const r = board(dir, files, 'review', 'de-claude', `--sha=${SHA}`);
		expect(r.status).toBe(0);
		expect(r.out).toContain('creada para gemini (vuelta 1) · riesgo alto');
		expect(r.out).not.toContain('subagente');
		const round = readTask(dir, 'de-claude-revision');
		expect(round.agente).toBe('gemini');
		expect(round.revisor).toBeUndefined();
		expect(round.prompt).toContain('pnpm board claim de-claude-revision --agente=gemini');
	});

	it('lets a session take, close and review a task with toca; the owner keeps actor dueno', () => {
		const dir = makeBoard([
			task('con-toca', { toca: ['produccion'], agente: 'claude', rama: 'feat/t' }),
			task('del-dueno', { actor: 'dueno', toca: ['produccion'] }),
			task('coordina-toca', { actor: 'coordinador', toca: ['main'] }),
		]);
		const colors = Object.fromEntries(
			(JSON.parse(board(dir, null, 'list', '--json').out) as Json[]).map((r) => [
				r.id,
				r.color,
			]),
		);
		expect(colors).toMatchObject({
			'con-toca': 'auto',
			'del-dueno': 'own',
			'coordina-toca': 'own',
		});
		const claim = board(
			dir,
			null,
			'claim',
			'con-toca',
			'--agente=claude',
			'--sesion=local_t274',
			'--carril=f10-libre',
		);
		expect(claim.err).toBe('');
		expect(claim.status).toBe(0);
		expect(board(dir, null, 'claim', 'del-dueno', '--agente=codex', '--sesion=x').status).toBe(
			2,
		);
		const closed = board(
			dir,
			null,
			'close',
			'con-toca',
			'--resumen=Hecho.',
			'--comprobacion=validate:changed',
			'--saltada=ninguna',
			'--pendiente=ninguna',
			'--agente=claude',
			'--sesion=local_t274',
		);
		expect(closed.err).toBe('');
		expect(closed.status).toBe(0);
	});
});
