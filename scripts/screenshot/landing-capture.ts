// =============================================================================
// CELEBRA-ME | Screenshot Tool — Landing Full-Page Stitch
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import type { Page } from 'playwright';
import type { OutputFormat, CaptureResult } from './types.js';
import { formatDuration, playwrightFormatOptions } from './utils.js';
import { captureFullPage, hideFixedOverlaysForCapture, pathLabel } from './element-capture.js';

/**
 * Order and selectors for the landing page sections used by the
 * `captureLandingStitchedFullPage` stitcher. This is screenshot-tool-internal:
 * the website UI does not consume this list. Selectors prefer the
 * `data-screenshot="landing-…"` hooks used by `getDefaultCriticalSelectors`,
 * then fall back to the section's `id` for resilience. The hero is captured
 * with the fixed header visible (to match `01-viewport`); every other section
 * is captured with fixed overlays hidden.
 */
const LANDING_FULLPAGE_SECTIONS: ReadonlyArray<{
	id: string;
	selector: string;
	keepHeader: boolean;
}> = [
	{
		id: 'hero',
		selector: '[data-screenshot="landing-hero"], #inicio, .hero-prime',
		keepHeader: true,
	},
	{
		id: 'event-selector',
		selector: '[data-screenshot="landing-event-selector"], #tipo-evento',
		keepHeader: false,
	},
	{
		id: 'product-proof',
		selector: '[data-screenshot="landing-product-proof"], #prueba-producto',
		keepHeader: false,
	},
	{
		id: 'services',
		selector: '[data-screenshot="landing-includes"], #servicios',
		keepHeader: false,
	},
	{
		id: 'interlude',
		selector: '[data-screenshot="landing-interlude"], .photo-interlude',
		keepHeader: false,
	},
	{
		id: 'guest-experience',
		selector: '[data-screenshot="landing-guest-experience"], #experiencia-invitados',
		keepHeader: false,
	},
	{
		id: 'how-it-works',
		selector: '[data-screenshot="landing-process"], #como-funciona',
		keepHeader: false,
	},
	{
		id: 'testimonials',
		selector: '[data-screenshot="landing-testimonials"], #testimonios',
		keepHeader: false,
	},
	{
		id: 'pricing',
		selector: '[data-screenshot="landing-pricing"], #pricing',
		keepHeader: false,
	},
	{
		id: 'faq',
		selector: '[data-screenshot="landing-faq"], #faq-section',
		keepHeader: false,
	},
	{
		id: 'contact',
		selector: '[data-screenshot="landing-contact"], #contacto',
		keepHeader: false,
	},
	{ id: 'footer', selector: '[data-screenshot="landing-footer"], footer', keepHeader: false },
];

function describeStitchFailure(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (
		message.includes('Timeout') ||
		message.includes('stable') ||
		message.includes('bounding box') ||
		message.includes('visible')
	) {
		return 'unstable element';
	}
	return message;
}

/**
 * Capture a single landing-page section for the stitched full-page screenshot.
 * Pushes results, warnings, and failures into the caller-supplied arrays.
 * Called once per section by {@link captureLandingStitchedFullPage}.
 */
async function captureSingleSectionForStitch(
	page: Page,
	section: { id: string; selector: string; keepHeader: boolean },
	tmpDir: string,
	format: OutputFormat,
	stitchTimeoutMs: number,
	capturedSections: { id: string; file: string; width: number; height: number }[],
	skipped: string[],
	failedSections: string[],
): Promise<void> {
	const loc = page.locator(section.selector).first();
	const count = await loc.count().catch(() => 0);
	if (count === 0) {
		skipped.push(section.id);
		return;
	}

	const file = path.join(tmpDir, `${section.id}.png`);
	try {
		await loc.waitFor({ state: 'visible', timeout: stitchTimeoutMs });
		await loc.evaluate((element) => {
			element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
		});
		await page.waitForTimeout(150);
		const clip = await loc.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			return {
				x: Math.max(0, window.scrollX + rect.left),
				y: Math.max(0, window.scrollY + rect.top),
				width: Math.max(0, rect.width),
				height: Math.max(0, rect.height),
				docWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
				docHeight: Math.max(
					document.documentElement.scrollHeight,
					document.body.scrollHeight,
				),
			};
		});
		if (!clip || clip.width <= 0 || clip.height <= 0) {
			// Clip unavailable — fall back to locator.screenshot
			await loc.screenshot({
				path: file,
				animations: 'disabled',
				...playwrightFormatOptions(format),
			});
			const meta = await sharp(file).metadata();
			if (!meta.width || !meta.height) {
				throw new Error('unstable element');
			}
			capturedSections.push({
				id: section.id,
				file,
				width: meta.width,
				height: meta.height,
			});
			return;
		}
		const boundedClip = {
			x: Math.min(clip.x, Math.max(0, clip.docWidth - 1)),
			y: Math.min(clip.y, Math.max(0, clip.docHeight - 1)),
			width: Math.min(clip.width, Math.max(1, clip.docWidth - clip.x)),
			height: Math.min(clip.height, Math.max(1, clip.docHeight - clip.y)),
		};
		if (boundedClip.width <= 0 || boundedClip.height <= 0) {
			throw new Error('clip outside page bounds');
		}

		const restoreOverlays = section.keepHeader ? null : await hideFixedOverlaysForCapture(page);
		try {
			try {
				await page.screenshot({
					path: file,
					clip: boundedClip,
					...playwrightFormatOptions(format),
				});
			} catch (screenshotErr) {
				const msg =
					screenshotErr instanceof Error ? screenshotErr.message : String(screenshotErr);
				if (!msg.includes('Clipped area is either empty or outside the resulting image')) {
					throw screenshotErr;
				}
				// Clip failed (2x DPR / complex CSS issue) — fall back to locator.screenshot with animations disabled
				await loc.screenshot({
					path: file,
					animations: 'disabled',
					...playwrightFormatOptions(format),
				});
			}
		} finally {
			if (restoreOverlays) await restoreOverlays();
		}

		const meta = await sharp(file).metadata();
		if (!meta.width || !meta.height) {
			skipped.push(`${section.id} (empty)`);
			return;
		}
		capturedSections.push({
			id: section.id,
			file,
			width: meta.width,
			height: meta.height,
		});
	} catch (err) {
		const reason = describeStitchFailure(err);
		console.warn(
			`  ⚠ Stitch: section "${section.id}" failed after ${formatDuration(stitchTimeoutMs)} — ${reason}`,
		);
		failedSections.push(`${section.id}: ${reason}`);
	}
}

