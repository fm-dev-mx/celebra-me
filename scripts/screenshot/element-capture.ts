// =============================================================================
// CELEBRA-ME | Screenshot Tool — Viewport, Element & Tall-Section Capture
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import type { Page, Locator } from 'playwright';
import {
	type OutputFormat,
	type CaptureResult,
	type SectionExtent,
	DEFAULT_ELEMENT_TIMEOUT,
} from './types.js';
import {
	getOperationalToolbarSelectors,
	intersectRectWithViewport,
	playwrightFormatOptions,
} from './utils.js';

/**
 * Screenshot-only helper that hides fixed UI overlays so they do not appear
 * floating over content in non-header captures (full-page and element captures).
 *
 * Production layout is not modified: we apply a screenshot-only CSS override
 * using `visibility: hidden` (elements keep their layout box). The style tag
 * is injected at most once per page session, identified by a data attribute
 * on <html>. Subsequent calls are no-ops, which keeps the renderer from
 * accumulating dozens of <style> tags and avoids `addStyleTag` racing with
 * in-flight smooth scrolls.
 */
export async function hideFixedOverlaysForCapture(page: Page): Promise<() => Promise<void>> {
	const state = await page.evaluate(() => ({
		alreadyInjected: document.documentElement.hasAttribute('data-screenshot-overlay-hidden'),
		alreadyActive: document.documentElement.classList.contains('screenshot-hide-overlays'),
	}));
	if (!state.alreadyInjected) {
		const toolbarSelectors = getOperationalToolbarSelectors().join(',\n      ');
		await page.addStyleTag({
			content: `
	      html.screenshot-hide-overlays .header-base,
	      html.screenshot-hide-overlays [data-back-to-top],
	      html.screenshot-hide-overlays .back-to-top,
	      html.screenshot-hide-overlays .scroll-to-top,
	      html.screenshot-hide-overlays .action-icon--scroll,
	      html.screenshot-hide-overlays .action-icon--fixed-bottom-right,
	      html.screenshot-hide-overlays :is(
	        ${toolbarSelectors}
	      ) {
	        visibility: hidden !important;
	        pointer-events: none !important;
	      }
	    `,
		});
		await page.evaluate(() => {
			document.documentElement.setAttribute('data-screenshot-overlay-hidden', '1');
		});
	}

	if (!state.alreadyActive) {
		await page.evaluate(() => {
			document.documentElement.classList.add('screenshot-hide-overlays');
		});
		// Settle only when transitioning into the hidden state (E3).
		await page.waitForTimeout(50);
	}

	return async () => {
		await page.evaluate(() => {
			document.documentElement.classList.remove('screenshot-hide-overlays');
		});
	};
}

/**
 * Capture a full-page screenshot using Playwright's native fullPage option.
 *
 * Note: this captures the whole document at once. For landing pages on
 * mobile/tablet viewports, prefer `captureLandingStitchedFullPage` which
 * stitches per-section element captures. The native fullPage mode
 * mis-stitches when <body> is the scroll container (the landing sets
 * `body { overflow-y: auto }`), producing a large blank white tail.
 */
export async function captureFullPage(
	page: Page,
	outputPath: string,
	format: OutputFormat,
): Promise<CaptureResult> {
	const fullPage = format === 'pdf' || format === 'png';

	const restoreOverlays = await hideFixedOverlaysForCapture(page);
	try {
		await page.screenshot({
			path: outputPath,
			fullPage: fullPage,
			...playwrightFormatOptions(format),
		});
	} finally {
		await restoreOverlays();
	}

	return {
		path: outputPath,
		viewportName: '',
		label: pathLabel(outputPath),
		success: true,
	};
}
/**
 * Capture just the visible viewport.
 */
export async function captureViewport(
	page: Page,
	outputPath: string,
	format: OutputFormat,
): Promise<CaptureResult> {
	await page.screenshot({
		path: outputPath,
		fullPage: false,
		...playwrightFormatOptions(format),
	});

	return {
		path: outputPath,
		viewportName: '',
		label: pathLabel(outputPath),
		success: true,
	};
}

