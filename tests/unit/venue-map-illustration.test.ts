import { readFileSync } from 'node:fs';
import { buildVenueMapIllustration } from '../../src/lib/invitation/venue-map-illustration';

describe('venue map illustration', () => {
	it('derives a stable framing from coordinates', () => {
		const first = buildVenueMapIllustration(19.291035, -99.1314772);
		expect(buildVenueMapIllustration(19.291035, -99.1314772)).toEqual(first);
		expect(Math.abs(first.rotation)).toBeLessThanOrEqual(18);
		expect(['left', 'right']).toContain(first.parkSide);
	});

	it('varies the framing between nearby venues', () => {
		const framings = new Set(
			[
				[19.2759461, -99.5176924],
				[19.291035, -99.1314772],
				[20.6597, -103.3496],
				[25.6866, -100.3161],
			].map(([lat, lng]) => JSON.stringify(buildVenueMapIllustration(lat, lng))),
		);
		expect(framings.size).toBeGreaterThan(1);
	});

	it('rejects non-finite coordinates', () => {
		expect(() => buildVenueMapIllustration(Number.NaN, 0)).toThrow(/finite/u);
	});

	it('renders without a basemap provider or remote image', () => {
		const component = readFileSync(
			'src/components/invitation/components/StaticVenueMap.astro',
			'utf8',
		);
		expect(component).toContain('data-map-provider="illustration"');
		// The SVG namespace is the only URL; nothing is fetched.
		expect(component.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//u);
		expect(component).not.toContain('<img');
	});
});
