// =============================================================================
// CELEBRA-ME | Screenshot Tool — Playwright Capture Functions
// =============================================================================
/* eslint-disable max-lines -- Screenshot orchestration is intentionally centralized for CLI maintainability. */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import {
	type Viewport,
	type ScreenshotJob,
	type OutputFormat,
	type CaptureResult,
	type ScreenshotMode,
	type ScreenshotSelectorConfig,
	KNOWN_INVITATION_SECTIONS,
	REVEAL_TRIGGER_TEXTS,
	DEFAULT_NAVIGATION_TIMEOUT,
	DEFAULT_NETWORK_IDLE_TIMEOUT,
	DEFAULT_ELEMENT_TIMEOUT,
	DEFAULT_IMAGE_TIMEOUT,
	DEFAULT_STABILITY_DELAY,
} from './types.js';
import {
	buildScreenshotPath,
	getAboveFoldCriticalSelector,
	getDefaultHideSelectors,
} from './utils.js';

// =============================================================================
// Browser Management
// =============================================================================

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
		id: 'event-types',
		selector: '[data-screenshot="landing-event-types"], #tipo-evento',
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
	{ id: 'about', selector: '[data-screenshot="landing-essence"], #nosotros', keepHeader: false },
	{
		id: 'how-it-works',
		selector: '[data-screenshot="landing-process"], #como-funciona',
		keepHeader: false,
	},
	{ id: 'pricing', selector: '[data-screenshot="landing-pricing"], #pricing', keepHeader: false },
	{
		id: 'testimonials',
		selector: '[data-screenshot="landing-testimonials"], #testimonios',
		keepHeader: false,
	},
	{ id: 'faq', selector: '[data-screenshot="landing-faq"], #faq-section', keepHeader: false },
	{
		id: 'contact',
		selector: '[data-screenshot="landing-contact"], #contacto',
		keepHeader: false,
	},
	{ id: 'footer', selector: '[data-screenshot="landing-footer"], footer', keepHeader: false },
];

/**
 * Launch a headless Chromium browser instance.
 */
export async function launchBrowser(): Promise<Browser> {
	return chromium.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
		],
	});
}

/**
 * Create a new browser context with the specified viewport.
 * Each context gets a clean storage state and viewport.
 */
export function createContext(browser: Browser, viewport: Viewport): Promise<BrowserContext> {
	return browser.newContext({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: viewport.deviceScaleFactor,
		locale: 'es-MX',
		timezoneId: 'America/Mexico_City',
		acceptDownloads: false,
	});
}

// =============================================================================
// Page Stability
// =============================================================================

/**
 * Wait for the page to reach a stable, render-complete state.
 *
 * Checks (in order):
 *  1. DOMContentLoaded
 *  2. Network idle (with timeout — non-blocking if page stays busy)
 *  3. Fonts loaded  (document.fonts.ready)
 *  4. Visible images loaded
 *  5. Small settle delay for layout shifts
 */
export async function waitForPageStability(page: Page): Promise<void> {
	await page.waitForLoadState('domcontentloaded');

	// Best-effort network idle
	try {
		await page.waitForLoadState('networkidle', { timeout: DEFAULT_NETWORK_IDLE_TIMEOUT });
	} catch {
		// Page may be polling or using SSE — continue anyway
	}

	await waitForFonts(page);
	await waitForImages(page);

	// Small settle delay
	await page.waitForTimeout(DEFAULT_STABILITY_DELAY);
}

export async function waitForFonts(page: Page): Promise<void> {
	try {
		await page.evaluate(() => document.fonts.ready);
	} catch {
		// Font loading failed — validation reports the final state later.
	}
}

export async function waitForImages(page: Page): Promise<void> {
	try {
		await page.evaluate((timeoutMs) => {
			const images = Array.from(document.querySelectorAll('img'));
			return Promise.all(
				images.map(
					(img) =>
						new Promise<void>((resolve) => {
							if (img.complete && img.naturalWidth > 0) {
								resolve();
								return;
							}

							const handler = () => {
								resolve();
							};
							img.addEventListener('load', handler, { once: true });
							img.addEventListener('error', handler, { once: true });
							setTimeout(resolve, timeoutMs);
						}),
				),
			);
		}, DEFAULT_IMAGE_TIMEOUT);
	} catch {
		// Image loading failures are classified by validation.
	}
}

/**
 * Scroll through the page to trigger lazy loading, then return to top.
 */
export async function scrollForLazyLoad(page: Page): Promise<void> {
	try {
		await page.evaluate(async () => {
			let previousHeight = 0;

			for (let pass = 0; pass < 3; pass++) {
				const scrollHeight = Math.max(
					document.body.scrollHeight,
					document.documentElement.scrollHeight,
				);
				const viewportHeight = window.innerHeight;
				const stepSize = Math.max(250, Math.floor(viewportHeight * 0.75));

				for (let y = 0; y <= scrollHeight; y += stepSize) {
					window.scrollTo(0, y);
					await new Promise((r) => setTimeout(r, 180));
				}

				window.scrollTo(0, scrollHeight);
				await new Promise((r) => setTimeout(r, 250));

				const nextHeight = Math.max(
					document.body.scrollHeight,
					document.documentElement.scrollHeight,
				);
				if (Math.abs(nextHeight - previousHeight) < 2) break;
				previousHeight = nextHeight;
			}

			window.scrollTo(0, 0);
		});
		await waitForImages(page);
		await waitForLayoutHeightStable(page);
	} catch {
		// Scroll failed — continue
	}
}