export async function resetScrollAndAssertAboveFold(page: Page, selector: string): Promise<void> {
	await page.evaluate(() => {
		window.scrollTo(0, 0);
	});
	await page.waitForFunction(() => Math.abs(window.scrollY) <= 1, undefined, { timeout: 3000 });
	await page.waitForTimeout(150);

	const visible = await page
		.locator(selector)
		.first()
		.evaluate((element) => {
			const style = window.getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity || '1') > 0.01 &&
				rect.width > 0 &&
				rect.height > 0 &&
				rect.bottom > 0 &&
				rect.top < window.innerHeight
			);
		})
		.catch(() => false);

	if (!visible) {
		throw new Error(
			`Above-fold selector was not visible after resetting scroll before viewport capture: ${selector}`,
		);
	}
}

/**
 * Capture a specific element identified by a CSS selector.
 * Scrolling into view first. Does NOT hard-crash if the element is missing.
 *
 * By default, fixed UI overlays (header, back-to-top, etc.) are hidden so they
 * do not float over the captured element. Pass `hideOverlays: false` to capture
 * a dedicated header or other overlay element with the overlay visible.
 *
 * `sectionExtent`:
 *  - `full` (default): entire element height (tiles + stitches when taller than viewport)
 *  - `viewport`: only the visible intersection with the current viewport
 */
export async function captureElement(
	page: Page,
	selector: string,
	outputPath: string,
	format: OutputFormat,
	opts: { hideOverlays?: boolean; sectionExtent?: SectionExtent } = {},
): Promise<CaptureResult | null> {
	const label = pathLabel(outputPath);
	const { hideOverlays = true, sectionExtent = 'full' } = opts;

	try {
		const locator = page.locator(selector).first();
		const count = await locator.count();

		if (count === 0) {
			console.warn(`  ⚠ Element not found: ${selector} — skipping`);
			return null;
		}

		await locator.waitFor({ state: 'visible', timeout: DEFAULT_ELEMENT_TIMEOUT });
		await locator.evaluate((element) => {
			element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
		});
		await page.waitForTimeout(200);

		const documentBounds = await locator
			.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				return {
					x: Math.floor(rect.left + window.scrollX),
					y: Math.floor(rect.top + window.scrollY),
					width: Math.ceil(rect.width),
					height: Math.ceil(rect.height),
				};
			})
			.catch(() => undefined);

		const restoreOverlays = hideOverlays ? await hideFixedOverlaysForCapture(page) : null;
		try {
			if (sectionExtent === 'viewport') {
				const captured = await captureElementViewportCrop(
					page,
					locator,
					outputPath,
					format,
				);
				if (!captured) return null;
			} else {
				const captured = await captureElementFullExtent(
					page,
					locator,
					outputPath,
					format,
					selector,
				);
				if (!captured) return null;
			}
		} finally {
			if (restoreOverlays) await restoreOverlays();
		}

		return {
			path: outputPath,
			viewportName: '',
			label,
			success: true,
			...(documentBounds ? { documentBounds } : {}),
		};
	} catch (err) {
		console.warn(`  ⚠ Could not capture element "${selector}": ${err}`);
		return null;
	}
}

