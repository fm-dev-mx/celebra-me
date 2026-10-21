jest.mock('@/lib/content/events', () => ({
	...jest.requireActual('@/lib/content/events'),
	getRoutableEventEntry: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedWithAccessBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	isInvitationArchivedBySlug: jest.fn(),
}));

jest.mock('@/lib/adapters/event', () => ({
	adaptEvent: jest.fn(() => ({
		id: 'my-invitation',
		isDemo: false,
		title: 'Published Event',
		theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
		hero: { name: 'Ana Sofia', label: 'Mis XV Anos', date: '2027-11-20' },
		envelope: { enabled: false },
		brandingVisibility: {
			showFooterBranding: true,
			showContactCta: true,
		},
		sections: {},
	})),
}));

jest.mock('@/lib/environment', () => ({
	isDevEnvironment: () => false,
}));

import {
	resolveInvitationContent,
	resolvePublicInvitation,
} from '@/lib/invitation/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedWithAccessBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { isInvitationArchivedBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptEvent } from '@/lib/adapters/event';
import validPublishedContentJson from '../fixtures/content/xv-jewelry-box.json';
import {
	ANONYMOUS_PUBLISHED_CONTENT_READS,
	assertObservedOperationCount,
} from '@/lib/invitation/delivery-contract';

const validPublishedContent = validPublishedContentJson as unknown as Record<string, unknown>;

const mockGetRoutable = getRoutableEventEntry as jest.MockedFunction<typeof getRoutableEventEntry>;
const mockFindPublishedWithAccess =
	findPublishedWithAccessBySlugAndEventType as jest.MockedFunction<
		typeof findPublishedWithAccessBySlugAndEventType
	>;
const mockAdaptEvent = adaptEvent as jest.Mock;
const mockIsInvitationArchivedBySlug = isInvitationArchivedBySlug as jest.MockedFunction<
	typeof isInvitationArchivedBySlug
>;

// The published fixture has a fixed event date (2026-11-21): pin only the clock inside its
// validity window so the suite does not start failing once that window closes.
const PINNED_NOW = new Date('2026-10-13T12:00:00.000Z');
beforeAll(() => {
	jest.useFakeTimers({
		now: PINNED_NOW,
		doNotFake: [
			'nextTick',
			'queueMicrotask',
			'setImmediate',
			'clearImmediate',
			'setTimeout',
			'clearTimeout',
			'setInterval',
			'clearInterval',
			'hrtime',
			'performance',
		],
	});
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
	jest.clearAllMocks();
	mockIsInvitationArchivedBySlug.mockResolvedValue(false);
});

