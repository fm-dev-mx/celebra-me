import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';

const projectRoot = process.cwd();
const assetDir = path.join(projectRoot, 'src/assets/images/events/xv-xareni-iyarit');
const payloadPath = path.join(projectRoot, '.agent/plans/active/xv-xareni-iyarit-db-payload.json');
const stylePath = path.join(projectRoot, 'src/styles/themes/sections/_xv-xareni-iyarit.scss');
const sectionsIndexPath = path.join(projectRoot, 'src/styles/themes/sections/_index.scss');

const expectedAssets = [
	'hero.webp',
	'portrait.webp',
	'family.webp',
	'gallery-01.webp',
	'gallery-02.webp',
	'gallery-03.webp',
	'gallery-04.webp',
	'gallery-05.webp',
	'gallery-06.webp',
	'ceremony.webp',
	'reception.webp',
	'interlude-01.webp',
	'interlude-02.webp',
	'interlude-03.webp',
	'interlude-04.webp',
	'thank-you-portrait.webp',
] as const;

describe('XV Xareni Iyarit client invitation preparation', () => {
	describe('assets', () => {
		it('exports the client asset namespace with the celestial-blue media surface', () => {
			for (const filename of expectedAssets) {
				expect(fs.existsSync(path.join(assetDir, filename))).toBe(true);
			}
		});
	});

	describe('theme', () => {
		it('adds a scoped rose champagne override without changing the global celestial-blue preset', () => {
			const sectionIndex = fs.readFileSync(sectionsIndexPath, 'utf8');
			const styles = fs.readFileSync(stylePath, 'utf8');

			expect(sectionIndex).toContain("@forward 'xv-xareni-iyarit';");
			expect(styles).toContain('.event--xv-xareni-iyarit.theme-preset--celestial-blue');
			expect(styles).toContain('--xareni-deep-mauve-rgb: 122 62 87;');
			expect(styles).toContain('--xareni-ivory-rgb: 255 248 244;');
			expect(styles).toContain('--color-satin-blue: var(--xareni-rose-gold);');
			expect(styles).toContain('--color-ice-blue: var(--xareni-blush);');
			expect(styles).toContain('--color-satin-blue-rgb: var(--xareni-rose-gold-rgb);');
			expect(styles).toContain('--color-ice-blue-rgb: var(--xareni-blush-rgb);');
			expect(styles).toContain('--color-deep-blue-graphite-rgb: var(--xareni-plum-rgb);');
			expect(styles).toContain('--itinerary-ink-dark-rgb: var(--xareni-plum-rgb);');
			expect(styles).toContain('--itinerary-slate-rgb: var(--xareni-deep-mauve-rgb);');
			expect(styles).not.toContain('#0000ff');
			expect(styles).not.toMatch(/navy/i);
		});
	});

	describe('DB payload', () => {
		it('validates the local DB payload artifact and renders the Xareni event selector', () => {
			const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
			const result = eventContentSchema.safeParse(payload);

			if (!result.success) {
				throw new Error(
					`Xareni Iyarit DB payload failed schema validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
				);
			}

			expect(result.data.eventType).toBe('xv');
			expect(result.data.isDemo).toBe(false);
			expect(result.data._assetSlug).toBe('xv-xareni-iyarit');
			expect(result.data.theme.preset).toBe('celestial-blue');
			expect(Object.hasOwn(result.data, 'music')).toBe(false);
			expect(result.data.rsvp?.accessMode).toBe('hybrid');
			expect(result.data.rsvp?.confirmationMode).toBe('api');
			expect(result.data.location?.ceremony?.image).toBeUndefined();
			expect(result.data.location?.reception?.image).toBeUndefined();

			const viewModel = adaptEvent({
				id: 'event-published/xv/xv-xareni-iyarit',
				data: result.data,
			} as EventContentEntry);
			const pageContext = buildPageContextFromViewModel({
				viewModel,
				slug: 'xv-xareni-iyarit',
				eventType: 'xv',
			});

			expect(pageContext.wrapper.className.split(' ')).toEqual(
				expect.arrayContaining([
					'event-theme-wrapper',
					'event--xv-xareni-iyarit',
					'theme-preset--celestial-blue',
				]),
			);
		});
	});
});