export async function waitForLayoutHeightStable(page: Page): Promise<void> {
	try {
		await page.waitForFunction(
			async () => {
				const readHeight = () =>
					Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
				const first = readHeight();
				await new Promise((resolve) => setTimeout(resolve, 250));
				const second = readHeight();
				await new Promise((resolve) => setTimeout(resolve, 250));
				const third = readHeight();
				return Math.abs(first - second) < 2 && Math.abs(second - third) < 2;
			},
			{ timeout: 5000 },
		);
	} catch {
		// Reported later as document height metadata; do not block capture forever.
	}
}

// =============================================================================
// Animation Handling
// =============================================================================

/**
 * Inject CSS to disable all CSS animations, transitions, and smooth scroll.
 */
export async function disableAnimations(page: Page): Promise<void> {
	await page.addStyleTag({
		content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
	});
	await page.waitForTimeout(100);
}

export async function prepareAuditPage(
	page: Page,
	criticalSelectors: ScreenshotSelectorConfig[],
	hideSelectors: string[] = [],
): Promise<void> {
	await page.evaluate(() => {
		document.documentElement.dataset.screenshot = 'audit';
		document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
			img.loading = 'eager';
		});
	});
	await waitForPageStability(page);
	await scrollForLazyLoad(page);
	await waitForLayoutHeightStable(page);
	await storePreNormalizationSelectorState(page, criticalSelectors);
	await normalizeForAudit(page);
	await normalizeOperationalOverlaysForAudit(page, hideSelectors);
	await disableAnimations(page);
	await page.waitForTimeout(100);
}

export async function prepareRawPage(page: Page): Promise<void> {
	await waitForPageStability(page);
}

async function storePreNormalizationSelectorState(
	page: Page,
	criticalSelectors: ScreenshotSelectorConfig[],
): Promise<void> {
	await page.evaluate((selectors) => {
		const state: Record<string, boolean> = {};
		for (const selector of selectors) {
			const element = document.querySelector(selector.selector);
			if (!element) {
				state[selector.selector] = false;
				continue;
			}
			const style = window.getComputedStyle(element);
			const box = element.getBoundingClientRect();
			state[selector.selector] =
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity || '1') > 0.01 &&
				!style.filter.includes('blur') &&
				box.width > 0 &&
				box.height > 0;
		}
		(
			window as Window & {
				__screenshotPreNormalizationVisibility?: Record<string, boolean>;
			}
		).__screenshotPreNormalizationVisibility = state;
	}, criticalSelectors);
}

async function normalizeForAudit(page: Page): Promise<void> {
	await page.addStyleTag({
		content: `
      html[data-screenshot='audit'] .has-motion,
      html[data-screenshot='audit'] .animate-on-scroll,
      html[data-screenshot='audit'] .stagger-container,
      html[data-screenshot='audit'] [data-screenshot-section],
      html[data-screenshot='audit'] [data-screenshot='invitation-open-hero'],
      html[data-screenshot='audit'] [data-screenshot='invitation-open-content'],
      html[data-screenshot='audit'] [data-screenshot^='landing-'] {
        opacity: 1 !important;
        visibility: visible !important;
        filter: none !important;
        transform: none !important;
      }

      html[data-screenshot='audit'] .has-motion,
      html[data-screenshot='audit'] .animate-on-scroll,
      html[data-screenshot='audit'] .stagger-container,
      html[data-screenshot='audit'] .stagger-container > * {
        transition-delay: 0s !important;
        animation-delay: 0s !important;
      }
    `,
	});
	await page.evaluate(() => {
		const revealSelectors = [
			'.has-motion',
			'.animate-on-scroll',
			'.stagger-container',
			'[data-screenshot-section]',
			'[data-screenshot^="landing-"] .pricing-card',
		];
		for (const selector of revealSelectors) {
			document.querySelectorAll(selector).forEach((element) => {
				element.classList.add('is-visible', 'animate-visible');
			});
		}
	});
}

async function normalizeOperationalOverlaysForAudit(
	page: Page,
	hideSelectors: string[],
): Promise<void> {
	const selectors = Array.from(new Set([...getDefaultHideSelectors(), ...hideSelectors]));
	const selectorText = selectors.join(',\n      ');

	await page.addStyleTag({
		content: `
      html[data-screenshot='audit'] :is(
        ${selectorText}
      ) {
        display: none !important;
      }
    `,
	});

	await page.evaluate((normalizedSelectors) => {
		const state =
			(
				window as Window & {
					__screenshotAuditNormalizations?: string[];
				}
			).__screenshotAuditNormalizations ?? [];
		state.push(
			'Operational overlays normalized for audit screenshots: local consent decision is set before navigation; configured hide selectors are hidden only while html[data-screenshot="audit"] is active.',
		);
		for (const selector of normalizedSelectors) {
			if (document.querySelector(selector)) {
				state.push(`Audit hide selector matched: ${selector}`);
			}
		}
		(
			window as Window & {
				__screenshotAuditNormalizations?: string[];
			}
		).__screenshotAuditNormalizations = Array.from(new Set(state));
	}, selectors);
}

// =============================================================================
// URL & Navigation
// =============================================================================

/**
 * Build a screenshot-mode URL by adding query parameters.
 * Merges with any existing query params on the URL.
 */
