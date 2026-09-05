import fs from 'node:fs';
import { expect, test } from './public-preview-test';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
} from '../../../scripts/screenshot/visual-coverage-contract';
import { listInvitationDefinitions } from '../../../scripts/provision/invitations/registry';
import { buildSemanticAssetMap } from '../../../scripts/provision/normalized-invitation-release';

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
					sections
						.map((section) => section.getAttribute('data-section-kind'))
						.filter((kind) => kind !== 'interlude'),
				);
			// Public invitations do not fabricate personalized access without a guest.
			const expected = content.sectionOrder
				.map((kind: string) =>
					kind === 'personalizedAccess' ? 'personalized-access' : kind,
				)
				.filter(
					(kind: string) =>
						kind !== 'interlude' &&
						(entry.kind === 'demo' || kind !== 'personalized-access'),
				);
			expect(actual).toEqual(expected);
			for (const [key, selector] of [
				['gallery', '.gallery-section'],
				['thankYou', '.thank-you-section'],
			] as const) {
				if (content[key]?.variant)
					await expect(root.locator(selector)).toHaveAttribute(
						'data-variant',
						content[key].variant,
					);
			}
		});
	}
}
