jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftContentConditionally: jest.fn(),
	upsertDraft: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	buildRominaPublishedContent,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	canonicalizeDraftContent,
	DraftNormalizationError,
	mapNestedToDraftContent,
	normalizeDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import { applyDraftMutation } from '@/lib/intake/services/draft-mutation.service';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import { createPublicationComparison } from '@/lib/intake/services/publication-diff.service';
import { buildSectionSaveValue } from '@/lib/intake/services/section-content-mapper';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

const findDraftMock = findDraftByInvitationId as jest.MockedFunction<
	typeof findDraftByInvitationId
>;
const upsertDraftMock = upsertDraft as jest.MockedFunction<typeof upsertDraft>;
const updateDraftMock = updateDraftContentConditionally as jest.MockedFunction<
	typeof updateDraftContentConditionally
>;
const findPublishedMock = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;

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

/** Romina's real published snapshot: flat `parents` + `godparents` family. */
function buildRominaPublished(): Record<string, unknown> {
	return buildRominaPublishedContent(assets as never) as unknown as Record<string, unknown>;
}

/**
 * Daniela-style published snapshot: the family section uses `groups[].items`,
 * `children[]` and `godparentGroups[].godparents` instead of flat parents.
 */
function buildNestedFamilyPublished(): Record<string, unknown> {
	const published = buildRominaPublished();
	published.family = {
		labels: {
			sectionTitle: 'Con la bendición de',
			sectionSubtitle: 'Nuestras familias',
			childrenTitle: 'Nuestros hijos',
			godparentsTitle: 'Padrinos',
		},
		groups: [
			{
				title: 'Padres de la novia',
				items: [
					{ name: 'María Elena Ruiz' },
					{ name: 'Jorge Alberto Sánchez', role: 'Padre' },
				],
			},
			{
				title: 'Padres del novio',
				items: [{ name: 'Ana Sofía Torres' }, { name: 'Luis Fernando Marín' }],
			},
		],
		children: [{ name: 'Emiliano' }, { name: 'Renata' }],
		godparentGroups: [
			{
				honoreeName: 'Daniela',
				label: 'Padrinos de velación',
				godparents: [{ name: 'Carmen Díaz' }, { name: 'Raúl Ortega', role: 'Padrino' }],
			},
		],
		presentation: 'text-only',
	};
	return published;
}

function comparePublication(
	draftContent: DraftContent,
	published: Record<string, unknown>,
): ReturnType<typeof createPublicationComparison> {
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
	return createPublicationComparison({
		draftProjection: {
			content: eventContentSchema.parse(mapped),
			metadata: { title: ROMINA_EVENT.title, slug: ROMINA_EVENT.slug },
		},
		publishedProjection: {
			content: eventContentSchema.parse(published),
			metadata: { title: published.title, slug: ROMINA_EVENT.slug },
		},
	});
}