async function captureElementViewportCrop(
	page: Page,
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
): Promise<boolean> {
	const box = await locator.boundingBox();
	const viewport = page.viewportSize();
	if (!box || !viewport) {
		console.warn('  ⚠ Could not get bounding box / viewport for viewport-crop capture');
		return false;
	}
	const clip = intersectRectWithViewport(box, viewport);
	if (!clip) {
		console.warn('  ⚠ Element has no visible intersection with the viewport');
		return false;
	}
	try {
		await page.screenshot({
			path: outputPath,
			clip,
			...playwrightFormatOptions(format),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes('Clipped area is either empty or outside the resulting image')) {
			throw error;
		}
		// Last resort: locator screenshot (may exceed viewport for tall elements)
		await locator.screenshot({
			path: outputPath,
			animations: 'disabled',
			...playwrightFormatOptions(format),
		});
	}
	return true;
}

async function screenshotLocatorToPath(
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
): Promise<void> {
	await locator.screenshot({
		path: outputPath,
		animations: 'disabled',
		...playwrightFormatOptions(format),
	});
}

/**
 * Single-shot page clip for elements that fit (or nearly fit) one viewport.
 * Clamps to the viewport — Playwright rejects clips taller than the viewport by
 * ~1px when sections are `100vh`/`100svh`, and the old `locator.screenshot`
 * fallback stitched with mid-frame seams + next-section bleed (ivory bands).
 *
 * Returns false when the element does not fit so the caller can tile-stitch.
 */
async function captureShortElementFullExtent(
	page: Page,
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
	viewportHeight: number,
): Promise<boolean> {
	const viewport = page.viewportSize();
	if (!viewport) return false;

	const box = await locator.boundingBox();
	if (!box || box.width <= 0 || box.height <= 0) return false;

	// Near-full-viewport sections (common for interludes / RSVP) must use a
	// clamped page clip, not locator.screenshot stitching.
	if (box.height > viewportHeight + 2) {
		return false;
	}

	const clip = intersectRectWithViewport(box, viewport);
	if (!clip) return false;

	try {
		await page.screenshot({
			path: outputPath,
			clip,
			...playwrightFormatOptions(format),
		});
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes('Clipped area is either empty or outside the resulting image')) {
			throw error;
		}
		return false;
	}
}

export interface TallElementCaptureSegmentInput {
	docY: number;
	height: number;
	nextOffset: number;
	actualScrollY: number;
	visibleHeight: number;
}

export interface TallElementCaptureSegment {
	elementStart: number;
	captureStart: number;
	captureHeight: number;
}

/**
 * Resolve the next non-overlapping element segment from the browser's actual
 * scroll position. At the document bottom the requested scroll can be clamped,
 * so the visible segment may begin before the requested offset; cropping the
 * already-captured prefix keeps the stitched output contiguous.
 */
export function resolveTallElementCaptureSegment(
	input: TallElementCaptureSegmentInput,
): TallElementCaptureSegment {
	const elementStart = Math.max(0, Math.min(input.height, input.actualScrollY - input.docY));
	const visibleEnd = Math.min(input.height, elementStart + input.visibleHeight);
	const epsilon = 0.5;

	if (elementStart > input.nextOffset + epsilon) {
		throw new Error(
			`Tall element capture skipped content: actual start ${elementStart} is after next offset ${input.nextOffset}`,
		);
	}

	const captureStart = input.nextOffset;
	const captureHeight = visibleEnd - captureStart;
	if (captureHeight <= epsilon) {
		throw new Error(
			`Tall element capture made no progress at offset ${input.nextOffset} (visible end ${visibleEnd})`,
		);
	}

	return { elementStart, captureStart, captureHeight };
}

