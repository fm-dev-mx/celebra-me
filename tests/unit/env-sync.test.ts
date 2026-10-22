import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { planEnvSync } from '../../scripts/agent/env-files';
import { cleanupFixture, createLaneFixture } from '../helpers/git-fixture';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const parents: string[] = [];
const cli = join(process.cwd(), 'scripts/agent/env-files.ts');
const tsxLoader = pathToFileURL(
	createRequire(join(process.cwd(), 'package.json')).resolve('tsx'),
).href;

afterAll(() => parents.forEach(cleanupFixture));

function fixture(segment = 'f06-landing') {
	const parent = mkdtempSync(join(tmpdir(), 'env-sync-'));
	parents.push(parent);
	const target = createLaneFixture(parent, segment, 'Env Sync Tester');
	const source = join(parent, 'celebra-me');
	for (const root of [source, target]) {
		writeFileSync(join(root, '.env.example'), '# Local\nLOCAL_NAME=\n');
		writeFileSync(join(root, '.env.preview.local.example'), '# Preview\nPREVIEW_NAME=\n');
	}
	writeFileSync(join(source, '.env.local'), 'LOCAL_NAME=synthetic-local\n');
	return { parent, source, target };
}

describe('environment synchronization boundaries', () => {
	it('plans only Local configuration without requiring or exposing other purposes', () => {
		const { source, target } = fixture();
		writeFileSync(
			join(source, '.env.production.local'),
			'deliberately invalid production data',
		);
		writeFileSync(join(source, '.env.e2e.local'), 'deliberately invalid hosted-test data');
		expect(planEnvSync(source, [target]).map(({ file, state }) => ({ file, state }))).toEqual([
			{ file: '.env.local', state: 'absent' },
		]);
		expect(existsSync(join(target, '.env.local'))).toBe(false);
	});

	it.each(['f11-preview', 'f12-release'])('requires the Preview overlay for %s', (segment) => {
		const { source, target } = fixture(segment);
		expect(() => planEnvSync(source, [target])).toThrow(
			'Required Integration source is missing',
		);
		writeFileSync(join(source, '.env.preview.local'), 'PREVIEW_NAME=synthetic-preview\n');
		expect(planEnvSync(source, [target]).map(({ file }) => file)).toEqual([
			'.env.local',
			'.env.preview.local',
		]);
	});

	it('preserves differing destination values and rejects incompatible templates', () => {
		const { source, target } = fixture();
		writeFileSync(join(target, '.env.local'), 'LOCAL_NAME=owner-value\n');
		expect(() => planEnvSync(source, [target])).toThrow('Configuration conflict');
		expect(readFileSync(join(target, '.env.local'), 'utf8')).toContain('owner-value');
		writeFileSync(join(target, '.env.example'), '# Older schema\nOTHER=\n');
		expect(() => planEnvSync(source, [target])).toThrow('Incompatible destination template');
	});

	it('treats identical files as no-ops', () => {
		const { source, target } = fixture();
		writeFileSync(join(target, '.env.local'), readFileSync(join(source, '.env.local')));
		expect(planEnvSync(source, [target])[0].state).toBe('identical');
	});

	it('initializes only the assigned runtime files and safely repeats the operation', () => {
		const { source, target } = fixture();
		writeFileSync(join(source, '.env.production.local'), 'PROD_TOKEN=synthetic-private\n');
		writeFileSync(join(source, '.env.e2e.local'), 'E2E_TOKEN=synthetic-private\n');
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = runCommand(
				process.execPath,
				['--import', tsxLoader, cli, 'sync', '--apply'],
				{
					cwd: target,
					env: sanitizeEnv(),
					allowFailure: true,
				},
			);
			expect(result.status).toBe(0);
			expect(result.stdout).not.toContain('synthetic-');
		}
		expect(readFileSync(join(target, '.env.local'), 'utf8')).toBe(
			'LOCAL_NAME=synthetic-local\n',
		);
		expect(existsSync(join(target, '.env.production.local'))).toBe(false);
		expect(existsSync(join(target, '.env.e2e.local'))).toBe(false);
	});

	it('refuses foreign repositories, unknown paths and redirected lane directories', () => {
		const first = fixture();
		const foreign = fixture();
		expect(() => planEnvSync(first.source, [foreign.target])).toThrow('canonical lane');
		const unknown = join(first.parent, 'scratch');
		mkdirSync(unknown);
		expect(() => planEnvSync(first.source, [unknown])).toThrow('canonical lane');
		const redirected = join(dirname(first.target), 'f08-demos');
		symlinkSync(unknown, redirected, process.platform === 'win32' ? 'junction' : 'dir');
		expect(() => planEnvSync(first.source, [redirected])).toThrow('canonical lane');
	});

	it('preflights the Preview overlay before copying the Local file and refuses bulk apply', () => {
		const { target } = fixture('f12-release');
		for (const args of [
			['sync', '--apply'],
			['sync', '--all', '--apply'],
		]) {
			const result = runCommand(process.execPath, ['--import', tsxLoader, cli, ...args], {
				cwd: target,
				env: sanitizeEnv(),
				allowFailure: true,
			});
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				args.includes('--all')
					? 'Bulk apply is unsupported'
					: 'Required Integration source is missing',
			);
			expect(existsSync(join(target, '.env.local'))).toBe(false);
			expect(result.stderr).not.toContain('synthetic-local');
		}
	});
});