/** Reproduces an editor location-only edit: hydrate, add an indication, save. */
async function saveLocationIndication(
	published: Record<string, unknown>,
	existingDraft: Record<string, unknown> | null,
	options: { addIndication?: boolean } = {},
): Promise<Record<string, unknown>> {
	const baselineContent = computeEffectiveContent(existingDraft ?? {}, published);
	const editedContent: DraftContent =
		options.addIndication === false
			? baselineContent
			: {
					...baselineContent,
					location: {
						...baselineContent.location,
						indications: [
							...(baselineContent.location?.indications ?? []),
							{
								iconName: 'Calendar',
								styleVariant: 'default',
								text: 'Agradecemos confirmar su asistencia antes del 15 de octubre.',
							},
						],
					},
				};
	const value = buildSectionSaveValue(baselineContent, editedContent, 'location');

	findDraftMock.mockResolvedValue(
		existingDraft
			? {
					id: 'draft-1',
					invitationId: 'inv-1',
					content: existingDraft,
					status: 'draft',
					updatedAt: '2026-08-01T00:00:00.000Z',
					createdAt: '2026-08-01T00:00:00.000Z',
					submissionId: null,
				}
			: null,
	);
	findPublishedMock.mockResolvedValue({
		id: 'pub-1',
		invitationId: 'inv-1',
		content: published,
		version: 1,
	} as never);

	let persisted: Record<string, unknown> = {};
	const capture = (input: { content: Record<string, unknown> }) => {
		persisted = input.content;
		return Promise.resolve({
			id: 'draft-1',
			invitationId: 'inv-1',
			content: input.content,
			status: 'draft',
			updatedAt: '2026-08-02T00:00:00.000Z',
			createdAt: '2026-08-01T00:00:00.000Z',
			submissionId: null,
		});
	};
	upsertDraftMock.mockImplementation(capture as never);
	updateDraftMock.mockImplementation(((
		_id: string,
		_expected: string,
		patch: { content: Record<string, unknown> },
	) => capture(patch)) as never);

	await applyDraftMutation({
		invitationId: 'inv-1',
		expectedDraftUpdatedAt: existingDraft ? '2026-08-01T00:00:00.000Z' : null,
		patch: { kind: 'section', section: 'location', value },
		actor: 'editor',
	});
	return persisted;
}