export function buildScreenshotUrl(baseUrl: string, revealState?: 'open' | 'closed'): string {
	const url = new URL(baseUrl);
	url.searchParams.set('screenshot', '1');
	if (revealState) {
		url.searchParams.set('reveal', revealState);
	}
	return url.toString();
}

/**
 * Navigate to a URL and wait for the page to stabilise.
 */
export async function navigateTo(
	page: Page,
	url: string,
	mode: ScreenshotMode,
	animationHandling: string,
	criticalSelectors: ScreenshotSelectorConfig[] = [],
	hideSelectors: string[] = [],
): Promise<void> {
	if (mode === 'audit') {
		await page.addInitScript(() => {
			if (document.documentElement) {
				document.documentElement.dataset.screenshot = 'audit';
			}
			try {
				localStorage.setItem(
					'cm_consent',
					JSON.stringify({
						necessary: true,
						analytics: false,
						marketing: false,
						updatedAt: new Date(0).toISOString(),
					}),
				);
			} catch {
				// localStorage may be unavailable in unusual browser contexts.
			}
		});
	}

	await page.goto(url, {
		waitUntil: 'domcontentloaded',
		timeout: DEFAULT_NAVIGATION_TIMEOUT,
	});

	if (mode === 'audit') {
		await prepareAuditPage(page, criticalSelectors, hideSelectors);
		return;
	}

	await prepareRawPage(page);
	if (animationHandling === 'disable') {
		await disableAnimations(page);
	}
}

// =============================================================================
// Reveal Section Detection & Interaction
// =============================================================================

/**
 * Find the reveal section element using data attributes.
 * Returns the selector string, or null if not found.
 */
async function findRevealSection(page: Page): Promise<string | null> {
	const selectors = [
		'[data-screenshot="reveal-section"]',
		'[data-screenshot="invitation-container"]',
		'.reveal-section',
		'.invitation-reveal',
	];

	for (const sel of selectors) {
		try {
			const count = await page.locator(sel).count();
			if (count > 0) return sel;
		} catch {
			continue;
		}
	}
	return null;
}

/**
 * Find the reveal trigger button/link using data attributes and text fallbacks.
 * Returns the selector string, or null if not found.
 */
async function findRevealTrigger(page: Page): Promise<string | null> {
	// Priority 1: data attribute
	try {
		const count = await page.locator('[data-screenshot="reveal-trigger"]').count();
		if (count > 0) return '[data-screenshot="reveal-trigger"]';
	} catch {
		// Selector/parsing failed — skip
	}

	// Priority 2: text content matching
	for (const text of REVEAL_TRIGGER_TEXTS) {
		try {
			// Try case-insensitive text matching with has-text
			const locator = page
				.getByRole('button')
				.or(page.getByRole('link'))
				.filter({ hasText: new RegExp(text, 'i') });
			const count = await locator.count();
			if (count > 0) {
				// Return generic selector: first match
				return `text=${text}`;
			}
		} catch {
			// Locator or selector failed — skip
		}
	}

	// Priority 3: generic text match on any element
	for (const text of REVEAL_TRIGGER_TEXTS) {
		try {
			const locator = page.locator(`:has-text("${text}")`).first();
			const count = await locator.count();
			if (count > 0) return `:has-text("${text}")`;
		} catch {
			// Locator or selector failed — skip
		}
	}

	return null;
}

/**
 * Find the reveal letter/card content element.
 * Returns the selector, or null if not found.
 */
async function findRevealLetter(page: Page): Promise<string | null> {
	const selectors = [
		'[data-screenshot="reveal-letter"]',
		'[data-screenshot="invitation-letter"]',
		'.reveal-letter',
		'.invitation-card',
		'.letter-content',
	];

	for (const sel of selectors) {
		try {
			const count = await page.locator(sel).count();
			if (count > 0) return sel;
		} catch {
			continue;
		}
	}
	return null;
}

/**
 * Try to open the reveal section by clicking the trigger.
 * Returns true if the reveal was triggered, false otherwise.
 */
async function openRevealSection(page: Page): Promise<boolean> {
	const trigger = await findRevealTrigger(page);
	if (!trigger) return false;

	try {
		// Try to click the trigger
		const locator = trigger.startsWith('text=')
			? page.getByText(new RegExp(trigger.replace('text=', ''), 'i')).first()
			: page.locator(trigger).first();

		await locator.waitFor({ state: 'visible', timeout: DEFAULT_ELEMENT_TIMEOUT });
		await locator.click();
		// Wait for card visibility
		await page.waitForFunction(
			() => {
				const card = document.querySelector('[data-envelope-card]');
				if (!card) return true;
				return window.getComputedStyle(card).visibility !== 'hidden';
			},
			{ timeout: 5000 },
		);
		return true;
	} catch (err) {
		console.warn(`  ⚠ Could not click reveal trigger: ${err}`);
		return false;
	}
}

/**
 * Try to open the reveal section using the server-side query param approach first,
 * falling back to click automation if the page doesn't support screenshot mode.
 * Logs detailed diagnostic information on failure.
 */
