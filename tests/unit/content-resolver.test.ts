jest.mock('@/lib/content/events', () => ({
	getRoutableEventEntry: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationBySlug: jest.fn(),
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

jest.mock('@/lib/environment', () => ({
	isDevEnvironment: () => false,
}));

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import validPublishedContentJson from '@/content/event-demos/xv/demo-xv-jewelry-box.json';

const validPublishedContent = validPublishedContentJson as unknown as Record<string, unknown>;

const mockGetRoutable = getRoutableEventEntry as jest.MockedFunction<typeof getRoutableEventEntry>;
const mockFindPublishedBySlugAndEventType = findPublishedBySlugAndEventType as jest.MockedFunction<
	typeof findPublishedBySlugAndEventType
>;
const mockAdaptEvent = adaptEvent as jest.Mock;
const mockAdaptDbEvent = adaptDbEvent as jest.Mock;
const mockFindInvitationBySlug = findInvitationBySlug as jest.MockedFunction<
	typeof findInvitationBySlug
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockFindInvitationBySlug.mockResolvedValue(null);
});

describe('resolveInvitationContent', () => {
	it('prefers DB-published content over static', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
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
		expect(mockGetRoutable).not.toHaveBeenCalled();
	});

	it('resolves static demo when Supabase credentials are missing', async () => {
		mockFindPublishedBySlugAndEventType.mockRejectedValue(
			new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.'),
		);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
		expect(mockAdaptEvent).toHaveBeenCalled();
	});

	it('resolves static demo when all Supabase calls fail with credential errors', async () => {
		const credError = new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
		mockFindPublishedBySlugAndEventType.mockRejectedValue(credError);
		mockFindInvitationBySlug.mockRejectedValue(credError);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('returns null when credentials are missing and no static fallback exists', async () => {
		mockFindPublishedBySlugAndEventType.mockRejectedValue(
			new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.'),
		);
		mockGetRoutable.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('still throws on non-credential DB errors', async () => {
		mockFindPublishedBySlugAndEventType.mockRejectedValue(new Error('connection refused'));

		await expect(resolveInvitationContent('my-invitation', 'xv')).rejects.toThrow(
			'connection refused',
		);
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
			content: validPublishedContent,
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
		expect(mockAdaptDbEvent).toHaveBeenCalled();
		expect(mockGetRoutable).not.toHaveBeenCalled();
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
			content: validPublishedContent,
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
			content: validPublishedContent,
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
				...validPublishedContent,
				_assetSlug: 'demo-xv-jewelry-box',
			},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		const vm = result!.viewModel as unknown as Record<string, unknown>;
		expect(vm._assetSlug).toBeUndefined();
	});

	it('rejects malformed published content before adaptation and logs identifiers only', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			id: 'published-1',
			invitationId: 'invitation-1',
			slug: 'broken-invitation',
			eventType: 'xv',
			isDemo: false,
			content: { hero: { name: 'Private payload must not be logged' } },
			version: 7,
		} as any);

		const result = await resolveInvitationContent('broken-invitation', 'xv');

		expect(result).toBeNull();
		expect(mockAdaptDbEvent).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			'[invitation-content] Invalid published content',
			expect.objectContaining({
				publishedContentId: 'published-1',
				invitationId: 'invitation-1',
				slug: 'broken-invitation',
				eventType: 'xv',
				version: 7,
				issuePaths: expect.any(Array),
			}),
		);
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			'Private payload must not be logged',
		);
		consoleError.mockRestore();
	});

	it('keeps schema-compatible legacy published snapshots renderable', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'legacy-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
		} as any);

		const result = await resolveInvitationContent('legacy-invitation', 'xv');

		expect(result?.source).toBe('published');
		expect(mockAdaptDbEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					title: validPublishedContent.title,
					eventType: validPublishedContent.eventType,
					_assetSlug: validPublishedContent._assetSlug,
				}),
			}),
		);
	});
});