describe('draft canonicalization', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('draft creation baseline', () => {
		it('persists a flat draft on the first save from a nested-family published source', async () => {
			const published = buildNestedFamilyPublished();
			const persisted = await saveLocationIndication(published, null);
			const family = persisted.family as Record<string, unknown>;

			expect(family).toBeDefined();
			expect(family.parents).toBeUndefined();
			expect(family.labels).toBeUndefined();
			expect(family.children).toBe('Emiliano\nRenata');
			expect(family.groups).toEqual([
				{
					title: 'Padres de la novia',
					names: 'María Elena Ruiz\nJorge Alberto Sánchez — Padre',
				},
				{ title: 'Padres del novio', names: 'Ana Sofía Torres\nLuis Fernando Marín' },
			]);
			expect(family.godparentGroups).toEqual([
				{
					honoreeName: 'Daniela',
					label: 'Padrinos de velación',
					names: 'Carmen Díaz\nRaúl Ortega — Padrino',
				},
			]);
		});

		it('does not persist published-only metadata on the first save', async () => {
			const published = buildNestedFamilyPublished();
			published.theme = 'jewelry-box';
			published.templateId = 'tpl-1';
			published.visualProfileId = 'vp-1';
			published._assetSlug = 'daniela-y-martin';
			published.isDemo = false;
			published.sectionStyles = { quote: { variant: 'jewelry-box' } };

			const persisted = await saveLocationIndication(published, null);

			for (const key of [
				'theme',
				'templateId',
				'visualProfileId',
				'_assetSlug',
				'isDemo',
				'sectionStyles',
				'navigation',
			]) {
				expect(persisted).not.toHaveProperty(key);
			}
		});

		it('reports only the location section as changed after a location-only edit', async () => {
			const published = buildNestedFamilyPublished();
			const persisted = await saveLocationIndication(published, null);
			const comparison = comparePublication(persisted as DraftContent, published);

			expect(comparison.changedPaths.filter((path) => path.includes('family'))).toEqual([]);
			expect(comparison.changedSections.map((section) => section.sectionId)).toEqual([
				'location',
			]);
		});

		it('keeps Romina flat parents and godparents behaviour unchanged', async () => {
			const published = buildRominaPublished();
			const publishedParents = (published.family as { parents: Record<string, string> })
				.parents;
			const persisted = await saveLocationIndication(published, null);
			const family = persisted.family as Record<string, unknown>;

			expect(family.fatherName).toBe(publishedParents.father);
			expect(family.motherName).toBe(publishedParents.mother);
			expect(family.parents).toBeUndefined();
			expect(typeof family.godparents).toBe('string');

			const comparison = comparePublication(persisted as DraftContent, published);
			expect(comparison.changedSections.map((section) => section.sectionId)).toEqual([
				'location',
			]);
		});
	});

	describe('legacy hybrid drafts', () => {
		/** A draft seeded from raw published content under the old behaviour. */
		function buildHybridDraft(published: Record<string, unknown>): Record<string, unknown> {
			const hybrid = structuredClone(published);
			(hybrid.location as Record<string, unknown>).indications = [
				{
					iconName: 'Calendar',
					styleVariant: 'default',
					text: 'Agradecemos confirmar su asistencia antes del 15 de octubre.',
				},
			];
			return hybrid;
		}

		it('flattens every nested family shape', () => {
			const published = buildNestedFamilyPublished();
			const result = canonicalizeDraftContent(buildHybridDraft(published));
			const family = result.content.family as Record<string, unknown>;

			expect(result.issues).toEqual([]);
			expect(family.parents).toBeUndefined();
			expect(family.labels).toBeUndefined();
			expect(family.sectionTitle).toBe('Con la bendición de');
			expect(family.children).toBe('Emiliano\nRenata');
			expect((family.groups as Array<Record<string, unknown>>)[0]?.items).toBeUndefined();
			expect((family.groups as Array<Record<string, unknown>>)[0]?.names).toBe(
				'María Elena Ruiz\nJorge Alberto Sánchez — Padre',
			);
			expect(
				(family.godparentGroups as Array<Record<string, unknown>>)[0]?.godparents,
			).toBeUndefined();
		});

		it('is idempotent', () => {
			const hybrid = buildHybridDraft(buildNestedFamilyPublished());
			const once = normalizeDraftContent(hybrid);
			const twice = normalizeDraftContent(once);

			expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
			expect(canonicalizeDraftContent(once).changed).toBe(false);
		});

		it('leaves an already-flat draft untouched', () => {
			const flat = mapNestedToDraftContent(buildNestedFamilyPublished());
			const result = canonicalizeDraftContent(flat as Record<string, unknown>);

			expect(result.changed).toBe(false);
			expect(result.removedPublishedOnlyKeys).toEqual([]);
			expect(JSON.stringify(result.content)).toBe(JSON.stringify(flat));
		});

		it('converges a hybrid draft on the next section save', async () => {
			const published = buildNestedFamilyPublished();
			const persisted = await saveLocationIndication(published, buildHybridDraft(published));

			expect(persisted).not.toHaveProperty('theme');
			expect((persisted.family as Record<string, unknown>).labels).toBeUndefined();
			expect(
				(
					(persisted.family as Record<string, unknown>).groups as Array<
						Record<string, unknown>
					>
				)[0]?.names,
			).toBe('María Elena Ruiz\nJorge Alberto Sánchez — Padre');
		});

		it('removes published-only nested fields the draft contract does not own', () => {
			const published = buildNestedFamilyPublished();
			const hybrid = buildHybridDraft(published);
			(hybrid.rsvp as Record<string, unknown>).personalizedAccess = {
				title: 'Acceso',
				noteText: 'Nota interna publicada',
			};
			const result = canonicalizeDraftContent(hybrid);

			expect(result.removedPublishedOnlyKeys).toContain('rsvp.personalizedAccess.noteText');
			expect((result.content.rsvp as Record<string, unknown>).personalizedAccess).toEqual({
				title: 'Acceso',
			});
		});

		it('strips gifts.variant without changing gift items', () => {
			const hybrid = {
				gifts: {
					title: 'Mesa de regalos',
					variant: 'celestial-blue',
					items: [
						{
							type: 'cash',
							title: 'Lluvia de sobres',
							text: 'Tu presencia es el mejor regalo.',
						},
					],
				},
			};
			const result = canonicalizeDraftContent(hybrid);
			expect(result.issues).toEqual([]);
			expect(result.removedPublishedOnlyKeys).toContain('gifts.variant');
			expect(result.content.gifts).toEqual({
				title: 'Mesa de regalos',
				items: hybrid.gifts.items,
			});
			expect(canonicalizeDraftContent(result.content).changed).toBe(false);
		});

		it('strips legacy indication icon and countdown.subtitlePrefix', () => {
			const hybrid = {
				location: {
					indications: [
						{
							icon: 'dressCode',
							iconName: 'DressCode',
							styleVariant: 'default',
							text: 'Código de vestimenta casual elegante',
						},
					],
				},
				countdown: {
					title: 'Falta poco',
					footerText: 'Los esperamos',
					subtitlePrefix: '',
				},
			};
			const result = canonicalizeDraftContent(hybrid);
			expect(result.issues).toEqual([]);
			expect(result.removedPublishedOnlyKeys).toEqual(
				expect.arrayContaining([
					'location.indications[0].icon',
					'countdown.subtitlePrefix',
				]),
			);
			expect(result.content.location?.indications).toEqual([
				{
					iconName: 'DressCode',
					styleVariant: 'default',
					text: 'Código de vestimenta casual elegante',
				},
			]);
			expect(result.content.countdown).toEqual({
				title: 'Falta poco',
				footerText: 'Los esperamos',
			});
		});

		it('folds rsvp.whatsappConfig into whatsappPhone and maps personalizedAccess', () => {
			const published = {
				rsvp: {
					title: 'Confirma',
					accessMode: 'hybrid',
					whatsappConfig: { phone: '+526671112233' },
					personalizedAccess: {
						title: 'Pase',
						subtitle: 'Presente este pase',
						footerText: 'Válido el día del evento',
						noteText: 'interno',
					},
				},
			};
			const draft = mapNestedToDraftContent(published);
			expect(draft.rsvp).toMatchObject({
				title: 'Confirma',
				accessMode: 'hybrid',
				whatsappPhone: '+526671112233',
				personalizedAccess: {
					title: 'Pase',
					subtitle: 'Presente este pase',
					footerText: 'Válido el día del evento',
				},
			});
			expect(draft.rsvp).not.toHaveProperty('whatsappConfig');
			expect(
				(draft.rsvp as { personalizedAccess?: Record<string, unknown> }).personalizedAccess,
			).not.toHaveProperty('noteText');

			const hybridResult = canonicalizeDraftContent(published);
			expect(hybridResult.removedPublishedOnlyKeys).toEqual(
				expect.arrayContaining(['rsvp.whatsappConfig', 'rsvp.personalizedAccess.noteText']),
			);
			expect(hybridResult.content.rsvp).toEqual(draft.rsvp);
		});
	});

	describe('editor hydration', () => {
		it('hydrates nested published groups as flat draft names', () => {
			const published = buildNestedFamilyPublished();
			const effective = computeEffectiveContent({}, published);
			const family = effective.family as Record<string, unknown>;

			expect(family.groups).toEqual([
				{
					title: 'Padres de la novia',
					names: 'María Elena Ruiz\nJorge Alberto Sánchez — Padre',
				},
				{ title: 'Padres del novio', names: 'Ana Sofía Torres\nLuis Fernando Marín' },
			]);
			expect(family.children).toBe('Emiliano\nRenata');
		});

		it('does not let a nested draft fragment overwrite the flattened published family', () => {
			const published = buildNestedFamilyPublished();
			const hybridDraft = { family: structuredClone(published.family) };
			const effective = computeEffectiveContent(hybridDraft, published);
			const family = effective.family as Record<string, unknown>;

			expect((family.groups as Array<Record<string, unknown>>)[0]?.items).toBeUndefined();
			expect((family.groups as Array<Record<string, unknown>>)[0]?.names).toBe(
				'María Elena Ruiz\nJorge Alberto Sánchez — Padre',
			);
		});
	});

	describe('publish contract', () => {
		it('round-trips children, groups and godparentGroups without loss', () => {
			const published = buildNestedFamilyPublished();
			const draft = mapNestedToDraftContent(published);
			const comparison = comparePublication(draft, published);

			expect(comparison.changedPaths).toEqual([]);
		});

		it('preserves published-only personalizedAccess fields through publish', () => {
			const published = buildNestedFamilyPublished();
			(published.rsvp as Record<string, unknown>).personalizedAccess = {
				title: 'Acceso',
				noteText: 'Nota interna publicada',
			};
			const draft = mapNestedToDraftContent(published);
			draft.rsvp = { ...draft.rsvp, personalizedAccess: { title: 'Acceso editado' } };

			const mapped = mapDraftToPublished({
				invitation: {
					title: ROMINA_EVENT.title,
					eventType: ROMINA_EVENT.eventType,
					snapshot: preset as never,
				},
				assetSlug: ROMINA_EVENT.assetSlug,
				draftContent: computeEffectiveContent(draft, published),
				demoContent,
				priorPublishedContent: published,
				isDemo: false,
			});

			expect((mapped.rsvp as Record<string, unknown>).personalizedAccess).toEqual({
				title: 'Acceso editado',
				noteText: 'Nota interna publicada',
			});
		});

		it('rejects a non-canonical family draft instead of dropping names', () => {
			const published = buildNestedFamilyPublished();
			expect(() =>
				mapDraftToPublished({
					invitation: {
						title: ROMINA_EVENT.title,
						eventType: ROMINA_EVENT.eventType,
						snapshot: preset as never,
					},
					assetSlug: ROMINA_EVENT.assetSlug,
					draftContent: { family: structuredClone(published.family) } as DraftContent,
					demoContent,
					priorPublishedContent: published,
					isDemo: false,
				}),
			).toThrow(/estructuras de contenido publicado/);
		});

		it('does not drift over repeated load and save cycles', async () => {
			const published = buildNestedFamilyPublished();
			let draft = await saveLocationIndication(published, null);
			const first = JSON.stringify(draft);

			for (let cycle = 0; cycle < 3; cycle++) {
				draft = await saveLocationIndication(published, draft, { addIndication: false });
			}

			expect(JSON.stringify(draft)).toBe(first);
		});
	});

	describe('unsupported data', () => {
		it('reports a child role instead of silently dropping it', () => {
			const draft = { family: { children: [{ name: 'Emiliano', role: 'Hijo mayor' }] } };
			const result = canonicalizeDraftContent(draft);

			expect(result.issues).toEqual([
				{
					path: 'family.children[0].role',
					reason: 'unrepresentable_field',
					detail: 'the flat draft contract stores children as names only',
				},
			]);
			expect(() => normalizeDraftContent(draft)).toThrow(DraftNormalizationError);
		});

		it('reports a deceased marker inside a nested group', () => {
			const draft = {
				family: {
					groups: [{ title: 'Padres', items: [{ name: 'Jorge', deceased: true }] }],
				},
			};

			expect(canonicalizeDraftContent(draft).issues).toEqual([
				{
					path: 'family.groups[0].items[0].deceased',
					reason: 'unrepresentable_field',
					detail: 'the flat draft contract cannot express a deceased marker for list members',
				},
			]);
		});

		it('reports conflicting flat and nested values', () => {
			const draft = { family: { fatherName: 'Jorge', parents: { father: 'Luis' } } };
			const [issue] = canonicalizeDraftContent(draft).issues;

			expect(issue?.path).toBe('family.fatherName');
			expect(issue?.reason).toBe('conflicting_values');
		});

		it('reports an unknown nested label key', () => {
			const draft = { family: { labels: { sectionTitle: 'Familia', legacyTitle: 'X' } } };
			const [issue] = canonicalizeDraftContent(draft).issues;

			expect(issue?.path).toBe('family.labels.legacyTitle');
			expect(issue?.reason).toBe('unsupported_shape');
		});
	});
});
