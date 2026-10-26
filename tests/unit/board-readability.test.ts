import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const VIEW = readFileSync(path.join(BOARD, 'view.html'), 'utf8');
const CSS = /<style>([\s\S]*?)<\/style>/.exec(VIEW)?.[1] ?? '';
const SCRIPT = /<script type="module">([\s\S]*?)<\/script>/.exec(VIEW)?.[1] ?? '';

/** Runs `code` with `m` = the board module `file` and returns what it prints as JSON. */
function probe(file: string, code: string) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const href = pathToFileURL(path.join(BOARD, file)).href;
	const result = runCommand(process.execPath, ['--input-type=module', '-e', src, href], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}
const format = (code: string) => probe('format.mjs', code);
const TASKS = `{ task: (n) => (n === 274 ? { id: 'revision-riesgo', titulo: 'Revisión <riesgo>' } : null) }`;

describe('board readability (d284)', () => {
	it('bolds only **…** and shows `…` as inline code in free text', () => {
		expect(
			format(
				`console.log(JSON.stringify(m.richText('Use **solo** \`pnpm board\` y **T274 \`x\`**', ${TASKS})))`,
			),
		).toBe(
			'Use <strong>solo</strong> <code>pnpm board</code> y <strong><a class="tl" href="#cola" data-sel="revision-riesgo" data-jump="1" data-all="1" title="Revisión &lt;riesgo&gt;">T274</a> <code>x</code></strong>',
		);
		// A lone pair of asterisks stays text.
		expect(format(`console.log(JSON.stringify(m.richText('a ** b')))`)).toBe('a ** b');
	});

	it('renders a title for a button without links, a known T274 as a span that opens it', () => {
		expect(
			format(
				`console.log(JSON.stringify(m.titleHtml('**Tablero** \`view\` T274, T9, PR #576 y d284 <b>', ${TASKS})))`,
			),
		).toBe(
			'<strong>Tablero</strong> <code>view</code> <span class="tl" data-sel="revision-riesgo" data-jump="1" data-all="1" title="Revisión &lt;riesgo&gt;">T274</span>, T9, PR #576 y d284 &lt;b&gt;',
		);
	});

	it('reads a PR state for the row: CI rojo, abierto, unido or unknown', () => {
		expect(
			format(`const prs = [{ number: 5, ci: 'rojo' }, { number: 6, ci: 'verde' }];
				console.log(JSON.stringify([
					m.prStatus({ pr: '#5' }, prs),
					m.prStatus({ pr: '#6' }, prs),
					m.prStatus({ pr: '#7', estado: 'unida' }, prs),
					m.prStatus({ pr: '#8', estado: 'en revision' }, null),
					m.prStatus({}, prs),
				]))`),
		).toEqual([
			{ n: 5, key: 'rojo', label: 'CI rojo' },
			{ n: 6, key: 'abierto', label: 'abierto' },
			{ n: 7, key: 'unido', label: 'unido' },
			{ n: 8, key: '', label: '' },
			null,
		]);
	});

	it('says who runs an open task and where, «Claude · f05» or «Gemini»', () => {
		expect(
			format(`console.log(JSON.stringify([
				m.runnerOf({ estado: 'en curso', agente: 'claude', candado: { agente: 'claude', carril: 'f05-plataforma' } }),
				m.runnerOf({ estado: 'pendiente', agente: 'gemini' }),
				m.runnerOf({ estado: 'pendiente', agente: 'cualquiera' }),
				m.runnerOf({ estado: 'hecha', agente: 'claude' }),
				m.laneKey('f04-integracion'),
				m.laneKey('sin-carril'),
			]))`),
		).toEqual([
			{ key: 'claude', text: 'Claude · f05' },
			{ key: 'gemini', text: 'Gemini' },
			null,
			null,
			'f04',
			'sin-carril',
		]);
	});

	it('writes the versions line from the newest data change', () => {
		const now = Date.parse('2026-10-25T20:00:00Z');
		expect(
			format(`const board = {
				tareas: [{ actualizado: '2026-10-25T19:40:00Z' }, { actualizado: 'x' }],
				bitacora: [{ en: '2026-10-25T19:50:00Z' }],
				decisiones: [{ en: '2026-10-20T10:00:00Z' }],
				vivo: { app: { version: '0.50.0', tablero: { sha: '72db2fc', en: '2026-10-25T18:00:00Z' } } },
			};
			console.log(JSON.stringify([m.lastChange(board), m.versionsLine(board, ${now}), m.versionsLine({}, ${now}), m.lastChange({})]))`),
		).toEqual([
			'2026-10-25T19:50:00.000Z',
			'Celebra-me v0.50.0 · Tablero 72db2fc · Actualizado hace 10 min',
			'',
			null,
		]);
	});

	it('folds a PR check rollup into one CI word and reads the app version', () => {
		expect(
			probe(
				'live.mjs',
				`console.log(JSON.stringify([
					m.ciOf([{ conclusion: 'SUCCESS' }, { state: 'FAILURE' }]),
					m.ciOf([{ conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }]),
					m.ciOf([{ conclusion: 'SUCCESS' }, { conclusion: 'SKIPPED' }, { state: 'SUCCESS' }]),
					m.ciOf([]),
					(await m.readApp()).version,
				]))`,
			),
		).toEqual([
			'rojo',
			'pendiente',
			'verde',
			null,
			JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
		]);
	});

	it('styles inline code Notion-like and keeps titles in normal weight', () => {
		expect(CSS).toContain('code{color:var(--code-ink)}');
		expect(CSS).toContain('--code-bg:#f1f0ed;--code-ink:#c4362b;');
		expect(CSS.match(/--code-bg:#2a2a2a;--code-ink:#ff7369;/g)).toHaveLength(2);
		expect(CSS).toContain('.item .ttl{grid-column:3;font:400');
		expect(CSS).toContain('.fr .ttl{font:400');
		expect(SCRIPT).toContain('${tt(t.titulo)}');
		expect(SCRIPT).not.toContain('${esc(t.titulo)}</button>');
	});

	it('folds the help into «?», quiets the sync buttons and shows the versions foot', () => {
		expect(VIEW).toMatch(/<div class="help" id="help" hidden><p>«Para usted» muestra solo/);
		expect(VIEW).toContain('id="help-btn" aria-expanded="false" aria-controls="help"');
		expect(VIEW).toContain('class="btn sm ghost" id="sync-dry"');
		expect(VIEW).toContain('class="btn sm ghost" id="sync-run"');
		expect(VIEW).not.toContain('class="btn primary" id="sync-run"');
		expect(VIEW).toContain('<footer id="meta" aria-live="polite">');
		expect(SCRIPT).toContain("for(const id of ['meta','sidever'])");
	});

	it('counts every tab and repeats the count in the view title', () => {
		for (const id of ['n-you', 'n-cola', 'n-cal', 'n-blk', 'n-fin', 'n-car', 'n-hist'])
			expect(VIEW).toContain(`id="${id}"`);
		expect(SCRIPT).toContain("$('vtitle').textContent=TITLE[S.tab]+(n!==''?` (${n})`:'')");
	});

	it('unfolds subtasks with a toggle in the mother row', () => {
		expect(SCRIPT).toContain('itemHtml(head,{toggle})');
		expect(SCRIPT).toContain("const tg=ev.target.closest('[data-toggle]')");
		expect(SCRIPT).not.toContain('<details class="subs"');
	});

	it('never stays on «Cargando…»: a fetch fallback, a visible state and a start watchdog', () => {
		expect(SCRIPT).toContain("await fetch('/api/board',{cache:'no-store'})");
		expect(SCRIPT).toContain('setTimeout(()=>{if(!S.ready)fetchBoard()},2000);');
		expect(SCRIPT).toContain("if(!S.ready)$('meta').textContent=text");
		expect(SCRIPT).toContain('window.boardStarted=true;');
		expect(VIEW).toMatch(/<script>\n\/\/ d284:[\s\S]*?if\(window\.boardStarted\)return;/);
		expect(VIEW).not.toContain('<span class="rev" id="rev">Cargando…</span>');
	});
});
