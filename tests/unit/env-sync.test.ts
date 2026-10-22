import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
	existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertCheckoutRuntime,
	parseSyncArgs,
	synchronizeEnv,
} from '../../scripts/agent/env-files';
import { PREVIEW_PROJECT_REF } from '../../scripts/shared/celebra-runtime-env';
import { cleanupFixture, createLaneFixture } from '../helpers/git-fixture';

const parents: string[] = [];
afterAll(() => {
	for (const parent of parents) cleanupFixture(parent);
});

function fixture(segment = 'f09-docs') {
	const parent = mkdtempSync(join(tmpdir(), 'env-sync-'));
	parents.push(parent);
	const target = createLaneFixture(parent, segment, 'Env Sync Tester');
	const source = join(parent, 'celebra-me');
	for (const root of [source, target]) {
		writeFileSync(join(root, '.env.example'), '# Synthetic local fixture\nA=\n');
		writeFileSync(
			join(root, '.env.preview.local.example'),
			'# Synthetic Preview fixture\nB=\n',
		);
	}
	writeFileSync(join(source, '.env.local'), 'A=synthetic-secret\n');
	writeFileSync(join(source, '.env.preview.local'), 'B=synthetic-preview\n');
	return { source, target };
}

const options = { targets: ['f09-docs'], purposes: ['local'] as const, apply: false };
const request = (apply = false) => ({ ...options, purposes: [...options.purposes], apply });

describe('scoped configuration synchronization', () => {
	it('copies the Preview overlay only to Preview-default lanes and never hosted-test files', () => {
		const { source, target } = fixture('f12-release');
		writeFileSync(join(source, '.env.e2e.local'), 'C=synthetic-test-secret\n');
		mkdirSync(join(source, '.env.production.local'));
		synchronizeEnv(
			source,
			{ targets: ['f12-release'], purposes: ['preview'], apply: true },
			() => {},
		);
		expect(readFileSync(join(target, '.env.preview.local'), 'utf8')).toBe(
			'B=synthetic-preview\n',
		);
		expect(existsSync(join(target, '.env.local'))).toBe(false);
		expect(existsSync(join(target, '.env.e2e.local'))).toBe(false);
		expect(existsSync(join(target, '.env.production.local'))).toBe(false);
		expect(() =>
			synchronizeEnv(source, {
				targets: ['f12-release'],
				purposes: ['e2e' as 'local'],
				apply: true,
			}),
		).toThrow('hosted-test');
		expect(existsSync(join(target, '.env.e2e.local'))).toBe(false);
	});

	it('refuses the Preview overlay for a Local-default lane before inspecting it', () => {
		const { source, target } = fixture();
		expect(() =>
			synchronizeEnv(source, { ...request(true), purposes: ['local', 'preview'] }),
		).toThrow('Preview-default lanes');
		expect(existsSync(join(target, '.env.local'))).toBe(false);
		expect(existsSync(join(target, '.env.preview.local'))).toBe(false);
	});

	it('rejects a different repository even when inherited Git variables point at the source', () => {
		const { source, target } = fixture();
		const foreign = fixture();
		// Git hides a linked worktree's .git file on Windows; hidden files cannot be overwritten.
		rmSync(join(target, '.git'));
		writeFileSync(join(target, '.git'), `gitdir: ${join(foreign.source, '.git')}\n`);
		const inherited = process.env.GIT_DIR;
		try {
			process.env.GIT_DIR = join(source, '.git');
			expect(() => synchronizeEnv(source, request(true))).toThrow('another repository');
			expect(existsSync(join(target, '.env.local'))).toBe(false);
		} finally {
			if (inherited === undefined) delete process.env.GIT_DIR;
			else process.env.GIT_DIR = inherited;
		}
	});
	it('requires named targets and purposes; excludes bulk and Production requests', () => {
		for (const args of [
			[],
			['--all'],
			['--target', '../elsewhere', '--purpose', 'production'],
			['--target', 'f12-release', '--purpose', 'e2e'],
			['--force'],
		]) {
			expect(() => parseSyncArgs(args)).toThrow();
		}
		expect(parseSyncArgs(['--target', 'f09-docs', '--purpose', 'local', '--apply'])).toEqual(
			request(true),
		);
	});

	it('dry-runs without copying and reads only selected purposes', () => {
		const { source, target } = fixture();
		mkdirSync(join(source, '.env.production.local'));
		mkdirSync(join(source, '.env.e2e.local'));
		const output: string[] = [];
		synchronizeEnv(source, request(), (line) => output.push(line));
		expect(existsSync(join(target, '.env.local'))).toBe(false);
		expect(output.join('\n')).toContain('would copy');
		expect(output.join('\n')).not.toContain('synthetic-secret');
	});

	it('copies selected files completely, keeps them private, and treats identical copies as no-ops', () => {
		const { source, target } = fixture();
		const output: string[] = [];
		synchronizeEnv(source, request(true), (line) => output.push(line));
		expect(readFileSync(join(target, '.env.local'), 'utf8')).toBe('A=synthetic-secret\n');
		expect(existsSync(join(target, '.env.preview.local'))).toBe(false);
		expect(existsSync(join(target, '.env.production.local'))).toBe(false);
		expect(output.join('\n')).toContain('f09-docs/.env.local: copied');
		output.length = 0;
		synchronizeEnv(source, request(true), (line) => output.push(line));
		expect(output.join('\n')).toContain('identical');
		expect(output.join('\n')).toContain('0 file(s) copied');
		expect(output.join('\n')).not.toContain('synthetic-secret');
	});

	it('preserves a differing destination and preflights the entire selected batch before writing', () => {
		const { source, target } = fixture('f11-preview');
		writeFileSync(join(target, '.env.preview.local'), 'B=owner-value\n');
		expect(() =>
			synchronizeEnv(source, {
				targets: ['f11-preview'],
				purposes: ['local', 'preview'],
				apply: true,
			}),
		).toThrow('Conflict preserved');
		expect(existsSync(join(target, '.env.local'))).toBe(false);
		expect(readFileSync(join(target, '.env.preview.local'), 'utf8')).toBe('B=owner-value\n');
	});

	it('refuses incompatible destination schemas and missing required sources without copying', () => {
		const { source, target } = fixture();
		writeFileSync(join(target, '.env.example'), '# Older version\nOLD=\n');
		expect(() => synchronizeEnv(source, request(true))).toThrow('incompatible');
		expect(existsSync(join(target, '.env.local'))).toBe(false);
		writeFileSync(join(target, '.env.example'), '# Compatible\nA=\n');
		rmSync(join(source, '.env.local'));
		expect(() => synchronizeEnv(source, request(true))).toThrow('Required file is missing');
		expect(existsSync(join(target, '.env.local'))).toBe(false);
	});

	it('rejects unknown/traversing targets and untyped Production purposes', () => {
		const { source } = fixture();
		for (const target of ['integration', '../scratch', 'f09-docs/../f11-preview', 'unknown']) {
			expect(() => synchronizeEnv(source, { ...request(), targets: [target] })).toThrow(
				'external lane id',
			);
		}
		expect(() =>
			synchronizeEnv(source, { ...request(), purposes: ['production' as 'local'] }),
		).toThrow('Production is excluded');
	});

	it('refuses redirection of files instead of following a destination link', () => {
		const { source, target } = fixture();
		// A directory link also works on Windows without symlink privileges.
		symlinkSync(
			source,
			join(target, '.env.local'),
			process.platform === 'win32' ? 'junction' : 'dir',
		);
		expect(() => synchronizeEnv(source, request(true))).toThrow('regular file');
	});

	it('rechecks drift between writes and reports completed files without revealing values', () => {
		const { source, target } = fixture('f11-preview');
		const batch = { targets: ['f11-preview'], purposes: ['local', 'preview'] as const };
		expect(() =>
			synchronizeEnv(source, { ...batch, purposes: [...batch.purposes], apply: true }, () => {
				writeFileSync(join(source, '.env.preview.local'), 'B=changed-secret\n');
			}),
		).toThrow('1 file(s) copied. Configuration changed');
		expect(existsSync(join(target, '.env.local'))).toBe(true);
		expect(existsSync(join(target, '.env.preview.local'))).toBe(false);
	});
});