async function tryOpenReveal(
	page: Page,
	url: string,
	mode: ScreenshotMode,
	animationHandling: string,
	closedUrl: string,
	revealMode: string,
	criticalSelectors: ScreenshotSelectorConfig[] = [],
	hideSelectors: string[] = [],
): Promise<boolean> {
	const openUrl = buildScreenshotUrl(url, 'open');
	console.log(`  ℹ Navigating (open via query param): ${openUrl}`);
	await navigateTo(page, openUrl, mode, animationHandling, criticalSelectors, hideSelectors);
	await page.waitForTimeout(500);
	await scrollForLazyLoad(page);

	const isOpen = await checkRevealIsOpen(page);
	if (isOpen) {
		console.log('  ✓ Reveal opened via ?screenshot=1&reveal=open (server-side previewState)');
		return true;
	}

	if (revealMode === 'auto') {
		console.log('  ℹ Query-param state not supported — trying click automation...');
		await navigateTo(
			page,
			closedUrl,
			mode,
			animationHandling,
			criticalSelectors,
			hideSelectors,
		);
		await page.waitForTimeout(300);
		await scrollForLazyLoad(page);
		const clicked = await openRevealSection(page);
		if (!clicked) {
			const triggerFound = await findRevealTrigger(page);
			if (!triggerFound) {
				console.warn(
					'  ⚠ [skip 03/04/05] Cannot open reveal — no trigger found ([data-screenshot="reveal-trigger"] or text match)',
				);
			} else {
				console.warn(
					'  ⚠ [skip 03/04/05] Reveal trigger found but click did not open the section',
				);
			}
		}
		return clicked;
	}

	if (revealMode === 'force-open') {
		console.warn(
			'  ⚠ [skip 03/04/05] Query-param state not supported — page did not render with reveal=open',
		);
	}

	return false;
}

// =============================================================================
// Core Capture Functions
// =============================================================================

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
	const alreadyInjected = await page.evaluate(() => {
		return document.documentElement.hasAttribute('data-screenshot-overlay-hidden');
	});
	if (!alreadyInjected) {
		await page.addStyleTag({
			content: `
      html .header-base,
      html [data-back-to-top],
      html .back-to-top,
      html .scroll-to-top,
      html .action-icon--scroll,
      html .action-icon--fixed-bottom-right {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `,
		});
		await page.evaluate(() => {
			document.documentElement.setAttribute('data-screenshot-overlay-hidden', '1');
		});
	}
	// Wait for any in-flight smooth scroll to settle so addStyleTag (or any
	// later evaluate) does not race the navigation event.
	await page.waitForTimeout(50);
	return async () => {
		// No per-call state to roll back. The overlay style stays in place for
		// the rest of the page session; it is intentionally not removed so we
		// do not have to re-inject on every capture.
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
			...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
			...(format === 'webp' ? { type: 'png' } : {}), // webp via fullPage PNG
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

	for (const section of LANDING_FULLPAGE_SECTIONS) {
		const loc = page.locator(section.selector).first();
		const count = await loc.count().catch(() => 0);
		if (count === 0) {
			skipped.push(section.id);
			continue;
		}

		const visible = await loc
			.evaluate((el) => {
				const r = (el as HTMLElement).getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			})
			.catch(() => false);
		if (!visible) {
			skipped.push(section.id);
			continue;
		}

		const file = path.join(tmpDir, `${section.id}.png`);
		try {
			await loc.scrollIntoViewIfNeeded();
			await page.waitForTimeout(150);

			const restoreOverlays = section.keepHeader
				? null
				: await hideFixedOverlaysForCapture(page);
			try {
				await loc.screenshot({
					path: file,
					...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
					...(format === 'webp' ? { type: 'png' } : {}),
				});
			} finally {
				if (restoreOverlays) await restoreOverlays();
			}

			const meta = await sharp(file).metadata();
			if (!meta.width || !meta.height) {
				skipped.push(`${section.id} (empty)`);
				continue;
			}
			capturedSections.push({
				id: section.id,
				file,
				width: meta.width,
				height: meta.height,
			});
		} catch (err) {
			console.warn(`  ⚠ Stitch: section "${section.id}" failed: ${err}`);
			skipped.push(`${section.id} (error)`);
		}
	}

	if (skipped.length > 0) {
		console.warn(`  ⚠ Stitch: skipped sections: ${skipped.join(', ')}`);
	}

	if (capturedSections.length === 0) {
		// Nothing captured — let Playwright try native fullPage as a last resort.
		console.warn('  ⚠ Stitch: no sections captured, falling back to native fullPage.');
		const fallback = await captureFullPage(page, outputPath, format);
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		return fallback;
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
		...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
		...(format === 'webp' ? { type: 'png' } : {}),
	});

	return {
		path: outputPath,
		viewportName: '',
		label: pathLabel(outputPath),
		success: true,
	};
}

