import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	DANIELA_ASSET_SPECS,
	DANIELA_EVENT,
	buildDanielaPublishedContent,
} from '../../scripts/provision/invitations/daniela-y-martin.ts';
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
	buildSectionSaveValue,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { toEditorDate } from '@/lib/shared/data-utils';
import { normalizeTime } from '@/lib/time/time-format';

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

const danielaAssets = Object.fromEntries(
	DANIELA_ASSET_SPECS.map((asset, index) => [
		asset.key,
		{
			type: 'uploaded',
			assetId: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
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

const danielaPreset = {
	id: DANIELA_EVENT.baseDemoId,
	eventType: DANIELA_EVENT.eventType,
	displayName: 'Boda — Jewelry Box',
	themeId: DANIELA_EVENT.themeId,
	defaultSections: [],
	supportedBlocks: [],
	recommendedBlocks: [],
	requiredAssets: [],
	previewSlug: 'demo-boda-jewelry-box-wedding',
};

function published(): Record<string, unknown> {
	return buildRominaPublishedContent(assets as never) as unknown as Record<string, unknown>;
}

function publishedDaniela(): Record<string, unknown> {
	return buildDanielaPublishedContent(danielaAssets as never) as unknown as Record<
		string,
		unknown
	>;
}

function compare(
	draftContent: DraftContent,
	pub: Record<string, unknown>,
	meta: {
		title: string;
		slug: string;
		eventType: string;
		assetSlug: string;
		snapshot: {
			id: string;
			eventType: string;
			displayName: string;
			themeId: string;
			defaultSections: unknown[];
			supportedBlocks: unknown[];
			recommendedBlocks: unknown[];
			requiredAssets: unknown[];
			previewSlug: string;
		};
	} = {
		title: ROMINA_EVENT.title,
		slug: ROMINA_EVENT.slug,
		eventType: ROMINA_EVENT.eventType,
		assetSlug: ROMINA_EVENT.assetSlug,
		snapshot: preset,
	},
) {
	const mapped = mapDraftToPublished({
		invitation: {
			title: meta.title,
			eventType: meta.eventType,
			snapshot: meta.snapshot as never,
		},
		assetSlug: meta.assetSlug,
		draftContent: computeEffectiveContent(draftContent, pub),
		demoContent,
		priorPublishedContent: pub,
		isDemo: false,
	});
	return createPublicationComparison({
		draftProjection: {
			content: eventContentSchema.parse(mapped),
			metadata: { title: meta.title, slug: meta.slug },
		},
		publishedProjection: {
			content: eventContentSchema.parse(pub),
			metadata: { title: pub.title, slug: meta.slug },
		},
	});
}

/** Shape consumed by LocationSectionEditor via getSectionValue(..., 'location'). */
function editorLocationState(draft: DraftContent) {
	return getSectionValue(draft, 'location') as {
		ceremony?: { date?: string; time?: string; venueName?: string; address?: string };
		reception?: { date?: string; time?: string; venueName?: string; address?: string };
		venues?: Array<{
			type?: string;
			date?: string;
			time?: string;
			venueName?: string;
			address?: string;
		}>;
		eventTiming?: { localDateTime?: string; timeZone?: string };
		introHeading?: string;
		indications?: Array<{ text?: string }>;
	};
}

/** Assert the exact Draft shape consumed by `<input type="date|time">`. */
function expectEditorDate(value: string | undefined, expectedDate: string) {
	expect(value).toBe(expectedDate);
	expect(toEditorDate(value)).toBe(expectedDate);
}

function expectEditorTime(value: string | undefined, expectedTime: string) {
	expect(value).toBe(expectedTime);
	expect(normalizeTime(value)).toBe(expectedTime);
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

			const next = applySectionToBaseline(baseline, section, edited) as DraftContent;
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

describe('Fecha y ubicaciones editor-consumable Draft state', () => {
	it('hydrates Romina ceremony/reception date+time for editor controls (no draft)', () => {
		const pub = published();
		const draft = mapNestedToDraftContent(pub);
		const location = editorLocationState(draft);

		expectEditorDate(location.ceremony?.date, '2026-08-14');
		expectEditorTime(location.ceremony?.time, '17:00');
		expectEditorDate(location.reception?.date, '2026-08-14');
		expectEditorTime(location.reception?.time, '20:30');
		expect(location.ceremony?.time).not.toBe(location.reception?.time);
		expect(location.eventTiming?.localDateTime).toBe(ROMINA_EVENT.localDateTime);
		expect(location.ceremony?.venueName).toBeTruthy();
		expect(location.ceremony?.address).toBeTruthy();
	});

	it('hydrates Daniela venues with distinct ceremony/reception times', () => {
		const pub = publishedDaniela();
		const draft = mapNestedToDraftContent(pub);
		const location = editorLocationState(draft);
		const ceremony = location.venues?.find((v) => v.type === 'ceremony');
		const reception = location.venues?.find((v) => v.type === 'reception');

		expectEditorDate(ceremony?.date, '2026-11-28');
		expectEditorTime(ceremony?.time, '17:30');
		expectEditorDate(reception?.date, '2026-11-28');
		expectEditorTime(reception?.time, '19:30');
		expect(ceremony?.time).not.toBe(reception?.time);
		expect(location.eventTiming?.localDateTime).toBe(DANIELA_EVENT.localDateTime);
	});

	it('keeps optional missing venue date/time absent rather than inventing empty strings', () => {
		const pub = published();
		const sparse = structuredClone(pub) as Record<string, unknown>;
		const location = sparse.location as Record<string, unknown>;
		const ceremony = { ...(location.ceremony as Record<string, unknown>) };
		delete ceremony.date;
		delete ceremony.time;
		location.ceremony = ceremony;

		const draft = mapNestedToDraftContent(sparse);
		const editor = editorLocationState(draft);
		expect(editor.ceremony?.date).toBeUndefined();
		expect(editor.ceremony?.time).toBeUndefined();
		expectEditorDate(editor.reception?.date, '2026-08-14');
		expectEditorTime(editor.reception?.time, '20:30');
	});

	it('prefers existing Draft venue times over Published when both are present', () => {
		const pub = published();
		const draftOverlay: DraftContent = {
			location: {
				ceremony: { date: '2026-08-15', time: '18:00' },
				reception: { date: '2026-08-15', time: '21:00' },
			},
		};
		const merged = computeEffectiveContent(draftOverlay, pub);
		const location = editorLocationState(merged);
		expectEditorDate(location.ceremony?.date, '2026-08-15');
		expectEditorTime(location.ceremony?.time, '18:00');
		expectEditorDate(location.reception?.date, '2026-08-15');
		expectEditorTime(location.reception?.time, '21:00');
	});

	it('no-op location save does not invent pending location/family changes', () => {
		const pub = published();
		const baseline = mapNestedToDraftContent(pub) as DraftContent;
		const saveValue = buildSectionSaveValue(baseline, baseline, 'location');
		expect(saveValue).toEqual(getSectionValue(baseline, 'location'));

		const next = applySectionToBaseline(baseline, 'location', baseline) as DraftContent;
		const comparison = compare(next, pub);
		expect(comparison.changedPaths.filter((path) => path.includes('location'))).toEqual([]);
		expect(comparison.changedPaths.filter((path) => path.includes('family'))).toEqual([]);

		const location = editorLocationState(next);
		expectEditorDate(location.ceremony?.date, '2026-08-14');
		expectEditorTime(location.ceremony?.time, '17:00');
		expectEditorDate(location.reception?.date, '2026-08-14');
		expectEditorTime(location.reception?.time, '20:30');
	});

	it('isolated ceremony time edit changes only that semantic path', () => {
		const pub = published();
		const baseline = mapNestedToDraftContent(pub) as DraftContent;
		const edited = structuredClone(baseline) as DraftContent;
		edited.location = {
			...edited.location,
			ceremony: { ...edited.location?.ceremony, time: '17:15' },
		};
		const comparison = compare(edited, pub);
		expect(
			comparison.changedPaths.some(
				(path) => path.includes('ceremony') && path.includes('time'),
			),
		).toBe(true);
		expect(comparison.changedPaths.filter((path) => path.includes('family'))).toEqual([]);
		expect(
			comparison.changedPaths.filter(
				(path) => path.includes('reception') && path.includes('time'),
			),
		).toEqual([]);
	});

	it('isolated ceremony date edit changes only that semantic path', () => {
		const pub = published();
		const baseline = mapNestedToDraftContent(pub) as DraftContent;
		const edited = structuredClone(baseline) as DraftContent;
		edited.location = {
			...edited.location,
			ceremony: { ...edited.location?.ceremony, date: '2026-08-15' },
		};
		const comparison = compare(edited, pub);
		expect(
			comparison.changedPaths.some(
				(path) => path.includes('ceremony') && path.includes('date'),
			),
		).toBe(true);
		expect(comparison.changedPaths.filter((path) => path.includes('family'))).toEqual([]);
	});

	it('Daniela no-edit round-trip preserves venue date/time and venueEvent (no false pending)', () => {
		const pub = publishedDaniela();
		const draft = mapNestedToDraftContent(pub);
		const comparison = compare(draft, pub, {
			title: DANIELA_EVENT.title,
			slug: DANIELA_EVENT.slug,
			eventType: DANIELA_EVENT.eventType,
			assetSlug: DANIELA_EVENT.assetSlug,
			snapshot: danielaPreset,
		});
		expect(
			comparison.changedPaths.filter(
				(path) =>
					path.includes('location.venues') ||
					path.includes('.date') ||
					path.includes('.time'),
			),
		).toEqual([]);
		expect(comparison.changedSections.map((s) => s.sectionId)).not.toContain('family');
	});
});
