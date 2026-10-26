import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const NOW = Date.parse('2026-10-24T18:00:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const later = Math.floor((NOW + DAY) / 1000);
const earlier = Math.floor((NOW - DAY) / 1000);

type Json = Record<string, unknown>;
const dirs: string[] = [];
const MODULE = pathToFileURL(path.join(ROOT, 'scripts', 'board', 'reviewer.mjs')).href;

/** Call `fn` of reviewer.mjs in a module child with JSON `args`; its JSON result is returned. */
function call(fn: string, ...args: unknown[]) {
	const src = `const m = await import(process.argv[1]); console.log(JSON.stringify(m[${JSON.stringify(fn)}](...${JSON.stringify(args)}) ?? null))`;
	const result = runCommand(process.execPath, ['--input-type=module', '-e', src, MODULE], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}
const pickReviewer = (...a: unknown[]) => call('pickReviewer', ...a);
const reviewerLoad = (...a: unknown[]) => call('reviewerLoad', ...a);
const codexCapped = (...a: unknown[]) => call('codexCapped', ...a);
const codexQuota = (...a: unknown[]) => call('codexQuota', ...a);

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string) {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

const review = (
	id: string,
	agente: string,
	estado = 'pendiente',
	actualizado = iso(NOW),
): Json => ({
	id: `${id}-revision`,
	origen: id,
	agente,
	estado,
	actualizado,
});

const quota = (week: number, fiveHours: number, resets = later) => ({
	primary: { used_percent: fiveHours, window_minutes: 300, resets_at: resets },
	secondary: { used_percent: week, window_minutes: 10080, resets_at: resets },
});

/** A home whose newest Codex rollout ends with `limits`; an older rollout says something else. */
function codexHome(limits: Json | null) {
	const home = tempDir('board-reviewer-home-');
	const day = path.join(home, '.codex', 'sessions', '2026', '10', '23');
	const old = path.join(home, '.codex', 'sessions', '2026', '10', '20');
	mkdirSync(day, { recursive: true });
	mkdirSync(old, { recursive: true });
	const event = (l: Json) =>
		JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', rate_limits: l } });
	const oldFile = path.join(old, 'rollout-old.jsonl');
	writeFileSync(oldFile, `${event(quota(99, 99))}\n`);
	utimesSync(oldFile, new Date(NOW - 3 * DAY), new Date(NOW - 3 * DAY));
	const lines = [event(quota(10, 10)), '{"type":"response_item","payload":{"text":"hola"}}'];
	if (limits) lines.push(event(limits));
	writeFileSync(path.join(day, 'rollout-new.jsonl'), `${lines.join('\n')}\n`);
	return home;
}

describe('board reviewer (d209, d240)', () => {
	it('sends Claude work to Gemini on a tie and to the less loaded reviewer otherwise', () => {
		expect(pickReviewer('claude', { tareas: [] }, { now: NOW }).agente).toBe('gemini');
		const board = {
			tareas: [review('a', 'gemini'), review('b', 'gemini'), review('c', 'codex')],
		};
		const pick = pickReviewer('claude', board, { quota: quota(37, 38), now: NOW });
		expect(pick).toEqual({
			agente: 'codex',
			motivo: 'riesgo alto · carga 7 d: gemini 2, codex 1 · cuota Codex 38 % 5 h, 37 % semana',
		});
	});

	it('counts open or recent reviews and open normal tasks, never cancelled or old ones', () => {
		const board = {
			tareas: [
				review('open', 'codex', 'pendiente', iso(NOW - 30 * DAY)),
				review('recent', 'codex', 'hecha', iso(NOW - 2 * DAY)),
				review('old', 'codex', 'hecha', iso(NOW - 8 * DAY)),
				review('dropped', 'codex', 'cancelada'),
				{ id: 'busy', agente: 'codex', estado: 'en curso' },
				{
					id: 'locked',
					agente: 'cualquiera',
					estado: 'pendiente',
					candado: { agente: 'codex' },
				},
				{ id: 'queued', agente: 'codex', estado: 'pendiente' },
				{ id: 'done', agente: 'codex', estado: 'unida' },
			],
			archivo: [review('archived', 'codex', 'hecha', iso(NOW - DAY))],
		};
		expect(reviewerLoad(board, 'codex', NOW)).toBe(5);
		expect(reviewerLoad(board, 'gemini', NOW)).toBe(0);
	});

	it('sends Claude work to Gemini while Codex is over its cap, and ignores an expired or missing quota', () => {
		const board = { tareas: [review('a', 'gemini')] };
		const at = (q: unknown) => pickReviewer('claude', board, { quota: q as never, now: NOW });
		expect(at(quota(80, 0))).toMatchObject({
			agente: 'gemini',
			motivo: 'riesgo alto · carga 7 d: gemini 1, codex 0 · cuota Codex 80 % semana (tope)',
		});
		expect(at(quota(0, 90)).agente).toBe('gemini');
		expect(at(quota(79, 89)).agente).toBe('codex');
		expect(at(quota(95, 95, earlier))).toMatchObject({
			agente: 'codex',
			motivo: 'riesgo alto · carga 7 d: gemini 1, codex 0 · cuota Codex 5 h sin dato, semana sin dato',
		});
		expect(at(null)).toMatchObject({
			agente: 'codex',
			motivo: expect.stringContaining('sin dato'),
		});
		expect(codexCapped(quota(85, 0), NOW)).toBe('85 % semana');
	});

	it('keeps work by Codex or Gemini going to Claude, so the author never reviews itself', () => {
		const board = { tareas: [review('a', 'gemini'), review('b', 'gemini')] };
		expect(pickReviewer('codex', board, { quota: quota(0, 0), now: NOW }).agente).toBe(
			'claude',
		);
		expect(pickReviewer('gemini', board, { now: NOW }).agente).toBe('claude');
		expect(pickReviewer(null, board, { now: NOW }).agente).toBeUndefined();
	});

	it('reads only the last rate_limits of the newest Codex rollout', () => {
		expect(codexQuota({ home: codexHome(quota(61, 4)) })).toEqual(quota(61, 4));
		// No rate_limits in the tail of the newest file: the older ones are not used.
		expect(codexQuota({ home: codexHome(null) })).toEqual(quota(10, 10));
		expect(codexQuota({ home: tempDir('board-reviewer-empty-') })).toBeNull();
	});

	it('prints both loads and the quota when `review` picks the reviewer', () => {
		const dir = tempDir('board-reviewer-');
		mkdirSync(path.join(dir, 'tareas'), { recursive: true });
		const doc = {
			num: 1,
			titulo: 'de claude',
			estado: 'en revision',
			urgencia: 'normal',
			actor: 'sesion',
			agente: 'claude',
			requisitos: [],
			prompt: 'Sigue .agent/rules/board.md.\nDECISIONES\n- ninguna',
			rev: 1,
			actualizado: iso(NOW),
			rama: 'feat/a',
			pr: 10,
			cierre: {
				resumen: 'ok',
				comprobaciones: [],
				saltadas: [],
				pendientes: [],
				en: iso(NOW),
			},
		};
		writeFileSync(path.join(dir, 'tareas', 'de-claude.json'), JSON.stringify(doc));
		writeFileSync(
			path.join(dir, 'tareas', 'otra-revision.json'),
			JSON.stringify({ ...review('otra', 'gemini'), num: 2, titulo: 'r' }),
		);
		const home = codexHome(quota(37, 38, Math.floor(Date.now() / 1000) + 3600));
		const result = runCommand(
			process.execPath,
			[SCRIPT_PATH, 'review', 'de-claude', `--sha=${'a'.repeat(40)}`, '--coordinador'],
			{
				cwd: ROOT,
				allowFailure: true,
				env: sanitizeEnv({
					CELEBRA_BOARD_DIR: dir,
					HOME: home,
					USERPROFILE: home,
					BOARD_TEST_PREFLIGHT: JSON.stringify({
						pr: { files: [{ path: 'src/lib/server/index.ts' }] },
					}),
				}),
			},
		);
		expect(String(result.stderr)).toBe('');
		expect(String(result.stdout)).toContain(
			'de-claude-revision creada para codex (vuelta 1) · riesgo alto · carga 7 d: gemini 1, codex 0 · cuota Codex 38 % 5 h, 37 % semana',
		);
		const saved = JSON.parse(
			readFileSync(path.join(dir, 'tareas', 'de-claude-revision.json'), 'utf8'),
		);
		expect(saved.agente).toBe('codex');
	});
});
