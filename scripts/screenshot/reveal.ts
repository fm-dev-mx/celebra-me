// =============================================================================
// CELEBRA-ME | Screenshot Tool — Reveal Detection & Open-State Validation
// =============================================================================

import type { Page } from 'playwright';
import type { ScreenshotJob } from './types.js';
import { buildScreenshotUrl, navigateTo } from './navigation.js';

export interface RevealOcclusionCache {
	assert(page: Page): Promise<boolean>;
	invalidate(): void;
	getCached(): boolean | null;
}

/** Cache occlusion checks for the current open navigation URL (E2). */
export function createRevealOcclusionCache(): RevealOcclusionCache {
	let cached: boolean | null = null;
	let cachedUrl: string | null = null;
	return {
		async assert(page: Page): Promise<boolean> {
			const url = page.url();
			if (cached !== null && cachedUrl === url) return cached;
			const ok = await assertRevealDoesNotOccludeInvitation(page);
			cached = ok;
			cachedUrl = url;
			return ok;
		},
		invalidate(): void {
			cached = null;
			cachedUrl = null;
		},
		getCached(): boolean | null {
			return cached;
		},
	};
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
	opts: {
		hasReveal: boolean;
		maxAttempts?: number;
		/** When provided, open-state occlusion results seed/reuse the E2 cache. */
		occlusionCache?: RevealOcclusionCache;
	} = { hasReveal: true },
): Promise<boolean> {
	const maxAttempts = opts.maxAttempts ?? 2;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const openUrl = buildScreenshotUrl(job.url, 'open');
		console.log(
			`  ℹ Opening invitation for capture (attempt ${attempt}/${maxAttempts}): ${openUrl}`,
		);
		opts.occlusionCache?.invalidate();
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
		const clearOk = opts.hasReveal
			? opts.occlusionCache
				? await opts.occlusionCache.assert(page)
				: await assertRevealDoesNotOccludeInvitation(page)
			: true;
		if (revealOk && contentOk && clearOk) {
			console.log('  ✓ Invitation open and section content ready');
			return true;
		}
		opts.occlusionCache?.invalidate();
		console.warn(
			`  ⚠ Open assert failed (revealOpen=${revealOk}, contentReady=${contentOk}, revealClear=${clearOk})` +
				(attempt < maxAttempts ? '; retrying…' : ''),
		);
	}

	return false;
}

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
			undefined,
			{ timeout },
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Wait until reveal-section (envelope/cover) has a non-zero layout box and is not hidden.
 */
export async function waitForRevealSectionLaidOut(
	page: Page,
	timeout = REVEAL_LETTER_LAID_OUT_TIMEOUT,
): Promise<boolean> {
	try {
		await page.waitForFunction(
			() => {
				const section = document.querySelector(
					'[data-screenshot="reveal-section"], ds-envelope-reveal, ds-editorial-cover',
				);
				if (!(section instanceof HTMLElement) || section.hidden) return false;
				const rect = section.getBoundingClientRect();
				return (
					rect.width >= 1 &&
					rect.height >= 1 &&
					window.getComputedStyle(section).display !== 'none'
				);
			},
			undefined,
			{ timeout },
		);
		return true;
	} catch {
		return false;
	}
}

/** DOM probe for unit-tested reveal-open evaluation (browser gathers, Node asserts). */
export interface RevealOpenDomProbe {
	hasRevealSection: boolean;
	previewState: string;
	revealState: string;
	wrapperRevealState: string;
	hasPreviewOpenedClass: boolean;
	hasOpenClass: boolean;
	hasRevealedClass: boolean;
	triggerExpanded: boolean;
	openContentLaidOut: boolean;
}

/**
 * Deterministic reveal-open evaluation from DOM probes.
 * Uses `data-preview-state` (envelope/editorial contract) and wrapper reveal state.
 * Does not treat letter visibility or inverted `envelope-open` as open.
 */
