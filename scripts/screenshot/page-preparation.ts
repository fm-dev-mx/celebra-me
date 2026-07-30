// =============================================================================
// CELEBRA-ME | Screenshot Tool — Page Stability & Audit Preparation
// =============================================================================

import type { Page } from 'playwright';
import {
	type ScreenshotSelectorConfig,
	DEFAULT_NETWORK_IDLE_TIMEOUT,
	DEFAULT_IMAGE_TIMEOUT,
	DEFAULT_STABILITY_DELAY,
} from './types.js';
import { getDefaultHideSelectors } from './utils.js';

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
export async function waitForCustomElements(page: Page): Promise<void> {
	try {
		await page.evaluate(async () => {
			if (typeof window.customElements === 'undefined') return;
			const customNames = ['ds-envelope-reveal', 'ds-editorial-cover'];
			for (const name of customNames) {
				if (document.querySelector(name)) {
					await window.customElements.whenDefined(name).catch(() => {});
				}
			}
		});
	} catch {
		// Non-fatal
	}
}

export async function waitForBackgroundImages(page: Page): Promise<void> {
	try {
		await page.evaluate(async (timeoutMs) => {
			// Prefer invitation/landing surfaces over a full DOM scan; dedupe URLs.
			const roots = Array.from(
				document.querySelectorAll(
					'[data-screenshot-section], [data-screenshot^="landing-"], [data-screenshot="invitation-open-hero"], .invitation-hero, .hero-prime',
				),
			);
			const scanRoots = roots.length > 0 ? roots : [document.documentElement];
			const bgUrls = new Set<string>();
			for (const root of scanRoots) {
				const elements = [root, ...Array.from(root.querySelectorAll('*'))];
				for (const el of elements) {
					const bg = window.getComputedStyle(el).backgroundImage;
					if (bg && bg !== 'none' && bg.includes('url(')) {
						const match = bg.match(/url\((['"]?)(.*?)\1\)/);
						if (match && match[2] && !match[2].startsWith('data:')) {
							bgUrls.add(match[2]);
						}
					}
				}
			}
			await Promise.all(
				Array.from(bgUrls).map(
					(url) =>
						new Promise<void>((resolve) => {
							const img = new Image();
							img.onload = () => resolve();
							img.onerror = () => resolve();
							img.src = url;
							setTimeout(resolve, timeoutMs);
						}),
				),
			);
		}, DEFAULT_IMAGE_TIMEOUT);
	} catch {
		// Non-fatal
	}
}

/**
 * Wait until the open-invitation hero has a loaded image (or non-empty bg).
 * Prevents full-page tiles from capturing an unfinished/stale hero paint.
 */
export async function waitForHeroReady(page: Page): Promise<void> {
	try {
		await page.waitForFunction(
			() => {
				const hero = document.querySelector(
					'[data-screenshot-section="hero"], [data-screenshot="invitation-open-hero"]',
				);
				if (!hero) return true;
				const style = window.getComputedStyle(hero);
				const box = hero.getBoundingClientRect();
				if (
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					box.width <= 0 ||
					box.height <= 0
				) {
					return false;
				}
				const imgs = Array.from(hero.querySelectorAll('img'));
				if (imgs.length > 0) {
					return imgs.every((img) => img.complete && img.naturalWidth > 0);
				}
				const bg = style.backgroundImage;
				return Boolean(bg && bg !== 'none');
			},
			undefined,
			{ timeout: DEFAULT_IMAGE_TIMEOUT },
		);
	} catch {
		// Non-fatal — capture continues; validation may still flag blank crops.
	}
}

export async function waitForPageStability(page: Page): Promise<void> {
	await page.waitForLoadState('domcontentloaded');
	await waitForCustomElements(page);

	// Best-effort network idle
	try {
		await page.waitForLoadState('networkidle', { timeout: DEFAULT_NETWORK_IDLE_TIMEOUT });
	} catch {
		// Page may be polling or using SSE — continue anyway
	}

	await waitForFonts(page);
	await waitForImages(page);
	await waitForBackgroundImages(page);

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
 * @returns true when this call performed layout-height stabilization (E4).
 */
export async function scrollForLazyLoad(
	page: Page,
	opts: { force?: boolean } = {},
): Promise<boolean> {
	try {
		if (!opts.force) {
			const alreadyScrolled = await page.evaluate(
				() => document.documentElement.dataset.screenshotLazyScrolled === '1',
			);
			if (alreadyScrolled) {
				await waitForImages(page);
				return false;
			}
		}

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
			document.documentElement.dataset.screenshotLazyScrolled = '1';
		});
		await waitForImages(page);
		await waitForLayoutHeightStable(page);
		return true;
	} catch {
		// Scroll failed — continue
		return false;
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
			undefined,
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
	opts: { skipLazyScroll?: boolean } = {},
): Promise<void> {
	await page.evaluate(() => {
		document.documentElement.dataset.screenshot = 'audit';
		document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
			img.loading = 'eager';
		});
	});
	await waitForPageStability(page);
	let stabilizedByLazyScroll = false;
	if (!opts.skipLazyScroll) {
		stabilizedByLazyScroll = await scrollForLazyLoad(page);
	}
	// E4: skip a second waitForLayoutHeightStable when lazy scroll just stabilized.
	if (!stabilizedByLazyScroll) {
		await waitForLayoutHeightStable(page);
	}
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

      /* Remove reveal/cover from layout only for fully-open invitation capture.
         Do NOT hide letter-held / is-letter-held (?reveal=letter) — steps 03/04 need a box. */
      html[data-screenshot='audit'] [data-screenshot='reveal-section'][data-preview-state='opened'],
      html[data-screenshot='audit'] [data-screenshot='reveal-section'].is-preview-opened,
      html[data-screenshot='audit'] .event-theme-wrapper[data-reveal-state='revealed'] [data-screenshot='reveal-section'],
      html[data-screenshot='audit'] .event-theme-wrapper[data-reveal-state='preview-opened'] [data-screenshot='reveal-section'],
      html[data-screenshot='audit'] ds-editorial-cover[data-preview-state='opened'],
      html[data-screenshot='audit'] ds-editorial-cover.is-preview-opened {
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
