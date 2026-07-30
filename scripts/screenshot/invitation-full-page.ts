// =============================================================================
// CELEBRA-ME | Screenshot Tool — Invitation Document-Space Full Page
// =============================================================================

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import type { Page } from 'playwright';
import type { OutputFormat, CaptureResult } from './types.js';
import { deriveSectionInventory } from './inventory.js';
import {
	listOrderedSectionCapturePaths,
	planDocumentCaptureStrips,
	planDocumentStripPhysicalPlacement,
	resolveInvitationDocumentCaptureRange,
} from './composite.js';
import { hideFixedOverlaysForCapture } from './element-capture.js';
import { scrollForLazyLoad, waitForHeroReady, waitForImages } from './page-preparation.js';
import {
	buildScreenshotPath,
	formatExtension,
	publishArtifactAtomically,
	invalidateStaleInvitationFullPage,
	verifyPhysicalPng,
	verifySectionCropInclusion,
} from './utils.js';

/**
 * Compare two screenshot files by file hash and warn if they are identical.
 * This detects cases where 03-reveal-letter and 04-reveal-section produce
 * the same visual output (wrong capture targets).
 */
async function warnIfFilesIdentical(
	pathA: string,
	pathB: string,
	labelA: string,
	labelB: string,
): Promise<void> {
	try {
		const [bufA, bufB] = await Promise.all([
			fs.promises.readFile(pathA),
			fs.promises.readFile(pathB),
		]);
		const hashA = crypto.createHash('md5').update(bufA).digest('hex');
		const hashB = crypto.createHash('md5').update(bufB).digest('hex');

		if (hashA === hashB) {
			console.warn(`  ⚠ [hash-match] ${labelA} and ${labelB} are identical (same MD5).`);
			console.warn(`    This means the capture targets are not semantically distinct.`);
			console.warn(`    Check that [data-screenshot="reveal-letter"] targets only the card,`);
			console.warn(
				`    while [data-screenshot="reveal-section"] targets a broader composition.`,
			);
		}
	} catch {
		// File read errors are non-fatal for this warning
	}
}

/**
 * Validate that reveal letter (03) and reveal section (04) screenshots are distinct.
 * Compares their file hashes and warns if identical.
 */
export async function validateDistinctReveal(results: CaptureResult[]): Promise<void> {
	const letter = results.find((r) => r.label === 'Reveal letter (open)');
	const section = results.find((r) => r.label === 'Reveal section (open)');
	if (letter?.success && section?.success) {
		await warnIfFilesIdentical(
			letter.path,
			section.path,
			'03-reveal-letter-open',
			'04-reveal-section-open',
		);
	}
}

/**
 * Document-space full-page raster for `05-invitation-full-page`.
 *
 * Captures contiguous page clips by absolute document Y (CDP
 * captureBeyondViewport) so a strip can span multiple sections and preserve
 * cross-section overflow/transforms. Does not use standalone `10-*` element
 * screenshots as raster sources. Scroll position stays fixed after lazy-load
 * so every strip reflects the same stable page state.
 */