async function resetScrollAndAssertAboveFold(page: Page, selector: string): Promise<void> {
	await page.evaluate(() => {
		window.scrollTo(0, 0);
	});
	await page.waitForFunction(() => Math.abs(window.scrollY) <= 1, { timeout: 3000 });
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
 */
export async function captureElement(
	page: Page,
	selector: string,
	outputPath: string,
	format: OutputFormat,
	opts: { hideOverlays?: boolean } = {},
): Promise<CaptureResult | null> {
	const label = pathLabel(outputPath);
	const { hideOverlays = true } = opts;

	try {
		const locator = page.locator(selector).first();
		const count = await locator.count();

		if (count === 0) {
			console.warn(`  ⚠ Element not found: ${selector} — skipping`);
			return null;
		}

		await locator.waitFor({ state: 'visible', timeout: DEFAULT_ELEMENT_TIMEOUT });
		await locator.scrollIntoViewIfNeeded();
		await page.waitForTimeout(200);

		const restoreOverlays = hideOverlays ? await hideFixedOverlaysForCapture(page) : null;
		try {
			await locator.screenshot({
				path: outputPath,
				...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
				...(format === 'webp' ? { type: 'png' } : {}),
			});
		} finally {
			if (restoreOverlays) await restoreOverlays();
		}

		return {
			path: outputPath,
			viewportName: '',
			label,
			success: true,
		};
	} catch (err) {
		console.warn(`  ⚠ Could not capture element "${selector}": ${err}`);
		return null;
	}
}

// =============================================================================
// Capture Orchestration — Invitations
// =============================================================================

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
async function validateDistinctReveal(results: CaptureResult[]): Promise<void> {
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
 * Capture the 05-invitation-full-open screenshot.
 *
 * Priority:
 *   1. [data-screenshot="invitation-open-hero"]       — real opened invitation hero
 *   2. [data-screenshot="invitation-commercial-hero"] — commercial/landing hero fallback
 *   3. [data-screenshot="invitation-hero"]            — legacy hero selector
 *   4. [data-screenshot="invitation-open-content"]    — starts at Hero, includes sections + footer
 *   5. [data-screenshot="invitation-content"]         — includes EventHeader + hero + sections
 *   6. [data-screenshot="invitation-root"]            — full page (may include reveal section)
 *
 * Logs a warning at each fallback.
 */
async function captureInvitationOpen(
	page: Page,
	outputDir: string,
	viewportName: string,
	format: OutputFormat,
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];

	const targets = [
		{ selector: '[data-screenshot="invitation-open-hero"]', label: 'invitation-open-hero' },
		{
			selector: '[data-screenshot="invitation-open-content"]',
			label: 'invitation-open-content',
		},
		{ selector: '[data-screenshot="invitation-content"]', label: 'invitation-content' },
		{ selector: '[data-screenshot="invitation-root"]', label: 'invitation-root' },
	];

	let chosenSelector: string | null = null;
	let chosenLabel = '';

	for (const t of targets) {
		const count = await page.locator(t.selector).count();
		if (count > 0) {
			chosenSelector = t.selector;
			chosenLabel = t.label;
			break;
		}
		if (t.label !== targets[targets.length - 1].label) {
			console.warn(`  ⚠ [WARN] ${t.label} target not found; checking next target.`);
		}
	}

	if (!chosenSelector) {
		console.warn('  ⚠ [WARN] No screenshot target found — skipping 05.');
		return results;
	}

	const legacyHeroInfo = await page.evaluate(() => {
		const hero = document.querySelector('[data-screenshot="invitation-hero"]');
		if (!hero) return null;

		return {
			text: (hero.textContent ?? '').replace(/\s+/g, ' ').trim(),
			hasImage: Boolean(hero.querySelector('img')),
		};
	});

	if (chosenLabel === 'invitation-hero' && legacyHeroInfo) {
		const rawBounds = await page.evaluate((sel) => {
			const el = document.querySelector(sel);
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { height: rect.height, viewportHeight: window.innerHeight };
		}, chosenSelector);
		if (rawBounds && rawBounds.height < rawBounds.viewportHeight * 0.7) {
			console.warn(
				'  ⚠ [WARN] invitation-hero exists but appears to be the intro/name card (less than 70% viewport height), not the intended opened hero. Prefer invitation-open-hero.',
			);
		}
	}

	// Trigger lazy loading before capture
	await scrollForLazyLoad(page);
	await page.waitForTimeout(300);

	const fullOpenPath = await buildScreenshotPath(
		outputDir,
		viewportName,
		'05-invitation-full-open',
		format,
	);

	try {
		await page.evaluate((sel) => {
			if (!document.querySelector(sel)) return;
			const imgs = Array.from(
				document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'),
			);
			imgs.forEach((img) => {
				img.loading = 'eager';
			});
		}, chosenSelector);
		await page.waitForTimeout(500);

		const captureBounds = await page.evaluate((sel) => {
			const target = document.querySelector(sel);
			if (!target) return null;

			const rect = target.getBoundingClientRect();
			const doc = document.documentElement;
			const body = document.body;
			const y = Math.max(0, Math.floor(rect.top + window.scrollY));
			const width = Math.ceil(Math.max(doc.clientWidth, body.scrollWidth, doc.scrollWidth));
			const docHeight = Math.ceil(Math.max(body.scrollHeight, doc.scrollHeight));
			const height = Math.max(1, docHeight - y);

			return { x: 0, y, width, height };
		}, chosenSelector);

		if (!captureBounds) {
			throw new Error(`Target disappeared before capture: ${chosenSelector}`);
		}

		const restoreReveal = await page.evaluate(() => {
			const reveal = document.querySelector<HTMLElement>(
				'[data-screenshot="reveal-section"]',
			);
			if (!reveal) return null;

			const previousVisibility = reveal.style.visibility;
			reveal.style.setProperty('visibility', 'hidden', 'important');

			return { previousVisibility };
		});

		try {
			await page.waitForTimeout(100);
			const startsAtDocumentTop = captureBounds.y <= 1;
			await page.screenshot({
				path: fullOpenPath,
				...(startsAtDocumentTop ? { fullPage: true } : { clip: captureBounds }),
				...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
			});
		} finally {
			if (restoreReveal) {
				await page.evaluate((state) => {
					const reveal = document.querySelector<HTMLElement>(
						'[data-screenshot="reveal-section"]',
					);
					if (!reveal) return;

					if (state.previousVisibility) {
						reveal.style.visibility = state.previousVisibility;
					} else {
						reveal.style.removeProperty('visibility');
					}
				}, restoreReveal);
			}
		}

		results.push({
			path: fullOpenPath,
			viewportName,
			label: 'Full invitation (open)',
			success: true,
		});
		console.log(`  ✓ Captured: 05-invitation-full-open (${viewportName}) [via ${chosenLabel}]`);
	} catch (err) {
		console.warn(`  ⚠ Failed to capture 05 open page: ${err}`);
		results.push({
			path: fullOpenPath,
			viewportName,
			label: 'Full invitation (open)',
			success: false,
			error: String(err),
		});
	}

	return results;
}

/**
 * Navigate, detect, and capture invitation screenshots for one viewport.
 *
 * Output files (when found):
 *   01-initial-full-page
 *   02-reveal-section-closed
 *   03-reveal-letter-open
 *   04-reveal-section-open
 *   05-invitation-full-open
 *   (06-section-{name} for full QA)
 */
export async function captureInvitationScreenshots(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;
	const revealMode = job.revealHandling ?? 'auto';

	// ── STEP 1: Navigate (closed state first) ──────────────────────────────
	const closedUrl = buildScreenshotUrl(job.url, 'closed');
	console.log(`  ℹ Navigating (closed): ${closedUrl}`);
	await navigateTo(
		page,
		closedUrl,
		job.mode,
		job.animationHandling,
		job.criticalSelectors,
		job.hideSelectors,
	);

	// Wait for custom element initialization
	await page.waitForTimeout(300);
	await scrollForLazyLoad(page);

	// Check if reveal section exists in the DOM
	const hasRevealSection = await findRevealSection(page);
	if (!hasRevealSection) {
		console.warn(
			'  ⚠ [skip 02/04] [data-screenshot="reveal-section"] not found — page has no envelope reveal',
		);
	}

	// 01 — Initial full page (closed state)
	const initialPath = await buildScreenshotPath(
		outputDir,
		viewportName,
		'01-initial-full-page',
		format,
	);
	try {
		const result = await captureFullPage(page, initialPath, format);
		result.viewportName = viewportName;
		result.label = 'Initial full page';
		results.push(result);
		console.log(`  ✓ Captured: 01-initial-full-page (${viewportName})`);
	} catch (err) {
		console.warn(`  ⚠ Failed to capture initial full page: ${err}`);
		results.push({
			path: initialPath,
			viewportName,
			label: 'Initial full page',
			success: false,
			error: String(err),
		});
	}

	// ── STEP 2: Closed reveal section ──────────────────────────────────────
	if (revealMode !== 'open-only') {
		const revealSelector = await findRevealSection(page);
		if (revealSelector) {
			const revealClosedPath = await buildScreenshotPath(
				outputDir,
				viewportName,
				'02-reveal-section-closed',
				format,
			);
			const result = await captureElement(page, revealSelector, revealClosedPath, format);
			if (result) {
				result.viewportName = viewportName;
				result.label = 'Reveal section (closed)';
				results.push(result);
				console.log(`  ✓ Captured: 02-reveal-section-closed (${viewportName})`);
			}
		} else {
			console.warn(
				'  ⚠ [skip 02] Reveal section not found — missing [data-screenshot="reveal-section"] attribute',
			);
		}
	}

	// ── STEP 3: Open the reveal ────────────────────────────────────────────
	let revealOpened = false;
	if (revealMode === 'auto' || revealMode === 'force-open' || revealMode === 'open-only') {
		revealOpened = await tryOpenReveal(
			page,
			job.url,
			job.mode,
			job.animationHandling,
			closedUrl,
			revealMode,
			job.criticalSelectors,
			job.hideSelectors,
		);
	}

	// ── STEP 4: Open letter/card ───────────────────────────────────────────
	if (revealOpened) {
		const letterSelector = await findRevealLetter(page);
		if (letterSelector) {
			const letterPath = await buildScreenshotPath(
				outputDir,
				viewportName,
				'03-reveal-letter-open',
				format,
			);
			const result = await captureElement(page, letterSelector, letterPath, format);
			if (result) {
				result.viewportName = viewportName;
				result.label = 'Reveal letter (open)';
				results.push(result);
				console.log(`  ✓ Captured: 03-reveal-letter-open (${viewportName})`);
			}
		} else {
			console.warn(
				'  ⚠ [skip 03] No reveal letter element found — missing [data-screenshot="reveal-letter"] attribute',
			);
		}

		// ── STEP 5: Open reveal section ──────────────────────────────────────
		const revealSelector = await findRevealSection(page);
		if (revealSelector) {
			const revealOpenPath = await buildScreenshotPath(
				outputDir,
				viewportName,
				'04-reveal-section-open',
				format,
			);
			const result = await captureElement(page, revealSelector, revealOpenPath, format);
			if (result) {
				result.viewportName = viewportName;
				result.label = 'Reveal section (open)';
				results.push(result);
				console.log(`  ✓ Captured: 04-reveal-section-open (${viewportName})`);
			}
		}

		validateDistinctReveal(results);

		// ── STEP 6: Full page after reveal ───────────────────────────────────
		// Prefer invitation-content (excludes the reveal section) via element capture
		// Fallback: use full-page screenshot (may include reveal section)
		const fullOpenResult = await captureInvitationOpen(page, outputDir, viewportName, format);
		results.push(...fullOpenResult);
	} else if (revealMode !== 'closed-only' && revealMode !== 'skip') {
		console.log('  ℹ [skip 03/04/05] Reveal was not opened — skipping open-state screenshots');
	}

	// ── Individual sections (full QA) ─────────────────────────────────────
	const sectionResults = await captureSectionsForJob(page, job, outputDir, viewportName);
	results.push(...sectionResults);
	results.push(...(await captureCriticalSelectorSections(page, job, outputDir, viewportName)));

	return results;
}

// =============================================================================
// Capture Orchestration — General Pages
// =============================================================================

/**
 * Capture screenshots for a general page (landing, dashboard, login, custom).
 *
 * Output files:
 *   01-viewport
 *   02-full-page
 *   (03-header, 04-main, 05-footer for full QA)
 *   (06-section-{name} for full QA with sections)
 */
export async function captureGeneralPageScreenshots(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;
	const screenshotSet = job.generalSet ?? 'basic';

	// Navigate
	const pageUrl = buildScreenshotUrl(job.url);
	await navigateTo(
		page,
		pageUrl,
		job.mode,
		job.animationHandling,
		job.criticalSelectors,
		job.hideSelectors,
	);

	// ── 01: Viewport screenshot ────────────────────────────────────────────
	const viewportPath = await buildScreenshotPath(outputDir, viewportName, '01-viewport', format);
	try {
		await resetScrollAndAssertAboveFold(page, getAboveFoldCriticalSelector(job.pageType));
		const result = await captureViewport(page, viewportPath, format);
		result.viewportName = viewportName;
		result.label = 'Viewport';
		results.push(result);
		console.log(`  ✓ Captured: 01-viewport (${viewportName})`);
	} catch (err) {
		console.warn(`  ⚠ Failed to capture viewport: ${err}`);
		results.push({
			path: viewportPath,
			viewportName,
			label: 'Viewport',
			success: false,
			error: String(err),
		});
	}

	// ── 02: Full page screenshot ───────────────────────────────────────────
	const fullPath = await buildScreenshotPath(outputDir, viewportName, '02-full-page', format);
	try {
		// Landing mobile/tablet stitching: native fullPage mis-stitches when
		// <body> is the scroll container (landing sets `body { overflow-y: auto }`),
		// producing a large blank white tail. For the landing page on any
		// viewport narrower than desktop, compose 02-full-page from per-section
		// element captures instead. Desktop keeps the native fullPage path
		// because it is the one viewport where it still works reliably.
		const pageViewport = page.viewportSize();
		const isLanding = job.pageType === 'landing';
		const isDesktop = pageViewport ? pageViewport.width >= 1280 : false;
		const useStitch = isLanding && !isDesktop;

		const result = useStitch
			? await captureLandingStitchedFullPage(page, fullPath, format)
			: await captureFullPage(page, fullPath, format);
		result.viewportName = viewportName;
		result.label = 'Full page';
		results.push(result);
		console.log(`  ✓ Captured: 02-full-page (${viewportName})`);
	} catch (err) {
		console.warn(`  ⚠ Failed to capture full page: ${err}`);
		results.push({
			path: fullPath,
			viewportName,
			label: 'Full page',
			success: false,
			error: String(err),
		});
	}

	// ── Full QA: Header, Main, Footer ──────────────────────────────────────
	if (screenshotSet === 'full-qa') {
		// Header — keep the header visible in this dedicated capture.
		const headerPath = await buildScreenshotPath(outputDir, viewportName, '03-header', format);
		const headerResult = await captureElement(
			page,
			'[data-screenshot="header"], header, .header',
			headerPath,
			format,
			{ hideOverlays: false },
		);
		if (headerResult) {
			headerResult.viewportName = viewportName;
			headerResult.label = 'Header';
			results.push(headerResult);
		}

		// Main content
		const mainPath = await buildScreenshotPath(outputDir, viewportName, '04-main', format);
		const mainResult = await captureElement(
			page,
			'[data-screenshot="main"], main, .main-content',
			mainPath,
			format,
		);
		if (mainResult) {
			mainResult.viewportName = viewportName;
			mainResult.label = 'Main';
			results.push(mainResult);
		}

		// Footer
		const footerPath = await buildScreenshotPath(outputDir, viewportName, '05-footer', format);
		const footerResult = await captureElement(
			page,
			'[data-screenshot="footer"], footer, .footer',
			footerPath,
			format,
		);
		if (footerResult) {
			footerResult.viewportName = viewportName;
			footerResult.label = 'Footer';
			results.push(footerResult);
		}

		// Sections (known or auto)
		const sectionResults = await captureSectionsForJob(page, job, outputDir, viewportName);
		results.push(...sectionResults);
	}
	results.push(...(await captureCriticalSelectorSections(page, job, outputDir, viewportName)));

	return results;
}

// =============================================================================
// Section Capture
// =============================================================================

/**
 * Capture known invitation sections from the KNOWN_INVITATION_SECTIONS list.
 */
async function captureKnownSections(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];
	let index = 6; // Start after standard screenshots

	for (const section of KNOWN_INVITATION_SECTIONS) {
		// Try the data attribute selector first
		let selector = section.selector;
		let found = await page.locator(selector).count();

		// Try fallback selectors
		if (found === 0) {
			for (const fallback of section.fallbackSelectors) {
				const count = await page.locator(fallback).count();
				if (count > 0) {
					selector = fallback;
					found = count;
					break;
				}
			}
		}

		if (found === 0) continue; // Skip missing sections

		const label = `${String(index).padStart(2, '0')}-section-${section.id}`;
		const sectionPath = await buildScreenshotPath(
			outputDir,
			viewportName,
			label,
			job.outputFormat,
		);
		const result = await captureElement(page, selector, sectionPath, job.outputFormat);

		if (result) {
			result.viewportName = viewportName;
			result.label = `Section: ${section.label}`;
			results.push(result);
			console.log(`  ✓ Captured: ${label} (${viewportName})`);
		}
		index++;
	}

	return results;
}