export function evaluateRevealIsOpen(probe: RevealOpenDomProbe): boolean {
	if (!probe.hasRevealSection) {
		return probe.openContentLaidOut;
	}
	if (probe.previewState === 'opened' || probe.previewState === 'open') return true;
	if (
		probe.revealState === 'open' ||
		probe.revealState === 'revealed' ||
		probe.revealState === 'preview-opened'
	) {
		return true;
	}
	if (probe.hasPreviewOpenedClass || probe.hasOpenClass || probe.hasRevealedClass) return true;
	if (probe.wrapperRevealState === 'revealed' || probe.wrapperRevealState === 'preview-opened') {
		return true;
	}
	if (probe.triggerExpanded) return true;
	return false;
}

/** DOM probe for unit-tested reveal occlusion checks. */
export interface RevealOcclusionDomProbe {
	present: boolean;
	hidden: boolean;
	display: string;
	visibility: string;
	opacity: number;
	width: number;
	height: number;
	intersectsViewport: boolean;
}

/** True when the reveal does not visually cover the invitation viewport. */
export function evaluateRevealDoesNotOcclude(probe: RevealOcclusionDomProbe): boolean {
	if (!probe.present) return true;
	if (probe.hidden) return true;
	if (probe.display === 'none' || probe.visibility === 'hidden' || probe.opacity <= 0.01) {
		return true;
	}
	if (probe.width <= 0 || probe.height <= 0) return true;
	return !probe.intersectsViewport;
}

/**
 * Check if the reveal section appears to be in an "open" state.
 * Looks for data-preview-state, data-reveal-state, CSS classes, and wrapper state.
 */
export async function checkRevealIsOpen(page: Page): Promise<boolean> {
	try {
		const probe = await page.evaluate((): RevealOpenDomProbe => {
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

			const section = document.querySelector('[data-screenshot="reveal-section"]');
			const openContent = document.querySelector(
				'[data-screenshot="invitation-open-content"]',
			);
			if (!section) {
				return {
					hasRevealSection: false,
					previewState: '',
					revealState: '',
					wrapperRevealState: '',
					hasPreviewOpenedClass: false,
					hasOpenClass: false,
					hasRevealedClass: false,
					triggerExpanded: false,
					openContentLaidOut: isLaidOut(openContent),
				};
			}

			const wrapper = section.closest('.event-theme-wrapper');
			const trigger = document.querySelector('[data-screenshot="reveal-trigger"]');
			return {
				hasRevealSection: true,
				previewState: section.getAttribute('data-preview-state') || '',
				revealState: section.getAttribute('data-reveal-state') || '',
				wrapperRevealState: wrapper?.getAttribute('data-reveal-state') || '',
				hasPreviewOpenedClass: section.classList.contains('is-preview-opened'),
				hasOpenClass: section.classList.contains('open'),
				hasRevealedClass: section.classList.contains('revealed'),
				triggerExpanded: trigger?.getAttribute('aria-expanded') === 'true',
				openContentLaidOut: isLaidOut(openContent),
			};
		});
		return evaluateRevealIsOpen(probe);
	} catch {
		return false;
	}
}

/**
 * After audit normalization, verify the reveal no longer covers the invitation.
 */
export async function assertRevealDoesNotOccludeInvitation(page: Page): Promise<boolean> {
	try {
		const probe = await page.evaluate((): RevealOcclusionDomProbe => {
			const reveal = document.querySelector(
				'[data-screenshot="reveal-section"], ds-envelope-reveal, ds-editorial-cover',
			);
			if (!reveal) {
				return {
					present: false,
					hidden: true,
					display: 'none',
					visibility: 'hidden',
					opacity: 0,
					width: 0,
					height: 0,
					intersectsViewport: false,
				};
			}
			const el = reveal as HTMLElement;
			const style = window.getComputedStyle(el);
			const box = el.getBoundingClientRect();
			const intersectsViewport =
				box.bottom > 0 &&
				box.top < window.innerHeight &&
				box.right > 0 &&
				box.left < window.innerWidth;
			return {
				present: true,
				hidden: Boolean(el.hidden) || el.hasAttribute('hidden'),
				display: style.display,
				visibility: style.visibility,
				opacity: Number.parseFloat(style.opacity || '1'),
				width: box.width,
				height: box.height,
				intersectsViewport,
			};
		});
		return evaluateRevealDoesNotOcclude(probe);
	} catch {
		return false;
	}
}
