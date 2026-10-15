/**
 * The preview watermark as repeated copies of one rotated mark bitmap.
 *
 * The Cloudflare Images binding composites bitmaps but does not rasterize SVG, and its
 * `repeat` tiling is axis-aligned while the mark is rotated. The pattern of
 * `buildPreviewMarkSvg` is a lattice of identical marks (nothing overlaps across tiles), so
 * drawing one pre-rendered mark at every lattice position reproduces it. Pure module, no I/O.
 */
import {
	MARK,
	PREVIEW_MARK_ANGLE,
	STROKE,
	markGroup,
	previewMarkMetrics,
	type PreviewMarkOptions,
} from './preview-mark-svg';

/** How far one mark extends beyond its glyph geometry (half the halo stroke), in cap units. */
const MARK_PAD = (STROKE * 2.1) / 2;
const CAP_UNITS = 10;

interface Point {
	x: number;
	y: number;
}

function rotate(point: Point, degrees: number): Point {
	const rad = (degrees * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/** Bounding box of one rotated mark (halo included) around its own origin, in cap units. */
function rotatedMarkBounds(): { minX: number; minY: number; width: number; height: number } {
	const corners = [
		{ x: -MARK_PAD, y: -MARK_PAD },
		{ x: MARK.width + MARK_PAD, y: -MARK_PAD },
		{ x: MARK.width + MARK_PAD, y: CAP_UNITS + MARK_PAD },
		{ x: -MARK_PAD, y: CAP_UNITS + MARK_PAD },
	].map((corner) => rotate(corner, PREVIEW_MARK_ANGLE));
	const xs = corners.map((corner) => corner.x);
	const ys = corners.map((corner) => corner.y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Pixel size of the rotated single-mark bitmap at `pxPerUnit` pixels per cap unit. */
export function previewMarkInstanceSize(pxPerUnit: number): { width: number; height: number } {
	const bounds = rotatedMarkBounds();
	return {
		width: Math.ceil(bounds.width * pxPerUnit),
		height: Math.ceil(bounds.height * pxPerUnit),
	};
}

/**
 * One mark (dark halo under the light stroke), already rotated by the pattern angle, on a
 * transparent canvas of `previewMarkInstanceSize(pxPerUnit)`.
 */
export function buildPreviewMarkInstanceSvg(pxPerUnit: number): string {
	const bounds = rotatedMarkBounds();
	const size = previewMarkInstanceSize(pxPerUnit);
	const layers =
		markGroup(0, 0, 1, '#000', 0.16, STROKE * 2.1) + markGroup(0, 0, 1, '#fff', 0.46, STROKE);
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">` +
		`<g transform="scale(${pxPerUnit}) translate(${-bounds.minX} ${-bounds.minY}) rotate(${PREVIEW_MARK_ANGLE})">${layers}</g></svg>`
	);
}

export interface PreviewMarkLayout {
	/** Width in pixels the instance bitmap must be scaled to for this image size. */
	instanceWidth: number;
	/** Top-left corners of every instance that touches the image; may lie partly outside. */
	instances: Array<{ left: number; top: number }>;
}

/** Positions of the repeated marks that `buildPreviewMarkSvg` draws for an image of this size. */
export function layoutPreviewMarkInstances({
	width,
	height,
}: PreviewMarkOptions): PreviewMarkLayout {
	if (!(width > 0 && height > 0)) throw new Error('Preview mark needs a positive size.');
	const { capPx, scale, tileW, tileH } = previewMarkMetrics(width);
	const bounds = rotatedMarkBounds();
	const bitmapW = bounds.width * scale;
	const bitmapH = bounds.height * scale;
	const baseline = capPx * 1.2;
	// Two staggered mark origins per tile, in pattern space.
	const origins = [
		{ x: 0, y: baseline },
		{ x: tileW / 2, y: baseline + tileH / 2 },
	];
	// Pattern-space window that covers the canvas, to bound the tile indexes.
	const inverse = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height },
	].map((corner) => rotate(corner, -PREVIEW_MARK_ANGLE));
	const reach = Math.max(bitmapW, bitmapH);
	const minX = Math.min(...inverse.map((p) => p.x)) - reach;
	const maxX = Math.max(...inverse.map((p) => p.x)) + reach;
	const minY = Math.min(...inverse.map((p) => p.y)) - reach;
	const maxY = Math.max(...inverse.map((p) => p.y)) + reach;
	const instances: PreviewMarkLayout['instances'] = [];
	for (let i = Math.floor(minX / tileW) - 1; i <= Math.ceil(maxX / tileW); i++) {
		for (let j = Math.floor(minY / tileH) - 1; j <= Math.ceil(maxY / tileH); j++) {
			for (const origin of origins) {
				const anchor = rotate(
					{ x: i * tileW + origin.x, y: j * tileH + origin.y },
					PREVIEW_MARK_ANGLE,
				);
				const left = Math.round(anchor.x + bounds.minX * scale);
				const top = Math.round(anchor.y + bounds.minY * scale);
				if (left >= width || top >= height) continue;
				if (left + bitmapW <= 0 || top + bitmapH <= 0) continue;
				instances.push({ left, top });
			}
		}
	}
	return { instanceWidth: Math.round(bitmapW), instances };
}
