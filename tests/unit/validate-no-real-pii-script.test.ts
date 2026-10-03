import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT = 'scripts/validate-no-real-pii-in-content.mjs';

const fixtureRoots: string[] = [];

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function demoEntry(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({ eventType: 'xv', isDemo: true, title: 'Demo', ...overrides });
}

/** Copies the guard into a temp repo so it resolves the fixture tree as the project root. */
function createFixture(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), 'no-pii-guard-'));
	fixtureRoots.push(root);
	for (const [relativePath, contents] of Object.entries({
		[SCRIPT]: null,
		...files,
	})) {
		const target = join(root, relativePath);
		mkdirSync(dirname(target), { recursive: true });
		if (contents === null) cpSync(join(ROOT, relativePath), target);
		else writeFileSync(target, contents, 'utf8');
	}
	return root;
}

function runGuard(cwd: string) {
	const result = runCommand('node', [join(cwd, SCRIPT)], { cwd, allowFailure: true });
	return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe('validate-no-real-pii-in-content script', () => {
	it('validates the repository demo collection without being a no-op', () => {
		const result = runGuard(ROOT);

		expect(result.status).toBe(0);
		const checked = Number(/checked (\d+) content files/.exec(result.output)?.[1] ?? 0);
		expect(checked).toBeGreaterThan(0);
	});

	it('recurses into event-type subfolders', () => {
		const root = createFixture({
			'src/content/event-demos/xv/demo-xv-one.json': demoEntry(),
			'src/content/event-demos/boda/nested/demo-boda-two.json': demoEntry({
				eventType: 'boda',
			}),
		});

		const result = runGuard(root);

		expect(result.status).toBe(0);
		expect(result.output).toContain('checked 2 content files');
	});

	it.each([
		['isDemo=false', { isDemo: false }],
		['missing isDemo', { isDemo: undefined }],
	])('rejects nested demo entries with %s', (_scenario, overrides) => {
		const root = createFixture({
			'src/content/event-demos/xv/demo-xv-ok.json': demoEntry(),
			'src/content/event-demos/xv/xv-real-client.json': demoEntry(overrides),
		});

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain(
			'[PII] src/content/event-demos/xv/xv-real-client.json is not marked isDemo=true',
		);
		expect(result.output).not.toContain('demo-xv-ok.json');
	});

	it('fails when the demo collection is missing', () => {
		const root = createFixture({ 'src/content/README.md': '# Content\n' });

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain('[PII] src/content/event-demos is missing');
	});

	it('fails when the demo collection yields zero JSON files', () => {
		const root = createFixture({ 'src/content/event-demos/xv/README.md': '# Demos\n' });

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain('[PII] src/content/event-demos contains no JSON files');
	});

	it('fails on unparseable content instead of skipping it', () => {
		const root = createFixture({
			'src/content/event-demos/xv/demo-xv-broken.json': '{ "isDemo": true,',
		});

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain(
			'[PII] src/content/event-demos/xv/demo-xv-broken.json is not valid JSON',
		);
	});

	describe('demo visual profiles', () => {
		it('accepts demo-owned profiles', () => {
			const root = createFixture({
				'src/content/event-demos/xv/demo-xv-celestial-blue.json': demoEntry({
					visualProfileId: 'demo-xv-celestial-blue',
				}),
			});

			const result = runGuard(root);

			expect(result.status).toBe(0);
		});

		it('rejects a demo styled by a client profile', () => {
			const demoPath = 'src/content/event-demos/xv/demo-xv-client-profile.json';
			const root = createFixture({
				[demoPath]: demoEntry({ visualProfileId: 'valentina-hernandez' }),
			});

			const result = runGuard(root);

			expect(result.status).toBe(1);
			expect(result.output).toContain(
				`[PII] ${demoPath} uses client visual profile "valentina-hernandez"`,
			);
		});
	});
});