/**
 * Stitch a landing `02-full-page` capture from per-section element screenshots.
 *
 * Playwright's native `fullPage: true` mis-stitches landing captures on
 * mobile/tablet because the landing sets `body { overflow-y: auto }`, making
 * <body> the scroll container instead of <html>. Stitching individual section
 * element captures sidesteps the scroll-container issue entirely and also lets
 * us hide fixed overlays (`.header-base`, back-to-top, etc.) for every section
 * after the hero.
 *
 * Each section is captured as an element screenshot (its bounding box). Sections
 * are then concatenated vertically with sharp. Sections missing from the DOM
 * are skipped with a warning; they do not fail the run. The first section
 * (hero) is captured with the header visible to match `01-viewport`. All
 * subsequent sections are captured with fixed overlays hidden.
 */
export async function captureLandingStitchedFullPage(
	page: Page,
	outputPath: string,
	format: OutputFormat,
): Promise<CaptureResult> {
	const label = pathLabel(outputPath);
	const tmpDir = path.join(path.dirname(outputPath), '.stitch-tmp');
	await fs.promises.mkdir(tmpDir, { recursive: true });

	const capturedSections: Array<{ id: string; file: string; width: number; height: number }> = [];
	const skipped: string[] = [];
	const failedSections: string[] = [];
	const stitchTimeoutMs = 2_000;

	for (const section of LANDING_FULLPAGE_SECTIONS) {
		await captureSingleSectionForStitch(
			page,
			section,
			tmpDir,
			format,
			stitchTimeoutMs,
			capturedSections,
			skipped,
			failedSections,
		);
	}

	if (skipped.length > 0) {
		console.warn(`  ⚠ Stitch: skipped sections: ${skipped.join(', ')}`);
	}

	if (failedSections.length > 0) {
		console.warn(
			`  ⚠ Stitch failed for ${failedSections.length} section(s). Falling back to native fullPage screenshot.`,
		);
		const fallback = await captureFullPage(page, outputPath, format);
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		return {
			...fallback,
			fallback: 'native-full-page',
			stitchFailures: failedSections,
		};
	}

	if (capturedSections.length === 0) {
		// Nothing captured — let Playwright try native fullPage as a last resort.
		console.warn('  ⚠ Stitch: no sections captured, falling back to native fullPage.');
		const fallback = await captureFullPage(page, outputPath, format);
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		return {
			...fallback,
			fallback: 'native-full-page',
		};
	}

	// All section captures share the viewport width (Playwright element
	// screenshots are at device pixel ratio). Use the widest captured width
	// as the canvas width and left-align every section.
	const canvasWidth = capturedSections.reduce((max, s) => Math.max(max, s.width), 0);
	const canvasHeight = capturedSections.reduce((sum, s) => sum + s.height, 0);

	// Resize any section narrower than canvasWidth so they all align cleanly
	// (rare; happens if a section has negative left margin on a narrow viewport).
	const composites = await Promise.all(
		capturedSections.map(async (s, idx) => {
			let input: ReturnType<typeof sharp> = sharp(s.file);
			if (s.width !== canvasWidth) {
				input = input.resize({ width: canvasWidth });
			}
			const buf = await input.toBuffer();
			const top = capturedSections.slice(0, idx).reduce((sum, p) => sum + p.height, 0);
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

	// Clean up temp dir.
	await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

	console.log(
		`  ✓ Stitched full-page from ${capturedSections.length} sections (skipped: ${skipped.length})`,
	);

	return {
		path: outputPath,
		viewportName: '',
		label,
		success: true,
	};
}
