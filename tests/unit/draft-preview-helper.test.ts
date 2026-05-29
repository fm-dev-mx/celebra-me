import { buildDraftPreviewPageContext } from '@/lib/invitation/draft-preview-helper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { InvitationProject, DemoPreset } from '@/lib/intake/types';

jest.mock('@/lib/adapters/db-event-adapter', () => ({
	adaptDbEvent: jest.fn(),
}));

jest.mock('@/lib/invitation/page-data', () => ({
	buildPageContextFromViewModel: jest.fn(),
}));

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

function makeProject(overrides?: Partial<InvitationProject>): InvitationProject {
	return {
		id: '01548214-bc22-4141-ba61-f36c27cd8627',
		title: 'XV Años — Ayrin Samantha',
		eventType: 'xv',
		baseDemoId: 'demo-xv-enchanted-rose',
		themeId: 'enchanted-rose',
		status: 'draft',
		slug: null,
		snapshot: demoPreset,
		clientName: 'Ayrin Samantha',
		clientEmail: 'ayrin@example.com',
		clientWhatsapp: '+521234567890',
		photosReceived: false,
		createdBy: 'user-1',
		createdAt: '2026-05-28T14:00:00Z',
		updatedAt: '2026-05-28T14:00:00Z',
		...overrides,
	};
}

const validDemoContent = {
	eventType: 'xv',
	title: 'XV Años — Enchanted Rose Demo',
	theme: { fontFamily: 'serif', preset: 'enchanted-rose' },
	hero: {
		name: 'Isabella Rose',
		label: 'Mis XV Años',
		date: '2027-11-20T20:00:00.000Z',
		backgroundImage: 'hero',
		portrait: 'portrait',
	},
};

const validDraftContent = {
	title: 'XV Años — Ayrin Samantha',
	description: 'Una noche mágica',
	hero: {
		name: 'Ayrin Samantha',
		secondaryName: '',
		label: 'Mis XV Años',
		nickname: 'Ayrin',
		date: '2027-12-15T18:00:00Z',
	},
};

const mockViewModel = {
	id: 'demo-xv-enchanted-rose',
	isDemo: false,
	title: 'Preview',
	description: 'Preview description',
	theme: { preset: 'enchanted-rose' as const, themeClass: 'theme-preset--enchanted-rose' },
	hero: {
		name: 'Ayrin Samantha',
		label: 'Mis XV Años',
		date: '2027-12-15T18:00:00Z',
		variant: 'enchanted-rose' as const,
		backgroundImage: { src: '/test-hero.jpg', alt: 'Test' },
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: true,
		showContactCta: true,
		showThankYouBranding: true,
	},
	sections: {},
	navigation: [],
	interludes: [],
};

const mockPageContext: ReturnType<typeof buildPageContextFromViewModel> = {
	viewModel: mockViewModel as never,
	guestContext: null,
	isDemoPreview: false,
	layout: { title: 'Preview', description: '', image: '' },
	wrapper: {
		className: 'event-theme-wrapper',
		showEnvelope: false,
		dataAttributes: {},
		scopedStyles: '',
	},
	guestName: undefined,
	heroTime: undefined,
	heroVenueName: undefined,
	envelope: undefined,
	footerVariant: 'enchanted-rose' as never,
	renderPlan: [],
};

beforeEach(() => {
	jest.clearAllMocks();
	mockAdaptDbEvent.mockReturnValue(mockViewModel);
	mockBuildPageContext.mockReturnValue(mockPageContext);
});

describe('buildDraftPreviewPageContext', () => {
	it('builds a preview context from draft + demo content', () => {
		const project = makeProject();

		const result = buildDraftPreviewPageContext(project, validDraftContent, validDemoContent);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.projectTitle).toBe('XV Años — Ayrin Samantha');
			expect(result.eventType).toBe('xv');
			expect(result.pageContext).toBeDefined();
		}
	});

	it('passes correct args to adaptDbEvent', () => {
		const project = makeProject();

		buildDraftPreviewPageContext(project, validDraftContent, validDemoContent);

		expect(mockAdaptDbEvent).toHaveBeenCalledTimes(1);
		const callArgs = mockAdaptDbEvent.mock.calls[0][0];
		expect(callArgs.eventType).toBe('xv');
		expect(callArgs.isDemo).toBe(false);
		expect(callArgs.assetSlug).toBe('demo-xv-enchanted-rose');
		expect(callArgs.content).toBeDefined();
	});

	it('calls buildPageContextFromViewModel with isPreview=true', () => {
		const project = makeProject();

		buildDraftPreviewPageContext(project, validDraftContent, validDemoContent);

		expect(mockBuildPageContext).toHaveBeenCalledTimes(1);
		const callArgs = mockBuildPageContext.mock.calls[0][0];
		expect(callArgs.isPreview).toBe(true);
		expect(callArgs.viewModel).toBe(mockViewModel);
		expect(callArgs.eventType).toBe('xv');
	});

	it('returns RENDER_FAILED when adaptDbEvent throws', () => {
		const project = makeProject();
		mockAdaptDbEvent.mockImplementation(() => {
			throw new Error('Asset resolution failed');
		});

		const result = buildDraftPreviewPageContext(project, validDraftContent, validDemoContent);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBeDefined();
		}
	});
});
