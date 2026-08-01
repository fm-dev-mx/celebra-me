/**
 * Resolve render-effective published content for any Local Render Corpus entry.
 */
import { listInvitationDefinitions, getInvitationDefinition } from '../invitations/registry.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
} from '../invitations/invitation-definition.ts';
import { listLocalRenderCorpus, type LocalRenderCorpusEntry } from './registry.ts';
import { loadLegacyCorpusFixture } from './load-fixture.ts';

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

export function resolveCorpusPublishedContent(
	entry: LocalRenderCorpusEntry,
): Record<string, unknown> {
	if (entry.sourceStrategy === 'canonical_definition') {
		const definition = getInvitationDefinition(entry.slug);
		return definition.buildPublishedContent(buildSyntheticAssets(definition));
	}
	return loadLegacyCorpusFixture(entry).publishedContent;
}

export function assertCanonicalRegistryCoveredByCorpus(): void {
	const corpusSlugs = new Set(listLocalRenderCorpus().map((e) => e.slug));
	for (const definition of listInvitationDefinitions()) {
		if (!corpusSlugs.has(definition.slug)) {
			throw new Error(
				`Canonical managed invitation "${definition.slug}" is missing from the Local Render Corpus SSOT.`,
			);
		}
	}
}
