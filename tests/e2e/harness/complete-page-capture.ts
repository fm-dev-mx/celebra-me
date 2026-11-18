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
// photos and counter all follow the section) are read together at one moment of it; centring each
// photo showed the counter at two pages and the photos scattered. That moment is the scene's end,
// their last keyframe, where its story is complete (the album assembled, the lantern at the last
// stop with its venue, the family names lit), except an animation that runs as the scene exits,
// read at its first keyframe before it leaves: the centred scene sat at the lantern route's
// crossover, where one venue has left and the next has not arrived. A scene that opens the page
// (the cover approach) is read at the top instead, as a guest first sees it.
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
		// Each group is read at one scroll position (an element to centre, or the page top) or
		// pinned at its first or last keyframe.
		type GroupKey = Element | 'top' | 'here' | 'before' | 'end';
		const groupKey = (timeline: AnimationTimeline, animation: Animation): GroupKey => {
			if (!completePage) return 'here';
			const subject = (timeline as AnimationTimeline & { subject?: Element }).subject;
			const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
			if (!subject || !target) return 'top';
			// A view() on a pseudo-element (a mirror ball on a card's `::before`) has the
			// pseudo-element, a child of the animated element, as its subject: it follows that
			// element, read centred like its own timeline, not as a later element arriving.
			if (subject === target) return target;
			const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement;
			if (pseudo && subject.parentElement === target) return target;
			if (subject.contains(target)) {
				return subject.getBoundingClientRect().top + scrollY < 1 ? 'top' : 'end';
			}
			const later =
				(target.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
			return later ? 'before' : target;
		};
		// An animation whose range starts as the scene exits (a block fading out as its section
		// leaves) ends hidden; its scene is complete at its first keyframe, still at rest.
		const rangeName = (animation: Animation): unknown => {
			const start = (animation as Animation & { rangeStart?: unknown }).rangeStart;
			return typeof start === 'object' && start !== null
				? (start as { rangeName?: unknown }).rangeName
				: start;
		};
		const leaving = (animation: Animation): boolean => {
			const name = rangeName(animation);
			return typeof name === 'string' && name.startsWith('exit');
		};
		// A scene animation with no range of its own runs over its section's whole pass and may
		// fade out as the section leaves (the veiled-photo quote, the framed family card): it is
		// complete at its last fully visible keyframe, not at its hidden end. One with a range
		// (a camera flash that peaks and clears) still ends at its last keyframe.
		const opacityOf = (frame: ComputedKeyframe): number => {
			const value = frame.opacity;
			if (value === undefined || value === null) return 1;
			const amount = Number.parseFloat(String(value));
			if (!Number.isFinite(amount)) return 1;
			return String(value).trim().endsWith('%') ? amount / 100 : amount;
		};
		// A pinned frame is replayed with `direction: normal`, so an animation that plays in
		// reverse (the jewel-box quote leaving its shared stage) starts its scene at its last
		// keyframe and ends it at its first.
		const reversed = (animation: Animation): boolean => {
			const direction = animation.effect?.getTiming().direction;
			return direction === 'reverse' || direction === 'alternate-reverse';
		};
		const lastShown = (animation: Animation): number => {
			const end = reversed(animation) ? 0 : 1;
			let frames: ComputedKeyframe[];
			try {
				frames = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
			} catch {
				return end;
			}
			const last = end === 0 ? frames.at(0) : frames.at(-1);
			if (rangeName(animation) !== 'normal' || !last || opacityOf(last) > 0) return end;
			let best = { opacity: 0, offset: end };
			for (const frame of end === 0 ? [...frames].reverse() : frames) {
				const opacity = opacityOf(frame);
				if (opacity > 0 && opacity >= best.opacity) {
					best = { opacity, offset: frame.computedOffset };
				}
			}
			return best.opacity > 0 ? best.offset : end;
		};
		const keyframe = (key: 'before' | 'end', animation: Animation): number => {
			if (key === 'end' && !leaving(animation)) return lastShown(animation);
			return reversed(animation) ? 1 : 0;
		};
		// The progress a scroll-driven animation shows at scroll offset `offset`, worked out from
		// layout instead of read from its timeline: a timeline can keep the previous scroll
		// position for several frames, long enough for two reads to agree on the stale value (on
		// CI the disco hero kept the page foot's lift and the photo pass its unentered, hidden
		// first frame). Null when the timing is one this does not model; the live read stands.
		const unitValue = (value: unknown, unit: string): number | null => {
			const measured = value as { unit?: string; value?: number } | null;
			return measured && measured.unit === unit && Number.isFinite(measured.value)
				? (measured.value as number)
				: null;
		};
		const progressAt = (animation: Animation, offset: number): number | null => {
			const effect = animation.effect;
			const timeline = animation.timeline as
				| (AnimationTimeline & {
						source?: Element | null;
						axis?: string;
						subject?: Element;
						startOffset?: unknown;
						endOffset?: unknown;
				  })
				| null;
			if (!effect || !timeline || timeline === document.timeline) return null;
			if (timeline.source !== document.scrollingElement) return null;
			if (timeline.axis !== undefined && timeline.axis !== 'block' && timeline.axis !== 'y')
				return null;
			const timing = effect.getTiming();
			if (
				timing.iterations !== 1 ||
				(timing.easing ?? 'linear') !== 'linear' ||
				Number(timing.delay ?? 0) !== 0 ||
				Number(timing.endDelay ?? 0) !== 0
			)
				return null;
			const viewport = innerHeight;
			// The ranges CSS names, as scroll offsets [start, end].
			let ranges: Record<string, [number, number]>;
			if (timeline.subject) {
				const coverStart = unitValue(timeline.startOffset, 'px');
				const coverEnd = unitValue(timeline.endOffset, 'px');
				if (coverStart === null || coverEnd === null) return null;
				const top = coverStart + viewport;
				const height = coverEnd - top;
				const fit = Math.min(height, viewport);
				ranges = {
					normal: [coverStart, coverEnd],
					cover: [coverStart, coverEnd],
					contain:
						height <= viewport
							? [top + height - viewport, top]
							: [top, top + height - viewport],
					entry: [coverStart, coverStart + fit],
					exit: [top + height - fit, coverEnd],
					'entry-crossing': [coverStart, coverStart + height],
					'exit-crossing': [top, coverEnd],
				};
			} else {
				const max = (document.scrollingElement as Element).scrollHeight - viewport;
				ranges = { normal: [0, max] };
			}
			const edge = (value: unknown, side: 0 | 1): number | null => {
				if (value === 'normal' || value === undefined) return ranges.normal[side];
				const { rangeName, offset: amount } = value as {
					rangeName?: string;
					offset?: unknown;
				};
				const range = ranges[rangeName ?? 'normal'];
				const share = unitValue(amount, 'percent');
				if (!range || share === null) return null;
				return range[0] + (share / 100) * (range[1] - range[0]);
			};
			const scrolled = animation as Animation & { rangeStart?: unknown; rangeEnd?: unknown };
			const start = edge(scrolled.rangeStart, 0);
			const end = edge(scrolled.rangeEnd, 1);
			if (start === null || end === null || end <= start) return null;
			const forward = Math.min(1, Math.max(0, (offset - start) / (end - start)));
			const direction = timing.direction ?? 'normal';
			return direction === 'reverse' || direction === 'alternate-reverse'
				? 1 - forward
				: forward;
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
			if (key === 'before' || key === 'end') {
				for (const animation of animations)
					pinned.push([animation, keyframe(key, animation)]);
				continue;
			}
			if (key === 'top') window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
			else if (key !== 'here') key.scrollIntoView({ block: 'center', behavior: 'instant' });
			const read = (): Array<number | null> =>
				animations.map((animation) => {
					try {
						return animation.effect?.getComputedTiming().progress ?? null;
					} catch {
						// An unreadable timing leaves the animation to be cancelled below.
						return null;
					}
				});
			// A scroll timeline can report the progress of the previous scroll position for a few
			// frames after the jump: the night-arch hero read at the page top kept the zoom of the
			// page foot on a fast machine and not on CI. Read once two frames agree.
			let live = read();
			for (let attempt = 0; attempt < 30; attempt++) {
				await frames();
				const next = read();
				const settled = next.every((value, index) => value === live[index]);
				live = next;
				if (settled && attempt > 0) break;
			}
			const computed = animations.map((animation) => progressAt(animation, scrollY));
			const progresses = computed.map((value, index) => value ?? live[index]);
			animations.forEach((animation, index) => pinned.push([animation, progresses[index]]));
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
		// scrollIntoView also scrolls clipped ancestors: a section with overflow hidden whose
		// decoration overflows it by a few pixels keeps that offset, and its content renders
		// shifted. Readers cannot scroll such boxes, so return them to their origin. Rails the
		// reader can scroll (auto/scroll) keep their framing.
		const clipped = (value: string) => value === 'hidden' || value === 'clip';
		for (const element of document.querySelectorAll<HTMLElement>('body *')) {
			if (!element.scrollTop && !element.scrollLeft) continue;
			const style = getComputedStyle(element);
			if (clipped(style.overflowY) && element.scrollTop) element.scrollTop = 0;
			if (clipped(style.overflowX) && element.scrollLeft) element.scrollLeft = 0;
		}
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
