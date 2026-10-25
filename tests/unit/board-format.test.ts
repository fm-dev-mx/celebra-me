import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const FORMAT = pathToFileURL(path.join(ROOT, 'scripts', 'board', 'format.mjs')).href;

/** Runs `code` with `m` = the board's format module and returns what it prints as JSON. */
function probe(code: string) {
	const src = `const m = await import(process.argv[1]); ${code}`;
	const result = runCommand(process.execPath, ['--input-type=module', '-e', src, FORMAT], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({}),
	});
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const SHA = '23deb49afdf5552b31b782dcfa8f4d20b1d1327a';
const kinds = (text: string) =>
	probe(
		`console.log(JSON.stringify(m.tokenize(${JSON.stringify(text)}).filter((x) => x.kind !== 'text')))`,
	) as { kind: string; text: string }[];
const html = (text: string) =>
	probe(
		`console.log(JSON.stringify(m.richText(${JSON.stringify(text)}, { task: (n) => (n === 132 ? { id: 'landing-pulido', titulo: 'Landing <pulida>' } : null), decision: (id) => (id === 'd210' ? { decision: 'Solo el coordinador reinicia 4320' } : null) })))`,
	) as string;

describe('board free-text formatter', () => {
	it('recognises PRs, tasks, decisions, SHAs, paths, branches and file names', () => {
		expect(
			kinds(
				`PR #512 cierra T132 (d210) en ${SHA} sobre feat/board-readable-cards; ver scripts/board/view.html y model.mjs`,
			),
		).toEqual([
			{ kind: 'pr', text: '#512' },
			{ kind: 'task', text: 'T132' },
			{ kind: 'dec', text: 'd210' },
			{ kind: 'sha', text: SHA },
			{ kind: 'branch', text: 'feat/board-readable-cards' },
			{ kind: 'path', text: 'scripts/board/view.html' },
			{ kind: 'file', text: 'model.mjs' },
		]);
	});

	it('leaves plain numbers, words and lowercase task-like text alone', () => {
		expect(
			kinds('CI 40130668415 verde; 9 suites / 120 pruebas; t12 y deadbeef y D210'),
		).toEqual([]);
	});

	it('gives the input back unchanged when the tokens are joined', () => {
		const text = `HEAD 756ae5db → 369c2b86; baseline preservado. Ver https://example.com/x. y \`pnpm board\``;
		expect(
			probe(
				`console.log(JSON.stringify(m.tokenize(${JSON.stringify(text)}).map((x) => x.text).join('')))`,
			),
		).toBe(text);
	});

	it('cuts a SHA to 7 characters, keeps the full one as tooltip and copy value', () => {
		const out = html(`commit ${SHA}`);
		expect(out).toContain(`data-sha="${SHA}"`);
		expect(out).toContain(`title="${SHA} · clic para copiar"`);
		expect(out).toContain('>23deb49</button>');
	});

	it('links a PR to GitHub, a known task to its card and a decision to the history', () => {
		const out = html('PR #512, T132, T999 y d210');
		expect(out).toContain('href="https://github.com/fm-dev-mx/celebra-me/pull/512"');
		expect(out).toContain('data-sel="landing-pulido"');
		expect(out).toContain('title="Landing &lt;pulida&gt;"');
		expect(out).toContain('<span class="tl-x">T999</span>');
		expect(out).toContain('data-dec="d210" title="Solo el coordinador reinicia 4320"');
	});

	it('dims paths and branches in monospace and escapes everything else', () => {
		const out = html('<b>x</b> en src/lib/a.ts y fix/y-z');
		expect(out).toContain('&lt;b&gt;x&lt;/b&gt;');
		expect(out).toContain('<span class="nm">src/lib/a.ts</span>');
		expect(out).toContain('<span class="nm">fix/y-z</span>');
	});

	it('swaps internal jargon for a plain word and keeps the original as tooltip', () => {
		const out = html('Git Safety finish FALLÓ; baseline preservado');
		expect(out).toContain(
			'title="Término original: Git Safety finish">cierre de seguridad de Git</span>',
		);
		expect(out).toContain(
			'title="Término original: baseline preservado">registro de seguridad conservado</span>',
		);
	});

	it('keeps a URL out of the sentence punctuation', () => {
		expect(kinds('Ver https://example.com/a/b. Luego')).toEqual([
			{ kind: 'url', text: 'https://example.com/a/b' },
		]);
	});
});

describe('board card helpers', () => {
	it('splits the summary into one short sentence and the rest, dropping a prefix that repeats the title', () => {
		expect(
			probe(
				`console.log(JSON.stringify(m.leadOf('T142 rev-2 (PR #512): revisión publicada. GitHub rechazó el cambio.\\nOtra línea.', { id: 'rev-2', num: 142 })))`,
			),
		).toEqual({ lead: 'Revisión publicada.', rest: 'GitHub rechazó el cambio.\nOtra línea.' });
	});

	it('keeps a prefix that is not the task itself', () => {
		expect(
			probe(
				`console.log(JSON.stringify(m.leadOf('PR #523 unido a develop (46b8896ae): fix(rsvp): x', { id: 'otra', num: 1 }).lead))`,
			),
		).toBe('PR #523 unido a develop (46b8896ae): fix(rsvp): x');
	});

	it('says how a task ended and who did it', () => {
		expect(
			probe(`console.log(JSON.stringify([
				m.outcomeOf({ id: 'a-revision', estado: 'hecha', cierre: { pendientes: [] } }),
				m.outcomeOf({ id: 'a-revision', estado: 'hecha', veredicto: 'hallazgos', cierre: { pendientes: [{}] } }),
				m.outcomeOf({ id: 'a-revision', estado: 'hecha', cierre: { pendientes: [{}] } }),
				m.outcomeOf({ id: 'a', estado: 'cancelada' }),
				m.outcomeOf({ id: 'a', estado: 'comprobada' }),
				m.whoOf({ agente: 'codex' }),
				m.whoOf({ agente: 'cualquiera', cierre: { quien: 'dueno' } }),
				m.whoOf({}),
			]))`),
		).toEqual([
			{ key: 'ok', label: 'Aprobada' },
			{ key: 'warn', label: 'Con hallazgos' },
			{ key: 'warn', label: 'Con pendientes' },
			{ key: 'cancel', label: 'Cancelada' },
			{ key: 'ok', label: 'Comprobada' },
			{ key: 'codex', label: 'Codex' },
			{ key: 'dueno', label: 'Usted' },
			null,
		]);
	});

	it('writes a relative age', () => {
		const now = Date.parse('2026-10-24T20:00:00Z');
		expect(
			probe(
				`console.log(JSON.stringify(['2026-10-24T19:59:30Z','2026-10-24T19:15:00Z','2026-10-24T18:00:00Z','2026-10-20T20:00:00Z','x'].map((s) => m.relTime(s, ${now}))))`,
			),
		).toEqual(['hace un momento', 'hace 45 min', 'hace 2 h', 'hace 4 días', '']);
	});
});