/**
 * Dispatch section capture based on the job's sectionCapture mode.
 */
async function captureSectionsForJob(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	if (job.sectionCapture === 'known' || job.sectionCapture === 'auto') {
		return captureKnownSections(page, job, outputDir, viewportName);
	}
	if (job.sectionCapture === 'custom' && job.sectionSelectors) {
		return captureCustomSections(page, job.sectionSelectors, job, outputDir, viewportName);
	}
	return [];
}

/**
 * Capture sections using custom CSS selectors.
 */
async function captureCustomSections(
	page: Page,
	selectors: string[],
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	const results: CaptureResult[] = [];
	let index = 6;

	for (const selector of selectors) {
		const safeName = selector.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
		const label = `${String(index).padStart(2, '0')}-section-${safeName}`;
		const sectionPath = await buildScreenshotPath(
			outputDir,
			viewportName,
			label,
			job.outputFormat,
		);
		const result = await captureElement(page, selector, sectionPath, job.outputFormat);

		if (result) {
			result.viewportName = viewportName;
			result.label = `Section: ${selector}`;
			results.push(result);
			console.log(`  ✓ Captured: ${label} (${viewportName})`);
		}
		index++;
	}

	return results;
}

async function captureCriticalSelectorSections(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<CaptureResult[]> {
	if (job.mode !== 'audit') return [];

	const results: CaptureResult[] = [];
	const selectors = job.criticalSelectors.filter((selector) => selector.capture);
	let index = 20;

	for (const selectorConfig of selectors) {
		const safeName = (selectorConfig.label ?? selectorConfig.selector)
			.replace(/[^a-zA-Z0-9_-]/g, '_')
			.slice(0, 40);
		const label = `${String(index).padStart(2, '0')}-critical-${safeName}`;
		const sectionPath = await buildScreenshotPath(
			outputDir,
			viewportName,
			label,
			job.outputFormat,
		);
		const result = await captureElement(
			page,
			selectorConfig.selector,
			sectionPath,
			job.outputFormat,
		);

		if (result) {
			result.viewportName = viewportName;
			result.label = `Critical: ${selectorConfig.label ?? selectorConfig.selector}`;
			results.push(result);
			console.log(`  ✓ Captured: ${label} (${viewportName})`);
		}
		index++;
	}

	return results;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if the reveal section appears to be in an "open" state.
 * Looks for data attributes, CSS classes, or visible card/letter content.
 */
async function checkRevealIsOpen(page: Page): Promise<boolean> {
	try {
		// eslint-disable-next-line complexity -- Supports standard envelope, editorial cover, and legacy reveal states.
		const result = await page.evaluate(() => {
			const section = document.querySelector('[data-screenshot="reveal-section"]');
			if (!section) {
				const openContent = document.querySelector(
					'[data-screenshot="invitation-open-content"]',
				);
				if (openContent) {
					const style = window.getComputedStyle(openContent);
					const box = openContent.getBoundingClientRect();
					return (
						style.display !== 'none' &&
						style.visibility !== 'hidden' &&
						Number.parseFloat(style.opacity || '1') > 0.01 &&
						box.width > 0 &&
						box.height > 0
					);
				}
				return false;
			}

			// Check data attribute (supports both 'open' and 'preview-opened')
			const state = section.getAttribute('data-reveal-state') || '';
			if (state === 'open' || state === 'revealed' || state === 'preview-opened') return true;

			// Check class (supports is-preview-opened for screenshot mode)
			if (section.classList.contains('is-preview-opened')) return true;
			if (section.classList.contains('open') || section.classList.contains('revealed'))
				return true;

			// Check aria-expanded on trigger
			const trigger = document.querySelector('[data-screenshot="reveal-trigger"]');
			if (trigger?.getAttribute('aria-expanded') === 'true') return true;

			// Check if the letter/card is actually visible in the layout
			const letter = document.querySelector('[data-screenshot="reveal-letter"]');
			if (letter) {
				const style = window.getComputedStyle(letter);
				const box = letter.getBoundingClientRect();
				return (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					style.opacity !== '0' &&
					box.height > 0 &&
					box.width > 0
				);
			}

			// Fallback: check html class
			// NOTE: "envelope-open" class is present when the envelope renderer has completed its open animation.
			return document.documentElement.classList.contains('envelope-open') === false;
		});
		return result;
	} catch {
		return false;
	}
}

/**
 * Extract a human-readable label from a file path for reporting.
 */
function pathLabel(filepath: string): string {
	const parts = filepath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1];
}
