import fs from 'node:fs';
import { expect, test } from './public-preview-test';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
} from '../../../scripts/screenshot/visual-coverage-contract';
import { listInvitationDefinitions } from '../../../scripts/provision/invitations/registry';
import { buildSemanticAssetMap } from '../../../scripts/provision/normalized-invitation-release';
import { assertRenderedImageDelivery } from './image-delivery';

// Complements the controlled visual harness with the deployed public resolver.
// Deployment protection is handled by the existing read-only Preview fixture.
for (const entry of buildVisualPageCases()) {
	const definition = listInvitationDefinitions().find((item) => item.slug === entry.slug);
	const content = definition
		? definition.buildPublishedContent(buildSemanticAssetMap(definition))
		: JSON.parse(fs.readFileSync(entry.sourcePath!, 'utf8'));
	for (const viewport of VISUAL_VIEWPORTS) {
		test(`public content: ${entry.eventType}/${entry.slug} @ ${viewport.name}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			const imageResponses = new Map<
				string,
				{ status: number; mime: string; bytes: number }
			>();
			page.on('response', (assetResponse) => {
				if (assetResponse.request().resourceType() !== 'image') return;
				const contentType =
					assetResponse.headers()['content-type']?.split(';')[0]?.trim() ?? '';
				const contentLength = Number(assetResponse.headers()['content-length'] ?? 0);
				imageResponses.set(assetResponse.url(), {
					status: assetResponse.status(),
					mime: contentType,
					bytes: Number.isFinite(contentLength) ? contentLength : 0,
				});
			});
			const response = await page.goto(
				`/${entry.eventType}/${entry.slug}?skipEnvelope=true&animations=off`,
				{ waitUntil: 'load' },
			);
			expect(response?.status()).toBe(200);
			expect(new URL(page.url()).pathname).toBe(`/${entry.eventType}/${entry.slug}`);
			const root = page.locator('.event-theme-wrapper');
			if (definition) {
				await expect(root).toHaveAttribute('data-content-source', 'published');
				await expect(root).toHaveAttribute('data-content-version', /^[1-9]\d*$/u);
			}
			const actual = await root
				.locator('.invitation-section-wrapper[data-section-kind]')
				.evaluateAll((sections) =>
					sections.map((section) => section.getAttribute('data-section-kind')),
				);
			// Assert every declared interlude, including anchors on personalized access.
			// Public invitations do not fabricate personalized access without a guest.
			const expected = content.sectionOrder.flatMap((kind: string) => [
				...(kind === 'personalizedAccess'
					? entry.kind === 'demo'
						? ['personalized-access']
						: []
					: [kind]),
				...(content.interludes ?? [])
					.filter(
						(interlude: { afterSection: string }) => interlude.afterSection === kind,
					)
					.map(() => 'interlude'),
			]);
			expect(actual).toEqual(expected);
			for (const [key, selector] of [
				['gallery', '.gallery-section'],
				['thankYou', '.thank-you-section'],
			] as const) {
				if (!expected.includes(key)) {
					await expect(root.locator(selector)).toHaveCount(0);
					continue;
				}
				if (content[key]?.variant)
					await expect(root.locator(selector)).toHaveAttribute(
						'data-variant',
						content[key].variant,
					);
			}

			const delivered = await assertRenderedImageDelivery(page);
			const failures = delivered.flatMap((image) => {
				const response = imageResponses.get(image.url);
				if (!response)
					return [
						image.section +
							'/' +
							image.altOrKey +
							': no image response for ' +
							image.redactedUrl,
					];
				if (response.status >= 400)
					return [
						image.section +
							'/' +
							image.altOrKey +
							': HTTP ' +
							response.status +
							' for ' +
							image.redactedUrl,
					];
				if (!response.mime.startsWith('image/'))
					return [
						image.section +
							'/' +
							image.altOrKey +
							': invalid MIME ' +
							(response.mime || 'missing') +
							' for ' +
							image.redactedUrl,
					];
				return [];
			});
			expect(failures).toEqual([]);
			if (entry.slug === 'valentina-hernandez' && definition) {
				const manifestKeys = definition.assets.map((asset) => asset.key);
				expect(manifestKeys).toHaveLength(16);
				const deliveredKeys = new Set(
					delivered.flatMap((image) =>
						manifestKeys.filter((key) => image.url.includes('/assets/' + key + '-')),
					),
				);
				expect(deliveredKeys.has('hero')).toBe(true);
			}
		});
	}
}

test('public image delivery reports one broken external image with a redacted URL', async ({
	page,
}) => {
	await page.route('**/broken.webp*', (route) =>
		route.fulfill({ status: 404, contentType: 'image/webp' }),
	);
	await page.setContent(
		'<img src="https://images.example.test/broken.webp?token=secret" alt="Imagen de prueba" />',
	);
	await expect(assertRenderedImageDelivery(page)).rejects.toThrow(
		'IMAGE_DELIVERY_FAILED:\npage/Imagen de prueba: decode failed for images.example.test/broken.webp',
	);
});
