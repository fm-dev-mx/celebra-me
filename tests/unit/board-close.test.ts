import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

/**
 * T297 (U-05): `pnpm board close --changelog=…` keeps a task's release note in its cierre, `pnpm board changelog`
 * turns the merged ones into `[Unreleased]` Markdown or checks CHANGELOG.md, and (U-03) a close from the task's
 * lane finishes its git-safety session with `--git-safety=commit`.
 */
const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SCRIPT_PATH = path.join(BOARD, 'board.mjs');
const NOW = '2026-10-26T12:00:00Z';
const SHA = 'a'.repeat(40);
const FULL = [
	'--resumen=Hecho.',
	'--comprobacion=type-check',
	'--saltada=ninguna',
	'--pendiente=ninguno',
	'--fallida=ninguna',
	'--riesgo=ninguno',
	'--duda=ninguna',
	'--excepcion=ninguna',
];

type Json = Record<string, any>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string) {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

function makeBoard(tareas: Json[]) {
	const dir = temp('board-close-');
	mkdirSync(path.join(dir, 'tareas'));
	for (const [i, t] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${t.id}.json`),
			JSON.stringify({
				num: i + 1,
				titulo: t.id,
				estado: 'en curso',
				urgencia: 'normal',
				actor: 'sesion',
				requisitos: [],
				rev: 1,
				actualizado: NOW,
				...t,
			}),
		);
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

const readTask = (dir: string, id: string): Json =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

/** Run a snippet with `c` = changelog.mjs; its printed JSON is returned. */
function probe(code: string) {
	const src = `const c = await import(process.argv[1]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, pathToFileURL(path.join(BOARD, 'changelog.mjs')).href],
		{ cwd: ROOT },
	);
	return JSON.parse(String(result.stdout));
}

const merged = (id: string, changelog: unknown, { en = NOW, ...fields }: Json = {}) => ({
	id,
	estado: 'unida',
	cierre: {
		resumen: 'Hecho.',
		comprobaciones: [],
		saltadas: [],
		pendientes: [],
		en,
		...(changelog === undefined ? {} : { changelog }),
	},
	...fields,
});

describe('close --changelog (T297)', () => {
	it('stores the release note, shows it and keeps it on a later close without the flag', () => {
		const dir = makeBoard([{ id: 'codigo' }]);
		const close = (...args: string[]) =>
			cli(dir, [
				'close',
				'codigo',
				'--coordinador',
				'--quien=claude',
				'--resumen=Hecho.',
				...args,
			]);

		const bad = close('--changelog=Nuevo: algo');
		expect(bad.status).toBe(2);
		expect(bad.err).toContain('--changelog debe ser «<Added|Changed|');
		expect(readTask(dir, 'codigo').cierre).toBeUndefined();
		const empty = close('--changelog');
		expect(empty.status).toBe(2);
		expect(empty.err).toContain('--changelog debe ser');

		const ok = close('--changelog=added: Board release notes live in the cierre');
		expect(ok.status).toBe(0);
		expect(ok.out).toContain('Nota de versión: Added: Board release notes live in the cierre');
		expect(readTask(dir, 'codigo').cierre.changelog).toEqual({
			grupo: 'Added',
			texto: 'Board release notes live in the cierre',
		});

		expect(close('--resumen=Otra vez.').status).toBe(0);
		expect(readTask(dir, 'codigo').cierre.changelog.grupo).toBe('Added');

		expect(close('--changelog=ninguno').status).toBe(0);
		expect(readTask(dir, 'codigo').cierre.changelog).toBe('ninguno');
		expect(cli(dir, ['show', 'codigo']).out).toContain('Nota de versión: ninguna.');
	});

	it('refuses a stored note with the wrong shape through board:verify', () => {
		const dir = makeBoard([merged('rara', { grupo: 'Nuevo', texto: 'x' })]);
		const r = cli(dir, ['verify', '--json']);
		expect(r.out).toContain('cierre.changelog debe ser {grupo, texto}');
	});
});

describe('pnpm board changelog (T297)', () => {
	const board = () =>
		makeBoard([
			merged(
				'vieja',
				{ grupo: 'Fixed', texto: 'Old fix' },
				{ pr: '#500', en: '2026-10-01T00:00:00Z' },
			),
			merged(
				'nueva',
				{ grupo: 'Added', texto: 'Release notes from the board' },
				{ pr: '#607' },
			),
			merged(
				'arreglo',
				{ grupo: 'Fixed', texto: 'Owner inbox stays unread' },
				{ pr: '#608', en: '2026-10-26T13:00:00Z' },
			),
			merged('sin-nota', 'ninguno', { pr: '#609' }),
			merged('sin-campo', undefined, { pr: '#610' }),
			{
				...merged('abierta', { grupo: 'Added', texto: 'Not merged yet' }),
				estado: 'en revision',
			},
		]);

	it('prints the merged notes grouped as [Unreleased] Markdown, since a date', () => {
		const r = cli(board(), ['changelog', '--desde=2026-10-20']);
		expect(r.status).toBe(0);
		expect(r.out.trim().split('\n')).toEqual([
			'### Added',
			'',
			'- Release notes from the board (#607)',
			'',
			'### Fixed',
			'',
			'- Owner inbox stays unread (#608)',
		]);
		const all = JSON.parse(cli(board(), ['changelog', '--json']).out);
		expect(all.map((n: Json) => n.tarea)).toEqual(['vieja', 'nueva', 'arreglo']);
		expect(cli(board(), ['changelog', '--desde=ayer']).status).toBe(2);

		const nonIso = cli(board(), ['changelog', '--desde=Oct 20 2026']);
		expect(nonIso.status).toBe(0);
		expect(nonIso.out.trim().split('\n')).toEqual(r.out.trim().split('\n'));
	});

	it('--faltan lists the notes CHANGELOG.md [Unreleased] lacks and exits 1 until none is missing', () => {
		const dir = board();
		const file = path.join(temp('changelog-'), 'CHANGELOG.md');
		writeFileSync(
			file,
			'# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Release notes (#607)\n- Mentions #6080 only\n\n## [0.1.0] - 2026-10-01\n\n- Old fix (#500)\n- Owner inbox (#608)\n',
		);
		const missing = cli(dir, [
			'changelog',
			'--desde=2026-10-20',
			'--faltan',
			`--archivo=${file}`,
		]);
		expect(missing.status).toBe(1);
		expect(missing.out).toContain('Faltan 1 de 2 notas en [Unreleased]');
		expect(missing.out).toContain('- Owner inbox stays unread (#608)');

		writeFileSync(file, '## [Unreleased]\n\n- (#607)\n- (#608)\n');
		const done = cli(dir, ['changelog', '--desde=2026-10-20', '--faltan', `--archivo=${file}`]);
		expect(done.status).toBe(0);
		expect(done.out).toContain('tiene las 2 notas del tablero');
	});

	it('parses and checks notes as pure functions', () => {
		const r = probe(`console.log(JSON.stringify({
			parsed: c.parseChangelog('security:  Rotate keys '),
			none: c.parseChangelog('Ninguna'),
			bad: (() => { try { c.parseChangelog('Added: two\\nlines'); } catch (e) { return e.message.slice(0, 12); } })(),
			valid: [c.validChangelog('ninguno'), c.validChangelog({ grupo: 'Added', texto: '' }), c.validChangelog(null)],
			section: c.unreleasedSection('x\\n## [Unreleased]\\na\\n## [1.0.0]\\nb'),
			urlPr: c.changelogNotes({ tareas: [{ id: 'u', estado: 'unida', pr: 'https://github.com/fm-dev-mx/celebra-me/pull/12', cierre: { en: '2026-10-26T00:00:00Z', changelog: { grupo: 'Fixed', texto: 'x' } } }] }, {}).map((n) => n.pr),
			nonIsoDesde: c.changelogNotes({
				tareas: [
					{ id: 'old', estado: 'unida', cierre: { en: '2026-10-01T00:00:00Z', changelog: { grupo: 'Fixed', texto: 'x' } } },
					{ id: 'cur', estado: 'unida', cierre: { en: '2026-10-26T00:00:00Z', changelog: { grupo: 'Fixed', texto: 'y' } } },
				],
			}, { desde: 'Oct 20, 2026' }).map((n) => n.tarea),
			missing: c.missingNotes([{ pr: '#12', texto: 'x' }, { pr: '#1', texto: 'y' }], '## [Unreleased]\\n- x (#12)\\n- y (#10)'),
		}));`);
		expect(r).toEqual({
			parsed: { grupo: 'Security', texto: 'Rotate keys' },
			none: 'ninguno',
			bad: '--changelog ',
			valid: [true, false, false],
			section: 'a',
			urlPr: ['#12'],
			nonIsoDesde: ['cur'],
			missing: [{ pr: '#1', texto: 'y' }],
		});
	});
});

describe('close --git-safety from the task lane (T297)', () => {
	const git = (cwd: string, ...args: string[]) =>
		runCommand(
			'git',
			[
				'-c',
				'user.email=t@example.com',
				'-c',
				'user.name=t',
				'-c',
				'commit.gpgsign=false',
				...args,
			],
			{
				cwd,
			},
		);

	it('finishes the lane session declaring the commit, and refuses a close from another lane', () => {
		const root = path.join(temp('lanes-'), 'celebra-me');
		mkdirSync(root);
		git(root, 'init', '-q', '-b', 'develop');
		git(root, 'commit', '-q', '--allow-empty', '-m', 'base');
		const lane = path.join(root, '..', 'celebra-me-worktrees', 'f05-plataforma');
		const other = path.join(root, '..', 'celebra-me-worktrees', 'f06-landing');
		git(root, 'worktree', 'add', '-q', '-b', 'feat/cierre', lane);
		git(root, 'worktree', 'add', '-q', '--detach', other);
		const candado = {
			agente: 'codex',
			desde: NOW,
			sesion: 'codex-test',
			carril: 'f05-plataforma',
			rama: 'feat/cierre',
		};
		const dir = makeBoard([{ id: 'codigo', rama: 'feat/cierre', candado }]);
		const baseline = path.join(lane, '.agent', 'tmp', 'git-safety-baseline.feat-cierre.json');
		runCommand(
			process.execPath,
			[
				path.join(ROOT, 'scripts', 'agent', 'git-safety.mjs'),
				'start',
				'--session=feat/cierre',
			],
			{
				cwd: lane,
				env: sanitizeEnv({ CELEBRA_GIT_SAFETY_ROOT: lane }),
			},
		);
		expect(existsSync(baseline)).toBe(true);
		// A close with a PR keeps the lock for the review (d290), so the second close still finds it.
		const result = ['--pr=#700', `--sha=${SHA}`, '--nivel=type-check'];
		const close = (checkout: string, ...args: string[]) =>
			cli(
				dir,
				[
					'close',
					'codigo',
					'--agente=codex',
					'--sesion=codex-test',
					...FULL,
					...result,
					...args,
				],
				{
					CELEBRA_BOARD_CHECKOUT: checkout,
				},
			);

		const wrong = close(other);
		expect(wrong.status).toBe(2);
		expect(wrong.err).toContain(
			'esta carpeta es f06-landing, pero el candado de codigo está en f05-plataforma',
		);

		const reminder = close(lane);
		expect(reminder.status).toBe(0);
		expect(reminder.out).toContain('git-safety: la sesión feat/cierre sigue abierta');

		git(lane, 'commit', '-q', '--allow-empty', '-m', 'work');
		const ok = close(lane, '--git-safety=commit');
		expect(ok.status).toBe(0);
		expect(ok.out).toContain('git-safety: sesión feat/cierre cerrada (commit)');
		expect(existsSync(baseline)).toBe(false);
		expect(readTask(dir, 'codigo').estado).toBe('en revision');
	});
});
