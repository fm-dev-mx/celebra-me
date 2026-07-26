import { deriveSectionInventory } from '../../../scripts/screenshot/inventory';
import { resolveCapturePlan } from '../../../scripts/screenshot/capture';
import type { ScreenshotJob } from '../../../scripts/screenshot/types';

describe('Screenshot Completeness & Section Inventory Validation', () => {
	it('derives ordered section inventory and computes bounding box from top to bottom section', async () => {
		const mockPage = {
			evaluate: async () => ({
				expected: 3,
				rendered: 3,
				sections: [
					{
						id: 'hero',
						label: 'Hero',
						order: 1,
						selector: '[data-screenshot-section="hero"]',
						bounds: { x: 0, y: 0, width: 390, height: 800 },
						isVisible: true,
					},
					{
						id: 'location',
						label: 'Location',
						order: 2,
						selector: '[data-screenshot-section="location"]',
						bounds: { x: 0, y: 800, width: 390, height: 600 },
						isVisible: true,
					},
					{
						id: 'thankYou',
						label: 'Thank You',
						order: 3,
						selector: '[data-screenshot-section="thankYou"]',
						bounds: { x: 0, y: 1400, width: 390, height: 400 },
						isVisible: true,
					},
				],
				duplicates: [],
				missing: [],
				topY: 0,
				bottomY: 1800,
			}),
		};

		const inventory = await deriveSectionInventory(
			mockPage as unknown as import('playwright').Page,
		);
		expect(inventory.expected).toBe(3);
		expect(inventory.topY).toBe(0);
		expect(inventory.bottomY).toBe(1800);
		expect(inventory.sections[0].id).toBe('hero');
		expect(inventory.sections[2].id).toBe('thankYou');
	});

	it('deduplicates repeated or nested markers by stable section identity', async () => {
		const mockPageWithDuplicates = {
			evaluate: async () => ({
				expected: 2,
				rendered: 2,
				sections: [
					{
						id: 'hero',
						label: 'Hero',
						order: 1,
						selector: '[data-screenshot-section="hero"]',
						bounds: { x: 0, y: 0, width: 390, height: 800 },
						isVisible: true,
					},
					{
						id: 'gallery',
						label: 'Gallery',
						order: 2,
						selector: '[data-screenshot-section="gallery"]',
						bounds: { x: 0, y: 800, width: 390, height: 1200 },
						isVisible: true,
					},
				],
				duplicates: ['gallery'],
				missing: [],
				topY: 0,
				bottomY: 2000,
			}),
		};

		const inventory = await deriveSectionInventory(
			mockPageWithDuplicates as unknown as import('playwright').Page,
		);
		expect(inventory.duplicates).toContain('gallery');
		expect(inventory.sections.length).toBe(2);
	});

	it('plans section tasks in order with full-page after standalones', async () => {
		const mockPage = {
			locator: () => ({
				count: async () => 1,
				first: () => ({ isVisible: async () => true }),
			}),
			evaluate: async (fn: unknown) => {
				if (typeof fn === 'function') {
					const src = fn.toString();
					if (src.includes('ds-editorial-cover') || src.includes('revealType')) {
						return {
							hasReveal: true,
							revealType: 'envelope' as const,
							hasLetter: true,
							hasFlapTransition: true,
						};
					}
				}
				return {
					expected: 2,
					rendered: 2,
					sections: [
						{
							id: 'hero',
							label: 'Hero',
							order: 1,
							selector: '[data-screenshot-section="hero"]',
							bounds: { x: 0, y: 0, width: 390, height: 800 },
							isVisible: true,
						},
						{
							id: 'quote',
							label: 'Quote',
							order: 2,
							selector: '[data-screenshot-section="quote"]',
							bounds: { x: 0, y: 800, width: 390, height: 300 },
							isVisible: true,
						},
					],
					duplicates: [],
					missing: [],
					topY: 0,
					bottomY: 1100,
				};
			},
		};

		const job: ScreenshotJob = {
			pageType: 'invitation',
			mode: 'audit',
			url: 'http://localhost:4321/xv/abril-michelle-becerra-rea',
			baseUrl: 'http://localhost:4321',
			viewportProfile: 'invitation',
			viewports: [],
			target: 'critical-qa',
			revealHandling: 'auto',
			animationHandling: 'disable',
			sectionCapture: 'auto',
			sectionExtent: 'full',
			criticalSelectors: [],
			waitSelectors: [],
			hideSelectors: [],
			authMethod: 'none',
			outputFormat: 'png',
			outputFolderStyle: 'default',
		};

		const tasks = await resolveCapturePlan(
			mockPage as unknown as import('playwright').Page,
			job,
		);
		const sectionTasks = tasks.filter((t) => t.type === 'section');
		const heroIdx = tasks.findIndex((t) => t.id === '10-01-hero');
		const fullIdx = tasks.findIndex((t) => t.id === '05-invitation-full-page');

		expect(sectionTasks.length).toBe(2);
		expect(sectionTasks[0].id).toBe('10-01-hero');
		expect(sectionTasks[1].id).toBe('10-02-quote');
		expect(heroIdx).toBeGreaterThan(-1);
		expect(fullIdx).toBeGreaterThan(heroIdx);
	});
});
