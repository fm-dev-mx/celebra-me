/**
 * Section bands for complete-page comparison.
 *
 * One stable full-page raster is partitioned into contiguous horizontal bands: the area above the
 * first section, each section, and the area below the last section. Every raster row belongs to
 * exactly one band, so the bands together are the complete page. A height change then fails only
 * the band that owns it instead of every row below it.
 */
import sharp from 'sharp';
import { assertContinuousDocumentStrips } from './composite.ts';

export interface SectionBoundary {
	/** Section kind from the DOM, e.g. `hero` or `gallery`. */
	kind: string;
	/** Document Y of the section box top in CSS px (may be fractional). */
	top: number;
}

export interface VisualBand {
	/** Stable identity: zero-padded order plus kind, e.g. `03-gallery`. */
	id: string;
	kind: string;
	top: number;
	height: number;
}

function sanitizeKind(kind: string): string {
	const value = kind
		.trim()
		.replace(/[^a-z0-9]+/giu, '-')
		.replace(/^-+|-+$/gu, '');
	if (!value) throw new Error(`Invalid band kind: ${JSON.stringify(kind)}`);
	return value;
}

/**
 * Boundaries are floored to whole rows. A section box that overlaps the previous one (negative
 * margins, decorations above its top) still starts its band at its own top: the next section owns
 * the shared rows. A section that would own no row is a structural error, not a silent merge.
 */
export function planSectionBands(input: {
	rasterHeight: number;
	sections: readonly SectionBoundary[];
}): VisualBand[] {
	const rasterHeight = input.rasterHeight;
	if (!Number.isInteger(rasterHeight) || rasterHeight <= 0) {
		throw new Error(`Invalid raster height: ${rasterHeight}`);
	}
	const starts: Array<{ kind: string; top: number }> = [];
	const firstTop = input.sections.length ? Math.floor(input.sections[0].top) : rasterHeight;
	if (firstTop > 0) starts.push({ kind: 'before-sections', top: 0 });
	for (const section of input.sections) {
		const top = Math.floor(section.top);
		if (top < 0 || top >= rasterHeight) {
			throw new Error(`Section ${section.kind} starts outside the raster at ${section.top}.`);
		}
		const previous = starts.at(-1);
		if (previous && top <= previous.top) {
			throw new Error(
				`Section ${section.kind} at ${section.top} owns no rows after ${previous.kind} at ${previous.top}.`,
			);
		}
		starts.push({ kind: sanitizeKind(section.kind), top });
	}
	if (!starts.length) starts.push({ kind: 'page', top: 0 });
	const width = String(starts.length).length < 2 ? 2 : String(starts.length).length;
	const bands = starts.map((start, index) => ({
		id: `${String(index).padStart(width, '0')}-${start.kind}`,
		kind: start.kind,
		top: start.top,
		height: (starts[index + 1]?.top ?? rasterHeight) - start.top,
	}));
	assertContiguousBands(bands, rasterHeight);
	return bands;
}

export function assertContiguousBands(bands: readonly VisualBand[], rasterHeight: number): void {
	assertContinuousDocumentStrips(
		bands.map((band) => ({ docY: band.top, height: band.height })),
		0,
		rasterHeight,
	);
	if (new Set(bands.map((band) => band.id)).size !== bands.length) {
		throw new Error('Visual band identities must be unique.');
	}
}

export interface BandStructureChange {
	added: string[];
	removed: string[];
	reordered: boolean;
}

/** A different band sequence is a structural change; it must never read as a missing snapshot. */
export function compareBandStructure(
	accepted: readonly string[],
	current: readonly string[],
): BandStructureChange | null {
	const acceptedKinds = accepted.map((id) => id.replace(/^\d+-/u, ''));
	const currentKinds = current.map((id) => id.replace(/^\d+-/u, ''));
	if (acceptedKinds.join('|') === currentKinds.join('|')) return null;
	const remaining = [...acceptedKinds];
	const added: string[] = [];
	for (const kind of currentKinds) {
		const index = remaining.indexOf(kind);
		if (index >= 0) remaining.splice(index, 1);
		else added.push(kind);
	}
	const shared = (kinds: string[], other: string[]) => {
		const pool = [...other];
		return kinds.filter((kind) => {
			const index = pool.indexOf(kind);
			if (index < 0) return false;
			pool.splice(index, 1);
			return true;
		});
	};
	return {
		added,
		removed: remaining,
		reordered:
			shared(acceptedKinds, currentKinds).join('|') !==
			shared(currentKinds, acceptedKinds).join('|'),
	};
}

/** Crops each band from the raster as its own PNG, in band order. */
export async function extractBands(
	raster: Buffer,
	bands: readonly VisualBand[],
): Promise<Array<{ band: VisualBand; png: Buffer }>> {
	const metadata = await sharp(raster).metadata();
	if (!metadata.width || !metadata.height) throw new Error('Raster has no dimensions.');
	assertContiguousBands(bands, metadata.height);
	return Promise.all(
		bands.map(async (band) => ({
			band,
			png: await sharp(raster)
				.extract({ left: 0, top: band.top, width: metadata.width!, height: band.height })
				.png()
				.toBuffer(),
		})),
	);
}
