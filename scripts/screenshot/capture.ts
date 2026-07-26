// =============================================================================
// CELEBRA-ME | Screenshot Tool — Playwright Capture Functions
// =============================================================================
/* eslint-disable max-lines -- Screenshot orchestration is intentionally centralized for CLI maintainability. */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { chromium, type Page, type Browser, type BrowserContext, type Locator } from 'playwright';
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
	type SectionExtent,
} from './types.js';
import { deriveSectionInventory, detectRevealCapabilities } from './inventory.js';
import {
	buildScreenshotPath,
	formatDuration,
	formatExtension,
	getAboveFoldCriticalSelector,
	getDefaultHideSelectors,
	getDocumentHeight,
	intersectRectWithViewport,
	playwrightFormatOptions,
	verifyPhysicalPng,
	verifySectionCropInclusion,
	publishArtifactAtomically,
	invalidateStaleInvitationFullPage,
} from './utils.js';

export type TaskRequirement = 'required' | 'optional' | 'unsupported';

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
		'initial-full-page' | 'reveal-closed' | 'reveal-letter-open' | 'reveal-open' | 'full-open';
	requirement?: TaskRequirement;
	viewportOnly?: boolean;
}

export function getPlannedCaptureLabel(id: string): string {
	return id.replace(/^\d+-/, '');
}

/**
 * Skip open-invitation captures (full-page + sections) when a reveal exists
 * but failed to open. Invitations without a reveal layer are never skipped.
 */
export function shouldSkipInvitationOpenCapture(
	revealOpened: boolean,
	hasReveal: boolean,
): boolean {
	return hasReveal && !revealOpened;
}

/**
 * True when open invitation content is laid out (at least one section or open-content root).
 */
export async function assertInvitationContentReady(page: Page): Promise<boolean> {
	try {
		return await page.evaluate(() => {
			const isLaidOut = (el: Element | null): boolean => {
				if (!el) return false;
				const style = window.getComputedStyle(el);
				const box = el.getBoundingClientRect();
				return (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					Number.parseFloat(style.opacity || '1') > 0.01 &&
					box.width > 0 &&
					box.height > 0
				);
			};

			const sections = Array.from(document.querySelectorAll('[data-screenshot-section]'));
			if (sections.some((el) => isLaidOut(el))) return true;
			return isLaidOut(document.querySelector('[data-screenshot="invitation-open-content"]'));
		});
	} catch {
		return false;
	}
}

/**
 * Open the invitation for section/full-page capture using only `?reveal=open`.
 * Retries once with a fresh navigation. Does not use seal click automation.
 */
export async function ensureInvitationOpenForCapture(
	page: Page,
	job: Pick<
		ScreenshotJob,
		'url' | 'mode' | 'animationHandling' | 'criticalSelectors' | 'hideSelectors'
	>,
	opts: { hasReveal: boolean; maxAttempts?: number } = { hasReveal: true },
): Promise<boolean> {
	const maxAttempts = opts.maxAttempts ?? 2;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const openUrl = buildScreenshotUrl(job.url, 'open');
		console.log(
			`  ℹ Opening invitation for capture (attempt ${attempt}/${maxAttempts}): ${openUrl}`,
		);
		await navigateTo(
			page,
			openUrl,
			job.mode,
			job.animationHandling,
			job.criticalSelectors,
			job.hideSelectors,
		);

		const revealOk = opts.hasReveal ? await checkRevealIsOpen(page) : true;
		const contentOk = await assertInvitationContentReady(page);
		if (revealOk && contentOk) {
			console.log('  ✓ Invitation open and section content ready');
			return true;
		}
		console.warn(
			`  ⚠ Open assert failed (revealOpen=${revealOk}, contentReady=${contentOk})` +
				(attempt < maxAttempts ? '; retrying…' : ''),
		);
	}

	return false;
}

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

/**
 * Vertically composite section PNG captures into a single full-page artifact.
 */
