jest.mock('@/lib/intake/repositories/invitation-content-draft.repository', () => ({
	findDraftByInvitationId: jest.fn(),
	updateDraftContentConditionally: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/editor-atomic.repository', () => ({
	restoreInvitationFromPublishedAtomic: jest.fn(),
}));

import {
	ROMINA_ASSET_SPECS,
	buildRominaPublishedContent,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { restoreInvitationFromPublishedAtomic } from '@/lib/intake/repositories/editor-atomic.repository';
import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import {
	planDraftRestore,
	restoreDraftSection,
	restoreEntireDraft,
} from '@/lib/intake/services/draft-restore.service';
import { getSectionValue } from '@/lib/intake/services/section-content-mapper';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { DraftRevisionConflictError } from '@/lib/intake/services/draft-mutation.service';

const findDraftMock = findDraftByInvitationId as jest.MockedFunction<typeof findDraftByInvitationId>;
const updateDraftMock = updateDraftContentConditionally as jest.MockedFunction<
	typeof updateDraftContentConditionally
>;
const findPublishedMock = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;
const findInvitationMock = findInvitationById as jest.MockedFunction<typeof findInvitationById>;
const restoreAtomicMock = restoreInvitationFromPublishedAtomic as jest.MockedFunction<
	typeof restoreInvitationFromPublishedAtomic
>;

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

function published(): Record<string, unknown> {
	return buildRominaPublishedContent(assets as never) as unknown as Record<string, unknown>;
}

describe('draft restore', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('planDraftRestore', () => {
		it('restores only the selected section and preserves other draft edits', () => {
			const pub = published();
			const flat = mapNestedToDraftContent(pub) as DraftContent;
			const draft: DraftContent = {
				...flat,
				family: { ...flat.family, fatherName: 'Editado' },
				location: {
					...flat.location,
					indications: [
						{
							iconName: 'Calendar',
							styleVariant: 'default',
							text: 'Agradecemos confirmar su asistencia antes del 15 de octubre.',
						},
					],
				},
			};

			const plan = planDraftRestore({
				draftContent: draft,
				publishedContent: pub,
				scope: { kind: 'section', section: 'family' },
			});

			expect(plan.afterContent.family?.fatherName).toBe(flat.family?.fatherName);
			expect(plan.afterContent.location?.indications).toEqual(draft.location?.indications);
			expect(plan.discardedPaths.some((path) => path.includes('fatherName'))).toBe(true);
			expect(plan.sectionUnchanged).toBe(false);
		});

		it('full restore discards every draft difference', () => {
			const pub = published();
			const flat = mapNestedToDraftContent(pub) as DraftContent;
			const draft: DraftContent = {
				...flat,
				family: { ...flat.family, fatherName: 'Editado' },
				music: { ...flat.music, title: 'Otra pista' },
			};

			const plan = planDraftRestore({
				draftContent: draft,
				publishedContent: pub,
				scope: { kind: 'entire' },
			});

			expect(plan.afterContent).toEqual(flat);
			expect(plan.discardedPaths.length).toBeGreaterThan(0);
		});

		it('produces canonical flat DraftContent', () => {
			const pub = published();
			pub.family = {
				parents: { father: 'A', mother: 'B' },
				groups: [{ title: 'Padres', items: [{ name: 'A' }] }],
			};
			const plan = planDraftRestore({
				draftContent: pub,
				publishedContent: pub,
				scope: { kind: 'entire' },
			});
			const family = plan.afterContent.family as Record<string, unknown>;
			expect(family.parents).toBeUndefined();
			expect(family.fatherName).toBe('A');
			expect((family.groups as Array<Record<string, unknown>>)[0]?.names).toBe('A');
		});
	});

	describe('restoreDraftSection', () => {
		it('writes only the restored section and rejects stale revisions', async () => {
			const pub = published();
			const flat = mapNestedToDraftContent(pub) as DraftContent;
			const draftContent: DraftContent = {
				...flat,
				family: { ...flat.family, fatherName: 'Editado' },
				music: { title: 'Borrador', url: 'https://example.com/a.mp3' },
			};

			findDraftMock.mockResolvedValue({
				id: 'draft-1',
				invitationId: 'inv-1',
				content: draftContent,
				status: 'draft',
				updatedAt: '2026-08-01T00:00:00.000Z',
				createdAt: '2026-08-01T00:00:00.000Z',
				submissionId: null,
			});
			findPublishedMock.mockResolvedValue({
				id: 'pub-1',
				invitationId: 'inv-1',
				content: pub,
				version: 1,
			} as never);

			let persisted: Record<string, unknown> = {};
			updateDraftMock.mockImplementation(async (_id, _expected, patch) => {
				persisted = patch.content as Record<string, unknown>;
				return {
					id: 'draft-1',
					invitationId: 'inv-1',
					content: patch.content as Record<string, unknown>,
					status: 'draft',
					updatedAt: '2026-08-02T00:00:00.000Z',
					createdAt: '2026-08-01T00:00:00.000Z',
					submissionId: null,
				};
			});

			const result = await restoreDraftSection({
				invitationId: 'inv-1',
				section: 'family',
				expectedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
			});

			expect(getSectionValue(persisted as DraftContent, 'family')).toEqual(
				getSectionValue(flat, 'family'),
			);
			expect((persisted.music as { title: string }).title).toBe('Borrador');
			expect(result.plan.discardedPaths.length).toBeGreaterThan(0);

			await expect(
				restoreDraftSection({
					invitationId: 'inv-1',
					section: 'family',
					expectedDraftUpdatedAt: 'stale',
				}),
			).rejects.toBeInstanceOf(DraftRevisionConflictError);
		});
	});

	describe('restoreEntireDraft', () => {
		it('calls the atomic restore with canonical content and never mutates published', async () => {
			const pub = published();
			const flat = mapNestedToDraftContent(pub);
			findInvitationMock.mockResolvedValue({
				id: 'inv-1',
				updatedAt: '2026-08-01T00:00:00.000Z',
			} as never);
			findDraftMock.mockResolvedValue({
				id: 'draft-1',
				invitationId: 'inv-1',
				content: { ...flat, music: { title: 'Edit' } },
				status: 'draft',
				updatedAt: '2026-08-01T00:00:00.000Z',
				createdAt: '2026-08-01T00:00:00.000Z',
				submissionId: null,
			});
			findPublishedMock.mockResolvedValue({
				id: 'pub-1',
				invitationId: 'inv-1',
				content: pub,
				version: 4,
			} as never);
			restoreAtomicMock.mockResolvedValue({
				draftId: 'draft-1',
				draftUpdatedAt: '2026-08-02T00:00:00.000Z',
				idempotent: false,
			} as never);

			const result = await restoreEntireDraft({
				invitationId: 'inv-1',
				expectedDraftUpdatedAt: '2026-08-01T00:00:00.000Z',
				expectedInvitationUpdatedAt: '2026-08-01T00:00:00.000Z',
				commandContext: {
					operationId: '00000000-0000-4000-8000-000000000099',
					actorId: null,
					actorType: 'admin',
					origin: 'editor',
					environment: 'local',
					projectRef: 'celebra-me-rsvp',
				},
			});

			expect(restoreAtomicMock).toHaveBeenCalledWith(
				expect.objectContaining({
					draftContent: flat,
					expectedPublishedVersion: 4,
				}),
			);
			expect(result.draft.content).toEqual(flat);
			expect(findPublishedMock).toHaveBeenCalled();
			// No published write path exists on this service.
			expect(Object.keys(restoreAtomicMock.mock.calls[0]![0])).not.toContain(
				'publishedContent',
			);
		});
	});
});
