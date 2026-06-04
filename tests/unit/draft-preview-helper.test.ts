import {
	buildDraftPreviewPageContext,
	hasMeaningfulDraftContent,
	selectPreviewContent,
} from '@/lib/invitation/draft-preview-helper';
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

const demoPreset: DemoPreset = {
	id: 'demo-xv-enchanted-rose',
	eventType: 'xv',
	displayName: 'XV Años — Enchanted Rose',
	themeId: 'enchanted-rose',
	defaultSections: [
		'quote',
		'location',
		'countdown',
		'family',
		'itinerary',
		'gallery',
		'gifts',
		'rsvp',
		'thankYou',
	],
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	],
	recommendedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	],
	requiredAssets: [
		'hero',
		'portrait',
		'gallery01',
		'gallery02',
		'gallery03',
		'interlude01',
		'interlude02',
	],
	previewSlug: 'demo-xv-enchanted-rose',
};

const makeProject = (overrides?: Partial<Invitation>): Invitation => ({
	id: 'test-invitation-id',
	kind: 'client',
	sourceInvitationId: null,
	slug: 'demo-xv-enchanted-rose',
	title: 'XV Años — Ayrin Samantha',
	eventType: 'xv',
	status: 'in_production',
	baseDemoId: 'demo-xv-enchanted-rose',
	themeId: 'enchanted-rose',
	snapshot: demoPreset,
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
	hero: {
		name: 'Ayrin Samantha',
		secondaryName: '',
		label: 'Mis XV Años',
		nickname: '',
		date: '2026-06-15T20:00:00.000Z',
	},
} satisfies Parameters<typeof buildDraftPreviewPageContext>[1];

const validDemoContent = {
	hero: {
		name: 'Demo Celebrant',
		backgroundImage: 'hero',
		portrait: 'portrait',
	},
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
		showThankYouBranding: true,
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
	it('builds a preview context from draft + demo content', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			validDemoContent,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.invitationTitle).toBe('XV Años — Ayrin Samantha');
			expect(result.eventType).toBe('xv');
			expect(result.pageContext).toBeDefined();
		}
	});

	it('passes correct args to adaptDbEvent', async () => {
		const invitation = makeProject();

		await buildDraftPreviewPageContext(invitation, validDraftContent, validDemoContent);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.eventType).toBe('xv');
		expect(callArgs.isDemo).toBe(false);
		expect(callArgs.assetSlug).toBe('demo-xv-enchanted-rose');
		expect(callArgs.content).toBeDefined();
	});

	it('calls buildPageContextFromViewModel with isPreview=true', async () => {
		const invitation = makeProject();

		await buildDraftPreviewPageContext(invitation, validDraftContent, validDemoContent);

		expect(mockBuildPageContext).toHaveBeenCalledTimes(1);
		const callArgs = mockBuildPageContext.mock.calls[0][0];
		expect(callArgs.isPreview).toBe(true);
		expect(callArgs.viewModel).toBe(mockViewModel);
		expect(callArgs.eventType).toBe('xv');
	});

	it('returns RENDER_FAILED when adaptDbEvent throws', async () => {
		const invitation = makeProject();
		mockAdaptDbEvent.mockImplementation(() => {
			throw new Error('Asset resolution failed');
		});

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			validDemoContent,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBeDefined();
		}
	});

	it('uses invitation slug for content identity and default asset resolution', async () => {
		const invitation = makeProject({ slug: 'ana-sofia-cota-guillen' });

		await buildDraftPreviewPageContext(invitation, validDraftContent, validDemoContent);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('ana-sofia-cota-guillen');
		expect(callArgs.assetSlug).toBe('ana-sofia-cota-guillen');
	});

	it('uses current content _assetSlug for asset resolution when it differs from previewSlug', async () => {
		const invitation = makeProject({
			slug: 'ana-sofia-cota-guillen',
			snapshot: { ...demoPreset, previewSlug: 'demo-xv-jewelry-box' },
		});

		await buildDraftPreviewPageContext(
			invitation,
			{
				...validDraftContent,
				_assetSlug: 'ana-sofia-cota-guillen',
				hero: { name: 'Ana Sofía', backgroundImage: 'hero', portrait: 'portrait' },
			},
			validDemoContent,
		);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.slug).toBe('ana-sofia-cota-guillen');
		expect(callArgs.assetSlug).toBe('ana-sofia-cota-guillen');
	});

	it('uses an explicit asset lookup slug for non-empty draft content', async () => {
		const invitation = makeProject({
			slug: 'ximena-meza-trasvina',
			snapshot: { ...demoPreset, previewSlug: 'demo-xv-jewelry-box' },
		});

		await buildDraftPreviewPageContext(
			invitation,
			{ ...validDraftContent, hero: { name: 'Ximena', backgroundImage: 'hero' } },
			validDemoContent,
			{ assetLookupSlug: 'ximena-meza-trasvina' },
		);

		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.assetSlug).toBe('ximena-meza-trasvina');
		expect((callArgs.content.hero as Record<string, unknown>).name).toBe('Ximena');
	});

	it('falls back to demo previewSlug for client invitations without a slug', async () => {
		const invitation = makeProject({ slug: null });

		await buildDraftPreviewPageContext(invitation, validDraftContent, validDemoContent);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.assetSlug).toBe('demo-xv-enchanted-rose');
	});

	it('succeeds with empty demo content (missing event-demos entry)', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, validDraftContent, {});

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
	});

	it('succeeds with empty draft content (no draft saved yet)', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, {}, validDemoContent);

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
	});

	it('succeeds when both draft and demo content are empty', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, {}, {});

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
	});
});

