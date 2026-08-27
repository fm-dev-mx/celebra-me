// =============================================================================
// CELEBRA-ME | Screenshot Tool — URL Construction & Navigation
// =============================================================================

import type { Page } from 'playwright';
import {
	type ScreenshotMode,
	type ScreenshotSelectorConfig,
	DEFAULT_NAVIGATION_TIMEOUT,
} from './types.js';
import { normalizeRouteIdentity, type RouteIdentity } from './scope.js';
import { disableAnimations, prepareAuditPage, prepareRawPage } from './page-preparation.js';

export type ScreenshotRevealState = 'open' | 'closed' | 'letter';

export interface ExpectedInvitationIdentity {
	routeIdentity: RouteIdentity;
	slug?: string;
}

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
		const ignored = new Set(['screenshot', 'reveal', 'forceEnvelope']);
		const comparable = (url: URL) =>
			Array.from(url.searchParams.entries())
				.filter(
					([key]) =>
						!ignored.has(key) &&
						!/^utm_/i.test(key) &&
						!['gclid', 'fbclid'].includes(key.toLowerCase()),
				)
				.sort(([aKey, aValue], [bKey, bValue]) =>
					aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
				)
				.map(([key, value]) => `${key}=${value}`)
				.join('&');
		if (comparable(current) !== comparable(target)) return false;
		for (const key of ['screenshot', 'reveal', 'forceEnvelope']) {
			if ((current.searchParams.get(key) ?? '') !== (target.searchParams.get(key) ?? ''))
				return false;
		}
		return true;
	} catch {
		return false;
	}
}

export function routeIdentityMatches(actual: RouteIdentity, expected: RouteIdentity): boolean {
	return actual.key === expected.key;
}

export async function assertScreenshotNavigationIdentity(
	page: Page,
	expected: ExpectedInvitationIdentity,
): Promise<void> {
	const actualRoute = normalizeRouteIdentity(page.url());
	if (!routeIdentityMatches(actualRoute, expected.routeIdentity)) {
		throw new Error(
			`SCREENSHOT_ROUTE_IDENTITY_MISMATCH: expected ${expected.routeIdentity.key}, received ${actualRoute.key}.`,
		);
	}
	if (!expected.slug) return;
	const renderedSlug = await page.evaluate(
		() =>
			document
				.querySelector('.event-theme-wrapper[data-event-slug]')
				?.getAttribute('data-event-slug') ?? null,
	);
	if (!renderedSlug || renderedSlug.toLowerCase() !== expected.slug.toLowerCase()) {
		throw new Error(
			`SCREENSHOT_RENDERED_IDENTITY_MISMATCH: expected invitation "${expected.slug}", received "${renderedSlug ?? 'none'}".`,
		);
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
	expectedInvitation?: ExpectedInvitationIdentity,
	waitSelectors: string[] = [],
): Promise<void> {
	// Same URL: skip goto and avoid stacking Playwright init scripts.
	if (isSameScreenshotNavigationUrl(page.url(), url)) {
		if (expectedInvitation) await assertScreenshotNavigationIdentity(page, expectedInvitation);
		for (const selector of waitSelectors) {
			await page.waitForSelector(selector, {
				state: 'attached',
				timeout: DEFAULT_NAVIGATION_TIMEOUT,
			});
		}
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
	await page.addInitScript((captureMode: ScreenshotMode) => {
		(window as Window & { __celebraScreenshotMode?: ScreenshotMode }).__celebraScreenshotMode =
			captureMode;
	}, mode);

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
	if (expectedInvitation) await assertScreenshotNavigationIdentity(page, expectedInvitation);

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
	} else {
		await prepareRawPage(page);
		if (animationHandling === 'disable') {
			await disableAnimations(page);
		}
	}
	for (const selector of waitSelectors) {
		await page.waitForSelector(selector, {
			state: 'attached',
			timeout: DEFAULT_NAVIGATION_TIMEOUT,
		});
	}
}
