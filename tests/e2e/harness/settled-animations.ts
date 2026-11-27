import type { Page } from '@playwright/test';

/**
 * Waits until every finite, time-driven animation and transition of the page has ended or been
 * cancelled. Endless ones (ambient sway) and scroll-driven ones never end, so they are ignored.
 * Two frames go first, so an entrance started by a scroll or a click is already registered.
 */
export async function waitForSettledAnimations(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every(
				(animation) =>
					animation.playState !== 'running' ||
					!(animation.timeline instanceof DocumentTimeline) ||
					animation.effect?.getComputedTiming().endTime === Infinity,
			),
	);
}
