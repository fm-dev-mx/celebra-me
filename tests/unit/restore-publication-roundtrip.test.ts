import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	buildRominaPublishedContent,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import { createPublicationComparison } from '@/lib/intake/services/publication-diff.service';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const demoContent = JSON.parse(
	readFileSync(
		resolve(process.cwd(), 'src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		'utf8',
	),
) as Record<string, unknown>;

const assets = Object.fromEntries(
	ROMINA_ASSET_SPECS.map((asset, index) => [
		asset.key,
		{
			type: 'uploaded',
			assetId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
			src: `https://local.test/${asset.key}.webp`,
		},
	]),
);

const published = buildRominaPublishedContent(assets as never);
const preset = {
	id: ROMINA_EVENT.baseDemoId,
	eventType: ROMINA_EVENT.eventType,
	displayName: 'XV Años — Premiere Floral',
	themeId: ROMINA_EVENT.themeId,
	defaultSections: [],
	supportedBlocks: [],
	recommendedBlocks: [],
	requiredAssets: [],
	previewSlug: 'demo-xv-jewelry-box',
};

function compareDraft(draftContent: ReturnType<typeof mapNestedToDraftContent>) {
	const mapped = mapDraftToPublished({
		invitation: {
			title: ROMINA_EVENT.title,
			eventType: ROMINA_EVENT.eventType,
			snapshot: preset as never,
		},
		assetSlug: ROMINA_EVENT.assetSlug,
		draftContent: computeEffectiveContent(draftContent, published),
		demoContent,
		priorPublishedContent: published,
		isDemo: false,
	});
	const projected = eventContentSchema.parse(mapped);
	return createPublicationComparison({
		draftProjection: {
			content: projected,
			metadata: { title: ROMINA_EVENT.title, slug: ROMINA_EVENT.slug },
		},
		publishedProjection: {
			content: eventContentSchema.parse(published),
			metadata: { title: published.title, slug: ROMINA_EVENT.slug },
		},
	});
}

describe('published restore round-trip', () => {
	it('restores the real Romina snapshot to a clean preflight baseline', () => {
		const restoredDraft = mapNestedToDraftContent(published);
		const comparison = compareDraft(restoredDraft);

		expect(comparison.changedPaths).toEqual([]);
		expect(comparison.changedSections).toEqual([]);
	});

	it('reports exactly one envelope change after a restored draft is edited', () => {
		const editedDraft = mapNestedToDraftContent(published);
		editedDraft.envelope = {
			...editedDraft.envelope,
			envelopeName: 'Romina — edición intencional',
		};
		const comparison = compareDraft(editedDraft);

		expect(comparison.changedPaths).toEqual(['content.envelope.envelopeName']);
		expect(comparison.changedSections).toEqual([
			{
				path: 'content.envelope.envelopeName',
				sectionId: 'envelope',
				sectionLabel: 'Sobre / apertura',
			},
		]);
	});
});
