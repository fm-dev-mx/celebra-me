import fs from 'node:fs';
import path from 'node:path';
import { getFeaturedDemoShowroomItems } from '@/data/demo-showroom.data';
import { getEventAsset, isEventAssetKey, type EventAssetKey } from '@/lib/assets/asset-registry';

const projectRoot = process.cwd();
const demosRoot = path.join(projectRoot, 'src/content/event-demos');

function getDemoFilePath(slug: string): string | null {
	const stack = [demosRoot];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const nextPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(nextPath);
				continue;
			}
			if (entry.isFile() && entry.name === `${slug}.json`) return nextPath;
		}
	}

	return null;
}

// Recursively search for any placeholder strings inside parsed JSON objects
function hasPlaceholder(val: unknown): { found: boolean; match?: string } {
	if (typeof val === 'string') {
		const upper = val.toUpperCase();
		if (upper.includes('PENDIENTE')) return { found: true, match: val };
		if (upper.includes('BANCO LUX')) return { found: true, match: val };
		if (upper.includes('0000 0000')) return { found: true, match: val }; // CLABE placeholder
		if (val.includes('****')) return { found: true, match: val }; // Masked details
		return { found: false };
	}

	if (Array.isArray(val)) {
		for (const item of val) {
			const res = hasPlaceholder(item);
			if (res.found) return res;
		}
	} else if (val && typeof val === 'object') {
		for (const key of Object.keys(val)) {
			// Skip Liverpool/store URLs or common mock profiles that are acceptable E2E constants
			if (key === 'url' || key === 'googleMapsUrl' || key === 'appleMapsUrl') continue;
			const res = hasPlaceholder((val as Record<string, unknown>)[key]);
			if (res.found) return res;
		}
	}

	return { found: false };
}

describe('Premium Demo Quality Gate', () => {
	const featuredItems = getFeaturedDemoShowroomItems();

	it('should verify all featured showroom items exist as content files', () => {
		expect(featuredItems.length).toBeGreaterThan(0);
		featuredItems.forEach((item) => {
			const filePath = getDemoFilePath(item.slug);
			expect(filePath).not.toBeNull();
			expect(fs.existsSync(filePath!)).toBe(true);
		});
	});

	featuredItems.forEach((item) => {
		describe(`Demo: ${item.slug}`, () => {
			let content: any = null;
			let filePath = '';

			beforeAll(() => {
				const resolvedPath = getDemoFilePath(item.slug);
				if (resolvedPath) {
					filePath = resolvedPath;
					content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
				}
			});

			it('does not contain developer placeholders or fake financial jargon', () => {
				expect(content).not.toBeNull();
				const check = hasPlaceholder(content);
				expect(check.found).toBe(false);
			});

			it('has a client-facing name and title without "Demo" tags', () => {
				expect(content.title).not.toMatch(/Demo/i);
				expect(content.description).not.toMatch(/Demo oficial/i);
				expect(content.description).not.toMatch(/tema [a-z-]+/i); // theme preset jargon
			});

			it('does not have masked RSVP or contact phone numbers', () => {
				const phone = content.rsvp?.whatsappConfig?.phone;
				if (phone) {
					expect(phone).not.toContain('*');
					expect(phone).not.toMatch(/[a-zA-Z]/);
				}
			});

			it('references only valid, registered assets from the event asset directory', () => {
				const assetSlug = content._assetSlug || item.slug;

				// Verify hero image
				if (
					content.hero?.backgroundImage &&
					typeof content.hero.backgroundImage === 'string'
				) {
					if (!content.hero.backgroundImage.startsWith('http')) {
						const key = content.hero.backgroundImage;
						expect(isEventAssetKey(key)).toBe(true);
						const asset = getEventAsset(assetSlug, key as EventAssetKey);
						expect(asset).toBeDefined();
					}
				}

				// Verify portrait image
				if (content.hero?.portrait && typeof content.hero.portrait === 'string') {
					if (!content.hero.portrait.startsWith('http')) {
						const key = content.hero.portrait;
						expect(isEventAssetKey(key)).toBe(true);
						const asset = getEventAsset(assetSlug, key as EventAssetKey);
						expect(asset).toBeDefined();
					}
				}

				// Verify location venue images
				if (content.location) {
					Object.keys(content.location).forEach((locKey) => {
						const loc = content.location[locKey];
						if (
							loc &&
							typeof loc === 'object' &&
							loc.image &&
							typeof loc.image === 'string'
						) {
							if (!loc.image.startsWith('http')) {
								const key = loc.image;
								expect(isEventAssetKey(key)).toBe(true);
								const asset = getEventAsset(assetSlug, key as EventAssetKey);
								expect(asset).toBeDefined();
							}
						}
					});
				}

				// Verify interlude images
				if (Array.isArray(content.interludes)) {
					content.interludes.forEach((interlude: any) => {
						if (interlude.image && typeof interlude.image === 'string') {
							if (!interlude.image.startsWith('http')) {
								const key = interlude.image;
								expect(isEventAssetKey(key)).toBe(true);
								const asset = getEventAsset(assetSlug, key as EventAssetKey);
								expect(asset).toBeDefined();
							}
						}
					});
				}

				// Verify gallery images
				if (content.gallery?.items && Array.isArray(content.gallery.items)) {
					content.gallery.items.forEach((galleryItem: any) => {
						const key =
							typeof galleryItem === 'string' ? galleryItem : galleryItem?.image;
						if (key && typeof key === 'string' && !key.startsWith('http')) {
							expect(isEventAssetKey(key)).toBe(true);
							const asset = getEventAsset(assetSlug, key as EventAssetKey);
							expect(asset).toBeDefined();
						}
					});
				}
			});
		});
	});

	it('should verify showroom metadata descriptions and titles have no "Demo" text', () => {
		featuredItems.forEach((item) => {
			expect(item.title).not.toMatch(/Demo/i);
			expect(item.description).not.toMatch(/Demo/i);
			expect(item.description).not.toMatch(/tema [a-z-]+/i);
		});
	});
});
