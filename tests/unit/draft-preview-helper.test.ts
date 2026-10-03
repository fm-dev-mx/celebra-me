import { buildDraftPreviewPageContext } from '@/lib/invitation/draft-preview-helper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import type { Invitation, DemoPreset } from '@/lib/intake/types';

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	findAssetsByInvitationId: jest.fn(),
}));

jest.mock('@/lib/intake/storage', () => ({
	getPublicUrl: (bucket: string, path: string) => `https://cdn.test/${bucket}/${path}`,
}));

jest.mock('@/lib/adapters/db-event-adapter', () => ({
	adaptDbEvent: jest.fn(),
}));

jest.mock('@/lib/invitation/page-data', () => ({
	buildPageContextFromViewModel: jest.fn(),
}));

const mockFindAssets = findAssetsByInvitationId as jest.MockedFunction<
	typeof findAssetsByInvitationId
>;
const mockAdaptDbEvent = adaptDbEvent as jest.MockedFunction<typeof adaptDbEvent>;
const mockBuildPageContext = buildPageContextFromViewModel as jest.MockedFunction<
	typeof buildPageContextFromViewModel
>;

// Required by the Invitation type; the preview helper does not read it.
const snapshot: DemoPreset = {
	id: 'xv-enchanted-rose',
	eventType: 'xv',
	displayName: 'XV Años — Enchanted Rose',
	themeId: 'enchanted-rose',
	defaultSections: ['quote'],
	supportedBlocks: [],
	recommendedBlocks: [],
	requiredAssets: [],
	previewSlug: 'xv-enchanted-rose',
};

const makeProject = (overrides?: Partial<Invitation>): Invitation => ({
	id: 'test-invitation-id',
	kind: 'client',
	sourceInvitationId: null,
	slug: 'ayrin-samantha',
	title: 'XV Años — Ayrin Samantha',
	eventType: 'xv',
	status: 'in_production',
	baseDemoId: 'xv-enchanted-rose',
	themeId: 'enchanted-rose',
	snapshot,
	clientName: '',
	clientEmail: '',
	clientWhatsapp: '',
	photosReceived: false,
	createdBy: null,
	archivedAt: null,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	...overrides,
});

const validDraftContent = {
	title: 'XV Años — Ayrin Samantha',
	description: 'Una celebración especial',
	sectionOrder: ['quote'],
	hero: {
		name: 'Ayrin Samantha',
		secondaryName: '',
		label: 'Mis XV Años',
		nickname: '',
		date: '2026-06-15T20:00:00.000Z',
		variant: 'standard',
	},
} satisfies Parameters<typeof buildDraftPreviewPageContext>[1];

const validPublishedContent = {
	sectionOrder: ['quote'],
	composition: { intersections: {} },
	hero: {
		name: 'Prior Celebrant',
		backgroundImage: 'hero',
		portrait: 'portrait',
		variant: 'standard',
	},
};

const previewOptions = {
	themePreset: 'enchanted-rose',
	priorPublishedContent: validPublishedContent,
} satisfies Parameters<typeof buildDraftPreviewPageContext>[2];

const mockViewModel = {
	id: 'test-slug',
	title: 'XV Años — Ayrin Samantha',
	theme: { preset: 'enchanted-rose', themeClass: 'theme-preset--enchanted-rose' },
	hero: {
		name: 'Ayrin Samantha',
		date: '2026-06-15T20:00:00.000Z',
		backgroundImage: { src: '/hero.webp', alt: 'Portada' },
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: true,
		showContactCta: false,
	},
	sections: {},
} as Parameters<typeof buildPageContextFromViewModel>[0]['viewModel'];

const mockPageContext = {
	viewModel: mockViewModel,
	layout: { className: '', description: '', image: '' },
	wrapper: { className: '', dataAttributes: {}, scopedStyles: '', showEnvelope: false },
} as unknown as ReturnType<typeof buildPageContextFromViewModel>;

beforeEach(() => {
	jest.clearAllMocks();
	mockFindAssets.mockResolvedValue([]);
	mockAdaptDbEvent.mockReturnValue(mockViewModel);
	mockBuildPageContext.mockReturnValue(mockPageContext);
});

