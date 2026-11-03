import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/tablero-core.mjs')).href;
const HEAD = 'a'.repeat(40);
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function checkout(): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'tablero-core-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'src'));
	writeFileSync(path.join(dir, 'src', 'cli.ts'), '');
	return dir;
}

function probe(code: string) {
	const r = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`const m=await import(process.argv[1]); console.log(JSON.stringify(${code}));`,
			MODULE,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(r.stdout);
}

describe('board core launcher', () => {
	it('defaults to ../tablero beside the Integration checkout', () => {
		const root = path.resolve('repo', 'celebra-me');
		expect(probe(`m.coreDir({ env: {}, root: ${JSON.stringify(root)} })`)).toBe(
			path.resolve('repo', 'tablero'),
		);
	});

	it('lets TABLERO_DIR override the checkout, relative to cwd', () => {
		const cwd = JSON.stringify(path.resolve('work'));
		expect(
			probe(`m.coreDir({ env: { TABLERO_DIR: '../core' }, cwd: ${cwd}, root: ${cwd} })`),
		).toBe(path.resolve('core'));
	});

	it('explains how to clone a missing checkout', () => {
		const missing = JSON.stringify(path.join(tmpdir(), 'no-such-tablero'));
		expect(probe(`m.coreProblem(${missing}, '${HEAD}', true)`)).toContain(
			'git clone git@github.com:fm-dev-mx/tablero.git',
		);
	});

	it('refuses a commit that is not on origin/main', () => {
		const dir = JSON.stringify(checkout());
		expect(probe(`m.coreProblem(${dir}, '${HEAD}', false)`)).toContain(
			'checkout --detach origin/main',
		);
	});

	it('accepts any commit on origin/main', () => {
		expect(probe(`m.coreProblem(${JSON.stringify(checkout())}, '${HEAD}', true)`)).toBeNull();
	});

	it('logs the core commit only when it changes', () => {
		const data = JSON.stringify(path.join(checkout(), 'datos'));
		const next = 'b'.repeat(40);
		expect(
			probe(
				`[m.recordCore(${data}, '${HEAD}'), m.recordCore(${data}, '${HEAD}'), m.recordCore(${data}, '${next}')]`,
			),
		).toEqual([true, false, true]);
		const log = readFileSync(path.join(JSON.parse(data), 'nucleo.log'), 'utf8')
			.trim()
			.split('\n');
		expect(log.map((line) => line.split(' ')[1])).toEqual([HEAD, next]);
	});
});

describe('board core cutover', () => {
	const read = (file: string) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

	it('keeps one board script group on the core launcher', () => {
		const { scripts } = read('package.json');
		const group = ['board', 'board:serve', 'board:mcp'];
		for (const name of group) {
			expect(scripts[name]).toMatch(/^node scripts\/board\/tablero-core\.mjs\b/);
		}
		const boardScripts = Object.keys(scripts).filter((name) => /^(board|tablero)\b/.test(name));
		expect(boardScripts.sort()).toEqual([...group].sort());
	});

	it('tracks no core version and registers projects and lanes', () => {
		const config = read('tablero.config.json');
		expect(config.nucleo).toBeUndefined();
		const ids = config.proyectos.map((project: { id: string }) => project.id);
		expect(ids[0]).toBe('celebra-me');
		expect(config.migracion).toBeUndefined();
		for (const lane of config.carriles) {
			expect(lane.carpeta).toBe(`../celebra-me-worktrees/${lane.id}`);
		}
	});
});