describe('runtime file readiness, separate from template inventory', () => {
	it('requires nonempty runtime keys and validates both Preview-lane configurations without reading operator files', () => {
		const { target } = fixture();
		const local =
			'SUPABASE_URL=http://127.0.0.1:54321\nPUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_ANON_KEY=local\nPUBLIC_SUPABASE_ANON_KEY=local\nSUPABASE_SERVICE_ROLE_KEY=local\n';
		writeFileSync(join(target, '.env.local'), local);
		mkdirSync(join(target, '.env.production.local'));
		expect(() => assertCheckoutRuntime(target, 'local')).not.toThrow();
		expect(() => assertCheckoutRuntime(target, 'preview')).toThrow('.env.preview.local');
		const origin = `https://${PREVIEW_PROJECT_REF}.supabase.co`;
		writeFileSync(
			join(target, '.env.preview.local'),
			`SUPABASE_URL=${origin}\nPUBLIC_SUPABASE_URL=${origin}\nSUPABASE_ANON_KEY=preview\nPUBLIC_SUPABASE_ANON_KEY=preview\nSUPABASE_SERVICE_ROLE_KEY=preview\n`,
		);
		expect(() => assertCheckoutRuntime(target, 'preview')).not.toThrow();
		writeFileSync(
			join(target, '.env.local'),
			local.replace('SUPABASE_SERVICE_ROLE_KEY=local', 'SUPABASE_SERVICE_ROLE_KEY='),
		);
		expect(() => assertCheckoutRuntime(target, 'local')).toThrow('SUPABASE_SERVICE_ROLE_KEY');
	});
});
