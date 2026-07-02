// =============================================================================
// CELEBRA-ME | Screenshot Tool — Playwright Capture Functions
// =============================================================================
// eslint-disable max-lines

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import {
	type Viewport,
	type ScreenshotJob,
	type OutputFormat,
	type CaptureResult,
	KNOWN_INVITATION_SECTIONS,
	REVEAL_TRIGGER_TEXTS,
	DEFAULT_NAVIGATION_TIMEOUT,
	DEFAULT_NETWORK_IDLE_TIMEOUT,
	DEFAULT_ELEMENT_TIMEOUT,
	DEFAULT_STABILITY_DELAY,
} from './types.js';
import { buildScreenshotPath } from './utils.js';

// =============================================================================
// Browser Management
// =============================================================================

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

	// Wait for fonts
	try {
		await page.evaluate(() => document.fonts.ready);
	} catch {
		// Font loading failed — continue
	}

	// Wait for visible images to load
	try {
		await page.evaluate(() => {
			const images = Array.from(document.querySelectorAll('img'));
			return Promise.all(
				images.map(
					(img) =>
						new Promise<void>((resolve) => {
							if (img.complete) resolve();
							else {
								const handler = () => {
									resolve();
								};
								img.addEventListener('load', handler, { once: true });
								img.addEventListener('error', handler, { once: true });
								// Timeout per image
								setTimeout(resolve, 8000);
							}
						}),
				),
			);
		});
	} catch {
		// Image loading failed — continue
	}

	// Small settle delay
	await page.waitForTimeout(DEFAULT_STABILITY_DELAY);
}

/**
 * Scroll through the page to trigger lazy loading, then return to top.
 */