export async function compositeSectionCapturePngs(
	sectionPaths: string[],
	outputPath: string,
): Promise<{ width: number; height: number; sectionCount: number }> {
	const ordered = listOrderedSectionCapturePaths(sectionPaths);
	if (ordered.length === 0) {
		throw new Error(
			'COMPOSITE_FULL_PAGE_FAILED: No ordered section capture paths to composite.',
		);
	}

	const tiles: Array<{ file: string; width: number; height: number }> = [];
	for (const file of ordered) {
		const meta = await sharp(file).metadata();
		if (!meta.width || !meta.height) {
			throw new Error(`COMPOSITE_FULL_PAGE_FAILED: Could not read dimensions for ${file}`);
		}
		tiles.push({ file, width: meta.width, height: meta.height });
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

	return { width: canvasWidth, height: canvasHeight, sectionCount: tiles.length };
}

// eslint-disable-next-line complexity
export async function resolveCapturePlan(page: Page, job: ScreenshotJob): Promise<CaptureTask[]> {
	const tasks: CaptureTask[] = [];

	if (job.pageType === 'invitation') {
		const capabilities = await detectRevealCapabilities(page);

		const fullOpenTask: CaptureTask = {
			id: '05-invitation-full-page',
			label: 'Full invitation (open)',
			type: 'invitation-step',
			invitationStep: 'full-open',
			requirement: 'required',
		};
		const shouldCaptureFullOpen =
			job.revealHandling !== 'closed-only' &&
			job.revealHandling !== 'skip' &&
			capabilities.hasReveal;

		if (job.target === 'full-page') {
			tasks.push({
				id: '01-initial-closed-viewport',
				label:
					capabilities.revealType === 'editorial-cover'
						? 'Initial cover (closed)'
						: 'Initial envelope (closed)',
				type: 'invitation-step',
				invitationStep: 'initial-full-page',
				requirement: 'required',
				viewportOnly: true,
			});
			if (shouldCaptureFullOpen) {
				tasks.push(fullOpenTask);
			}
		} else if (job.target === 'critical-qa') {
			tasks.push({
				id: '01-initial-closed-viewport',
				label:
					capabilities.revealType === 'editorial-cover'
						? 'Initial cover (closed)'
						: 'Initial envelope (closed)',
				type: 'invitation-step',
				invitationStep: 'initial-full-page',
				requirement: 'required',
				viewportOnly: true,
			});
			if (job.revealHandling !== 'open-only' && capabilities.hasReveal) {
				tasks.push({
					id: '02-reveal-closed',
					label:
						capabilities.revealType === 'editorial-cover'
							? 'Reveal cover (closed)'
							: 'Reveal section (closed)',
					type: 'invitation-step',
					invitationStep: 'reveal-closed',
					requirement: 'optional',
				});
			}
			if (shouldCaptureFullOpen) {
				if (capabilities.hasLetter) {
					tasks.push({
						id: '03-reveal-letter-open',
						label: 'Reveal letter (open)',
						type: 'invitation-step',
						invitationStep: 'reveal-letter-open',
						requirement: 'optional',
					});
				}
				if (capabilities.hasFlapTransition) {
					tasks.push({
						id: '04-reveal-transition-open',
						label: 'Reveal transition (open)',
						type: 'invitation-step',
						invitationStep: 'reveal-open',
						requirement: 'optional',
					});
				}
			}

			// Per-section captures BEFORE full-page so 05 can validate against
			// same-run standalones (avoids poisoning publish with stale heights).
			const inventory = await deriveSectionInventory(page);
			if (inventory.sections.length > 0) {
				for (const sec of inventory.sections) {
					const orderStr = String(sec.order).padStart(2, '0');
					tasks.push({
						id: `10-${orderStr}-${sec.id}`,
						label: `Section: ${sec.label}`,
						type: 'section',
						selector: sec.selector,
						requirement: 'required',
					});
				}
			} else {
				const sections = KNOWN_SECTIONS.filter((s) => s.pageType === 'invitation');
				let sIndex = 1;
				for (const s of sections) {
					const count = await page.locator(s.selector).count();
					if (count > 0) {
						const orderStr = String(sIndex).padStart(2, '0');
						tasks.push({
							id: `10-${orderStr}-${s.outputSlug}`,
							label: `Section: ${s.label}`,
							type: 'section',
							selector: s.selector,
							requirement: 'required',
						});
						sIndex++;
					}
				}
			}

			if (shouldCaptureFullOpen) {
				tasks.push(fullOpenTask);
			}
		} else if (job.target === 'all-sections') {
			const inventory = await deriveSectionInventory(page);
			if (inventory.sections.length > 0) {
				for (const sec of inventory.sections) {
					const orderStr = String(sec.order).padStart(2, '0');
					tasks.push({
						id: `10-${orderStr}-${sec.id}`,
						label: `Section: ${sec.label}`,
						type: 'section',
						selector: sec.selector,
						requirement: 'required',
					});
				}
			} else {
				const sections = KNOWN_SECTIONS.filter((s) => s.pageType === 'invitation');
				let sIndex = 1;
				for (const s of sections) {
					const count = await page.locator(s.selector).count();
					if (count > 0) {
						const orderStr = String(sIndex).padStart(2, '0');
						tasks.push({
							id: `10-${orderStr}-${s.outputSlug}`,
							label: `Section: ${s.label}`,
							type: 'section',
							selector: s.selector,
							requirement: 'required',
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
					(await page.locator('[data-screenshot="main"], main, .main-content').count()) >
					0;
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
 */
export async function scrollForLazyLoad(page: Page, opts: { force?: boolean } = {}): Promise<void> {
	try {
		if (!opts.force) {
			const alreadyScrolled = await page.evaluate(
				() => document.documentElement.dataset.screenshotLazyScrolled === '1',
			);
			if (alreadyScrolled) {
				await waitForImages(page);
				return;
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

      /* Remove reveal/cover from layout when in open/preview-opened or revealed state */
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

// =============================================================================
// URL & Navigation
// =============================================================================

/**
 * Build a screenshot-mode URL by adding query parameters.
 * Merges with any existing query params on the URL.
 *
 * When `reveal=closed`, also sets `forceEnvelope=true` so `RevealManager.shouldSkipEnvelope()`
 * does not hide the envelope after a prior open in the same browser context (localStorage).
 */
export function buildScreenshotUrl(baseUrl: string, revealState?: 'open' | 'closed'): string {
	const url = new URL(baseUrl);
	url.searchParams.set('screenshot', '1');
	if (revealState) {
		url.searchParams.set('reveal', revealState);
	}
	if (revealState === 'closed') {
		url.searchParams.set('forceEnvelope', 'true');
	}
	return url.toString();
}

/**
 * Remove `envelope-opened-*` keys from a Storage-like object.
 * Used by screenshot init scripts and unit-tested in Node.
 */
export function clearEnvelopeOpenedKeys(storage: {
	readonly length: number;
	key(index: number): string | null;
	removeItem(key: string): void;
}): string[] {
	const keysToRemove: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key && key.startsWith('envelope-opened-')) {
			keysToRemove.push(key);
		}
	}
	for (const key of keysToRemove) {
		storage.removeItem(key);
	}
	return keysToRemove;
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
			(window as unknown as Record<string, unknown>).__name = (
				target: object,
				value: string,
			) => Object.defineProperty(target, 'name', { value, configurable: true });
		}
	});

	// Always clear envelope skip flags before screenshot navigations so closed/open
	// steps within one viewport do not hide the seal after a prior click.
	await page.addInitScript(() => {
		try {
			const storage = window.localStorage;
			const keysToRemove: string[] = [];
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i);
				if (key && key.startsWith('envelope-opened-')) {
					keysToRemove.push(key);
				}
			}
			for (const key of keysToRemove) {
				storage.removeItem(key);
			}
		} catch {
			// localStorage may be unavailable in unusual browser contexts.
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

const REVEAL_TRIGGER_ATTACH_TIMEOUT = 5_000;
const REVEAL_LETTER_LAID_OUT_TIMEOUT = 5_000;

/**
 * Pure readiness check for reveal-letter capture.
 * Host `[hidden]` collapses layout (display:none → 0×0); CSS visibility alone is insufficient.
 */
export function isRevealLetterLaidOut(metrics: {
	letterWidth: number;
	letterHeight: number;
	hostHidden: boolean;
}): boolean {
	if (metrics.hostHidden) return false;
	return metrics.letterWidth >= 1 && metrics.letterHeight >= 1;
}

/**
 * Wait until `[data-screenshot="reveal-letter"]` has a non-zero box and its
 * envelope host is not `[hidden]`. Returns false on timeout / missing letter.
 */
export async function waitForRevealLetterLaidOut(
	page: Page,
	timeout = REVEAL_LETTER_LAID_OUT_TIMEOUT,
): Promise<boolean> {
	try {
		await page.waitForFunction(
			() => {
				const letter = document.querySelector('[data-screenshot="reveal-letter"]');
				if (!(letter instanceof HTMLElement)) return false;
				const host = letter.closest('ds-envelope-reveal, .envelope-wrapper');
				const hostHidden = host instanceof HTMLElement && host.hidden;
				const rect = letter.getBoundingClientRect();
				return (
					!hostHidden &&
					rect.width >= 1 &&
					rect.height >= 1 &&
					window.getComputedStyle(letter).display !== 'none'
				);
			},
			{ timeout },
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Try to open the reveal section by clicking the trigger.
 * Returns true if the reveal was triggered, false otherwise.
 *
 * Waits for `attached` (not only `visible`) so a seal that Playwright marks as
 * hidden (e.g. host `[hidden]` race, opacity) can still be force-clicked in
 * screenshot automation.
 *
 * After click, waits for a non-zero laid-out reveal letter when present — the old
 * `visibility !== hidden` check passed even when the host was already `[hidden]`
 * (0×0 measure / locator.screenshot fallback).
 */
export async function openRevealSection(page: Page): Promise<boolean> {
	const trigger = await findRevealTrigger(page);
	if (!trigger) return false;

	try {
		const locator = trigger.startsWith('text=')
			? page.getByText(new RegExp(trigger.replace('text=', ''), 'i')).first()
			: page.locator(trigger).first();

		await locator.waitFor({ state: 'attached', timeout: REVEAL_TRIGGER_ATTACH_TIMEOUT });

		const isVisible = await locator.isVisible().catch(() => false);
		if (!isVisible) {
			console.warn(
				'  ⚠ Reveal trigger attached but not visible; forcing click for screenshot automation',
			);
			await locator.click({ force: true, timeout: REVEAL_TRIGGER_ATTACH_TIMEOUT });
		} else {
			await locator.click({ timeout: REVEAL_TRIGGER_ATTACH_TIMEOUT });
		}

		const letterCount = await page.locator('[data-screenshot="reveal-letter"]').count();
		if (letterCount > 0) {
			const laidOut = await waitForRevealLetterLaidOut(page);
			if (!laidOut) {
				console.warn(
					'  ⚠ Reveal letter present but not laid out after click (host hidden or 0×0 box)',
				);
				return false;
			}
			return true;
		}

		// No letter hook (e.g. editorial cover) — fall back to stage/card visibility.
		await page.waitForFunction(
			() => {
				const card = document.querySelector('[data-envelope-card]');
				if (!card) return true;
				if (card instanceof HTMLElement) {
					const host = card.closest('ds-envelope-reveal, .envelope-wrapper');
					if (host instanceof HTMLElement && host.hidden) return false;
					const rect = card.getBoundingClientRect();
					if (rect.width < 1 || rect.height < 1) return false;
				}
				return window.getComputedStyle(card).visibility !== 'hidden';
			},
			{ timeout: REVEAL_LETTER_LAID_OUT_TIMEOUT },
		);
		return true;
	} catch (err) {
		console.warn(`  ⚠ Could not click reveal trigger: ${err}`);
		return false;
	}
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

async function captureShortElementFullExtent(
	page: Page,
	locator: Locator,
	outputPath: string,
	format: OutputFormat,
	viewportHeight: number,
): Promise<boolean> {
	const box = await locator.boundingBox();
	if (box && box.height > 0 && box.width > 0 && box.y + box.height <= viewportHeight + 1) {
		try {
			await page.screenshot({
				path: outputPath,
				clip: {
					x: Math.max(0, box.x),
					y: Math.max(0, box.y),
					width: box.width,
					height: box.height,
				},
				...playwrightFormatOptions(format),
			});
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('Clipped area is either empty or outside the resulting image')) {
				throw error;
			}
		}
	}
	await screenshotLocatorToPath(locator, outputPath, format);
	return true;
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
		let yOffset = 0;
		let tileIdx = 0;

		while (yOffset < metrics.height) {
			const tileHeight = Math.min(viewport.height, metrics.height - yOffset);
			await page.evaluate(
				({ docY, offset }) => {
					window.scrollTo(0, docY + offset);
				},
				{ docY: metrics.docY, offset: yOffset },
			);
			await page.waitForTimeout(80);

			const tileFile = path.join(tmpDir, `tile-${tileIdx}.png`);
			const box = await locator.boundingBox();
			if (!box) {
				throw new Error('element bounding box unavailable during tile capture');
			}
			const visible = intersectRectWithViewport(box, viewport);
			if (!visible) {
				throw new Error('element left the viewport during tile capture');
			}
			const clip = {
				x: visible.x,
				y: visible.y,
				width: visible.width,
				height: Math.min(visible.height, tileHeight),
			};

			try {
				await page.screenshot({
					path: tileFile,
					clip,
					...playwrightFormatOptions(format),
				});
			} catch {
				// Quirk fallback for complex CSS / 2x DPR — full element, stop tiling
				await screenshotLocatorToPath(locator, tileFile, format);
				await fs.promises.copyFile(tileFile, outputPath);
				await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
				return true;
			}

			const meta = await sharp(tileFile).metadata();
			if (meta.width && meta.height) {
				tiles.push({ file: tileFile, width: meta.width, height: meta.height });
			}
			yOffset += tileHeight;
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
		console.warn(`  ⚠ Full-section stitch failed (${err}); falling back to locator.screenshot`);
		await locator.evaluate((element) => {
			element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
		});
		await page.waitForTimeout(100);
		await screenshotLocatorToPath(locator, outputPath, format);
		return true;
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

	if (metrics.height <= viewport.height + 1) {
		return captureShortElementFullExtent(page, locator, outputPath, format, viewport.height);
	}

	return stitchTallElementTiles(page, locator, outputPath, format, metrics, viewport);
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
 * Segmented tile stitch for `05-invitation-full-page`.
 * Scrolls viewport tiles from topY→bottomY and composites with sharp.
 */
async function captureInvitationStitchedFullPage(
	page: Page,
	outputPath: string,
	format: OutputFormat,
	topY: number,
	bottomY: number,
	viewportWidth: number,
): Promise<boolean> {
	const initialViewport = page.viewportSize() ?? { width: viewportWidth, height: 844 };
	const tmpDir = path.join(path.dirname(outputPath), `.stitch-invitation-${Date.now()}`);
	await fs.promises.mkdir(tmpDir, { recursive: true });

	try {
		const restoreOverlays = await hideFixedOverlaysForCapture(page);
		const capturedTiles: Array<{ file: string; width: number; height: number }> = [];

		const tileSize = initialViewport.height;
		let yOffset = topY;
		let tileIdx = 0;

		while (yOffset < bottomY) {
			const currentTileHeight = Math.min(tileSize, bottomY - yOffset);
			const tileFile = path.join(tmpDir, `tile-${tileIdx}.png`);

			await page.evaluate((y) => window.scrollTo(0, y), yOffset);
			await page.waitForTimeout(100);

			await page.screenshot({
				path: tileFile,
				clip: { x: 0, y: 0, width: initialViewport.width, height: currentTileHeight },
				...playwrightFormatOptions(format),
			});

			const meta = await sharp(tileFile).metadata();
			if (meta.width && meta.height) {
				capturedTiles.push({ file: tileFile, width: meta.width, height: meta.height });
			}
			yOffset += currentTileHeight;
			tileIdx++;
		}

		await page.evaluate(() => window.scrollTo(0, 0));
		await restoreOverlays();

		const currentViewport = page.viewportSize();
		if (
			!currentViewport ||
			currentViewport.width !== initialViewport.width ||
			currentViewport.height !== initialViewport.height
		) {
			throw new Error(
				`VIEWPORT_MUTATED_DURING_CAPTURE: Viewport mutated during tile capture (${initialViewport.width}x${initialViewport.height} -> ${currentViewport?.width}x${currentViewport?.height})`,
			);
		}

		if (capturedTiles.length === 0) return false;

		const canvasWidth = capturedTiles.reduce((max, t) => Math.max(max, t.width), 0);
		const canvasHeight = capturedTiles.reduce((sum, t) => sum + t.height, 0);

		const composites = await Promise.all(
			capturedTiles.map(async (t, idx) => {
				let input = sharp(t.file);
				if (t.width !== canvasWidth) {
					input = input.resize({ width: canvasWidth });
				}
				const buf = await input.toBuffer();
				const top = capturedTiles.slice(0, idx).reduce((sum, p) => sum + p.height, 0);
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
		console.warn(`  ⚠ Segmented capture failed: ${err}`);
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		throw err;
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

async function collectSectionPathsForComposite(
	page: Page,
	priorResults: CaptureResult[],
	tempSectionDir: string,
	format: OutputFormat,
): Promise<string[]> {
	const priorPaths = listOrderedSectionCapturePaths(
		priorResults.filter((r) => r.success).map((r) => r.path),
	);
	if (priorPaths.length > 0) return priorPaths;

	const inventory = await deriveSectionInventory(page);
	assertCompleteInvitationInventory(inventory);
	await fs.promises.mkdir(tempSectionDir, { recursive: true });

	const capturedPaths: string[] = [];
	for (const sec of inventory.sections) {
		const orderStr = String(sec.order).padStart(2, '0');
		const sectionFile = path.join(
			tempSectionDir,
			`10-${orderStr}-${sec.id}.${formatExtension(format)}`,
		);
		const captured = await captureElement(page, sec.selector, sectionFile, format, {
			sectionExtent: 'full',
		});
		if (!captured) {
			throw new Error(
				`FULL_PAGE_CAPTURE_FAILED: Could not capture section "${sec.id}" for composite.`,
			);
		}
		capturedPaths.push(sectionFile);
	}
	return listOrderedSectionCapturePaths(capturedPaths);
}

async function verifyCompositeInvitationFullPage(
	tempPath: string,
	sectionPaths: string[],
	viewportName: string,
	initialViewport: { width: number; height: number },
	deviceScaleFactor: number,
	sectionCount: number,
	expectedCssHeight: number,
): Promise<void> {
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

	const heroPath = sectionPaths.find((p) => /[/\\]10-\d+-hero\./.test(p.replace(/\\/g, '/')));
	if (heroPath) {
		const heroMeta = await sharp(heroPath).metadata();
		const heroHeight = heroMeta.height || 0;
		if (heroHeight > 0) {
			const cropCheck = await verifySectionCropInclusion({
				fullPagePath: tempPath,
				sectionId: 'hero',
				sectionBounds: { y: 0, height: heroHeight / deviceScaleFactor },
				topY: 0,
				deviceScaleFactor,
				standalonePath: heroPath,
			});
			if (cropCheck.warning) {
				console.warn(`  ⚠ ${cropCheck.warning}`);
			}
			if (!cropCheck.valid) {
				await fs.promises.rm(tempPath, { force: true }).catch(() => {});
				throw new Error(
					`${cropCheck.errorCode ?? 'SECTION_CAPTURE_MISMATCH'}: ${cropCheck.error}`,
				);
			}
		}
	}

	console.log(
		`  ✓ Captured: 05-invitation-full-page (${viewportName}) [${sectionCount} section(s), ${expectedCssHeight}px, strategy: section-composite]`,
	);
}

async function captureInvitationOpenTileFallback(
	page: Page,
	tempPath: string,
	format: OutputFormat,
	viewportName: string,
	initialViewport: { width: number; height: number },
	deviceScaleFactor: number,
): Promise<void> {
	const inventory = await deriveSectionInventory(page);
	const topY = inventory.sections.length > 0 ? inventory.topY : 0;
	const bottomY =
		inventory.sections.length > 0 ? inventory.bottomY : await getDocumentHeight(page);
	const expectedCssHeight = Math.max(100, Math.ceil(bottomY - topY));
	const stitchedSuccess = await captureInvitationStitchedFullPage(
		page,
		tempPath,
		format,
		topY,
		bottomY,
		initialViewport.width,
	);
	if (!stitchedSuccess) {
		throw new Error(
			`FULL_PAGE_CAPTURE_FAILED: Segmented capture strategy failed for ${viewportName}.`,
		);
	}
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
	console.log(
		`  ✓ Captured: 05-invitation-full-page (${viewportName}) [strategy: stitched tile fallback]`,
	);
}

/**
 * Capture the 05-invitation-full-page screenshot.
 *
 * Preferred strategy: vertically composite same-run `10-*` section PNGs (source of truth).
 * If none exist (full-page-only target), capture each inventory section to temp then composite.
 * Last resort: viewport tile stitch.
 */
async function captureInvitationOpen(
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
	const tempSectionDir = path.join(outputDir, `.tmp-sections-${runId}-${viewportName}`);

	try {
		await scrollForLazyLoad(page);
		await page.evaluate(() => {
			document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
				img.loading = 'eager';
			});
		});
		await waitForImages(page);
		await waitForHeroReady(page);

		const sectionPaths = await collectSectionPathsForComposite(
			page,
			priorResults,
			tempSectionDir,
			format,
		);
		const initialViewport = page.viewportSize() ?? { width: 390, height: 844 };
		const deviceScaleFactor = (await page.evaluate(() => window.devicePixelRatio)) || 2;

		if (sectionPaths.length > 0) {
			const composite = await compositeSectionCapturePngs(sectionPaths, tempPath);
			const expectedCssHeight = Math.max(
				100,
				Math.ceil(composite.height / deviceScaleFactor),
			);
			await verifyCompositeInvitationFullPage(
				tempPath,
				sectionPaths,
				viewportName,
				initialViewport,
				deviceScaleFactor,
				composite.sectionCount,
				expectedCssHeight,
			);
		} else {
			await captureInvitationOpenTileFallback(
				page,
				tempPath,
				format,
				viewportName,
				initialViewport,
				deviceScaleFactor,
			);
		}

		const published = await publishArtifactAtomically(tempPath, fullOpenPath);
		results.push({
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
			path: fullOpenPath,
			viewportName,
			label: 'Full invitation (open)',
			success: false,
			error: String(err),
		});
	} finally {
		await fs.promises.rm(tempSectionDir, { recursive: true, force: true }).catch(() => {});
	}

	return results;
}

/**
 * Navigate, detect, and capture invitation screenshots for one viewport.
 *
 * Output files (when found):
 *   01-initial-closed-viewport
 *   02-reveal-closed
 *   03-reveal-letter-open
 *   04-reveal-transition-open
 *   05-invitation-full-page
 *   (10-*-{section} for full QA; captured before 05 when present)
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

	const revealCapabilities = await detectRevealCapabilities(page);
	// Invitations without a reveal layer are already "open" for section captures.
	if (!revealCapabilities.hasReveal) {
		revealOpened = true;
	}

	// 1. Resolve capture plan
	const tasks = await resolveCapturePlan(page, job);
	// plannedCount excludes optional captures so the manifest expected-vs-files
	// comparison only covers required content QA tasks.
	const plannedCount = tasks.filter((t) => t.requirement !== 'optional').length;

	// 2. Print capture plan to console
	console.log('  Planned captures:');
	for (const t of tasks) {
		console.log(`    - ${viewportName} / ${getPlannedCaptureLabel(t.id)}`);
	}

	// Open for sections/05 via query-param only (retry once). Click remains for 03/04.
	const ensureOpenState = async (): Promise<boolean> => {
		if (revealOpened) return true;
		const t = mark('open reveal');
		revealOpened = await ensureInvitationOpenForCapture(page, job, {
			hasReveal: revealCapabilities.hasReveal,
			maxAttempts: 2,
		});
		t();
		return revealOpened;
	};

	/** True when invitation section tasks may run (reveal opened or no reveal required). */
	let sectionOpenFailedLogged = false;

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		const tMark = mark(getPlannedCaptureLabel(t.id));

		if (t.type === 'invitation-step') {
			if (t.invitationStep === 'initial-full-page') {
				try {
					const result = t.viewportOnly
						? await captureViewport(page, taskPath, format)
						: await captureFullPage(page, taskPath, format);
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
				await ensureClosedState();
				const revealSelector = await findRevealSection(page);
				let captured = false;
				if (revealSelector) {
					const result = await captureElement(page, revealSelector, taskPath, format);
					if (result) {
						result.viewportName = viewportName;
						result.label = t.label;
						results.push(result);
						console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
						captured = true;
					}
				}
				if (!captured) {
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						isOptional: true,
						error: 'Reveal closed element not found or could not be captured.',
					});
				}
			} else if (t.invitationStep === 'reveal-letter-open') {
				// Capture intermediate letter-open state by clicking seal trigger on closed page BEFORE entering final open state
				await ensureClosedState();
				const isOpened = await openRevealSection(page);
				let captured = false;
				if (isOpened) {
					const letterSelector = await findRevealLetter(page);
					if (letterSelector) {
						const stillLaidOut = await waitForRevealLetterLaidOut(page, 2_000);
						if (!stillLaidOut) {
							console.warn(
								'  ⚠ Reveal letter lost layout before capture; skipping 03-reveal-letter-open',
							);
						} else {
							const result = await captureElement(
								page,
								letterSelector,
								taskPath,
								format,
								{ sectionExtent: 'viewport' },
							);
							if (result) {
								result.viewportName = viewportName;
								result.label = t.label;
								results.push(result);
								console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
								captured = true;
							}
						}
					}
				}
				if (!captured) {
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						isOptional: true,
						error: 'Reveal letter element not found or could not be captured.',
					});
				}
			} else if (t.invitationStep === 'reveal-open') {
				// Capture intermediate reveal-open state while envelope is open before entering final open state
				await ensureClosedState();
				const isOpened = await openRevealSection(page);
				let captured = false;
				if (isOpened) {
					const revealSelector = await findRevealSection(page);
					if (revealSelector) {
						const result = await captureElement(page, revealSelector, taskPath, format);
						if (result) {
							result.viewportName = viewportName;
							result.label = t.label;
							results.push(result);
							console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
							captured = true;
						}
					}
				}
				if (!captured) {
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						isOptional: true,
						error: 'Reveal section open element not found or could not be captured.',
					});
				}
			} else if (t.invitationStep === 'full-open') {
				const isOpen = await ensureOpenState();
				if (shouldSkipInvitationOpenCapture(isOpen, revealCapabilities.hasReveal)) {
					console.warn(
						'  ⚠ Reveal did not open; skipping 05-invitation-full-page for this viewport',
					);
					const removed = await invalidateStaleInvitationFullPage(taskPath);
					if (removed) {
						console.warn(
							`  ⚠ Removed stale 05-invitation-full-page for ${viewportName} so a previous run cannot be mistaken for a fresh capture.`,
						);
					}
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						error: 'Reveal did not open; skipping full-page capture.',
					});
				} else {
					// Viewport-cropped standalones must not feed the 05 composite;
					// empty prior forces temp re-capture at sectionExtent: 'full'.
					const fullOpenResult = await captureInvitationOpen(
						page,
						outputDir,
						viewportName,
						format,
						job.sectionExtent === 'full' ? results : [],
					);
					if (fullOpenResult.length > 0) {
						for (const r of fullOpenResult) {
							r.viewportName = viewportName;
							results.push(r);
						}
					} else {
						results.push({
							path: taskPath,
							viewportName,
							label: t.label,
							success: false,
							error: 'Full open invitation target not found or could not be captured.',
						});
					}
				}
			}
		} else if (t.type === 'section' || t.type === 'critical') {
			const isOpen = await ensureOpenState();
			if (shouldSkipInvitationOpenCapture(isOpen, revealCapabilities.hasReveal)) {
				if (!sectionOpenFailedLogged) {
					console.warn(
						'  ⚠ Reveal did not open; skipping section captures for this viewport',
					);
					sectionOpenFailedLogged = true;
				}
				results.push({
					path: taskPath,
					viewportName,
					label: t.label,
					success: false,
					error: 'Reveal did not open; skipping section captures.',
				});
			} else {
				const captured = await captureSectionElement(
					page,
					t,
					taskPath,
					viewportName,
					format,
					job.sectionExtent,
				);
				if (captured) {
					results.push(captured);
					console.log(`  ✓ Captured: ${t.id} (${viewportName})`);
				} else {
					const isVisible = await page
						.locator(t.selector!)
						.first()
						.isVisible()
						.catch(() => false);
					const failMsg = isVisible
						? `Element "${t.selector}" could not be captured.`
						: 'Element is hidden — skipped.';
					console.log(`  ℹ ${t.id} — ${isVisible ? 'failed' : 'hidden'}`);
					results.push({
						path: taskPath,
						viewportName,
						label: t.label,
						success: false,
						error: failMsg,
					});
				}
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
		sectionExtent: SectionExtent,
	): Promise<CaptureResult | null> {
		const isVisible = await page
			.locator(task.selector!)
			.first()
			.isVisible()
			.catch(() => false);
		if (!isVisible) return null;

		const result = await captureElement(page, task.selector!, outputPath, format, {
			sectionExtent,
		});
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
	// plannedCount excludes optional captures so the manifest expected-vs-files
	// comparison only covers required content QA tasks.
	const plannedCount = tasks.filter((t) => t.requirement !== 'optional').length;

	// Print capture plan to console
	console.log('  Planned captures:');
	for (const t of tasks) {
		console.log(`    - ${viewportName} / ${getPlannedCaptureLabel(t.id)}`);
	}

	for (const t of tasks) {
		const taskPath = await buildScreenshotPath(outputDir, viewportName, t.id, format);
		if (t.type === 'viewport') {
			try {
				await resetScrollAndAssertAboveFold(
					page,
					getAboveFoldCriticalSelector(job.pageType),
				);
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

			const isSectionLike = t.type === 'section' || t.type === 'critical';
			const result = await captureElement(page, t.selector!, taskPath, format, {
				hideOverlays: t.type !== 'header',
				...(isSectionLike ? { sectionExtent: job.sectionExtent } : {}),
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
