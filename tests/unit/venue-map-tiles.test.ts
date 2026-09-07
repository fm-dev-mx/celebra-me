import { buildVenueMapTiles } from '@/lib/invitation/venue-map-tiles';

describe('Production venue map framing', () => {
	it('preserves the observed Abril ceremony tile and pixel offset', () => {
		const map = buildVenueMapTiles(21.3542979, -101.9320163, 16);
		expect(map).toMatchObject({ shiftX: -88, shiftY: 48 });
		expect(map.tileGrid).toHaveLength(9);
		expect(map.tileGrid[0]).toEqual({
			x: 1,
			y: 1,
			url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/16/14210/28786.png',
		});
		expect(new Set(map.tileGrid.map((tile) => tile.url)).size).toBe(9);
	});
});
