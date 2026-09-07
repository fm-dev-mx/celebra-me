function latLngToPixel(latVal: number, lngVal: number, zoomLevel: number) {
	const n = Math.pow(2, zoomLevel);
	const x = ((lngVal + 180) / 360) * n * 256;
	const latRad = (latVal * Math.PI) / 180;
	const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
	return { x, y };
}

/** Preserve the public Production tile URLs and framing. No credential is introduced. */
export function buildVenueMapTiles(lat: number, lng: number, zoom = 15) {
	const { x, y } = latLngToPixel(lat, lng, zoom);
	const centerTileX = Math.floor(x / 256);
	const centerTileY = Math.floor(y / 256);
	const offsetX = x % 256;
	const offsetY = y % 256;
	const shiftX = Math.round(128 - offsetX);
	const shiftY = Math.round(128 - offsetY);

	const subdomains = ['a', 'b', 'c'];
	const tileGrid: Array<{ x: number; y: number; url: string }> = [];
	let subIdx = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const tx = centerTileX + dx;
			const ty = centerTileY + dy;
			const sub = subdomains[subIdx % subdomains.length];
			subIdx++;
			tileGrid.push({
				x: dx + 2,
				y: dy + 2,
				url: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`,
			});
		}
	}
	return { tileGrid, shiftX, shiftY };
}