export async function captureInvitationDocumentSpaceFullPage(
	page: Page,
	outputPath: string,
	format: OutputFormat,
	topY: number,
	bottomY: number,
	viewportWidth: number,
	options: { deviceScaleFactor?: number } = {},
): Promise<{ cssHeight: number; stripCount: number; width: number; height: number }> {
	const initialViewport = page.viewportSize() ?? { width: viewportWidth, height: 844 };
	const dpr =
		options.deviceScaleFactor && options.deviceScaleFactor > 0
			? options.deviceScaleFactor
			: (await page.evaluate(() => window.devicePixelRatio)) || 1;

	const plan = planDocumentCaptureStrips({
		topY,
		bottomY,
		maxStripHeight: initialViewport.height,
	});
	const physical = planDocumentStripPhysicalPlacement(plan, dpr);

	const tmpDir = path.join(path.dirname(outputPath), `.doc-strips-${Date.now()}`);
	await fs.promises.mkdir(tmpDir, { recursive: true });

	const restoreOverlays = await hideFixedOverlaysForCapture(page);
	const cdp = await page.context().newCDPSession(page);
	try {
		// Stable scroll origin for the entire strip set (lazy-load already ran).
		await page.evaluate(() => {
			window.scrollTo(0, 0);
			document.documentElement.scrollTop = 0;
			document.body.scrollTop = 0;
		});
		await page.waitForTimeout(50);

		const captured: Array<{
			file: string;
			width: number;
			height: number;
			physicalTop: number;
			physicalHeight: number;
		}> = [];

		const cdpFormat = format === 'jpeg' ? 'jpeg' : 'png';

		for (let i = 0; i < plan.strips.length; i++) {
			const strip = plan.strips[i];
			const placement = physical.placements[i];
			const tileFile = path.join(tmpDir, `strip-${String(i).padStart(3, '0')}.png`);

			const { data } = await cdp.send('Page.captureScreenshot', {
				format: cdpFormat,
				...(cdpFormat === 'jpeg' ? { quality: 90 } : {}),
				fromSurface: true,
				captureBeyondViewport: true,
				clip: {
					x: 0,
					y: strip.docY,
					width: initialViewport.width,
					height: strip.height,
					// CDP scale is relative to CSS px; set to DPR for device-pixel output.
					scale: dpr,
				},
			});

			await fs.promises.writeFile(tileFile, Buffer.from(data, 'base64'));

			const meta = await sharp(tileFile).metadata();
			if (!meta.width || !meta.height) {
				throw new Error(
					`COMPOSITE_FULL_PAGE_FAILED: Could not read strip dimensions at docY=${strip.docY}`,
				);
			}
			captured.push({
				file: tileFile,
				width: meta.width,
				height: meta.height,
				physicalTop: placement.physicalTop,
				physicalHeight: placement.physicalHeight,
			});
		}

		const currentViewport = page.viewportSize();
		if (
			!currentViewport ||
			currentViewport.width !== initialViewport.width ||
			currentViewport.height !== initialViewport.height
		) {
			throw new Error(
				`VIEWPORT_MUTATED_DURING_CAPTURE: Viewport mutated during document-space capture (${initialViewport.width}x${initialViewport.height} -> ${currentViewport?.width}x${currentViewport?.height})`,
			);
		}

		if (captured.length === 0) {
			throw new Error('COMPOSITE_FULL_PAGE_FAILED: No document strips captured.');
		}

		const canvasWidth = Math.max(1, Math.round(initialViewport.width * dpr));
		const canvasHeight = physical.canvasHeight;

		const composites = await Promise.all(
			captured.map(async (t) => {
				let pipeline = sharp(t.file);
				if (t.width !== canvasWidth || t.height !== t.physicalHeight) {
					pipeline = pipeline.resize({
						width: canvasWidth,
						height: t.physicalHeight,
						fit: 'fill',
					});
				}
				const buf = await pipeline.toBuffer();
				return {
					input: buf,
					top: t.physicalTop,
					left: 0,
				};
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
			cssHeight: plan.totalHeight,
			stripCount: captured.length,
			width: canvasWidth,
			height: canvasHeight,
		};
	} finally {
		await cdp.detach().catch(() => {});
		await restoreOverlays();
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
	}
}

type InvitationSectionInventory = Awaited<ReturnType<typeof deriveSectionInventory>>;

function assertCompleteInvitationInventory(inventory: InvitationSectionInventory): void {
	if (inventory.missing.length > 0) {
		throw new Error(
			`SECTION_COVERAGE_INCOMPLETE: Required sections missing from rendered DOM: ${inventory.missing.join(', ')}`,
		);
	}
	if (inventory.duplicates.length > 0) {
		throw new Error(
			`SECTION_COVERAGE_INCOMPLETE: Duplicate section roots detected in DOM: ${inventory.duplicates.join(', ')}`,
		);
	}
}

/**
 * Soft sanity check: full-page hero strip vs same-run standalone `10-*` hero.
 * Blank region fails hard; visual MAE mismatch warns only (document-space page
 * clips can legitimately differ from element screenshots at overflow edges).
 */
async function verifyDocumentSpaceHeroAgainstStandalone(
	fullPagePath: string,
	priorResults: CaptureResult[],
	deviceScaleFactor: number,
	captureOriginTop: number,
): Promise<void> {
	const heroPath = listOrderedSectionCapturePaths(
		priorResults.filter((r) => r.success).map((r) => r.path),
	).find((p) => /[/\\]10-\d+-hero\./.test(p.replace(/\\/g, '/')));
	if (!heroPath) return;

	const heroResult = priorResults.find(
		(r) => path.normalize(r.path) === path.normalize(heroPath),
	);
	const heroBounds = heroResult?.documentBounds ?? { y: captureOriginTop, height: 0 };
	const heroMeta = await sharp(heroPath).metadata();
	const cssHeight =
		heroBounds.height > 0
			? heroBounds.height
			: (heroMeta.height || 0) / Math.max(1, deviceScaleFactor);
	if (!(cssHeight > 0)) return;

	const cropCheck = await verifySectionCropInclusion({
		fullPagePath,
		sectionId: 'hero',
		sectionBounds: { y: heroBounds.y, height: cssHeight },
		topY: captureOriginTop,
		deviceScaleFactor,
		standalonePath: heroPath,
	});
	if (cropCheck.warning) {
		console.warn(`  ⚠ ${cropCheck.warning}`);
	}
	if (!cropCheck.valid) {
		const isHeroMae =
			cropCheck.errorCode === 'SECTION_CAPTURE_MISMATCH' &&
			/does not match standalone hero/i.test(cropCheck.error ?? '');
		if (isHeroMae) {
			console.warn(`  ⚠ ${cropCheck.error}`);
			return;
		}
		throw new Error(`${cropCheck.errorCode ?? 'SECTION_CAPTURE_MISMATCH'}: ${cropCheck.error}`);
	}
}

/**
 * Capture the 05-invitation-full-page screenshot from document-space page strips.
 * Standalone `10-*` section captures remain QA artifacts only and are not raster
 * sources for this composite.
 */
export async function captureInvitationOpen(
	page: Page,
	outputDir: string,
	viewportName: string,
	format: OutputFormat,
	priorResults: CaptureResult[] = [],
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];
	const fullOpenPath = await buildScreenshotPath(
		outputDir,
		viewportName,
		'05-invitation-full-page',
		format,
	);

	const runId = Date.now();
	const tempPath = path.join(
		outputDir,
		`.tmp-${runId}-${viewportName}-05-invitation-full-page.${formatExtension(format)}`,
	);

	try {
		await scrollForLazyLoad(page);
		await page.evaluate(() => {
			document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
				img.loading = 'eager';
			});
		});
		await waitForImages(page);
		await waitForHeroReady(page);

		const inventory = await deriveSectionInventory(page);
		assertCompleteInvitationInventory(inventory);
		if (inventory.sections.length === 0) {
			throw new Error('FULL_PAGE_CAPTURE_FAILED: No invitation sections found in DOM.');
		}

		const range = resolveInvitationDocumentCaptureRange(
			inventory.sections.map((sec) => ({
				docTop: sec.bounds.y,
				docHeight: sec.bounds.height,
			})),
		);

		const initialViewport = page.viewportSize() ?? { width: 390, height: 844 };
		const deviceScaleFactor = (await page.evaluate(() => window.devicePixelRatio)) || 2;

		const capture = await captureInvitationDocumentSpaceFullPage(
			page,
			tempPath,
			format,
			range.topY,
			range.bottomY,
			initialViewport.width,
			{ deviceScaleFactor },
		);

		const expectedCssHeight = Math.max(100, capture.cssHeight);
		const physCheck = await verifyPhysicalPng({
			filePath: tempPath,
			expectedCssWidth: initialViewport.width,
			expectedCssHeight,
			viewportCssHeight: initialViewport.height,
			deviceScaleFactor,
		});
		if (!physCheck.valid) {
			await fs.promises.rm(tempPath, { force: true }).catch(() => {});
			throw new Error(
				`${physCheck.errorCode ?? 'FULL_PAGE_DIMENSION_MISMATCH'}: ${physCheck.error}`,
			);
		}

		await verifyDocumentSpaceHeroAgainstStandalone(
			tempPath,
			priorResults,
			deviceScaleFactor,
			Math.floor(range.topY),
		);

		console.log(
			`  ✓ Captured: 05-invitation-full-page (${viewportName}) [${inventory.sections.length} section(s), ${expectedCssHeight}px, ${capture.stripCount} strip(s), strategy: document-space]`,
		);

		const published = await publishArtifactAtomically(tempPath, fullOpenPath);
		results.push({
			id: '05-invitation-full-page',
			path: published.path,
			viewportName,
			label: 'Full invitation (open)',
			success: true,
			hash: published.hash,
			sizeBytes: published.sizeBytes,
			mtimeMs: published.mtimeMs,
			strategy: 'stitched',
			verificationStatus: 'passed',
		});
	} catch (err) {
		console.warn(`  ⚠ Failed to capture 05 open page: ${err}`);
		await fs.promises.rm(tempPath, { force: true }).catch(() => {});
		const removed = await invalidateStaleInvitationFullPage(fullOpenPath);
		if (removed) {
			console.warn(
				`  ⚠ Removed stale 05-invitation-full-page for ${viewportName} so a previous run cannot be mistaken for a fresh capture.`,
			);
		}
		results.push({
			id: '05-invitation-full-page',
			path: fullOpenPath,
			viewportName,
			label: 'Full invitation (open)',
			success: false,
			error: String(err),
		});
	}

	return results;
}
