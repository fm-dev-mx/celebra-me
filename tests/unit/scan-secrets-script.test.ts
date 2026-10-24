import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT = 'scripts/security/scan-secrets.mjs';
const ALLOWED_FILE = 'scripts/db/disposable-test-env.ts';

// Fake values, assembled at runtime so this file never matches the scan itself.
const FAKE_JWT = ['eyJ' + 'a'.repeat(20), 'eyJ' + 'b'.repeat(40), 'c'.repeat(43)].join('.');
const FAKE_GITHUB_TOKEN = 'ghp' + '_' + 'x'.repeat(36);

const fixtureRoots: string[] = [];

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Copies the scan into a temp Git repo so it lists the fixture files as the project's files. */
function createFixture(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), 'secret-scan-'));
	fixtureRoots.push(root);
	for (const [relativePath, contents] of Object.entries({ [SCRIPT]: null, ...files })) {
		const target = join(root, relativePath);
		mkdirSync(dirname(target), { recursive: true });
		if (contents === null) cpSync(join(ROOT, relativePath), target);
		else writeFileSync(target, contents, 'utf8');
	}
	runCommand('git', ['init', '-q'], { cwd: root });
	runCommand('git', ['add', '-A'], { cwd: root });
	return root;
}

function runScan(cwd: string) {
	const result = runCommand('node', [join(cwd, SCRIPT)], { cwd, allowFailure: true });
	return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe('scan-secrets script', () => {
	it('passes on the repository without findings', () => {
		const result = runScan(ROOT);

		expect(result.status).toBe(0);
		const checked = Number(/checked (\d+) versioned files/.exec(result.output)?.[1] ?? 0);
		expect(checked).toBeGreaterThan(0);
	});

	it('fails on a fake token in a source file', () => {
		const root = createFixture({
			'src/lib/client.ts': `export const token = '${FAKE_GITHUB_TOKEN}';\n`,
		});

		const result = runScan(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain('src/lib/client.ts:1 holds a GitHub token');
		expect(result.output).not.toContain(FAKE_GITHUB_TOKEN);
	});

	it('fails on a JWT outside the allowlist and accepts it in an allowlisted path', () => {
		const denied = createFixture({ 'src/lib/supabase.ts': `const key = '${FAKE_JWT}';\n` });
		const allowed = createFixture({ [ALLOWED_FILE]: `const key = '${FAKE_JWT}';\n` });

		expect(runScan(denied).output).toContain('src/lib/supabase.ts:1 holds a long JWT');
		expect(runScan(allowed).status).toBe(0);
	});

	it('keeps other rules active in allowlisted paths', () => {
		const root = createFixture({ [ALLOWED_FILE]: `const token = '${FAKE_GITHUB_TOKEN}';\n` });

		expect(runScan(root).output).toContain(`${ALLOWED_FILE}:1 holds a GitHub token`);
	});

	it('fails on a versioned env file but accepts env templates', () => {
		const root = createFixture({
			'.env.example': 'PUBLIC_SITE_URL=\n',
			'.env.local': 'PUBLIC_SITE_URL=\n',
		});

		const result = runScan(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain('.env.local is a versioned env file');
		expect(result.output).not.toContain('.env.example is');
	});
});