describe('buildDraftPreviewPageContext', () => {
	it('builds a preview context from draft and prior published content', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			previewOptions,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.invitationTitle).toBe('XV Años — Ayrin Samantha');
			expect(result.eventType).toBe('xv');
			expect(result.pageContext).toBeDefined();
		}
	});

	it('keeps prior published rsvp.variant and personalizedAccess when the draft omits them', async () => {
		const invitation = makeProject();
		const draftWithRsvp = {
			...validDraftContent,
			rsvp: { title: 'Confirma tu asistencia' },
		};
		const priorWithRsvp = {
			...validPublishedContent,
			rsvp: {
				variant: 'editorial-press-pass',
				personalizedAccess: { variant: 'editorial-pass' },
			},
		};

		const result = await buildDraftPreviewPageContext(invitation, draftWithRsvp, {
			...previewOptions,
			priorPublishedContent: priorWithRsvp,
		});

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const published = mockAdaptDbEvent.mock.calls[0][0].content as {
			rsvp?: { variant?: string; personalizedAccess?: { variant?: string } };
		};
		expect(published.rsvp?.variant).toBe('editorial-press-pass');
		expect(published.rsvp?.personalizedAccess?.variant).toBe('editorial-pass');
	});

	it('passes correct args to adaptDbEvent', async () => {
		const invitation = makeProject();

		await buildDraftPreviewPageContext(invitation, validDraftContent, {
			...previewOptions,
			assetLookupSlug: 'ayrin-samantha',
		});

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('ayrin-samantha');
		expect(callArgs.eventType).toBe('xv');
		expect(callArgs.isDemo).toBe(false);
		expect(callArgs.assetSlug).toBe('ayrin-samantha');
		expect(callArgs.content).toMatchObject({
			isDemo: false,
			theme: { preset: 'enchanted-rose' },
			_assetSlug: 'ayrin-samantha',
		});
	});

	it('calls buildPageContextFromViewModel with the adapted view model', async () => {
		const invitation = makeProject();

		await buildDraftPreviewPageContext(invitation, validDraftContent, previewOptions);

		expect(mockBuildPageContext).toHaveBeenCalledTimes(1);
		const callArgs = mockBuildPageContext.mock.calls[0][0];
		expect(callArgs.viewModel).toBe(mockViewModel);
		expect(callArgs.eventType).toBe('xv');
		expect(callArgs.slug).toBe('ayrin-samantha');
	});

	it('returns RENDER_FAILED when adaptDbEvent throws', async () => {
		const invitation = makeProject();
		mockAdaptDbEvent.mockImplementation(() => {
			throw new Error('Asset resolution failed');
		});

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			previewOptions,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBeDefined();
		}
	});

	it('uses the invitation slug for content identity and no asset slug without a lookup slug', async () => {
		const invitation = makeProject({ slug: 'ana-sofia-cota-guillen' });

		await buildDraftPreviewPageContext(invitation, validDraftContent, previewOptions);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('ana-sofia-cota-guillen');
		expect(callArgs.assetSlug).toBeUndefined();
		expect(callArgs.content).not.toHaveProperty('_assetSlug');
	});

	it('prefers the draft _assetSlug over the asset lookup slug', async () => {
		const invitation = makeProject({ slug: 'ana-sofia-cota-guillen' });

		await buildDraftPreviewPageContext(
			invitation,
			{
				...validDraftContent,
				_assetSlug: 'ana-sofia-cota-guillen',
				hero: { name: 'Ana Sofía', backgroundImage: 'hero', portrait: 'portrait' },
			},
			{ ...previewOptions, assetLookupSlug: 'other-asset-slug' },
		);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('ana-sofia-cota-guillen');
		expect(callArgs.assetSlug).toBe('ana-sofia-cota-guillen');
	});

	it('uses an explicit asset lookup slug for non-empty draft content', async () => {
		const invitation = makeProject({ slug: 'ximena-meza-trasvina' });

		await buildDraftPreviewPageContext(
			invitation,
			{ ...validDraftContent, hero: { name: 'Ximena', backgroundImage: 'hero' } },
			{ ...previewOptions, assetLookupSlug: 'ximena-meza-trasvina' },
		);

		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.assetSlug).toBe('ximena-meza-trasvina');
		expect((callArgs.content.hero as Record<string, unknown>).name).toBe('Ximena');
	});

	it('derives the public slug from eventType and id when the invitation has no slug', async () => {
		const invitation = makeProject({ slug: null });

		await buildDraftPreviewPageContext(invitation, validDraftContent, previewOptions);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('xv-test-inv');
		expect(callArgs.assetSlug).toBeUndefined();
	});

	it('fails closed without prior published content (no composition)', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, validDraftContent, {
			themePreset: 'enchanted-rose',
		});

		expect(result.ok).toBe(false);
		expect(mockAdaptDbEvent).not.toHaveBeenCalled();
	});

	it('succeeds with empty draft content (no draft saved yet)', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, {}, previewOptions);

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
	});

	it('fails closed when both draft and prior published content are empty', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			{},
			{
				themePreset: 'enchanted-rose',
				priorPublishedContent: null,
			},
		);

		expect(result.ok).toBe(false);
		expect(mockAdaptDbEvent).not.toHaveBeenCalled();
	});
});