export async function scrollForLazyLoad(page: Page): Promise<void> {
	try {
		await page.evaluate(async () => {
			const scrollHeight = document.body.scrollHeight;
			const viewportHeight = window.innerHeight;
			const steps = Math.min(10, Math.ceil(scrollHeight / viewportHeight));
			const stepSize = scrollHeight / steps;

			for (let i = 0; i <= steps; i++) {
				window.scrollTo(0, i * stepSize);
				await new Promise((r) => setTimeout(r, 150));
			}
			// Return to top
			window.scrollTo(0, 0);
		});
		await page.waitForTimeout(300);
	} catch {
		// Scroll failed — continue
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
	animationHandling: string,
): Promise<void> {
	await page.goto(url, {
		waitUntil: 'domcontentloaded',
		timeout: DEFAULT_NAVIGATION_TIMEOUT,
	});

	if (animationHandling === 'disable') {
		await disableAnimations(page);
	}

	await waitForPageStability(page);
}

// =============================================================================
// Reveal Section Detection & Interaction
// =============================================================================

/**
 * Find the reveal section element using data attributes.
 * Returns the selector string, or null if not found.
 */
export async function findRevealSection(page: Page): Promise<string | null> {
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
export async function findRevealTrigger(page: Page): Promise<string | null> {
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
export async function findRevealLetter(page: Page): Promise<string | null> {
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
export async function openRevealSection(page: Page): Promise<boolean> {
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
		await page.waitForFunction(() => {
			const card = document.querySelector('[data-envelope-card]');
			if (!card) return true;
			return window.getComputedStyle(card).visibility !== 'hidden';
		}, { timeout: 5000 });
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
export async function tryOpenReveal(
	page: Page,
	url: string,
	animationHandling: string,
	closedUrl: string,
	revealMode: string,
): Promise<boolean> {
	const openUrl = buildScreenshotUrl(url, 'open');
	console.log(`  ℹ Navigating (open via query param): ${openUrl}`);
	await navigateTo(page, openUrl, animationHandling);
	await page.waitForTimeout(500);
	await scrollForLazyLoad(page);

	const isOpen = await checkRevealIsOpen(page);
	if (isOpen) {
		console.log('  ✓ Reveal opened via ?screenshot=1&reveal=open (server-side previewState)');
		return true;
	}

	if (revealMode === 'auto') {
		console.log('  ℹ Query-param state not supported — trying click automation...');
		await navigateTo(page, closedUrl, animationHandling);
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
 * Capture a full-page screenshot.
 */
export async function captureFullPage(
	page: Page,
	outputPath: string,
	format: OutputFormat,
): Promise<CaptureResult> {
	const fullPage = format === 'pdf' || format === 'png';

	await page.screenshot({
		path: outputPath,
		fullPage: fullPage,
		...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
		...(format === 'webp' ? { type: 'png' } : {}), // webp via fullPage PNG
	});

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

/**
 * Capture a specific element identified by a CSS selector.
 * Scrolling into view first. Does NOT hard-crash if the element is missing.
 */
export async function captureElement(
	page: Page,
	selector: string,
	outputPath: string,
	format: OutputFormat,
): Promise<CaptureResult | null> {
	const label = pathLabel(outputPath);

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

		await locator.screenshot({
			path: outputPath,
			...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
			...(format === 'webp' ? { type: 'png' } : {}),
		});

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
export async function captureInvitationOpen(
  page: Page,
  outputDir: string,
  viewportName: string,
  format: OutputFormat,
): Promise<CaptureResult[]> {
  const results: CaptureResult[] = [];

  const targets = [
    { selector: '[data-screenshot="invitation-open-hero"]',       label: 'invitation-open-hero' },
    { selector: '[data-screenshot="invitation-open-content"]',    label: 'invitation-open-content' },
    { selector: '[data-screenshot="invitation-content"]',         label: 'invitation-content' },
    { selector: '[data-screenshot="invitation-root"]',            label: 'invitation-root' },
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

  const fullOpenPath = await buildScreenshotPath(outputDir, viewportName, '05-invitation-full-open', format);

  try {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]'));
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
      const reveal = document.querySelector<HTMLElement>('[data-screenshot="reveal-section"]');
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
        ...(startsAtDocumentTop
          ? { fullPage: true }
          : { clip: captureBounds }),
        ...(format === 'jpeg' ? { type: 'jpeg', quality: 90 } : {}),
      });
    } finally {
      if (restoreReveal) {
        await page.evaluate((state) => {
          const reveal = document.querySelector<HTMLElement>('[data-screenshot="reveal-section"]');
          if (!reveal) return;

          if (state.previousVisibility) {
            reveal.style.visibility = state.previousVisibility;
          } else {
            reveal.style.removeProperty('visibility');
          }
        }, restoreReveal);
      }
    }

    results.push({ path: fullOpenPath, viewportName, label: 'Full invitation (open)', success: true });
    console.log(`  ✓ Captured: 05-invitation-full-open (${viewportName}) [via ${chosenLabel}]`);
  } catch (err) {
    console.warn(`  ⚠ Failed to capture 05 open page: ${err}`);
    results.push({ path: fullOpenPath, viewportName, label: 'Full invitation (open)', success: false, error: String(err) });
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
	await navigateTo(page, closedUrl, job.animationHandling);

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
			job.animationHandling,
			closedUrl,
			revealMode,
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
	await navigateTo(page, pageUrl, job.animationHandling);
	await scrollForLazyLoad(page);

	// ── 01: Viewport screenshot ────────────────────────────────────────────
	const viewportPath = await buildScreenshotPath(outputDir, viewportName, '01-viewport', format);
	try {
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
		const result = await captureFullPage(page, fullPath, format);
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
		// Header
		const headerPath = await buildScreenshotPath(outputDir, viewportName, '03-header', format);
		const headerResult = await captureElement(
			page,
			'[data-screenshot="header"], header, .header',
			headerPath,
			format,
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

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if the reveal section appears to be in an "open" state.
 * Looks for data attributes, CSS classes, or visible card/letter content.
 */
async function checkRevealIsOpen(page: Page): Promise<boolean> {
	try {
		const result = await page.evaluate(() => {
			const section = document.querySelector('[data-screenshot="reveal-section"]');
			if (!section) return false;

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
	return parts[parts.length - 1] ?? filepath;
}
