/**
 * Strict Demo Counterpart Audit
 *
 * Enforces the demo-counterpart architecture invariants.
 *
 * Run: npx jest tests/content/demo-counterpart-audit.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const demosRoot = path.join(projectRoot, 'src/content/event-demos');
const assetsRoot = path.join(projectRoot, 'src/assets/images/events');

interface DemoInfo {
	file: string;
	slug: string;
	data: Record<string, unknown>;
}

function getRealInvitationAssetDirs(): string[] {
	if (!fs.existsSync(assetsRoot)) return [];
	return fs
		.readdirSync(assetsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('demo-'))
		.map((entry) => entry.name);
}

function getAllDemos(): DemoInfo[] {
	const demos: DemoInfo[] = [];
	if (!fs.existsSync(demosRoot)) return demos;

	const walkDir = (dir: string) => {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walkDir(fullPath);
			} else if (entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
				const raw = fs.readFileSync(fullPath, 'utf8');
				const data = JSON.parse(raw);
				const relPath = path.relative(projectRoot, fullPath);
				demos.push({ file: relPath, slug: entry.name.replace(/\.json$/, ''), data });
			}
		}
	};
	walkDir(demosRoot);
	return demos;
}

describe('Strict Demo Counterpart Audit', () => {
	const demos = getAllDemos();
	const realAssetDirs = getRealInvitationAssetDirs();

	describe('all demos have isDemo: true', () => {
		for (const demo of demos) {
			it(`demo "${demo.slug}" has isDemo: true`, () => {
				expect(demo.data.isDemo).toBe(true);
			});
		}
	});

	describe('all demos have templateId', () => {
		for (const demo of demos) {
			it(`demo "${demo.slug}" has templateId`, () => {
				expect(demo.data).toHaveProperty('templateId');
				expect(typeof demo.data.templateId).toBe('string');
				expect(demo.data.templateId).toBeTruthy();
			});
		}
	});

	describe('all demos have _assetSlug', () => {
		for (const demo of demos) {
			it(`demo "${demo.slug}" has _assetSlug`, () => {
				expect(demo.data).toHaveProperty('_assetSlug');
				expect(typeof demo.data._assetSlug).toBe('string');
				expect(demo.data._assetSlug).toBeTruthy();
			});
		}
	});

	describe('templateId must equal {eventType}-{theme.preset}', () => {
		for (const demo of demos) {
			const tid = demo.data.templateId as string;
			const eventType = demo.data.eventType as string;
			const themePreset = (demo.data.theme as { preset?: string })?.preset;
			const expected = `${eventType}-${themePreset}`;

			it(`demo "${demo.slug}": templateId "${tid}" === "${expected}"`, () => {
				expect(tid).toBe(expected);
			});
		}
	});

	describe('_assetSlug is not a real invitation directory', () => {
		for (const demo of demos) {
			const slug = demo.data._assetSlug as string;
			if (!slug) continue;
			it(`demo "${demo.slug}" _assetSlug is not a real invitation dir`, () => {
				expect(realAssetDirs.includes(slug)).toBe(false);
			});
		}
	});

	describe('_assetSlug directory exists', () => {
		for (const demo of demos) {
			const slug = demo.data._assetSlug as string;
			if (!slug) continue;
			it(`demo "${demo.slug}" _assetSlug directory "${slug}" exists`, () => {
				const dir = path.join(assetsRoot, slug);
				expect(fs.existsSync(dir)).toBe(true);
			});
		}
	});

	describe('no duplicate templateId with different theme.preset', () => {
		it('templateId values are unique to a single theme preset', () => {
			const map = new Map<string, Set<string>>();
			for (const demo of demos) {
				const tid = demo.data.templateId as string;
				const themePreset = (demo.data.theme as { preset?: string })?.preset;
				if (!tid || !themePreset) continue;
				if (!map.has(tid)) map.set(tid, new Set());
				map.get(tid)!.add(themePreset);
			}
			Array.from(map.entries()).forEach(([, presets]) => {
				expect(presets.size).toBe(1);
			});
		});
	});

	describe('media profile isolation', () => {
		it('no demo _assetSlug points to a real invitation asset directory', () => {
			const leaks = demos.filter((d) => {
				const slug = d.data._assetSlug as string;
				return slug && realAssetDirs.includes(slug);
			});
			expect(leaks).toHaveLength(0);
		});
	});

	describe('visualProfileId consistency', () => {
		const demosWithVpid = demos.filter((d) => d.data.visualProfileId);

		it('demos with visualProfileId also have templateId', () => {
			for (const demo of demosWithVpid) {
				expect(demo.data.templateId).toBeTruthy();
			}
		});

		it('demos with visualProfileId set isDemo: true', () => {
			for (const demo of demosWithVpid) {
				expect(demo.data.isDemo).toBe(true);
			}
		});

		for (const demo of demosWithVpid) {
			const vpid = demo.data.visualProfileId as string;
			it(`demo "${demo.slug}" visualProfileId "${vpid}" is a valid slug`, () => {
				expect(vpid).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			});
		}
	});
});
