import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	buildRominaPublishedContent,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { FAMILY_LABEL_KEYS, familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';
import { PERSONALIZED_ACCESS_DRAFT_KEYS } from '@/lib/intake/constants';
import { INVITATION_EDITOR_SECTION_KEYS } from '@/lib/intake/schemas/invitation-editor.schema';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	mapNestedToDraftContent,
	normalizeDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import { auditDraftContract } from '@/lib/intake/services/draft-contract-audit.service';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import { createPublicationComparison } from '@/lib/intake/services/publication-diff.service';
import {
	applySectionToBaseline,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

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

function published(): Record<string, unknown> {
	return buildRominaPublishedContent(assets as never) as unknown as Record<string, unknown>;
}

function compare(draftContent: DraftContent, pub: Record<string, unknown>) {
	const mapped = mapDraftToPublished({
		invitation: {
			title: ROMINA_EVENT.title,
			eventType: ROMINA_EVENT.eventType,
			snapshot: preset as never,
		},
		assetSlug: ROMINA_EVENT.assetSlug,
		draftContent: computeEffectiveContent(draftContent, pub),
		demoContent,
		priorPublishedContent: pub,
		isDemo: false,
	});
	return createPublicationComparison({
		draftProjection: {
			content: eventContentSchema.parse(mapped),
			metadata: { title: ROMINA_EVENT.title, slug: ROMINA_EVENT.slug },
		},
		publishedProjection: {
			content: eventContentSchema.parse(pub),
			metadata: { title: pub.title, slug: ROMINA_EVENT.slug },
		},
	});
}

describe('Draft ↔ Published contract parity', () => {
	it('preserves semantic content on a no-edit Published → Draft → Published round-trip', () => {
		const pub = published();
		const draft = mapNestedToDraftContent(pub);
		const comparison = compare(draft, pub);
		expect(comparison.changedPaths).toEqual([]);
		expect(comparison.changedSections).toEqual([]);
	});

	it.each(INVITATION_EDITOR_SECTION_KEYS.filter((section) => section !== 'photoNotes'))(
		'editing only %s does not invent unrelated pending sections',
		(section) => {
			const pub = published();
			const baseline = mapNestedToDraftContent(pub) as DraftContent;
			const edited = structuredClone(baseline) as DraftContent;

			if (section === 'main') {
				edited.hero = { ...edited.hero, name: 'Nombre editado' };
			} else if (section === 'family') {
				edited.family = { ...edited.family, fatherName: 'Padre editado' };
			} else if (section === 'location') {
				edited.location = {
					...edited.location,
					introHeading: 'Encabezado editado',
				};
			} else if (section === 'countdown') {
				edited.countdown = { ...edited.countdown, title: 'Cuenta editada' };
			} else if (section === 'itinerary') {
				edited.itinerary = {
					...edited.itinerary,
					title: 'Programa editado',
					items: edited.itinerary?.items ?? [],
				};
			} else if (section === 'rsvp') {
				edited.rsvp = { ...edited.rsvp, title: 'RSVP editado' };
			} else if (section === 'music') {
				edited.music = { ...edited.music, title: 'Música editada' };
			} else if (section === 'envelope') {
				edited.envelope = { ...edited.envelope, envelopeName: 'Sobre editado' };
			} else if (section === 'gifts') {
				edited.gifts = { ...edited.gifts, title: 'Regalos editados', items: [] };
			} else if (section === 'messages') {
				edited.quote = { ...edited.quote, text: 'Frase editada' };
			} else if (section === 'gallery') {
				edited.gallery = {
					...edited.gallery,
					title: 'Galería editada',
					items: edited.gallery?.items ?? [],
				};
			} else if (section === 'publication') {
				edited.sectionOrder = ['family', 'location', 'rsvp'];
			} else if (section === 'sharing') {
				edited.sharing = { ...edited.sharing, invitation: 'Mensaje editado' };
			}

			const next = applySectionToBaseline(
				baseline,
				section,
				edited,
			) as DraftContent;
			// Untouched sections must still match the published baseline when projected.
			for (const other of INVITATION_EDITOR_SECTION_KEYS) {
				if (other === section || other === 'photoNotes') continue;
				if (section === 'messages' && other === 'messages') continue;
				expect(getSectionValue(next, other)).toEqual(getSectionValue(baseline, other));
			}

			const comparison = compare(next, pub);
			const changedSectionIds = comparison.changedSections.map((entry) => entry.sectionId);
			expect(changedSectionIds.length).toBeGreaterThan(0);
			if (section !== 'family') {
				expect(changedSectionIds).not.toContain('family');
				expect(comparison.changedPaths.filter((path) => path.includes('family'))).toEqual(
					[],
				);
			}
		},
	);

	it('persisted canonical drafts contain no published-only properties', () => {
		const draft = mapNestedToDraftContent(published()) as Record<string, unknown>;
		const normalized = normalizeDraftContent(draft) as Record<string, unknown>;
		for (const key of [
			'theme',
			'templateId',
			'visualProfileId',
			'_assetSlug',
			'isDemo',
			'sectionStyles',
			'navigation',
		]) {
			expect(normalized).not.toHaveProperty(key);
		}
		expect(auditDraftContract(normalized).canonical).toBe(true);
	});
});

describe('schema ownership', () => {
	it('derives FAMILY_LABEL_KEYS from the Draft family schema', () => {
		for (const key of FAMILY_LABEL_KEYS) {
			expect(key in familyDraftSchema.shape).toBe(true);
		}
	});

	it('keeps published-only personalizedAccess.noteText out of the Draft key list', () => {
		expect(PERSONALIZED_ACCESS_DRAFT_KEYS).toEqual(['footerText', 'subtitle', 'title']);
		expect(PERSONALIZED_ACCESS_DRAFT_KEYS).not.toContain('noteText');
	});
});

describe('legacy draft detection', () => {
	it('detects Daniela-style hybrid nested family shapes', () => {
		const hybrid = {
			theme: 'x',
			family: {
				labels: { sectionTitle: 'Familia' },
				groups: [{ title: 'Padres', items: [{ name: 'Ana' }] }],
			},
		};
		const audit = auditDraftContract(hybrid);
		expect(audit.canonical).toBe(false);
		expect(audit.violations.some((v) => v.kind === 'published_only_field')).toBe(true);
		expect(audit.violations.some((v) => v.path.includes('groups[].items'))).toBe(true);
	});

	it('passes a canonical flat draft', () => {
		const draft = mapNestedToDraftContent(published()) as Record<string, unknown>;
		expect(auditDraftContract(draft).canonical).toBe(true);
	});

	it('fails explicitly for unrepresentable nested markers', () => {
		const audit = auditDraftContract({
			family: { groups: [{ title: 'Padres', items: [{ name: 'Jorge', deceased: true }] }] },
		});
		expect(audit.canonical).toBe(false);
		expect(
			audit.violations.some(
				(v) => v.kind === 'normalization_unsupported' && v.path.includes('deceased'),
			),
		).toBe(true);
	});
});
