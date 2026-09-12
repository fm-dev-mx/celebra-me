import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './public-preview-test';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
} from '../../../scripts/screenshot/visual-coverage-contract';
import { validatePublishedRoutes } from '../../../scripts/invitation/preview-public-routes';
import { assertRenderedImageDelivery } from './image-delivery';

const manifestPath = resolve(
	process.env.PREVIEW_PUBLIC_ROUTES_MANIFEST ?? '.tmp/playwright/preview-public-routes.json',
);
const manifestExists = existsSync(manifestPath);
const published = manifestExists
	? validatePublishedRoutes(JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown)
	: [];
const existing = new Set(
	buildVisualPageCases()
		.filter((item) => item.kind === 'invitation')
		.map((item) => `${item.eventType}/${item.slug}`),
);
const extra = published.filter((route) => !existing.has(`${route.eventType}/${route.slug}`));

test('published route inventory is complete and nonempty', () => {
	test.skip(
		!manifestExists,
		`Preview public routes manifest not found at ${manifestPath}. Run scripts/invitation/preview-public-routes.ts first.`,
	);
	expect(published.length).toBeGreaterThan(0);
	expect(new Set(published.map((route) => `${route.eventType}/${route.slug}`)).size).toBe(
		published.length,
	);
});

for (const route of extra) {
	for (const viewport of VISUAL_VIEWPORTS) {
		test(`unmanaged public images: ${route.eventType}/${route.slug} @ ${viewport.name}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			const responses = new Map<string, { status: number; mime: string }>();
			page.on('response', (response) => {
				if (response.request().resourceType() !== 'image') return;
				responses.set(response.url(), {
					status: response.status(),
					mime: response.headers()['content-type']?.split(';')[0]?.trim() ?? '',
				});
			});
			const response = await page.goto(
				`/${route.eventType}/${route.slug}?skipEnvelope=true&animations=off`,
				{ waitUntil: 'load' },
			);
			expect(response?.status()).toBe(200);
			expect(new URL(page.url()).pathname).toBe(`/${route.eventType}/${route.slug}`);
			const images = await assertRenderedImageDelivery(page);
			const failures = images.flatMap((image) => {
				const delivered = responses.get(image.url);
				if (!delivered)
					return [
						`${image.section}/${image.altOrKey}: no HTTP response for ${image.redactedUrl}`,
					];
				if (delivered.status >= 400)
					return [
						`${image.section}/${image.altOrKey}: HTTP ${delivered.status} for ${image.redactedUrl}`,
					];
				if (!delivered.mime.startsWith('image/'))
					return [
						`${image.section}/${image.altOrKey}: invalid MIME for ${image.redactedUrl}`,
					];
				return [];
			});
			expect(failures).toEqual([]);
		});
	}
}
