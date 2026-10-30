import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/tablero-core.mjs')).href;
const PIN = 'a'.repeat(40);
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
		const problem = probe(`m.coreProblem(${missing}, '${PIN}', '${PIN}')`);
		expect(problem).toContain('git clone git@github.com:fm-dev-mx/tablero.git');
		expect(problem).toContain(PIN);
	});

	it('refuses a checkout at another commit', () => {
		const dir = JSON.stringify(checkout());
		expect(probe(`m.coreProblem(${dir}, '${PIN}', '${'b'.repeat(40)}')`)).toContain(
			`checkout ${PIN}`,
		);
	});

	it('accepts the pinned commit', () => {
		expect(
			probe(`m.coreProblem(${JSON.stringify(checkout())}, '${PIN}', '${PIN}')`),
		).toBeNull();
	});
});
