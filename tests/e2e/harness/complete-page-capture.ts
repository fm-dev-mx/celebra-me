import { test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
	collectPresentationEvidence,
	presentationFailures,
} from '../../../scripts/screenshot/presentation-evidence';
import { getOperationalToolbarSelectors } from '../../../scripts/screenshot/utils';
// Stabilization permits no above-threshold pixels; baseline comparison keeps its own budget.
import { hasVisiblePixelChange } from '../../../scripts/screenshot/visual-yiq';

export async function initializeVisualCapture(
	page: Page,
	now = new Date('2026-09-10T19:37:17.052Z'),
): Promise<void> {
	// Keep the matrix epoch stable; temporal behavior tests supply an explicit epoch.
	// This changes only the browser clock, never invitation dates or persisted data.
	await page.clock.setFixedTime(now);
	await page.addInitScript(() => {
		Object.assign(window, { __celebraScreenshotMode: 'audit' });
		document.addEventListener(
			'DOMContentLoaded',
			() => {
				// Pin the final font from the Linux runtime instead of Chromium's lazy
				// generic fallback, which can change line metrics during the first PNG.
				for (const number of document.querySelectorAll<HTMLElement>(
					'.gift-card__table-number-code',
				)) {
					number.style.setProperty('--font-mono', '"Liberation Mono", monospace');
				}
			},
			{ once: true },
		);
	});
}

export async function captureStablePage(page: Page, fullPage = false): Promise<Buffer> {
	// A 1440px-wide complete page can take 4-5 seconds per PNG before comparison.
	const timeout = fullPage ? 20_000 : 5_000;
	const deadline = Date.now() + timeout;
	const started = Date.now();
	const captureTimes: number[] = [];
	let penultimate: Buffer | undefined;
	let previous = await page.screenshot({ fullPage, animations: 'disabled' });
	captureTimes.push(Date.now() - started);
	while (Date.now() < deadline) {
		await page.waitForTimeout(100);
		const current = await page.screenshot({ fullPage, animations: 'disabled' });
		captureTimes.push(Date.now() - started);
		if (current.equals(previous)) return current;
		const [before, after] = await Promise.all(
			[previous, current].map((image) =>
				sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
			),
		);
		if (
			before.info.width === after.info.width &&
			before.info.height === after.info.height &&
			!hasVisiblePixelChange(before.data, after.data)
		)
			return current;
		penultimate = previous;
		previous = current;
	}
	// Keep the actual failing frames, not a fresh screenshot of a later state.
	const info = test.info();
	await mkdir(info.outputDir, { recursive: true });
	await writeFile(info.outputPath('capture-stability-current-actual.png'), previous);
	if (penultimate)
		await writeFile(info.outputPath('capture-stability-previous-actual.png'), penultimate);
	await writeFile(
		info.outputPath('capture-stability.json'),
		JSON.stringify({ timeoutMs: timeout, elapsedMs: Date.now() - started, captureTimes }),
	);
	throw new Error(`Page capture did not stabilize within ${timeout / 1000} seconds.`);
}

export async function waitForVisualHydration(
	page: Page,
	options: { completePage?: boolean } = {},
): Promise<void> {
	const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
	await page.waitForFunction(() =>
		Array.from(document.querySelectorAll('astro-island[ssr]')).every(
			(island) => island.getClientRects().length === 0,
		),
	);
	const fields = page.locator('.rsvp__field');
	for (let index = 0; index < (await fields.count()); index++) {
		const field = fields.nth(index);
		if (!(await field.isVisible())) continue;
		await field.scrollIntoViewIfNeeded();
		await page.waitForFunction(
			(element) => {
				for (let node: Element | null = element; node; node = node.parentElement) {
					if (
						node instanceof HTMLElement &&
						node.style.opacity !== '' &&
						Number(node.style.opacity) < 1
					)
						return false;
				}
				return true;
			},
			await field.elementHandle(),
		);
	}
	await page.evaluate(async (position) => {
		window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
		await document.fonts.ready;
		// Loaded images can still paint a partially decoded frame; decoding changes timing only.
		// Unloaded (lazy, off-screen) images are skipped because decode() would wait for them.
		await Promise.all(
			Array.from(document.images)
				.filter((image) => image.complete && image.naturalWidth > 0)
				.map((image) => image.decode().catch(() => undefined)),
		);
	}, scroll);
	await settleFiniteAnimations(page, options.completePage ?? false);
}