describe('preview content selection', () => {
	it('treats an empty draft object as non-meaningful', () => {
		expect(hasMeaningfulDraftContent(null)).toBe(false);
		expect(hasMeaningfulDraftContent(undefined)).toBe(false);
		expect(hasMeaningfulDraftContent({})).toBe(false);
		expect(hasMeaningfulDraftContent({ hero: { name: 'Ximena' } })).toBe(true);
	});

	it('rejects non-object types as meaningful content', () => {
		expect(hasMeaningfulDraftContent('string')).toBe(false);
		expect(hasMeaningfulDraftContent(42)).toBe(false);
		expect(hasMeaningfulDraftContent(true)).toBe(false);
	});

	it('rejects arrays even if they contain valid keys', () => {
		expect(hasMeaningfulDraftContent(['hero', 'title'])).toBe(false);
		expect(hasMeaningfulDraftContent([{ hero: { name: 'Test' } }])).toBe(false);
	});

	it('treats objects with only underscore/internal keys as non-meaningful', () => {
		expect(hasMeaningfulDraftContent({ _assetSlug: 'test-slug' })).toBe(false);
		expect(hasMeaningfulDraftContent({ _meta: { version: 1 } })).toBe(false);
	});

	it('treats objects with all values undefined as non-meaningful', () => {
		expect(hasMeaningfulDraftContent({ title: undefined, hero: undefined })).toBe(false);
	});

	it('uses published content when a draft row exists but content is empty', () => {
		const publishedContent = {
			_assetSlug: 'ximena-meza-trasvina',
			hero: { name: 'Ximena', backgroundImage: 'hero' },
		};

		const result = selectPreviewContent({
			draftContent: {},
			publishedContent,
		});

		expect(result).toEqual({
			content: publishedContent,
			label: 'Versión pública',
			assetLookupSlug: 'ximena-meza-trasvina',
		});
	});

	it('uses non-empty draft content before published content while keeping published asset slug', () => {
		const draftContent = {
			hero: { name: 'Ximena editada', backgroundImage: 'hero' },
		};
		const publishedContent = {
			_assetSlug: 'ximena-meza-trasvina',
			hero: { name: 'Ximena', backgroundImage: 'hero' },
		};

		const result = selectPreviewContent({
			draftContent,
			publishedContent,
		});

		expect(result).toEqual({
			content: draftContent,
			label: 'Borrador',
			assetLookupSlug: 'ximena-meza-trasvina',
		});
	});
});

describe('content mapping behavior', () => {
	it('uses draft content when available', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(
			invitation,
			validDraftContent,
			validDemoContent,
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
			validDemoContent,
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
			validDemoContent,
		);
		expect(result.ok).toBe(true);
	});

	it('is resilient to missing event-demos entry (empty demo content)', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, validDraftContent, {});

		expect(result.ok).toBe(true);
		const callContent = mockAdaptDbEvent.mock.calls[0][0].content as Record<string, unknown>;
		expect(callContent.title).toBe('XV Años — Ayrin Samantha');
		expect(callContent.hero).toBeDefined();
		expect((callContent.hero as Record<string, unknown>).name).toBe('Ayrin Samantha');
	});

	it('handles empty previewSlug without crashing', async () => {
		const invitation = makeProject({
			slug: null,
			snapshot: { ...demoPreset, previewSlug: '' },
		});

		const result = await buildDraftPreviewPageContext(invitation, {}, {});

		expect(result.ok).toBe(true);
		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
	});

	it('renders default preview when neither draft nor published content exists', async () => {
		const invitation = makeProject();

		const result = await buildDraftPreviewPageContext(invitation, {}, {});

		expect(result.ok).toBe(true);
		const callContent = mockAdaptDbEvent.mock.calls[0][0].content;
		expect(callContent.title).toBe('XV Años — Ayrin Samantha');
		expect(callContent.hero).toBeDefined();
	});

	it('resolves uploaded asset refs before mapping', async () => {
		const invitation = makeProject();
		const draftWithUploaded = {
			...validDraftContent,
			gallery: {
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

		await buildDraftPreviewPageContext(invitation, draftWithUploaded, validDemoContent);

		expect(mockFindAssets).toHaveBeenCalledWith(invitation.id);
	});
});
