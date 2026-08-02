// =============================================================================
// CELEBRA-ME | Screenshot Tool — URL Construction & Navigation
// =============================================================================

import type { Page } from 'playwright';
import {
	type ScreenshotMode,
	type ScreenshotSelectorConfig,
	DEFAULT_NAVIGATION_TIMEOUT,
} from './types.js';
import { disableAnimations, prepareAuditPage, prepareRawPage } from './page-preparation.js';

export type ScreenshotRevealState = 'open' | 'closed' | 'letter';

/**
 * Build a screenshot-mode URL by adding query parameters.
 * Merges with any existing query params on the URL.
 *
 * - `closed` / `letter`: also sets `forceEnvelope=true` so localStorage cannot skip the envelope.
 * - `letter`: server paints measurable envelope + card (`previewState=letter` / `is-letter-held`).
 * - `open`: envelope lands at `preview-opened` (transitional letter preview). Content captures
 *   must then call `normalizeInvitationRevealedForCapture` (via `ensureInvitationOpenForCapture`)
 *   to reach `revealed` before Hero / section / full-page shots.
 */
export function buildScreenshotUrl(baseUrl: string, revealState?: ScreenshotRevealState): string {
	const url = new URL(baseUrl);
	url.searchParams.set('screenshot', '1');
	if (revealState) {
		url.searchParams.set('reveal', revealState);
	}
	if (revealState === 'closed' || revealState === 'letter') {
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
 * True when the page is already on the same screenshot navigation target
 * (path + screenshot/reveal/forceEnvelope). Skips redundant full reloads.
 */
export function isSameScreenshotNavigationUrl(currentHref: string, targetHref: string): boolean {
	try {
		const current = new URL(currentHref);
		const target = new URL(targetHref);
		if (current.origin !== target.origin || current.pathname !== target.pathname) {
			return false;
		}
		const keys = ['screenshot', 'reveal', 'forceEnvelope'] as const;
		for (const key of keys) {
			if ((current.searchParams.get(key) ?? '') !== (target.searchParams.get(key) ?? '')) {
				return false;
			}
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Navigate to a URL and wait for the page to stabilise.
 * No-ops (no goto / no prepare) when already on the same screenshot URL.
 */
export async function navigateTo(
	page: Page,
	url: string,
	mode: ScreenshotMode,
	animationHandling: string,
	criticalSelectors: ScreenshotSelectorConfig[] = [],
	hideSelectors: string[] = [],
): Promise<void> {
	// Same URL: skip goto and avoid stacking Playwright init scripts.
	if (isSameScreenshotNavigationUrl(page.url(), url)) {
		return;
	}

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
		let skipLazyScroll: boolean;
		try {
			const reveal = new URL(url).searchParams.get('reveal');
			skipLazyScroll = reveal === 'closed' || reveal === 'letter';
		} catch {
			skipLazyScroll = false;
		}
		await prepareAuditPage(page, criticalSelectors, hideSelectors, {
			skipLazyScroll,
		});
		return;
	}

	await prepareRawPage(page);
	if (animationHandling === 'disable') {
		await disableAnimations(page);
	}
}
