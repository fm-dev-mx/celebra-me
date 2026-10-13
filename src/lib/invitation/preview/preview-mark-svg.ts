/**
 * Tiled «VISTA PREVIA · CELEBRA-ME» watermark as pure SVG geometry.
 *
 * The letters are monoline strokes drawn on a 10-unit cap height, not text: the image
 * renderer (librsvg inside sharp) then needs no installed font, so the mark renders the
 * same locally and in serverless functions. Pure module, no I/O.
 */

interface Glyph {
	/** Advance width in cap units, before tracking. */
	width: number;
	paths?: readonly string[];
	/** Dot centers (rendered as filled circles). */
	dots?: ReadonlyArray<readonly [number, number]>;
}

const BOWL_P = 'M0 10V0H3.5C5.1 0 6 1.1 6 2.7S5.1 5.4 3.5 5.4H0';

const GLYPHS: Readonly<Record<string, Glyph>> = {
	V: { width: 7, paths: ['M0 0L3.5 10L7 0'] },
	I: { width: 0, paths: ['M0 0V10'] },
	S: {
		width: 6,
		paths: [
			'M5.8 1.6C5.1 .6 4.1 0 3 0C1.5 0 .4 .9 .4 2.4C.4 4.3 2.1 4.7 3.2 5C4.6 5.4 5.9 5.9 5.9 7.6C5.9 9.1 4.7 10 3 10C1.7 10 .6 9.4 0 8.4',
		],
	},
	T: { width: 7, paths: ['M0 0H7', 'M3.5 0V10'] },
	A: { width: 7, paths: ['M0 10L3.5 0L7 10', 'M1.25 6.5H5.75'] },
	P: { width: 6, paths: [BOWL_P] },
	R: { width: 6, paths: [BOWL_P, 'M3.2 5.4L6 10'] },
	E: { width: 5.4, paths: ['M5.4 0H0V10H5.4', 'M0 5H4.6'] },
	C: {
		width: 6.4,
		paths: ['M6.4 1.9C5.7 .7 4.6 0 3.4 0C1.4 0 0 2.2 0 5S1.4 10 3.4 10C4.6 10 5.7 9.3 6.4 8.1'],
	},
	L: { width: 5, paths: ['M0 0V10H5'] },
	B: {
		width: 6,
		paths: [
			'M0 0V10H3.7C5.1 10 6 9 6 7.6S5.1 5.1 3.6 5.1H0',
			'M0 0H3.3C4.7 0 5.5 .9 5.5 2.5S4.7 5.1 3.3 5.1',
		],
	},
	M: { width: 8, paths: ['M0 10V0L4 7L8 0V10'] },
	'-': { width: 3.4, paths: ['M0 6H3.4'] },
	'·': { width: 0, dots: [[0, 5.6]] },
	' ': { width: 2.6 },
};

export const PREVIEW_MARK_TEXT = 'VISTA PREVIA · CELEBRA-ME';

const TRACKING = 1.9;
const STROKE = 1.15;
const DOT_RADIUS = 0.8;

interface MarkGeometry {
	/** Path data and dots already translated along the baseline, in cap units. */
	paths: string[];
	dots: Array<readonly [number, number]>;
	width: number;
}

function layoutMark(text: string): MarkGeometry {
	const paths: string[] = [];
	const dots: Array<readonly [number, number]> = [];
	let x = 0;
	for (const char of text) {
		const glyph = GLYPHS[char];
		if (!glyph) throw new Error(`No preview-mark glyph for ${JSON.stringify(char)}.`);
		for (const d of glyph.paths ?? []) {
			paths.push(`<path transform="translate(${round(x)} 0)" d="${d}"/>`);
		}
		for (const [dx, dy] of glyph.dots ?? []) dots.push([x + dx, dy]);
		x += glyph.width + TRACKING;
	}
	return { paths, dots, width: x - TRACKING };
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

const MARK = layoutMark(PREVIEW_MARK_TEXT);

function markGroup(
	x: number,
	y: number,
	scale: number,
	stroke: string,
	opacity: number,
	width: number,
): string {
	const dots = MARK.dots
		.map(
			([cx, cy]) =>
				`<circle cx="${round(cx)}" cy="${cy}" r="${DOT_RADIUS * (width / STROKE)}"/>`,
		)
		.join('');
	return (
		`<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale * 1000) / 1000})" ` +
		`fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}" ` +
		`stroke-linecap="round" stroke-linejoin="round">${MARK.paths.join('')}` +
		`<g fill="${stroke}" fill-opacity="${opacity}" stroke="none">${dots}</g></g>`
	);
}

export interface PreviewMarkOptions {
	width: number;
	height: number;
}

/**
 * Full-size overlay for an image of the given pixel size: the mark repeats in
 * staggered diagonal rows, so no crop of a meaningful area escapes it. A dark halo under
 * a light stroke keeps it legible on bright and dark photographs alike.
 */
export function buildPreviewMarkSvg({ width, height }: PreviewMarkOptions): string {
	if (!(width > 0 && height > 0)) throw new Error('Preview mark needs a positive size.');
	const capPx = Math.min(72, Math.max(16, Math.round(width * 0.032)));
	const scale = capPx / 10;
	const textPx = MARK.width * scale;
	const tileW = Math.round(textPx * 1.55);
	const tileH = Math.round(capPx * 6.4);
	// The staggered row overflows the tile; its wrapped copy completes it across tiles.
	const rows = [
		{ x: 0, y: capPx * 1.2 },
		{ x: tileW / 2, y: capPx * 1.2 + tileH / 2 },
		{ x: tileW / 2 - tileW, y: capPx * 1.2 + tileH / 2 },
	];
	const layers = rows
		.flatMap(({ x, y }) => [
			markGroup(x, y, scale, '#000', 0.16, STROKE * 2.1),
			markGroup(x, y, scale, '#fff', 0.46, STROKE),
		])
		.join('');
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<defs><pattern id="preview-mark" patternUnits="userSpaceOnUse" width="${tileW}" height="${tileH}" ` +
		`patternTransform="rotate(-28)">${layers}</pattern></defs>` +
		`<rect width="${width}" height="${height}" fill="url(#preview-mark)"/></svg>`
	);
}
