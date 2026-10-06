import type { Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

/**
 * Layout evidence for a capture that still mismatches after its re-capture. Pixel diffs show that
 * a layout changed; this records the inputs it was resolved from (viewport units, fonts, image
 * intrinsic sizes and element boxes) so a nondeterministic layout can be traced to its cause.
 * `VISUAL_GEOMETRY_PROBE=1` records it for every capture, for local reproduction loops.
 */
export async function collectCaptureGeometry(page: Page, rootSelector: string): Promise<unknown> {
	return page.evaluate((selector) => {
		const round = (value: number) => Math.round(value * 100) / 100;
		const box = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return [round(rect.left), round(rect.top), round(rect.width), round(rect.height)];
		};
		const units = Object.fromEntries(
			['100vh', '100svh', '100lvh', '100dvh'].map((height) => {
				const probe = document.createElement('div');
				probe.style.cssText = `position:absolute;visibility:hidden;width:1px;height:${height}`;
				document.body.append(probe);
				const measured = probe.getBoundingClientRect().height;
				probe.remove();
				return [height, round(measured)];
			}),
		);
		const root = document.querySelector(selector);
		const elements = root
			? [root, ...Array.from(root.querySelectorAll('*'))]
					.filter((element) => element.getClientRects().length > 0)
					.slice(0, 80)
					.map((element) => ({
						tag: element.tagName.toLowerCase(),
						className:
							typeof element.className === 'string'
								? element.className.slice(0, 120)
								: '',
						box: box(element),
					}))
			: [];
		return {
			viewport: {
				innerWidth: window.innerWidth,
				innerHeight: window.innerHeight,
				visualViewport: window.visualViewport
					? [round(window.visualViewport.width), round(window.visualViewport.height)]
					: null,
				devicePixelRatio: window.devicePixelRatio,
				scroll: [round(window.scrollX), round(window.scrollY)],
				documentHeight: document.documentElement.scrollHeight,
			},
			units,
			fonts: {
				status: document.fonts.status,
				loaded: Array.from(document.fonts)
					.filter((font) => font.status === 'loaded')
					.map((font) => `${font.family} ${font.weight} ${font.style}`)
					.sort(),
			},
			animations: document.getAnimations().map((animation) => {
				const target = (animation.effect as KeyframeEffect | null)?.target;
				return {
					name:
						(animation as CSSAnimation).animationName ??
						(animation as CSSTransition).transitionProperty ??
						animation.constructor.name,
					target:
						target instanceof Element
							? `${target.tagName.toLowerCase()}.${String(target.className).slice(0, 60)}`
							: '',
					playState: animation.playState,
					currentTime:
						animation.currentTime === null ? null : Number(animation.currentTime),
				};
			}),
			timeline:
				document.timeline.currentTime === null
					? null
					: Number(document.timeline.currentTime),
			images: Array.from(root?.querySelectorAll('img') ?? []).map((image) => ({
				src: image.currentSrc.split('/').pop()?.slice(0, 80) ?? '',
				natural: [image.naturalWidth, image.naturalHeight],
				complete: image.complete,
				box: box(image),
			})),
			elements,
		};
	}, rootSelector);
}

export function shouldProbeCaptureGeometry(comparisonResult: string): boolean {
	return comparisonResult === 'FAIL' || process.env.VISUAL_GEOMETRY_PROBE === '1';
}

export async function writeCaptureGeometry(
	testInfo: TestInfo,
	page: Page,
	rootSelector: string,
	imageSha256: string,
	beforeCapture?: unknown,
): Promise<void> {
	const geometry = await collectCaptureGeometry(page, rootSelector);
	await writeFile(
		testInfo.outputPath('capture-geometry.json'),
		`${JSON.stringify({ imageSha256, beforeCapture, geometry }, null, 2)}\n`,
	);
}
