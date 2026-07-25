import { deriveSectionInventory } from '../../../scripts/screenshot/inventory';

describe('Section Inventory Service', () => {
	it('derives ordered section inventory from DOM elements with data-screenshot-section', async () => {
		const mockPage = {
			evaluate: async () => {
				// Simulating page.evaluate inside browser context
				const items = [
					{
						id: 'hero',
						label: 'Hero',
						selector: '[data-screenshot-section="hero"]',
						bounds: { x: 0, y: 0, width: 390, height: 800 },
						isVisible: true,
						order: 1,
					},
					{
						id: 'quote',
						label: 'Quote',
						selector: '[data-screenshot-section="quote"]',
						bounds: { x: 0, y: 800, width: 390, height: 300 },
						isVisible: true,
						order: 2,
					},
					{
						id: 'family',
						label: 'Family',
						selector: '[data-screenshot-section="family"]',
						bounds: { x: 0, y: 1100, width: 390, height: 600 },
						isVisible: true,
						order: 3,
					},
					{
						id: 'rsvp',
						label: 'Rsvp',
						selector: '[data-screenshot-section="rsvp"]',
						bounds: { x: 0, y: 1700, width: 390, height: 500 },
						isVisible: true,
						order: 4,
					},
				];

				return {
					expected: 4,
					rendered: 4,
					sections: items,
					duplicates: [],
					missing: [],
					topY: 0,
					bottomY: 2200,
				};
			},
		};

		const report = await deriveSectionInventory(mockPage as unknown as import('playwright').Page);
		expect(report.expected).toBe(4);
		expect(report.sections.length).toBe(4);
		expect(report.sections[0].id).toBe('hero');
		expect(report.sections[1].id).toBe('quote');
		expect(report.sections[2].id).toBe('family');
		expect(report.sections[3].id).toBe('rsvp');
		expect(report.topY).toBe(0);
		expect(report.bottomY).toBe(2200);
	});
});
