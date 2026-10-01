import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT = 'scripts/validate-no-real-pii-in-content.mjs';
const SHOWROOM = 'src/data/demo-showroom.data.ts';

type ShowroomItem = { slug: string; visibility: string; reviewStatus: string };

const fixtureRoots: string[] = [];

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function demoEntry(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({ eventType: 'xv', isDemo: true, title: 'Demo', ...overrides });
}

function showroomSource(items: ShowroomItem[]): string {
	const entries = items.map((item) =>
		[
			'\t{',
			"\t\t// Client's profile variants stay hidden until review.",
			`\t\tslug: '${item.slug}',`,
			`\t\tvisibility: '${item.visibility}',`,
			`\t\treviewStatus: '${item.reviewStatus}',`,
			"\t\tthumbnail: { assetSlug: 'demo-xv-editorial', key: 'hero', alt: 'Vista' },",
			'\t},',
		].join('\n'),
	);
	return [
		'export const DEMO_SHOWROOM_ITEMS: readonly DemoShowroomItem[] = [',
		...entries,
		'] as const;',
	].join('\n');
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
		const root = createFixture({ 'src/content/event-templates/xv/master.json': '{}' });

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

	it('keeps rejecting non-demo files if the legacy events collection reappears', () => {
		const root = createFixture({
			'src/content/event-demos/xv/demo-xv-ok.json': demoEntry(),
			'src/content/events/xv/xv-real-client.json': demoEntry({ isDemo: false }),
		});

		const result = runGuard(root);

		expect(result.status).toBe(1);
		expect(result.output).toContain(
			'[PII] src/content/events/xv/xv-real-client.json is not marked isDemo=true',
		);
	});

	describe('demos reusing a client visual profile', () => {
		const demoPath = 'src/content/event-demos/xv/demo-xv-client-profile.json';
		const clientProfileDemo = demoEntry({ visualProfileId: 'valentina-hernandez' });

		it('accepts demo-owned profiles without a showroom entry', () => {
			const root = createFixture({
				'src/content/event-demos/xv/demo-xv-celestial-blue.json': demoEntry({
					visualProfileId: 'demo-xv-celestial-blue',
				}),
			});

			const result = runGuard(root);

			expect(result.status).toBe(0);
			expect(result.output).not.toContain('quarantined');
		});

		it('accepts client profiles quarantined as hidden/needs-review', () => {
			const root = createFixture({
				[demoPath]: clientProfileDemo,
				[SHOWROOM]: showroomSource([
					{ slug: 'demo-xv-editorial', visibility: 'featured', reviewStatus: 'approved' },
					{
						slug: 'demo-xv-client-profile',
						visibility: 'hidden',
						reviewStatus: 'needs-review',
					},
				]),
			});

			const result = runGuard(root);

			expect(result.status).toBe(0);
			expect(result.output).toContain('1 demo(s) reusing client visual profiles');
		});

		it.each([
			[
				'featured/approved',
				'featured',
				'approved',
				'visibility=featured, reviewStatus=approved',
			],
			['hidden/approved', 'hidden', 'approved', 'visibility=hidden, reviewStatus=approved'],
			[
				'featured/needs-review',
				'featured',
				'needs-review',
				'visibility=featured, reviewStatus=needs-review',
			],
		])(
			'rejects client profiles exposed as %s',
			(_scenario, visibility, reviewStatus, state) => {
				const root = createFixture({
					[demoPath]: clientProfileDemo,
					[SHOWROOM]: showroomSource([
						{ slug: 'demo-xv-client-profile', visibility, reviewStatus },
					]),
				});

				const result = runGuard(root);

				expect(result.status).toBe(1);
				expect(result.output).toContain(
					`[PII] ${demoPath} reuses client visual profile "valentina-hernandez"`,
				);
				expect(result.output).toContain(`"demo-xv-client-profile" is ${state}`);
			},
		);

		it('rejects client profiles without a showroom entry', () => {
			const root = createFixture({
				[demoPath]: clientProfileDemo,
				[SHOWROOM]: showroomSource([
					{
						slug: 'demo-xv-editorial',
						visibility: 'hidden',
						reviewStatus: 'needs-review',
					},
				]),
			});

			const result = runGuard(root);

			expect(result.status).toBe(1);
			expect(result.output).toContain('"demo-xv-client-profile" is missing');
		});

		it('fails closed when the showroom data cannot be read', () => {
			const root = createFixture({ [demoPath]: clientProfileDemo });

			const result = runGuard(root);

			expect(result.status).toBe(1);
			expect(result.output).toContain(
				`[PII] Cannot read DEMO_SHOWROOM_ITEMS from ${SHOWROOM}`,
			);
		});
	});
});
