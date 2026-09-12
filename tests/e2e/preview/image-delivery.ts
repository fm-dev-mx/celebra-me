import { type Page } from '@playwright/test';

export interface RenderedImageDelivery {
	url: string;
	redactedUrl: string;
	altOrKey: string;
	section: string;
	naturalWidth: number;
}

export function redactImageUrl(value: string): string {
	const url = new URL(value);
	return url.hostname + url.pathname;
}

/** Throws a stable, credential-free diagnostic for every renderable image that cannot render. */
export async function assertRenderedImageDelivery(page: Page): Promise<RenderedImageDelivery[]> {
	const images = page.locator('img');
	await images.evaluateAll((nodes) => {
		for (const node of nodes) (node as HTMLImageElement).loading = 'eager';
	});
	for (let index = 0; index < (await images.count()); index += 1) {
		const image = images.nth(index);
		if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
	}
	const results = await images.evaluateAll(async (nodes) =>
		Promise.all(
			nodes
				.map((node) => node as HTMLImageElement)
				.filter(
					(node) =>
						node.getClientRects().length > 0 && Boolean(node.currentSrc || node.src),
				)
				.map(async (node) => {
					const url = node.currentSrc || node.src;
					const altOrKey = node.dataset.assetKey || node.alt || 'unnamed-image';
					const section =
						node.closest<HTMLElement>('[data-section-kind]')?.dataset.sectionKind ??
						'page';
					try {
						await node.decode();
					} catch {
						return { failure: section + '/' + altOrKey + ': decode failed for ' + url };
					}
					if (!node.complete || node.naturalWidth <= 0) {
						return { failure: section + '/' + altOrKey + ': unloaded ' + url };
					}
					return {
						delivery: {
							url,
							redactedUrl: '',
							altOrKey,
							section,
							naturalWidth: node.naturalWidth,
						},
					};
				}),
		),
	);
	const failures = results
		.map((result) => result.failure)
		.filter((failure): failure is string => typeof failure === 'string')
		.map((failure) => failure.replace(/https?:\/\/[^\s]+/u, (url) => redactImageUrl(url)));
	if (failures.length > 0) {
		throw new Error('IMAGE_DELIVERY_FAILED:\n' + failures.join('\n'));
	}
	const unique = new Map<string, RenderedImageDelivery>();
	for (const result of results) {
		const observed = result.delivery;
		if (!observed) continue;
		const delivery: RenderedImageDelivery = {
			...observed,
			redactedUrl: redactImageUrl(observed.url),
		};
		if (!unique.has(delivery.url)) unique.set(delivery.url, delivery);
	}
	return [...unique.values()];
}
