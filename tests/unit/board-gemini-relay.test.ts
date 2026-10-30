import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const NOW = Date.parse('2026-10-28T20:00:00Z');
const ALERT =
	'Arranque el relevo de Gemini: en Antigravity, en el Chat maestro, escriba «Arranque de nuevo el relevo celebra-gemini-relay.mjs».';
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-relay-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'board', 'bitacora'), { recursive: true });
	writeFileSync(
		path.join(dir, 'board', 'bitacora', 'message.json'),
		JSON.stringify({
			en: new Date(NOW).toISOString(),
			mensaje: { id: 'pending', para: 'gemini', texto: 'Review this task' },
		}),
	);
	return dir;
}

function probe(dir: string, code: string, extra: Record<string, string> = {}) {
	const src = `const n = await import(process.argv[1]);
		const s = await import(process.argv[2]);
		const w = await import(process.argv[3]);
		const f = await import(process.argv[4]);
		const v = await import(process.argv[5]);
		const now = ${NOW};
		${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			...['next.mjs', 'store.mjs', 'watch.mjs', 'format.mjs', 'view-payload.mjs'].map(
				(file) => pathToFileURL(path.join(BOARD, file)).href,
			),
		],
		{
			cwd: ROOT,
			env: sanitizeEnv({
				CELEBRA_BOARD_DIR: path.join(dir, 'board'),
				CELEBRA_BOARD_WATCH_STATE: path.join(dir, 'watch.json'),
				CELEBRA_GEMINI_RELAY_FILE: '',
				...extra,
			}),
		},
	);
	return JSON.parse(String(result.stdout));
}

describe('Gemini relay heartbeat', () => {
	it.each([
		['fresh', NOW - 5000, false],
		['exactly two minutes', NOW - 120000, false],
		['older than two minutes', NOW - 120001, true],
		['missing', null, true],
		['invalid timestamp', 'invalid', true],
		['numeric timestamp', NOW - 180000, true],
	])(
		'projects %s heartbeat into the CLI and the coordinator, never the owner (T489)',
		(_name, at, alerts) => {
			const dir = fixture();
			if (at !== null)
				writeFileSync(
					path.join(dir, 'gemini-relay.json'),
					JSON.stringify({
						at:
							typeof at === 'number' && _name !== 'numeric timestamp'
								? new Date(at).toISOString()
								: at,
						pid: 123,
					}),
				);
			const out = probe(
				dir,
				`
			const board = s.loadBoard(s.boardDir());
			const sections = n.nextSections(board, { now });
			console.log(JSON.stringify({
				cli: n.sectionLines(sections).join('\\n'),
				web: f.ownerActions(v.liveBoard(board, now), { now }),
				coord: sections.coordinador,
				watch: w.run({ dryRun: true, now, out: () => {} }),
			}));`,
			);
			expect(out.cli.includes(ALERT)).toBe(alerts);
			expect(out.watch).toEqual(alerts ? [{ agente: 'dueno', text: ALERT }] : []);
			expect(out.coord.some((row: { texto: string }) => row.texto === ALERT)).toBe(alerts);
			expect(out.web.some((row: { texto: string }) => row.texto === ALERT)).toBe(false);
		},
	);

	it('does not alert without unread Gemini messages, including read and handled messages', () => {
		const dir = fixture();
		const out = probe(
			dir,
			`
			const board = s.loadBoard(s.boardDir());
			const read = { ...board, bandejas: [{ id: 'gemini', leidos: ['pending'] }] };
			const handled = { ...board, bitacora: [...board.bitacora,
				{ atendido: { para: 'gemini', mensajes: ['pending'] } }] };
			console.log(JSON.stringify([
				n.geminiRelayAlert({ ...board, bitacora: [] }, now),
				n.geminiRelayAlert(read, now), n.geminiRelayAlert(handled, now),
			]));`,
		);
		expect(out).toEqual([null, null, null]);
	});

	it('uses the heartbeat override and treats malformed JSON as missing', () => {
		const dir = fixture();
		writeFileSync(path.join(dir, 'gemini-relay.json'), '{');
		writeFileSync(
			path.join(dir, 'custom.json'),
			JSON.stringify({ at: new Date(NOW).toISOString() }),
		);
		expect(
			probe(
				dir,
				'console.log(JSON.stringify(n.geminiRelayAlert(s.loadBoard(s.boardDir()), now)));',
			),
		).toBe(ALERT);
		expect(
			probe(
				dir,
				'console.log(JSON.stringify(n.geminiRelayAlert(s.loadBoard(s.boardDir()), now)));',
				{
					CELEBRA_GEMINI_RELAY_FILE: path.join(dir, 'custom.json'),
				},
			),
		).toBeNull();
	});

	it('notifies once per outage, keeps the latch without pending messages, and rearms after recovery', () => {
		const dir = fixture();
		const out = probe(
			dir,
			`
			const fs = await import('node:fs');
			const shown = [];
			fs.writeFileSync(w.statePath(s.boardDir()), 'null');
			const malformed = w.run({ now, out: () => {}, show: () => {} });
			fs.unlinkSync(w.statePath(s.boardDir()));
			const run = (dryRun = false) => w.run({ now, dryRun, out: () => {}, show: (text) => shown.push(text) });
			const dry = run(true);
			const noState = !fs.existsSync(w.statePath(s.boardDir()));
			run(); run();
			const message = s.loadBoard(s.boardDir()).bitacora[0];
			fs.unlinkSync(process.env.CELEBRA_BOARD_DIR + '/bitacora/message.json');
			run();
			fs.writeFileSync(process.env.CELEBRA_BOARD_DIR + '/bitacora/message.json', JSON.stringify(message));
			run();
			const firstOutage = shown.length;
			fs.writeFileSync(s.geminiRelayPath(s.boardDir()), JSON.stringify({ at: new Date(now).toISOString() }));
			run();
			fs.unlinkSync(s.geminiRelayPath(s.boardDir()));
			run();
			console.log(JSON.stringify({ dry, noState, firstOutage, shown, malformed }));`,
		);
		expect(out.dry).toEqual([{ agente: 'dueno', text: ALERT }]);
		expect(out.noState).toBe(true);
		expect(out.malformed).toEqual([{ agente: 'dueno', text: ALERT }]);
		expect(out.firstOutage).toBe(1);
		expect(out.shown).toEqual([ALERT, ALERT]);
	});

	it('prints the same alert in board list and sigue', () => {
		const dir = fixture();
		for (const command of ['list', 'sigue']) {
			const result = runCommand(
				process.execPath,
				[path.join(BOARD, 'board.mjs'), command, '--offline'],
				{
					cwd: ROOT,
					env: sanitizeEnv({
						CELEBRA_BOARD_DIR: path.join(dir, 'board'),
						CELEBRA_GEMINI_RELAY_FILE: '',
					}),
				},
			);
			expect(String(result.stdout)).toContain(ALERT);
		}
	});
});