describe('resolveInvitationContent', () => {
	it('prefers DB-published content over static', async () => {
		mockFindPublishedWithAccess.mockResolvedValue({
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
		expect(mockAdaptEvent).toHaveBeenCalledWith({
			slug: 'my-invitation',
			content: expect.objectContaining({ title: validPublishedContent.title }),
		});
		expect(mockGetRoutable).not.toHaveBeenCalled();
		assertObservedOperationCount(
			mockFindPublishedWithAccess.mock.calls.length,
			ANONYMOUS_PUBLISHED_CONTENT_READS,
			'published-content',
		);
		expect(mockIsInvitationArchivedBySlug).not.toHaveBeenCalled();
	});

	it('resolves static demo when Supabase credentials are missing', async () => {
		mockFindPublishedWithAccess.mockRejectedValue(
			new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.'),
		);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
		expect(mockAdaptEvent).toHaveBeenCalledWith({ slug: 'demo-xv', content: { isDemo: true } });
	});

	it('resolves static demo when all Supabase calls fail with credential errors', async () => {
		const credError = new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
		mockFindPublishedWithAccess.mockRejectedValue(credError);
		mockIsInvitationArchivedBySlug.mockRejectedValue(credError);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('returns null when credentials are missing and no static fallback exists', async () => {
		mockFindPublishedWithAccess.mockRejectedValue(
			new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.'),
		);
		mockGetRoutable.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('still throws on non-credential DB errors', async () => {
		mockFindPublishedWithAccess.mockRejectedValue(new Error('connection refused'));

		await expect(resolveInvitationContent('my-invitation', 'xv')).rejects.toThrow(
			'connection refused',
		);
	});

	it('resolves static demo content when no DB content exists', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('blocks non-demo static entries', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'events/some-event',
			data: { isDemo: false },
		} as any);

		const result = await resolveInvitationContent('some-event', 'xv');

		expect(result).toBeNull();
	});

	it('falls back to published content when static is null', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
		expect(mockAdaptEvent).toHaveBeenCalled();
		expect(mockGetRoutable).not.toHaveBeenCalled();
	});

	it('returns null when eventType is not provided (published skip)', async () => {
		mockGetRoutable.mockResolvedValue(null);

		const result = await resolveInvitationContent('my-invitation');

		expect(result).toBeNull();
		expect(mockFindPublishedWithAccess).not.toHaveBeenCalled();
	});

	it('does not cross-resolve when slug exists for different eventType', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		const result = await resolveInvitationContent('shared-slug', 'boda');

		expect(result).toBeNull();
		expect(mockFindPublishedWithAccess).toHaveBeenCalledWith('shared-slug', 'boda');
	});

	it('resolves published content only when both slug and eventType match', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
		} as any);

		const resultXv = await resolveInvitationContent('my-invitation', 'xv');
		expect(resultXv).not.toBeNull();
		expect(resultXv!.source).toBe('published');

		mockFindPublishedWithAccess.mockResolvedValue(null);
		const resultBoda = await resolveInvitationContent('my-invitation', 'boda');
		expect(resultBoda).toBeNull();
	});

	it('returns null when neither static nor published content exists', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('published lookup filters by both slug and eventType', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		await resolveInvitationContent('some-slug', 'bautizo');

		expect(mockFindPublishedWithAccess).toHaveBeenCalledWith('some-slug', 'bautizo');
	});

	it('no admin fields exposed in published resolution', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
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
		mockFindPublishedWithAccess.mockResolvedValue({
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
		mockFindPublishedWithAccess.mockResolvedValue({
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
		expect(mockAdaptEvent).not.toHaveBeenCalled();
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
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'legacy-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
		} as any);

		const result = await resolveInvitationContent('legacy-invitation', 'xv');

		expect(result?.source).toBe('published');
		expect(mockAdaptEvent).toHaveBeenCalledWith(
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

describe('resolvePublicInvitation access state', () => {
	const publishedEntry = (access: unknown) =>
		({
			id: 'published-1',
			invitationId: 'invitation-1',
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: validPublishedContent,
			version: 3,
			access,
		}) as any;

	it('attaches the paid access state to a published client invitation', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'paid', publicAccess: 'enabled' }),
		);

		const result = await resolvePublicInvitation('my-invitation', 'xv');

		expect(result).toEqual(
			expect.objectContaining({
				source: 'published',
				version: 3,
				access: { paymentStatus: 'paid', publicAccess: 'enabled' },
			}),
		);
	});

	it('keeps an unpaid invitation reachable with its access state', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'unpaid', publicAccess: 'enabled' }),
		);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result?.source).toBe('published');
		expect(result?.source === 'published' && result.access.paymentStatus).toBe('unpaid');
	});

	it('resolves a disabled invitation as unavailable without adapting its content', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'paid', publicAccess: 'disabled' }),
		);

		const result = await resolvePublicInvitation('my-invitation', 'xv');

		expect(result).toEqual({ source: 'unavailable' });
		expect(mockAdaptEvent).not.toHaveBeenCalled();
		expect(mockGetRoutable).not.toHaveBeenCalled();
		expect(mockIsInvitationArchivedBySlug).not.toHaveBeenCalled();
	});

	it('resolves an invitation past its validity window as unavailable', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'paid', publicAccess: 'enabled' }),
		);
		try {
			// Event date 2026-11-21 (legacy hero date, America/Chihuahua): last public
			// instant is 2027-11-21T23:59:59.999-06:00.
			jest.setSystemTime(new Date('2027-11-22T05:59:59.999Z'));
			expect((await resolvePublicInvitation('my-invitation', 'xv'))?.source).toBe(
				'published',
			);

			mockAdaptEvent.mockClear();
			jest.setSystemTime(new Date('2027-11-22T06:00:00.000Z'));
			expect(await resolvePublicInvitation('my-invitation', 'xv')).toEqual({
				source: 'unavailable',
			});
			expect(mockAdaptEvent).not.toHaveBeenCalled();
			await expect(resolveInvitationContent('my-invitation', 'xv')).resolves.toBeNull();
		} finally {
			jest.setSystemTime(PINNED_NOW);
		}
	});

	it('hides a disabled invitation from content-only callers', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'unpaid', publicAccess: 'disabled' }),
		);

		await expect(resolveInvitationContent('my-invitation', 'xv')).resolves.toBeNull();
	});

	it('serves the unpaid preview when the access row is missing', async () => {
		const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		mockFindPublishedWithAccess.mockResolvedValue(publishedEntry(null));

		const result = await resolvePublicInvitation('my-invitation', 'xv');

		expect(result?.source === 'published' && result.access).toEqual({
			paymentStatus: 'unpaid',
			publicAccess: 'enabled',
		});
		expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Missing access state'), {
			publishedContentId: 'published-1',
			invitationId: 'invitation-1',
		});
		consoleWarn.mockRestore();
	});

	it('serves original photos whether the invitation is unpaid or paid', async () => {
		const heroSrc =
			'https://abc.supabase.co/storage/v1/object/public/invitation-assets/x/hero.webp';
		const heroViewModel = {
			id: 'my-invitation',
			isDemo: false,
			title: 'Published Event',
			theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
			hero: {
				name: 'Ana',
				label: 'XV',
				date: '2027-11-20',
				backgroundImage: { src: heroSrc, alt: '' },
			},
			envelope: { enabled: false },
			brandingVisibility: { showFooterBranding: true, showContactCta: true },
			sections: {},
		};
		mockAdaptEvent.mockReturnValueOnce(heroViewModel).mockReturnValueOnce(heroViewModel);

		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'unpaid', publicAccess: 'enabled' }),
		);
		const unpaid = await resolvePublicInvitation('my-invitation', 'xv');
		const unpaidVm = unpaid?.source === 'published' ? unpaid.viewModel : null;
		expect(unpaidVm?.hero.backgroundImage.src).toBe(heroSrc);
		expect(JSON.stringify(unpaidVm)).not.toContain('/vista-previa/');

		mockFindPublishedWithAccess.mockResolvedValue(
			publishedEntry({ paymentStatus: 'paid', publicAccess: 'enabled' }),
		);
		const paid = await resolvePublicInvitation('my-invitation', 'xv');
		expect(paid?.source === 'published' && paid.viewModel.hero.backgroundImage.src).toBe(
			heroSrc,
		);
	});

	it('never applies access state to static demos', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolvePublicInvitation('demo-xv', 'xv');

		expect(result?.source).toBe('static');
		expect(result).not.toHaveProperty('access');
	});
});
