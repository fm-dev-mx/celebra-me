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
	KNOWN_SECTIONS,
	REVEAL_TRIGGER_TEXTS,
	DEFAULT_NAVIGATION_TIMEOUT,
	DEFAULT_NETWORK_IDLE_TIMEOUT,
	DEFAULT_ELEMENT_TIMEOUT,
	DEFAULT_IMAGE_TIMEOUT,
	DEFAULT_STABILITY_DELAY,
} from './types.js';
import {
	buildScreenshotPath,
	formatDuration,
	getAboveFoldCriticalSelector,
	getDefaultHideSelectors,
	playwrightFormatOptions,
} from './utils.js';

export interface CaptureTask {
	id: string;
	label: string;
	type:
		| 'viewport'
		| 'full-page'
		| 'header'
		| 'main'
		| 'footer'
		| 'critical'
		| 'section'
		| 'invitation-step';
	selector?: string;
	fallbackSelectors?: string[];
	invitationStep?:
		| 'initial-full-page'
		| 'reveal-closed'
		| 'reveal-letter-open'
		| 'reveal-open'
		| 'full-open';
}

export function getPlannedCaptureLabel(id: string): string {
	return id.replace(/^\d+-/, '');
}

// eslint-disable-next-line complexity
export async function resolveCapturePlan(
	page: Page,
	job: ScreenshotJob,
): Promise<CaptureTask[]> {
	const tasks: CaptureTask[] = [];

	if (job.pageType === 'invitation') {
		const hasReveal = (await findRevealSection(page)) !== null;

		if (job.target === 'full-page') {
			tasks.push({
				id: '01-initial-full-page',
				label: 'Initial full page (closed)',
				type: 'invitation-step',
				invitationStep: 'initial-full-page',
			});
			if (job.revealHandling !== 'closed-only' && job.revealHandling !== 'skip' && hasReveal) {
				tasks.push({
					id: '05-invitation-full-open',
					label: 'Full invitation (open)',
					type: 'invitation-step',
					invitationStep: 'full-open',
				});
			}
		} else if (job.target === 'critical-qa') {
			tasks.push({
				id: '01-initial-full-page',
				label: 'Initial full page (closed)',
				type: 'invitation-step',
				invitationStep: 'initial-full-page',
			});
			if (job.revealHandling !== 'open-only' && hasReveal) {
				tasks.push({
					id: '02-reveal-section-closed',
					label: 'Reveal section (closed)',
					type: 'invitation-step',
					invitationStep: 'reveal-closed',
				});
			}
			if (job.revealHandling !== 'closed-only' && job.revealHandling !== 'skip' && hasReveal) {
				tasks.push({
					id: '03-reveal-letter-open',
					label: 'Reveal letter (open)',
					type: 'invitation-step',
					invitationStep: 'reveal-letter-open',
				});
				tasks.push({
					id: '04-reveal-section-open',
					label: 'Reveal section (open)',
					type: 'invitation-step',
					invitationStep: 'reveal-open',
				});
				tasks.push({
					id: '05-invitation-full-open',
					label: 'Full invitation (open)',
					type: 'invitation-step',
					invitationStep: 'full-open',
				});
			}

			// Predefined critical sections
			if (job.mode === 'audit') {
				const critical = job.criticalSelectors.filter((s) => s.capture);
				let cIndex = 20;
				for (const c of critical) {
					const exists = (await page.locator(c.selector).count()) > 0;
					if (exists || c.required) {
						tasks.push({
							id: `${cIndex}-critical-${c.label || 'elem'}`,
							label: `Critical: ${c.label || c.selector}`,
							type: 'critical',
							selector: c.selector,
						});
						cIndex++;
					}
				}
			}
		} else if (job.target === 'all-sections') {
			const sections = KNOWN_SECTIONS.filter((s) => s.pageType === 'invitation');
			let sIndex = 6;
			for (const s of sections) {
				let selector = s.selector;
				let found = (await page.locator(selector).count()) > 0;
				if (!found && s.fallbackSelectors) {
					for (const fb of s.fallbackSelectors) {
						if ((await page.locator(fb).count()) > 0) {
							selector = fb;
							found = true;
							break;
						}
					}
				}
				if (found) {
					// Check visibility before planning — skip hidden sections
					const isVis = await page.locator(selector).first().isVisible().catch(() => false);
					if (isVis) {
						tasks.push({
							id: `${String(sIndex).padStart(2, '0')}-section-${s.outputSlug}`,
							label: `Section: ${s.label}`,
							type: 'section',
							selector,
						});
						sIndex++;
					}
				}
			}
		} else if (job.target === 'single-section' && job.selectedSection) {
			const s = KNOWN_SECTIONS.find((x) => x.id === job.selectedSection);
			if (s) {
				let selector = s.selector;
				const found = (await page.locator(selector).count()) > 0;
				if (!found && s.fallbackSelectors) {
					for (const fb of s.fallbackSelectors) {
						if ((await page.locator(fb).count()) > 0) {
							selector = fb;
							break;
						}
					}
				}
				tasks.push({
					id: '06-section-' + s.outputSlug,
					label: `Section: ${s.label}`,
					type: 'section',
					selector,
				});
			}
		}
	} else {
		// General Page type
		if (job.includeLayout) {
			tasks.push({ id: '01-viewport', label: 'Viewport', type: 'viewport' });
		}

		if (job.target === 'full-page' || job.target === 'critical-qa') {
			tasks.push({ id: '02-full-page', label: 'Full page', type: 'full-page' });
		}

		if (job.target === 'critical-qa') {
			if (job.includeLayout) {
				const hasHeader = (await page.locator('.header-base, header, .header').count()) > 0;
				if (hasHeader) {
					await page.evaluate(() => window.scrollTo(0, 0));
					await page.waitForTimeout(50);
					const isHeaderVisible = await page
						.locator('.header-base, header, .header')
						.first()
						.isVisible();
					if (isHeaderVisible) {
						tasks.push({
							id: '03-header',
							label: 'Header',
							type: 'header',
							selector: '.header-base, header, .header',
						});
					} else {
						console.log('  ℹ Header is hidden — skipping header capture.');
					}
				}

				const hasMain =
					(await page.locator('[data-screenshot="main"], main, .main-content').count()) > 0;
				if (hasMain) {
					tasks.push({
						id: '04-main',
						label: 'Main',
						type: 'main',
						selector: '[data-screenshot="main"], main, .main-content',
					});
				}

				const hasFooter =
					(await page.locator('[data-screenshot="footer"], footer, .footer').count()) > 0;
				if (hasFooter) {
					tasks.push({
						id: '05-footer',
						label: 'Footer',
						type: 'footer',
						selector: '[data-screenshot="footer"], footer, .footer',
					});
				}
			}

			// Predefined critical sections
			if (job.mode === 'audit') {
				const critical = job.criticalSelectors.filter((s) => s.capture);
				let cIndex = 20;
				for (const c of critical) {
					const exists = (await page.locator(c.selector).count()) > 0;
					if (exists || c.required) {
						tasks.push({
							id: `${cIndex}-critical-${c.label || 'elem'}`,
							label: `Critical: ${c.label || c.selector}`,
							type: 'critical',
							selector: c.selector,
						});
						cIndex++;
					}
				}
			}
		} else if (job.target === 'all-sections') {
			const sections = KNOWN_SECTIONS.filter((s) => s.pageType === job.pageType);
			let sIndex = 6;
			for (const s of sections) {
				let selector = s.selector;
				let found = (await page.locator(selector).count()) > 0;
				if (!found && s.fallbackSelectors) {
					for (const fb of s.fallbackSelectors) {
						if ((await page.locator(fb).count()) > 0) {
							selector = fb;
							found = true;
							break;
						}
					}
				}
				if (found) {
					tasks.push({
						id: `${String(sIndex).padStart(2, '0')}-section-${s.outputSlug}`,
						label: `Section: ${s.label}`,
						type: 'section',
						selector,
					});
					sIndex++;
				}
			}
		} else if (job.target === 'single-section' && job.selectedSection) {
			const s = KNOWN_SECTIONS.find((x) => x.id === job.selectedSection);
			if (s) {
				let selector = s.selector;
				const found = (await page.locator(selector).count()) > 0;
				if (!found && s.fallbackSelectors) {
					for (const fb of s.fallbackSelectors) {
						if ((await page.locator(fb).count()) > 0) {
							selector = fb;
							break;
						}
					}
				}
				tasks.push({
					id: '06-section-' + s.outputSlug,
					label: `Section: ${s.label}`,
					type: 'section',
					selector,
				});
			}
		}
	}

	return tasks;
}

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

			for (let pass = 0; pass < 2; pass++) {
				const scrollHeight = Math.max(
					document.body.scrollHeight,
					document.documentElement.scrollHeight,
				);
				const viewportHeight = window.innerHeight;
				const stepSize = Math.max(300, Math.floor(viewportHeight * 0.85));

				for (let y = 0; y <= scrollHeight; y += stepSize) {
					window.scrollTo(0, y);
					await new Promise((r) => setTimeout(r, 120));
				}

				window.scrollTo(0, scrollHeight);
				await new Promise((r) => setTimeout(r, 150));

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
				await new Promise((resolve) => setTimeout(resolve, 150));
				const second = readHeight();
				await new Promise((resolve) => setTimeout(resolve, 150));
				const third = readHeight();
				return Math.abs(first - second) < 2 && Math.abs(second - third) < 2;
			},
			{ timeout: 3000 },
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
      html, body, *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
        scroll-snap-type: none !important;
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
	await storePreNormalizationSelectorState(page, criticalSelectors);
	await normalizeForAudit(page);
	await normalizeOperationalOverlaysForAudit(page, hideSelectors);
	await disableAnimations(page);
	await waitForLayoutHeightStable(page);
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

      /* Remove reveal/cover from layout when in open/preview-opened state */
      html[data-screenshot='audit'] [data-screenshot='reveal-section'][data-preview-state='opened'],
      html[data-screenshot='audit'] ds-editorial-cover[data-preview-state='opened'] {
        display: none !important;
      }

      /* Force the invitation-open-content to be the first real child in layout */
      html[data-screenshot='audit'] [data-screenshot='invitation-open-content'] {
        min-height: 0 !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }

      /* Neutralise envelope-open class impact on scroll layout */
      html[data-screenshot='audit'].envelope-open {
        scroll-behavior: auto !important;
        overflow: auto !important;
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
	// Inject esbuild __name helper globally to prevent "ReferenceError: __name is not defined"
	// when transpiled evaluate/waitForFunction callbacks are executed in the browser context.
	await page.addInitScript(() => {
		if (typeof window !== 'undefined' && !('__name' in window)) {
			(window as unknown as Record<string, unknown>).__name = (target: object, value: string) =>
				Object.defineProperty(target, 'name', { value, configurable: true });
		}
	});

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
      html.screenshot-hide-overlays .header-base,
      html.screenshot-hide-overlays [data-back-to-top],
      html.screenshot-hide-overlays .back-to-top,
      html.screenshot-hide-overlays .scroll-to-top,
      html.screenshot-hide-overlays .action-icon--scroll,
      html.screenshot-hide-overlays .action-icon--fixed-bottom-right {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `,
		});
		await page.evaluate(() => {
			document.documentElement.setAttribute('data-screenshot-overlay-hidden', '1');
		});
	}

	// Add the class to enable the stylesheet rule
	await page.evaluate(() => {
		document.documentElement.classList.add('screenshot-hide-overlays');
	});

	// Wait for any in-flight smooth scroll to settle
	await page.waitForTimeout(50);
	return async () => {
		// Remove the class to restore overlays
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
 * Capture a single landing-page section for the stitched full-page screenshot.
 * Pushes results, warnings, and failures into the caller-supplied arrays.
 * Called once per section by {@link captureLandingStitchedFullPage}.
 */
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
			docWidth: Math.max(
				document.documentElement.scrollWidth,
				document.body.scrollWidth,
			),
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

	const restoreOverlays = section.keepHeader
		? null
		: await hideFixedOverlaysForCapture(page);
	try {
		try {
			await page.screenshot({
				path: file,
				clip: boundedClip,
				...playwrightFormatOptions(format),
			});
			} catch (screenshotErr) {
			const msg = screenshotErr instanceof Error ? screenshotErr.message : String(screenshotErr);
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
		await locator.evaluate((element) => {
			element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
		});
		await page.waitForTimeout(200);

		const restoreOverlays = hideOverlays ? await hideFixedOverlaysForCapture(page) : null;
		try {
			// Use clip-based screenshot to avoid locator.screenshot() blanking
			// at 2x DPR with complex CSS gradients (known Playwright rendering quirk).
			const box = await locator.boundingBox();
			if (!box) {
				console.warn(`  ⚠ Could not get bounding box for element: "${selector}"`);
				return null;
			}
			try {
				await page.screenshot({
					path: outputPath,
					clip: { x: box.x, y: box.y, width: box.width, height: box.height },
					...playwrightFormatOptions(format),
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!message.includes('Clipped area is either empty or outside the resulting image')) {
					throw error;
				}
				await locator.screenshot({
					path: outputPath,
					animations: 'disabled',
					...playwrightFormatOptions(format),
				});
			}
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
				...playwrightFormatOptions(format),
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
// eslint-disable-next-line complexity -- Screenshot orchestration is intentionally centralized for CLI maintainability.
export async function captureInvitationScreenshots(
	page: Page,
	job: ScreenshotJob,
	outputDir: string,
	viewportName: string,
): Promise<{ results: CaptureResult[]; plannedCount: number }> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;
	const timings: Array<{ phase: string; ms: number }> = [];
	const mark = (phase: string) => {
		const elapsed = Date.now();
		return () => {
			timings.push({ phase, ms: Date.now() - elapsed });
		};
	};

	// 3. Keep track of reveal status
	let revealOpened = false;

	// Helper to ensure closed state is loaded
	const ensureClosedState = async () => {
		const t = mark('ensureClosedState');
		const closedUrl = buildScreenshotUrl(job.url, 'closed');
		await navigateTo(
			page,
			closedUrl,
			job.mode,
			job.animationHandling,
			job.criticalSelectors,
			job.hideSelectors,
		);
		t();
	};

	// Navigate to initial closed state
	await ensureClosedState();

	// 1. Resolve capture plan
	const tasks = await resolveCapturePlan(page, job);
	const plannedCount = tasks.length;

	// 2. Print capture plan to console
	console.log('  Planned captures:');
	for (const t of tasks) {
		console.log(`    - ${viewportName} / ${getPlannedCaptureLabel(t.id)}`);
	}

	// Helper to ensure open state is loaded
	const ensureOpenState = async () => {
		if (revealOpened) return;
		const t = mark('open reveal');
		const closedUrl = buildScreenshotUrl(job.url, 'closed');
		revealOpened = await tryOpenReveal(
			page,
			job.url,
			job.mode,
			job.animationHandling,
			closedUrl,
			job.revealHandling,
			job.criticalSelectors,
			job.hideSelectors,
		);
		t();
	};

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		const tMark = mark(getPlannedCaptureLabel(t.id));

		if (t.type === 'invitation-step') {
			if (t.invitationStep === 'initial-full-page') {
				// Already in closed state from initial navigation — skip redundant
				try {
					const result = await captureFullPage(page, taskPath, format);
					result.viewportName = viewportName;
					result.label = t.label;
					results.push(result);
					console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
				} catch (err) {
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						error: String(err),
					});
				}
			} else if (t.invitationStep === 'reveal-closed') {
				// Already in closed state from initial navigation
				const revealSelector = await findRevealSection(page);
				if (revealSelector) {
					const result = await captureElement(page, revealSelector, taskPath, format);
					if (result) {
						result.viewportName = viewportName;
						result.label = t.label;
						results.push(result);
						console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
					}
				}
			} else if (t.invitationStep === 'reveal-letter-open') {
				await ensureOpenState();
				const letterSelector = await findRevealLetter(page);
				if (letterSelector) {
					const result = await captureElement(page, letterSelector, taskPath, format);
					if (result) {
						result.viewportName = viewportName;
						result.label = t.label;
						results.push(result);
						console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
					}
				}
			} else if (t.invitationStep === 'reveal-open') {
				await ensureOpenState();
				const revealSelector = await findRevealSection(page);
				if (revealSelector) {
					const result = await captureElement(page, revealSelector, taskPath, format);
					if (result) {
						result.viewportName = viewportName;
						result.label = t.label;
						results.push(result);
						console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
					}
				}
			} else if (t.invitationStep === 'full-open') {
				await ensureOpenState();
				const fullOpenResult = await captureInvitationOpen(page, outputDir, viewportName, format);
				for (const r of fullOpenResult) {
					r.viewportName = viewportName;
					results.push(r);
				}
			}
		} else if (t.type === 'section' || t.type === 'critical') {
			await ensureOpenState();
			const captured = await captureSectionElement(page, t, taskPath, viewportName, format);
			if (captured) {
				results.push(captured);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} else {
				const isVisible = await page.locator(t.selector!).first().isVisible().catch(() => false);
				const failMsg = isVisible
					? `Element "${t.selector}" could not be captured.`
					: 'Element is hidden — skipped.';
				console.log(`  ℹ ${t.id} — ${isVisible ? 'failed' : 'hidden'}`);
				results.push({ path: taskPath, viewportName, label: t.label, success: false, error: failMsg });
			}
		}
		tMark();
	}

	await validateDistinctReveal(results);


// =============================================================================
// Section Capture — extracted for complexity reduction
// =============================================================================

/**
 * Capture a section/critical element with fast visibility check.
 * Returns CaptureResult on success, null if hidden or errored.
 */
async function captureSectionElement(
	page: Page,
	task: CaptureTask,
	outputPath: string,
	viewportName: string,
	format: OutputFormat,
): Promise<CaptureResult | null> {
	const isVisible = await page.locator(task.selector!).first().isVisible().catch(() => false);
	if (!isVisible) return null;

	const result = await captureElement(page, task.selector!, outputPath, format);
	if (!result) return null;

	result.viewportName = viewportName;
	result.label = task.label;
	return result;
}

	// Print timing summary
	if (timings.length > 0) {
		console.log('  ⏱ Timing:');
		for (const t of timings) {
			console.log(`    ${t.phase}: ${(t.ms / 1000).toFixed(1)}s`);
		}
	}

	return { results, plannedCount };
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
): Promise<{ results: CaptureResult[]; plannedCount: number }> {
	const results: CaptureResult[] = [];
	const format = job.outputFormat;

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

	// Resolve capture plan
	const tasks = await resolveCapturePlan(page, job);
	const plannedCount = tasks.length;

	// Print capture plan to console
	console.log('  Planned captures:');
	for (const t of tasks) {
		console.log(`    - ${viewportName} / ${getPlannedCaptureLabel(t.id)}`);
	}

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		if (t.type === 'viewport') {
			try {
				await resetScrollAndAssertAboveFold(page, getAboveFoldCriticalSelector(job.pageType));
				const result = await captureViewport(page, taskPath, format);
				result.viewportName = viewportName;
				result.label = t.label;
				results.push(result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} catch (err) {
				console.warn(`  ✕ Failed to capture viewport: ${err}`);
				results.push({
					path: taskPath,
					viewportName,
					label: t.label,
					success: false,
					error: String(err),
				});
			}
		} else if (t.type === 'full-page') {
			try {
				const pageViewport = page.viewportSize();
				const isLanding = job.pageType === 'landing';
				const isDesktop = pageViewport ? pageViewport.width >= 1280 : false;
				const useStitch = isLanding && !isDesktop;

				const result = useStitch
					? await captureLandingStitchedFullPage(page, taskPath, format)
					: await captureFullPage(page, taskPath, format);
				result.viewportName = viewportName;
				result.label = t.label;
				results.push(result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} catch (err) {
				console.warn(`  ✕ Failed to capture full page: ${err}`);
				results.push({
					path: taskPath,
					viewportName,
					label: t.label,
					success: false,
					error: String(err),
				});
			}
		} else {
			// Element captures (header, main, footer, critical, section)
			if (t.type === 'header') {
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.waitForTimeout(100);
			}

			const result = await captureElement(page, t.selector!, taskPath, format, {
				hideOverlays: t.type !== 'header',
			});

			if (result) {
				result.viewportName = viewportName;
				result.label = t.label;
				results.push(result);
				console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
			} else {
				console.warn(`  ✕ Failed to capture element: ${t.id} (${t.selector})`);
				results.push({
					path: taskPath,
					viewportName,
					label: t.label,
					success: false,
					error: `Element "${t.selector}" could not be captured.`,
				});
			}
		}
	}

	return { results, plannedCount };
}

// =============================================================================
// Section Capture
// =============================================================================





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