async function stitchTallElementTiles(
	page: Page,
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
	metrics: { docY: number; height: number },
	viewport: { width: number; height: number },
): Promise<boolean> {
	const tmpDir = path.join(
		path.dirname(outputPath),
		`.section-stitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	await fs.promises.mkdir(tmpDir, { recursive: true });

	try {
		const tiles: Array<{ file: string; width: number; height: number }> = [];
		let nextOffset = 0;
		let tileIdx = 0;

		while (nextOffset < metrics.height) {
			await page.evaluate(
				({ docY, offset }) => {
					window.scrollTo(0, docY + offset);
				},
				{ docY: metrics.docY, offset: nextOffset },
			);
			await page.waitForTimeout(80);
			const actualScrollY = await page.evaluate(() => window.scrollY);

			const tileFile = path.join(tmpDir, `tile-${tileIdx}.png`);
			const box = await locator.boundingBox();
			if (!box) {
				throw new Error('element bounding box unavailable during tile capture');
			}
			const visible = intersectRectWithViewport(box, viewport);
			if (!visible) {
				throw new Error('element left the viewport during tile capture');
			}
			const segment = resolveTallElementCaptureSegment({
				docY: metrics.docY,
				height: metrics.height,
				nextOffset,
				actualScrollY,
				visibleHeight: visible.height,
			});
			const cropTop = segment.captureStart - segment.elementStart;
			const clip = {
				x: visible.x,
				y: visible.y + cropTop,
				width: visible.width,
				height: segment.captureHeight,
			};

			try {
				await page.screenshot({
					path: tileFile,
					clip,
					...playwrightFormatOptions(format),
				});
			} catch {
				// Retry with the same actual-position-derived segment. Capturing the
				// complete visible box here would reintroduce bottom-clamp overlap.
				await page.screenshot({
					path: tileFile,
					clip,
					...playwrightFormatOptions(format),
				});
			}

			const meta = await sharp(tileFile).metadata();
			if (meta.width && meta.height) {
				tiles.push({ file: tileFile, width: meta.width, height: meta.height });
			}
			nextOffset = segment.captureStart + segment.captureHeight;
			tileIdx++;
		}

		if (tiles.length === 0) {
			throw new Error('no tiles captured for full-section stitch');
		}

		const canvasWidth = tiles.reduce((max, t) => Math.max(max, t.width), 0);
		const canvasHeight = tiles.reduce((sum, t) => sum + t.height, 0);
		const composites = await Promise.all(
			tiles.map(async (t, idx) => {
				let input = sharp(t.file);
				if (t.width !== canvasWidth) {
					input = input.resize({ width: canvasWidth });
				}
				const buf = await input.toBuffer();
				const top = tiles.slice(0, idx).reduce((sum, p) => sum + p.height, 0);
				return { input: buf, top, left: 0 };
			}),
		);

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

		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		return true;
	} catch (err) {
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		console.warn(`  ⚠ Full-section stitch failed (${err})`);
		return false;
	}
}

/**
 * Capture the full element height. Short elements use a viewport clip after
 * scrollIntoView; tall elements are tiled and stitched with sharp.
 */
async function captureElementFullExtent(
	page: Page,
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
	selector = '',
): Promise<boolean> {
	const metrics = await locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return {
			docX: Math.max(0, window.scrollX + rect.left),
			docY: Math.max(0, window.scrollY + rect.top),
			width: Math.max(0, rect.width),
			height: Math.max(0, rect.height),
		};
	});
	const viewport = page.viewportSize();
	if (!viewport || metrics.width <= 0 || metrics.height <= 0) {
		console.warn(
			`  ⚠ Could not measure element for full-section capture` +
				` (selector=${selector || '(unknown)'}` +
				`, width=${metrics.width}, height=${metrics.height}` +
				`, viewport=${viewport ? `${viewport.width}x${viewport.height}` : 'null'})` +
				`; falling back to locator.screenshot`,
		);
		try {
			await screenshotLocatorToPath(locator, outputPath, format);
			return true;
		} catch (fallbackErr) {
			console.warn(`  ⚠ locator.screenshot fallback also failed: ${fallbackErr}`);
			return false;
		}
	}

	// Prefer a clamped one-shot clip for ~viewport-tall sections. If that fails
	// (subpixel overflow, sticky offset), fall through to controlled tile stitch —
	// never Playwright locator.screenshot auto-stitch.
	if (metrics.height <= viewport.height + 2) {
		const captured = await captureShortElementFullExtent(
			page,
			locator,
			outputPath,
			format,
			viewport.height,
		);
		if (captured) return true;
	}

	return stitchTallElementTiles(page, locator, outputPath, format, metrics, viewport);
}

/**
 * Extract a human-readable label from a file path for reporting.
 */
export function pathLabel(filepath: string): string {
	const parts = filepath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1];
}