// The fixed capture clock barely advances the animation timeline, so entrance animations are
// still running at capture time and each screenshot depended on Playwright fast-forwarding them
// in that instant. Finishing finite animations makes the captured state their end state.
// A scroll-driven animation (`animation-timeline: view()`, a named view timeline or
// `scroll(root)`) does not stay finished: its progress keeps following the scroll position, and a
// complete-page capture resizes the viewport, so each PNG caught it at a different point. Its end
// state is often an exit state (a booth photo leaving, a program item hidden), so it is pinned,
// on the document timeline and paused, at the progress a guest sees: in a viewport capture the
// one at the captured scroll position; in a complete-page capture, which has no single scroll
// position, the one with the animated element centred on screen (a root scroll timeline at the
// top of the page). Elements animated on an enclosing scene's timeline (a sticky album whose
// photos and counter all follow the section) are read with that scene centred, so they show one
// moment of it; centring each photo showed the counter at two pages and the photos scattered.
// An animation driven by a later element's timeline (a stacked card recedes
// while its successor arrives) shows its state before that element arrives, its first keyframe:
// a complete page lays every card out at once, and centring either card caught it half receded.
// Infinite animations stay with Playwright.
async function settleFiniteAnimations(page: Page, completePage: boolean): Promise<void> {
	await page.evaluate(async (completePage) => {
		const frames = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
		const start = { x: scrollX, y: scrollY };
		const finite = document.getAnimations().filter((animation) => {
			try {
				return Number.isFinite(animation.effect?.getComputedTiming().iterations);
			} catch {
				return false;
			}
		});
		// Each group is read at one scroll position: an element to centre, or the page top.
		type GroupKey = Element | 'top' | 'here' | 'before';
		const groupKey = (timeline: AnimationTimeline, animation: Animation): GroupKey => {
			if (!completePage) return 'here';
			const subject = (timeline as AnimationTimeline & { subject?: Element }).subject;
			const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
			if (!subject || !target) return 'top';
			if (subject.contains(target)) return subject;
			const later =
				(target.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			return later ? 'before' : target;
		};
		const groups = new Map<GroupKey, Animation[]>();
		for (const animation of finite) {
			const { timeline } = animation;
			if (!timeline || timeline === document.timeline) continue;
			const key = groupKey(timeline, animation);
			groups.set(key, [...(groups.get(key) ?? []), animation]);
		}
		const pinned: Array<[Animation, number | null]> = [];
		const committed = new Set<Animation>();
		for (const [key, animations] of groups) {
			// Capture mode (`?screenshot`) forces `animation-duration: 0s !important`. That ends a
			// time-based animation at once, but it collapses a scroll-driven range to a point, so
			// the animation jumps between its first and last keyframe as the scroll crosses it and
			// never shows its middle (the veiled-photo quote ends at opacity 0). `auto` gives it
			// back its whole range. A CSS animation has no fill by default, so past its range it
			// reports no progress and would fall back to its unanimated style; a filled one
			// reports 0 or 1 there.
			for (const animation of animations) {
				try {
					animation.effect?.updateTiming({ duration: 'auto', fill: 'both' });
				} catch {
					// Read below as unreadable and cancelled.
				}
			}
			if (key === 'before') {
				for (const animation of animations) pinned.push([animation, 0]);
				continue;
			}
			if (key === 'top') window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
			else if (key !== 'here') key.scrollIntoView({ block: 'center', behavior: 'instant' });
			await frames();
			for (const animation of animations) {
				let progress: number | null = null;
				try {
					progress = animation.effect?.getComputedTiming().progress ?? null;
				} catch {
					// An unreadable timing leaves the animation to be cancelled below.
				}
				pinned.push([animation, progress]);
			}
		}
		for (const [animation, progress] of pinned) {
			try {
				if (progress === null || !animation.effect) {
					animation.cancel();
					continue;
				}
				animation.timeline = document.timeline;
				animation.effect.updateTiming({
					delay: 0,
					endDelay: 0,
					duration: 1000,
					iterations: 1,
					direction: 'normal',
					easing: 'linear',
					fill: 'both',
				});
				animation.pause();
				animation.currentTime = progress * 1000;
				// A pinned frame left as a live animation did not hold: after one of Playwright's
				// `animations: 'disabled'` screenshots the veiled-arch scroll cue rendered its last
				// keyframe (opacity 0) while the animation still reported progress 0, so the cue
				// vanished between two PNGs of the same page. An element keeps the frame as inline
				// style with the animation cancelled, which leaves the screenshot nothing to move.
				const { pseudoElement, target } = animation.effect as KeyframeEffect;
				if (target && !pseudoElement) {
					animation.commitStyles();
					animation.cancel();
					committed.add(animation);
					continue;
				}
				// A pseudo-element cannot take inline style. Playwright skips animations with a zero
				// playback rate, so it leaves this pinned frame alone instead of finishing it.
				animation.updatePlaybackRate(0);
			} catch {
				// One animation that cannot be pinned must not leave the rest running.
				animation.cancel();
			}
		}
		window.scrollTo({ left: start.x, top: start.y, behavior: 'instant' });
		for (const animation of finite) {
			try {
				// Finishing a cancelled animation would play it again, at its last frame.
				if (animation.playbackRate === 0 || committed.has(animation)) continue;
				if (animation.playState !== 'finished') animation.finish();
			} catch {
				animation.cancel();
			}
		}
		await frames();
	}, completePage);
}

export async function assertNoOperationalTooling(page: Page): Promise<void> {
	const selectors = getOperationalToolbarSelectors();
	const visibleSelector = await page.evaluate((selectorList) => {
		for (const selector of selectorList) {
			const elements = document.querySelectorAll(selector);
			for (const element of elements) {
				const style = getComputedStyle(element);
				if (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					style.opacity !== '0' &&
					element.getClientRects().length > 0
				) {
					return selector;
				}
			}
		}
		return null;
	}, selectors);
	if (visibleSelector) {
		throw new Error('Visible operational tooling: ' + visibleSelector);
	}
}

export async function hideOperationalTooling(page: Page): Promise<void> {
	await page.addStyleTag({
		content: getOperationalToolbarSelectors().join(',') + '{display:none!important}',
	});
}

export async function prepareCompletePage(
	page: Page,
	options: { galleryScrollLeft?: number } = {},
): Promise<void> {
	await hideOperationalTooling(page);
	await page.evaluate(async () => {
		await document.fonts.ready;
		// A body scroll container hides most of the document from native full-page capture.
		if (
			document.body.scrollHeight > document.body.clientHeight + 1 &&
			document.documentElement.scrollHeight <= innerHeight + 1
		) {
			document.body.style.height = 'auto';
			document.body.style.maxHeight = 'none';
			document.body.style.overflowY = 'visible';
			document.documentElement.style.overflowY = 'visible';
		}
		for (const image of document.images) {
			image.loading = 'eager';
			// A tall complete-page raster can evict decoded images, and Chromium then paints
			// an async-decoding image as an empty box until its re-decode lands, so one PNG
			// shows the photo and the next a blank card. Sync decoding makes raster wait for it.
			image.decoding = 'sync';
		}
	});
	const sections = page.locator(
		'[data-section-id], .invitation-section-wrapper[data-section-kind], astro-island, img, footer, .gift-card',
	);
	const sectionCount = await sections.count();
	for (let index = 0; index < sectionCount; index++) {
		if (!(await sections.nth(index).isVisible())) continue;
		await sections.nth(index).scrollIntoViewIfNeeded();
		await page.waitForTimeout(40);
	}
	// A short editorial item at the foot of a tall section can be skipped by the section visits:
	// it never crosses the entrance line, so it stays pending and paints as a blank gap.
	// Centering puts it above the entrance line even when it already sits low in the viewport.
	await page.evaluate(async () => {
		for (const item of Array.from(
			document.querySelectorAll<HTMLElement>('[data-reveal-pending]'),
		)) {
			if (!item.hasAttribute('data-reveal-pending') || !item.checkVisibility()) continue;
			item.scrollIntoView({ block: 'center', behavior: 'instant' });
			await new Promise((resolve) => setTimeout(resolve, 40));
		}
	});
	await waitForVisualHydration(page, { completePage: true });
	const giftNumber = page.locator('.gift-card__table-number-code').first();
	if (await giftNumber.isVisible()) {
		// Chromium resolves the pinned system monospace lazily on the first rasterization.
		// Only a complete-page raster exercises that path, so discard one before geometry
		// is measured and before the stable capture pair is recorded.
		await page.screenshot({ fullPage: true, animations: 'disabled' });
	}
	await page.waitForFunction(() =>
		Array.from(document.images).every(
			(image) => !image.currentSrc || (image.complete && image.naturalWidth > 0),
		),
	);
	await page.evaluate(async (galleryScrollLeft) => {
		// Loaded bytes alone do not guarantee that async-decoded images have painted.
		await Promise.all(
			Array.from(document.images)
				.filter((image) => image.currentSrc)
				.map((image) => image.decode()),
		);
		// Preserve an explicitly accepted rail framing despite image visits and scroll snapping.
		if (galleryScrollLeft !== undefined) {
			for (const rail of document.querySelectorAll<HTMLElement>('.gallery-grid')) {
				rail.style.scrollSnapType = 'none';
				rail.scrollTo({ left: galleryScrollLeft, behavior: 'instant' });
			}
		}
	}, options.galleryScrollLeft);
	await settleFiniteAnimations(page, true);
	await page.evaluate(async () => {
		document.body.scrollTop = 0;
		window.scrollTo({ top: 0, behavior: 'instant' });
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
	await assertNoOperationalTooling(page);
	const failures = presentationFailures(await collectPresentationEvidence(page));
	if (failures.length) throw new Error(failures.join('\n'));
}

export async function assertCompletePageImage(page: Page, image: Buffer): Promise<void> {
	const metadata = await sharp(image).metadata();
	const extent = await page.evaluate(() => {
		const sections = [
			...document.querySelectorAll(
				'[data-section-id], .invitation-section-wrapper[data-section-kind], footer',
			),
		];
		return {
			height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
			lastBottom: Math.max(
				0,
				...sections.map(
					(section) => section.getBoundingClientRect().bottom + window.scrollY,
				),
			),
			viewport: innerHeight,
		};
	});
	if (
		!metadata.height ||
		metadata.height < extent.height - 1 ||
		metadata.height < extent.lastBottom - 1 ||
		(extent.height > extent.viewport && metadata.height <= extent.viewport)
	) {
		throw new Error(
			'Truncated complete-page capture: ' +
				JSON.stringify({ imageHeight: metadata.height, ...extent }),
		);
	}
	await assertNoOperationalTooling(page);
}

export async function captureCompletePage(page: Page): Promise<Buffer> {
	const image = await captureStablePage(page, true);
	await assertCompletePageImage(page, image);
	return image;
}