describe('content mapping behavior', () => {
	it('uses draft content when available', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			previewOptions,
		);

		expect(result.ok).toBe(true);
		const callContent = mockAdaptDbEvent.mock.calls[0][0].content as Record<string, unknown>;
		expect(callContent.title).toBe('XV Años — Ayrin Samantha');
		expect((callContent.hero as Record<string, unknown>).name).toBe('Ayrin Samantha');
	});

	it('returns error when adaptDbEvent throws during build', async () => {
		const invitation = makeProject();
		mockAdaptDbEvent.mockImplementation(() => {
			throw new Error('Draft render failed');
		});

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			previewOptions,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBeDefined();
		}
	});

	it('succeeds with content containing only a hero field', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			{ hero: { name: 'Published Hero' } },
			previewOptions,
		);
		expect(result.ok).toBe(true);
	});

	it('resolves uploaded asset refs before mapping', async () => {
		const invitation = makeProject();
		const draftWithUploaded = {
			...validDraftContent,
			gallery: {
				variant: 'uniform-grid',
				items: [
					{
						image: {
							type: 'uploaded' as const,
							assetId: '00000000-0000-0000-0000-000000000001',
						},
						caption: 'Test',
					},
				],
			},
		};
		mockFindAssets.mockResolvedValue([
			{
				id: '00000000-0000-0000-0000-000000000001',
				invitationId: invitation.id,
				displayName: 'test',
				bucket: 'invitation-assets',
				storagePath: 'invitations/test/original/test.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 12345,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		]);

		await buildDraftPreviewPageContext(invitation, draftWithUploaded, previewOptions);

		expect(mockFindAssets).toHaveBeenCalledWith(invitation.id);
	});

	it('preserves prior-published thankYou variant, date, and visualProfileId in preview mapping', async () => {
		const invitation = makeProject({
			kind: 'client',
			slug: 'alba-rosa-quinonez',
			themeId: 'luxury-hacienda',
			eventType: 'cumple',
			title: '70 años de Alba Rosa Quiñónez López',
		});

		const editableDraft = {
			title: '70 años de Alba Rosa Quiñónez López',
			description: 'Celebración',
			hero: {
				name: 'Alba Rosa Quiñónez López',
				secondaryName: '',
				label: '70 AÑOS',
				nickname: '',
				date: '2026-09-12T20:00:00.000Z',
			},
			thankYou: {
				message: 'Gracias por acompañarme en esta celebración.',
				closingName: 'Alba Rosa',
			},
		} satisfies Parameters<typeof buildDraftPreviewPageContext>[1];

		const priorPublishedContent = {
			visualProfileId: 'alba-rosa-quinonez',
			sectionOrder: ['thankYou'],
			composition: { intersections: {} },
			hero: { variant: 'standard' },
			thankYou: {
				variant: 'standard',
				message: 'Prior thank-you message',
				closingName: 'Alba Rosa',
				closingPhrase: 'Con cariño',
				date: '12 de septiembre de 2026',
			},
		};

		const withoutPrior = await buildDraftPreviewPageContext(invitation, editableDraft, {
			themePreset: 'luxury-hacienda',
		});
		expect(withoutPrior.ok).toBe(false);
		expect(mockAdaptDbEvent).not.toHaveBeenCalled();

		const withPrior = await buildDraftPreviewPageContext(invitation, editableDraft, {
			themePreset: 'luxury-hacienda',
			priorPublishedContent,
		});
		expect(withPrior.ok).toBe(true);
		const contentWithPrior = mockAdaptDbEvent.mock.calls.at(-1)?.[0].content as Record<
			string,
			unknown
		>;
		expect(contentWithPrior.visualProfileId).toBe('alba-rosa-quinonez');
		expect(contentWithPrior.sectionStyles).toBeUndefined();
		expect(contentWithPrior.thankYou).toMatchObject({
			message: 'Gracias por acompañarme en esta celebración.',
			closingName: 'Alba Rosa',
			closingPhrase: 'Con cariño',
			date: '12 de septiembre de 2026',
		});
	});
});
