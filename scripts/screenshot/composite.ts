// =============================================================================
// CELEBRA-ME | Screenshot Tool — Document Composite & Section PNG Helpers
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

/** Order `10-{order}-{id}` section capture paths by their numeric order prefix. */
export function listOrderedSectionCapturePaths(paths: string[]): string[] {
	return paths
		.filter((p) => /(?:^|[/\\])10-\d+-/.test(p.replace(/\\/g, '/')))
		.sort((a, b) => {
			const orderOf = (filePath: string) => {
				const match = path.basename(filePath).match(/^10-(\d+)-/);
				return match ? Number(match[1]) : 999;
			};
			return orderOf(a) - orderOf(b);
		});
}

/** Parse `10-{order}-{id}` from a section capture filename. */
export function parseSectionCaptureIdentity(filePath: string): {
	order: number;
	sectionId: string;
} | null {
	const match = path.basename(filePath).match(/^10-(\d+)-(.+)\.[^.]+$/);
	if (!match) return null;
	return { order: Number(match[1]), sectionId: match[2] };
}

/** Document-space fragment for geometry-aware section-composite. */
export interface SectionCompositeFragment {
	file: string;
	/** Document Y of the section top (CSS px). */
	docTop: number;
	/** Layout box height (CSS px). */
	docHeight: number;
	/** Stable paint order when tops are equal (DOM/section order). */
	order: number;
	sectionId?: string;
}

export interface DocumentCompositePlacement {
	file: string;
	/** Offset from composite origin (CSS px). */
	cssTop: number;
	cssHeight: number;
	order: number;
	sectionId?: string;
}

export interface DocumentCompositeLayout {
	originTop: number;
	canvasCssHeight: number;
	placements: DocumentCompositePlacement[];
}

/** Contiguous document-space strip covering [topY, bottomY). */
export interface DocumentCaptureStrip {
	/** Absolute document Y of the strip top (CSS px). */
	docY: number;
	/** Strip height in CSS px. */
	height: number;
}

export interface DocumentCaptureStripPlan {
	originTop: number;
	totalHeight: number;
	strips: DocumentCaptureStrip[];
}

/**
 * Partition a document Y range into contiguous strips with no gaps, overlaps,
 * missing rows, or duplicated rows. Heights are integers in CSS pixels.
 */
export function planDocumentCaptureStrips(input: {
	topY: number;
	bottomY: number;
	maxStripHeight: number;
}): DocumentCaptureStripPlan {
	const originTop = Math.floor(input.topY);
	const end = Math.ceil(input.bottomY);
	if (!(end > originTop)) {
		throw new Error(
			`COMPOSITE_FULL_PAGE_FAILED: Invalid document capture range [${input.topY}, ${input.bottomY}).`,
		);
	}
	const maxStripHeight = Math.max(1, Math.floor(input.maxStripHeight));
	const totalHeight = end - originTop;
	const strips: DocumentCaptureStrip[] = [];
	let y = originTop;
	while (y < end) {
		const height = Math.min(maxStripHeight, end - y);
		strips.push({ docY: y, height });
		y += height;
	}

	assertContinuousDocumentStrips(strips, originTop, end);
	return { originTop, totalHeight, strips };
}

/** Verify strip plan is a partition of [originTop, end). */
export function assertContinuousDocumentStrips(
	strips: DocumentCaptureStrip[],
	originTop: number,
	end: number,
): void {
	if (strips.length === 0) {
		throw new Error('COMPOSITE_FULL_PAGE_FAILED: No document capture strips planned.');
	}
	if (strips[0].docY !== originTop) {
		throw new Error(
			`COMPOSITE_FULL_PAGE_FAILED: First strip docY ${strips[0].docY} != origin ${originTop}.`,
		);
	}
	let cursor = originTop;
	for (const strip of strips) {
		if (strip.docY !== cursor) {
			throw new Error(
				`COMPOSITE_FULL_PAGE_FAILED: Strip gap/overlap at docY=${strip.docY} (expected ${cursor}).`,
			);
		}
		if (!(strip.height > 0)) {
			throw new Error(
				`COMPOSITE_FULL_PAGE_FAILED: Non-positive strip height at ${strip.docY}.`,
			);
		}
		cursor += strip.height;
	}
	if (cursor !== end) {
		throw new Error(
			`COMPOSITE_FULL_PAGE_FAILED: Strip coverage ended at ${cursor}, expected ${end}.`,
		);
	}
}

