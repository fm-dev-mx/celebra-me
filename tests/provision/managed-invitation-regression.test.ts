/**
 * Deterministic render-contract sweep for every managed invitation definition.
 *
 * This deliberately does not depend on a local database or pixel baselines. It
 * exercises the same schema → DB adapter → page context → section descriptor
 * path used by public managed invitations with synthetic uploaded-asset refs.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
} from '../../scripts/provision/invitations/invitation-definition.ts';

function buildSyntheticAssets(definition: InvitationDefinition): UploadedAssetMap {
	return Object.fromEntries(
		definition.assets.map((asset, index) => [
			asset.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `https://assets.example.test/invitation-assets/${definition.slug}/${asset.key}`,
			},
		]),
	);
}

function expectedDescriptorComponents(content: Record<string, unknown>): string[] {
	const sectionOrder = content.sectionOrder;
	if (!Array.isArray(sectionOrder)) {
		throw new Error('Managed invitation content must declare sectionOrder.');
	}
	// Personalized access is intentionally guest-context-only and is therefore
	// absent from unauthenticated public rendering.
	return sectionOrder.filter((section) => section !== 'personalizedAccess').map(String);
}

describe('managed invitation render regression sweep', () => {
	const definitions = listInvitationDefinitions();

	it('has the complete active managed invitation corpus', () => {
		expect(definitions.map((definition) => definition.slug)).toEqual([
			'alba-rosa-quinonez',
			'abril-michelle-becerra-rea',
			'romina-rios-chaparro',
		]);
	});

	it('keeps the deterministic screenshot sweep synchronized with the managed corpus', () => {
		const configPath = path.join(
			process.cwd(),
			'scripts/screenshot/managed-invitations.config.json',
		);
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
			pages: Array<{ route: string; target: string; sectionCapture: string }>;
		};

		expect(config.pages).toHaveLength(definitions.length);
		expect(config.pages.map((page) => page.route)).toEqual(
			definitions.map((definition) => `/${definition.eventType}/${definition.slug}`),
		);
		for (const page of config.pages) {
			expect(page).toMatchObject({ target: 'all-sections', sectionCapture: 'known' });
		}
	});

	for (const definition of definitions) {
		it(`${definition.slug} builds a schema-valid public render contract`, () => {
			const content = definition.buildPublishedContent(buildSyntheticAssets(definition));
			const parsed = eventContentSchema.safeParse(content);

			expect(parsed.success).toBe(true);
			if (!parsed.success) {
				throw new Error(parsed.error.message);
			}
			expect(JSON.stringify(content)).not.toMatch(/PENDING_|PROVISIONAL_/);

			const viewModel = adaptDbEvent({
				slug: definition.slug,
				eventType: definition.eventType,
				isDemo: false,
				content,
				assetSlug: definition.slug,
			});
			const page = buildPageContextFromViewModel({
				viewModel,
				slug: definition.slug,
				eventType: definition.eventType,
			});
			const descriptors = buildInvitationSectionRenderDescriptors(page);
			const components = descriptors.map((descriptor) => descriptor.component);

			expect(page.viewModel.visualProfileId).toBe(definition.visualProfileId);
			expect(page.viewModel.theme.preset).toBe(definition.themeId);
			expect(page.layout.image).toContain('/invitation-assets/');
			for (const component of expectedDescriptorComponents(content)) {
				expect(components).toContain(component);
			}
		});
	}
});
