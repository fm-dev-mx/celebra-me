import sharp from 'sharp';
import {
	compareBandStructure,
	extractBands,
	planSectionBands,
} from '../../scripts/screenshot/visual-bands';

describe('section bands', () => {
	it('partitions every raster row into ordered bands', () => {
		const bands = planSectionBands({
			rasterHeight: 1000,
			sections: [
				{ kind: 'hero', top: 40.6 },
				{ kind: 'gallery', top: 400.2 },
				{ kind: 'thankYou', top: 900 },
			],
		});
		expect(bands).toEqual([
			{ id: '00-before-sections', kind: 'before-sections', top: 0, height: 40 },
			{ id: '01-hero', kind: 'hero', top: 40, height: 360 },
			{ id: '02-gallery', kind: 'gallery', top: 400, height: 500 },
			{ id: '03-thankYou', kind: 'thankYou', top: 900, height: 100 },
		]);
	});

	it('lets an overlapping section own the shared rows', () => {
		// A negative top margin pulls the next box above the previous box's bottom.
		const bands = planSectionBands({
			rasterHeight: 300,
			sections: [
				{ kind: 'hero', top: 0 },
				{ kind: 'quote', top: 120 },
			],
		});
		expect(bands.map((band) => [band.id, band.top, band.height])).toEqual([
			['00-hero', 0, 120],
			['01-quote', 120, 180],
		]);
	});

	it('rejects sections that own no rows or start outside the raster', () => {
		expect(() =>
			planSectionBands({
				rasterHeight: 300,
				sections: [
					{ kind: 'hero', top: 10 },
					{ kind: 'quote', top: 10.9 },
				],
			}),
		).toThrow(/owns no rows/u);
		expect(() =>
			planSectionBands({ rasterHeight: 300, sections: [{ kind: 'hero', top: 300 }] }),
		).toThrow(/outside the raster/u);
	});

	it('reports structure changes instead of missing bands', () => {
		const accepted = ['00-hero', '01-gallery', '02-rsvp'];
		expect(compareBandStructure(accepted, ['00-hero', '01-gallery', '02-rsvp'])).toBeNull();
		expect(compareBandStructure(accepted, ['00-hero', '01-rsvp', '02-gallery'])).toEqual({
			added: [],
			removed: [],
			reordered: true,
		});
		expect(compareBandStructure(accepted, ['00-hero', '01-gifts', '02-rsvp'])).toEqual({
			added: ['gifts'],
			removed: ['gallery'],
			reordered: false,
		});
	});

	it('crops bands that stack back into the raster height', async () => {
		const raster = await sharp({
			create: { width: 20, height: 50, channels: 4, background: '#123456' },
		})
			.png()
			.toBuffer();
		const bands = planSectionBands({
			rasterHeight: 50,
			sections: [
				{ kind: 'hero', top: 0 },
				{ kind: 'rsvp', top: 30 },
			],
		});
		const crops = await extractBands(raster, bands);
		const heights = await Promise.all(
			crops.map(async ({ png }) => (await sharp(png).metadata()).height),
		);
		expect(heights).toEqual([30, 20]);
	});
});