/**
 * Capture range from the first invitation section top to the bottom of the
 * final section. Overlaps shrink the span; positive gaps are included.
 */
export function resolveInvitationDocumentCaptureRange(
	sections: Array<{ docTop: number; docHeight: number }>,
): { topY: number; bottomY: number; totalHeight: number } {
	if (sections.length === 0) {
		throw new Error('COMPOSITE_FULL_PAGE_FAILED: No invitation sections for document range.');
	}
	const topY = Math.min(...sections.map((s) => s.docTop));
	const bottomY = Math.max(...sections.map((s) => s.docTop + s.docHeight));
	const originTop = Math.floor(topY);
	const end = Math.ceil(bottomY);
	return { topY, bottomY, totalHeight: end - originTop };
}

export interface DocumentStripPhysicalPlacement {
	docY: number;
	cssHeight: number;
	physicalTop: number;
	physicalHeight: number;
}

/**
 * Map a CSS strip plan to device-pixel canvas placements. Tops/heights use
 * half-open document intervals mapped through DPR so adjacent strips abut
 * (no missing or duplicated physical rows).
 */
export function planDocumentStripPhysicalPlacement(
	plan: DocumentCaptureStripPlan,
	deviceScaleFactor: number,
): { canvasHeight: number; placements: DocumentStripPhysicalPlacement[] } {
	const dpr = deviceScaleFactor > 0 ? deviceScaleFactor : 1;
	const originPhys = Math.round(plan.originTop * dpr);
	const endPhys = Math.round((plan.originTop + plan.totalHeight) * dpr);
	const placements = plan.strips.map((strip) => {
		const stripStartPhys = Math.round(strip.docY * dpr);
		const stripEndPhys = Math.round((strip.docY + strip.height) * dpr);
		return {
			docY: strip.docY,
			cssHeight: strip.height,
			physicalTop: stripStartPhys - originPhys,
			physicalHeight: Math.max(1, stripEndPhys - stripStartPhys),
		};
	});
	const canvasHeight = Math.max(1, endPhys - originPhys);
	assertContinuousPhysicalStripPlacements(placements, canvasHeight);
	return { canvasHeight, placements };
}

/** Verify physical strip rows form a continuous partition of the canvas. */
export function assertContinuousPhysicalStripPlacements(
	placements: Array<{ physicalTop: number; physicalHeight: number }>,
	canvasHeight: number,
): void {
	if (placements.length === 0) {
		throw new Error('COMPOSITE_FULL_PAGE_FAILED: No physical strip placements.');
	}
	let cursor = 0;
	for (const placement of placements) {
		if (placement.physicalTop !== cursor) {
			throw new Error(
				`COMPOSITE_FULL_PAGE_FAILED: Physical strip gap/overlap at top=${placement.physicalTop} (expected ${cursor}).`,
			);
		}
		if (!(placement.physicalHeight > 0)) {
			throw new Error(
				`COMPOSITE_FULL_PAGE_FAILED: Non-positive physical strip height at top=${placement.physicalTop}.`,
			);
		}
		cursor += placement.physicalHeight;
	}
	if (cursor !== canvasHeight) {
		throw new Error(
			`COMPOSITE_FULL_PAGE_FAILED: Physical coverage ended at ${cursor}, expected canvas ${canvasHeight}.`,
		);
	}
}

/**
 * Place section fragments using document coordinates so overlaps and gaps are
 * preserved. Canvas height is last.bottom − first.top, not the sum of PNG heights.
 * Paint order is document-top ascending, then section order (later paints on top).
 *
 * Note: `05-invitation-full-page` uses document-space page strips, not these
 * section PNG fragments. This layout remains for deterministic geometry tests
 * and any non-full-page callers.
 */
export function computeDocumentCompositeLayout(
	fragments: SectionCompositeFragment[],
): DocumentCompositeLayout {
	if (fragments.length === 0) {
		throw new Error('COMPOSITE_FULL_PAGE_FAILED: No section fragments to layout.');
	}
	for (const fragment of fragments) {
		if (!(fragment.docHeight > 0)) {
			throw new Error(`COMPOSITE_FULL_PAGE_FAILED: Invalid docHeight for ${fragment.file}`);
		}
	}

	const sorted = [...fragments].sort(
		(a, b) => a.docTop - b.docTop || a.order - b.order || a.file.localeCompare(b.file),
	);
	const originTop = sorted[0].docTop;
	const bottom = Math.max(...sorted.map((f) => f.docTop + f.docHeight));
	const canvasCssHeight = Math.max(1, Math.ceil(bottom - originTop));

	return {
		originTop,
		canvasCssHeight,
		placements: sorted.map((f) => ({
			file: f.file,
			cssTop: f.docTop - originTop,
			cssHeight: f.docHeight,
			order: f.order,
			sectionId: f.sectionId,
		})),
	};
}

