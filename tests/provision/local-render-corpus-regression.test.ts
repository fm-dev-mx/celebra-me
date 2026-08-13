/**
 * Deterministic render-contract sweep for every Local Render Corpus client.
 * Uses real corpus content shapes (canonical definitions + sanitized legacy fixtures).
 */
import { describe, expect, it } from '@jest/globals';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	assertLocalRenderCorpusIntegrity,
	corpusPublicRoute,
	EXPECTED_LOCAL_RENDER_CORPUS_SIZE,
	listLocalRenderCorpus,
} from '../../scripts/provision/local-render-corpus/registry.ts';
import {
	assertCanonicalRegistryCoveredByCorpus,
	resolveCorpusPublishedContent,
} from '../../scripts/provision/local-render-corpus/content.ts';
import { buildCorpusScreenshotConfig } from '../../scripts/provision/local-render-corpus/screenshot-pages.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

const SECTION_KEYS = [
	'quote',
	'family',
	'countdown',
	'location',
	'itinerary',
	'gallery',
	'gifts',
	'music',
	'personalizedAccess',
	'rsvp',
	'thankYou',
] as const;

function expectedDescriptorComponents(content: Record<string, unknown>): string[] {
	const sectionOrder = content.sectionOrder;
	if (Array.isArray(sectionOrder)) {
		return sectionOrder.filter((section) => section !== 'personalizedAccess').map(String);
	}
	// Legacy Production payloads may omit sectionOrder; infer from present section objects.
	// `music` often exists as an empty/disabled object and is intentionally absent from descriptors.
	return SECTION_KEYS.filter(
		(key) =>
			key !== 'personalizedAccess' &&
			key !== 'music' &&
			content[key] &&
			typeof content[key] === 'object',
	);
}

describe('local render corpus regression sweep', () => {
	const corpus = listLocalRenderCorpus();

	it('registers exactly the 15 supported Production clients', () => {
		assertLocalRenderCorpusIntegrity();
		assertCanonicalRegistryCoveredByCorpus();
		expect(corpus).toHaveLength(EXPECTED_LOCAL_RENDER_CORPUS_SIZE);
		expect(corpus.map((entry) => entry.slug)).toEqual([
			'alba-rosa-quinonez',
			'abril-michelle-becerra-rea',
			'romina-rios-chaparro',
			'daniela-y-martin',
			'victoria-y-roberto',
			'america-johana',
			'valentina-hernandez',
			'xareni-iyarit',
			'leah-lexa',
			'luna-y-estrella',
			'cesar-ramses',
			'ayrin-samantha-lerma-castro',
			'ana-sofia-cota-guillen',
			'ximena-meza-trasvina',
			'gerardo-sesenta',
		]);
	});

	it('requires published canonical definitions to stay inside the Production corpus', () => {
		const corpusSlugs = new Set(corpus.map((entry) => entry.slug));
		const definitions = listInvitationDefinitions();
		expect(
			definitions
				.filter((definition) => definition.lifecycle === 'published')
				.every((definition) => corpusSlugs.has(definition.slug)),
		).toBe(true);
	});

	it('excludes demos, preview e2e fixtures, and stale rekey twins', () => {
		const slugs = corpus.map((entry) => entry.slug);
		expect(slugs.some((slug) => slug.startsWith('demo-'))).toBe(false);
		expect(slugs).not.toContain('e2e-preview-publication');
		expect(slugs).not.toContain('alba-rosa-quinones');
	});

	it('keeps the screenshot completeness sweep synchronized with the corpus SSOT', () => {
		const config = buildCorpusScreenshotConfig();
		const pages = config.pages ?? [];
		expect(pages).toHaveLength(corpus.length);
		expect(pages.map((page) => page.route)).toEqual(
			corpus.map((entry) => corpusPublicRoute(entry)),
		);
		for (const page of pages) {
			expect(page).toMatchObject({ target: 'all-sections', sectionCapture: 'known' });
		}
	});

	for (const entry of corpus) {
		it(`${entry.slug} builds a schema-valid public render contract`, () => {
			const content = resolveCorpusPublishedContent(entry);
			const parsed = eventContentSchema.safeParse(content);

			expect(parsed.success).toBe(true);
			if (!parsed.success) {
				throw new Error(`${entry.slug}: ${parsed.error.message}`);
			}
			expect(JSON.stringify(content)).not.toMatch(/PENDING_|PROVISIONAL_/);

			const viewModel = adaptDbEvent({
				slug: entry.slug,
				eventType: entry.eventType,
				isDemo: false,
				content,
				assetSlug: typeof content._assetSlug === 'string' ? content._assetSlug : entry.slug,
			});
			const page = buildPageContextFromViewModel({
				viewModel,
				slug: entry.slug,
				eventType: entry.eventType,
			});
			const descriptors = buildInvitationSectionRenderDescriptors(page);
			const components = descriptors.map((descriptor) => descriptor.component);

			if (entry.visualProfileId) {
				expect(page.viewModel.visualProfileId || entry.slug).toBe(entry.visualProfileId);
			}
			if (entry.themeId) {
				expect(page.viewModel.theme.preset).toBe(entry.themeId);
			}
			for (const component of expectedDescriptorComponents(content)) {
				expect(components).toContain(component);
			}
		});
	}
});
