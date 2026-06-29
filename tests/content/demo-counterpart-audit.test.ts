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

// Known safe asset keys that any asset registry can provide
const EVENT_KEYS_SET = new Set([
	'hero',
	'heroDesktop',
	'portrait',
	'family',
	'ceremony',
	'reception',
	'mapCeremony',
	'mapReception',
	'jardin',
	'signature',
	'sealImage',
	'gallery01',
	'gallery02',
	'gallery03',
	'gallery04',
	'gallery05',
	'gallery06',
	'gallery07',
	'gallery08',
	'gallery09',
	'gallery10',
	'gallery11',
	'gallery12',
	'gallery13',
	'gallery14',
	'gallery15',
	'interlude01',
	'interlude02',
	'interlude03',
	'interlude04',
	'thankYouPortrait',
]);

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

/**
 * Extract all asset key references from a demo JSON data object.
 */
function extractHeroAssetKeys(data: Record<string, unknown>): string[] {
	const hero = data.hero as Record<string, unknown> | undefined;
	if (!hero) return [];
	const keys: string[] = [];
	if (typeof hero.backgroundImage === 'string') keys.push(hero.backgroundImage);
	if (typeof hero.portrait === 'string') keys.push(hero.portrait);
	if (typeof hero.backgroundImageDesktop === 'string') keys.push(hero.backgroundImageDesktop);
	if (typeof hero.backgroundImageMobile === 'string') keys.push(hero.backgroundImageMobile);
	return keys;
}

function extractLocationAssetKeys(data: Record<string, unknown>): string[] {
	const location = data.location as Record<string, unknown> | undefined;
	if (!location) return [];
	const keys: string[] = [];
	const ceremony = location.ceremony as Record<string, unknown> | undefined;
	if (ceremony && typeof ceremony.image === 'string') keys.push(ceremony.image);
	const reception = location.reception as Record<string, unknown> | undefined;
	if (reception && typeof reception.image === 'string') keys.push(reception.image);
	const venues = location.venues as Record<string, unknown>[] | undefined;
	if (venues) {
		for (const v of venues) {
			if (typeof v.image === 'string') keys.push(v.image);
		}
	}
	return keys;
}

function extractReferencedAssetKeys(data: Record<string, unknown>): string[] {
	const keys: string[] = [...extractHeroAssetKeys(data), ...extractLocationAssetKeys(data)];

	// Family featured image
	const family = data.family as Record<string, unknown> | undefined;
	if (family && typeof family.featuredImage === 'string') keys.push(family.featuredImage);

	// Gallery items
	const gallery = data.gallery as Record<string, unknown> | undefined;
	if (gallery) {
		const items = gallery.items as Record<string, unknown>[] | undefined;
		if (items) {
			for (const item of items) {
				if (typeof item.image === 'string') keys.push(item.image);
			}
		}
	}

	// Interludes
	const interludes = data.interludes as Record<string, unknown>[] | undefined;
	if (interludes) {
		for (const interlude of interludes) {
			if (typeof interlude.image === 'string') keys.push(interlude.image);
		}
	}

	// Thank you image
	const thankYou = data.thankYou as Record<string, unknown> | undefined;
	if (thankYou && typeof thankYou.image === 'string') keys.push(thankYou.image);

	// Sharing OG image
	const sharing = data.sharing as Record<string, unknown> | undefined;
	if (sharing && typeof sharing.ogImage === 'string') keys.push(sharing.ogImage);

	// Envelope seal image
	const envelope = data.envelope as Record<string, unknown> | undefined;
	if (envelope && typeof envelope.sealImage === 'string') keys.push(envelope.sealImage);

	return keys;
}

/** Get the exported keys from an asset registry index.ts */
function getAssetRegistryKeys(assetSlug: string): string[] {
	const registryPath = path.join(assetsRoot, assetSlug, 'index.ts');
	if (!fs.existsSync(registryPath)) return [];

	const content = fs.readFileSync(registryPath, 'utf8');

	// Extract the exports object body — find `export const assets = { ... }`
	const exportMatch = content.match(/export\s+const\s+assets\s*=\s*\{([\s\S]*?)\};/);
	if (!exportMatch) return [];

	const body = exportMatch[1];

	const keys: string[] = [];

	// Process each line, extracting property names
	for (const line of body.split('\n')) {
		const trimmed = line.trim();

		// Skip comments, empty lines, closing brackets
		if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed === '}')
			continue;

		// Skip gallery array definition
		if (trimmed.startsWith('gallery') && trimmed.includes('[')) continue;

		// Match shorthand property name: `hero,` or `hero`
		const shorthandMatch = trimmed.match(/^(\w[\w]*)\s*[,]*\s*$/);
		if (shorthandMatch) {
			keys.push(shorthandMatch[1]);
			continue;
		}

		// Match key: value pattern: `ceremony: jardin,`
		const keyValueMatch = trimmed.match(/^(\w[\w]*)\s*:\s*\w+/);
		if (keyValueMatch) {
			keys.push(keyValueMatch[1]);
			continue;
		}
	}

	// Parse gallery array items and add gallery01...galleryN keys
	const galleryArrayMatch = content.match(/gallery\s*:\s*\[([\s\S]*?)\]/);
	if (galleryArrayMatch) {
		const rawItems = galleryArrayMatch[1];
		// Count non-empty, non-undefined entries separated by commas
		const items = rawItems
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s !== 'undefined');
		items.forEach((_item, index) => {
			keys.push(`gallery${String(index + 1).padStart(2, '0')}`);
		});
	}

	return [...new Set(keys)];
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

	describe('referenced image keys exist in selected asset registry', () => {
		for (const demo of demos) {
			const assetSlug = demo.data._assetSlug as string;
			if (!assetSlug) continue;

			const registryKeys = getAssetRegistryKeys(assetSlug);
			const referencedKeys = extractReferencedAssetKeys(demo.data);

			const unknownKeys = referencedKeys.filter(
				(k) => !EVENT_KEYS_SET.has(k) && !k.startsWith('https://') && !k.startsWith('/'),
			);

			it(`demo "${demo.slug}" has no unknown asset key references`, () => {
				expect(unknownKeys).toHaveLength(0);
			});

			it(`demo "${demo.slug}": all referenced asset keys are resolvable in registry "${assetSlug}"`, () => {
				// Skip external URLs and common asset keys
				const registryCheckableKeys = referencedKeys.filter((k) => EVENT_KEYS_SET.has(k));
				const missing = registryCheckableKeys.filter((key) => !registryKeys.includes(key));
				expect(missing).toHaveLength(0);
			});
		}
	});

	describe('media fallback detection', () => {
		it('any demo with _mediaFallback is documented', () => {
			const fallbackDemos = demos.filter((d) => d.data._mediaFallback === true);
			// Currently expected fallbacks: demo-xv-enchanted-rose, demo-xv-editorial-rose,
			// and the pre-existing demo-xv-editorial-magazine
			for (const demo of fallbackDemos) {
				expect(demo.data._mediaFallbackNote).toBeTruthy();
			}
		});
	});
});