/**
 * Vertically composite section PNG captures into a single full-page artifact.
 *
 * When fragments include document geometry, placements use document offsets
 * (overlaps/gaps preserved). Plain path arrays fall back to contiguous stacking
 * for legacy callers.
 */
export async function compositeSectionCapturePngs(
	sectionPathsOrFragments: string[] | SectionCompositeFragment[],
	outputPath: string,
	options: { deviceScaleFactor?: number } = {},
): Promise<{ width: number; height: number; sectionCount: number; cssHeight: number }> {
	const fragments = await normalizeCompositeFragments(sectionPathsOrFragments);
	const layout = computeDocumentCompositeLayout(fragments);
	const dpr =
		options.deviceScaleFactor && options.deviceScaleFactor > 0 ? options.deviceScaleFactor : 1;

	const tiles: Array<{
		file: string;
		width: number;
		height: number;
		physicalTop: number;
	}> = [];

	for (const placement of layout.placements) {
		const meta = await sharp(placement.file).metadata();
		if (!meta.width || !meta.height) {
			throw new Error(
				`COMPOSITE_FULL_PAGE_FAILED: Could not read dimensions for ${placement.file}`,
			);
		}
		tiles.push({
			file: placement.file,
			width: meta.width,
			height: meta.height,
			physicalTop: Math.round(placement.cssTop * dpr),
		});
	}

	const canvasWidth = tiles.reduce((max, t) => Math.max(max, t.width), 0);
	const docCanvasHeight = Math.max(1, Math.round(layout.canvasCssHeight * dpr));
	const contentBottom = tiles.reduce((max, t) => Math.max(max, t.physicalTop + t.height), 0);
	const canvasHeight = Math.max(docCanvasHeight, contentBottom);

	const composites = await Promise.all(
		tiles.map(async (t) => {
			let input = sharp(t.file);
			if (t.width !== canvasWidth) {
				input = input.resize({ width: canvasWidth });
			}
			const buf = await input.toBuffer();
			return { input: buf, top: t.physicalTop, left: 0 };
		}),
	);

	await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
	await sharp({
		create: {
			width: canvasWidth,
			height: canvasHeight,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite(composites)
		.png()
		.toFile(outputPath);

	return {
		width: canvasWidth,
		height: canvasHeight,
		sectionCount: tiles.length,
		cssHeight: layout.canvasCssHeight,
	};
}

async function normalizeCompositeFragments(
	sectionPathsOrFragments: string[] | SectionCompositeFragment[],
): Promise<SectionCompositeFragment[]> {
	if (sectionPathsOrFragments.length === 0) {
		throw new Error(
			'COMPOSITE_FULL_PAGE_FAILED: No ordered section capture paths to composite.',
		);
	}

	if (typeof sectionPathsOrFragments[0] !== 'string') {
		return sectionPathsOrFragments as SectionCompositeFragment[];
	}

	const paths = listOrderedSectionCapturePaths(sectionPathsOrFragments as string[]);
	if (paths.length === 0) {
		throw new Error(
			'COMPOSITE_FULL_PAGE_FAILED: No ordered section capture paths to composite.',
		);
	}

	// Legacy path-only API: treat fragments as contiguous stacked boxes.
	let cursor = 0;
	const fragments: SectionCompositeFragment[] = [];
	for (const file of paths) {
		const meta = await sharp(file).metadata();
		if (!meta.width || !meta.height) {
			throw new Error(`COMPOSITE_FULL_PAGE_FAILED: Could not read dimensions for ${file}`);
		}
		const identity = parseSectionCaptureIdentity(file);
		fragments.push({
			file,
			docTop: cursor,
			docHeight: meta.height,
			order: identity?.order ?? fragments.length + 1,
			sectionId: identity?.sectionId,
		});
		cursor += meta.height;
	}
	return fragments;
}
