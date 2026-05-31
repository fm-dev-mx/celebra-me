jest.mock('@/lib/content/events', () => ({
	getRoutableEventEntry: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/adapters/event', () => ({
	adaptEvent: jest.fn(() => ({
		id: 'ana-sofia-cota-guillen',
		isDemo: false,
		title: 'XV Anos — Ana Sofia',
		theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
		envelope: { enabled: false },
		brandingVisibility: {
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		},
		sections: {},
	})),
}));

jest.mock('@/lib/adapters/db-event-adapter', () => ({
	adaptDbEvent: jest.fn(() => ({
		id: 'my-invitation',
		isDemo: false,
		title: 'Published Event',
		theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
		envelope: { enabled: false },
		brandingVisibility: {
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		},
		sections: {},
	})),
}));

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';

const mockGetRoutable = getRoutableEventEntry as jest.MockedFunction<typeof getRoutableEventEntry>;
const mockFindPublishedBySlugAndEventType = findPublishedBySlugAndEventType as jest.MockedFunction<
	typeof findPublishedBySlugAndEventType
>;
const mockAdaptEvent = adaptEvent as jest.Mock;
const mockAdaptDbEvent = adaptDbEvent as jest.Mock;

beforeEach(() => {
	jest.clearAllMocks();
});

describe('resolveInvitationContent', () => {
	it('prefers DB-published content over static', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: { title: 'DB Content' },
		} as any);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(mockAdaptDbEvent).toHaveBeenCalled();
		expect(mockAdaptEvent).not.toHaveBeenCalled();
	});

	it('resolves static demo content when no DB content exists', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('blocks non-demo static entries', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'events/some-event',
			data: { isDemo: false },
		} as any);

		const result = await resolveInvitationContent('some-event', 'xv');

		expect(result).toBeNull();
	});

	it('falls back to published content when static is null', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
		expect(mockAdaptDbEvent).toHaveBeenCalled();
	});

	it('returns null when eventType is not provided (published skip)', async () => {
		mockGetRoutable.mockResolvedValue(null);

		const result = await resolveInvitationContent('my-invitation');

		expect(result).toBeNull();
		expect(mockFindPublishedBySlugAndEventType).not.toHaveBeenCalled();
	});

	it('does not cross-resolve when slug exists for different eventType', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		const result = await resolveInvitationContent('shared-slug', 'boda');

		expect(result).toBeNull();
		expect(mockFindPublishedBySlugAndEventType).toHaveBeenCalledWith('shared-slug', 'boda');
	});

	it('resolves published content only when both slug and eventType match', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {},
		} as any);

		const resultXv = await resolveInvitationContent('my-invitation', 'xv');
		expect(resultXv).not.toBeNull();
		expect(resultXv!.source).toBe('published');

		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		const resultBoda = await resolveInvitationContent('my-invitation', 'boda');
		expect(resultBoda).toBeNull();
	});

	it('returns null when neither static nor published content exists', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('published lookup filters by both slug and eventType', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		await resolveInvitationContent('some-slug', 'bautizo');

		expect(mockFindPublishedBySlugAndEventType).toHaveBeenCalledWith('some-slug', 'bautizo');
	});

	it('no admin fields exposed in published resolution', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'safe',
			eventType: 'xv',
			isDemo: false,
			content: { title: 'Safe Event', hero: {} },
		} as any);

		const result = await resolveInvitationContent('safe', 'xv');

		const vm = result!.viewModel as unknown as Record<string, unknown>;
		expect(vm.tokenHash).toBeUndefined();
		expect((vm as any).invitation_project_id).toBeUndefined();
	});

	it('does not propagate _assetSlug from rawContent to viewModel', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {
				_assetSlug: 'demo-xv-jewelry-box',
				title: 'Published',
				hero: { name: 'Test', label: 'Event', date: '2027-01-01' },
			},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		const vm = result!.viewModel as unknown as Record<string, unknown>;
		expect(vm._assetSlug).toBeUndefined();
	});
});
