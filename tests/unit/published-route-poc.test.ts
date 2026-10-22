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

// Bundled demos (content.isDemo true) and published rows get distinct view models.
jest.mock('@/lib/adapters/event', () => ({
	adaptEvent: jest.fn((document: { content: Record<string, unknown> }) =>
		document.content.isDemo === true
			? {
					id: 'demo-xv',
					isDemo: true,
					title: 'Demo Event',
					theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
					hero: {
						name: 'Lucia',
						label: 'Demo',
						date: '2027-01-01',
						backgroundImage: { src: '/img.jpg' },
					},
					envelope: { enabled: false },
					brandingVisibility: {
						showFooterBranding: true,
						showContactCta: true,
					},
					sections: {},
				}
			: {
					id: 'my-invitation',
					isDemo: false,
					title: 'Published Event',
					theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
					hero: {
						name: 'Published',
						label: 'Event',
						date: '2027-01-01',
						backgroundImage: { src: '/img.jpg' },
					},
					envelope: { enabled: false },
					brandingVisibility: {
						showFooterBranding: true,
						showContactCta: true,
					},
					sections: {
						rsvp: {
							title: 'Confirma',
							guestCap: 4,
							accessMode: 'hybrid',
							eventSlug: 'my-invitation',
							eventType: 'xv',
						},
						gifts: { items: [] },
						quote: { text: 'Quote' },
						thankYou: { message: 'Thanks' },
					},
				},
	),
}));

jest.mock('@/lib/environment', () => ({
	isDevEnvironment: () => false,
}));

import {
	resolveInvitationContent,
	type ContentResolution,
} from '@/lib/invitation/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedWithAccessBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { isInvitationArchivedBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptEvent } from '@/lib/adapters/event';
import validPublishedContentJson from '../fixtures/content/xv-jewelry-box.json';

const validPublishedContent = {
	...validPublishedContentJson,
	isDemo: false,
};

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

describe('published route POC', () => {
	it('resolver uses published content when available and static missing', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: { ...validPublishedContent, title: 'Published Event' },
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(
			(result! as Extract<ContentResolution, { source: 'published' }>).rawContent,
		).toBeDefined();
		expect(mockAdaptEvent).toHaveBeenCalled();
	});

	it('resolver uses DB content even when static content exists', async () => {
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'ana-sofia',
			eventType: 'xv',
			isDemo: false,
			content: { ...validPublishedContent, title: 'DB Event' },
		} as any);
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia', data: {} } as any);

		const result = await resolveInvitationContent('ana-sofia', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
	});

	it('resolver uses static content only for demos when DB is empty', async () => {
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/demo-xv',
			data: { isDemo: true },
		} as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('published content produces complete InvitationViewModel', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: { ...validPublishedContent, title: 'Published Event' },
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.viewModel.hero.name).toBe('Published');
		expect(result!.viewModel.sections.rsvp).toBeDefined();
		expect(result!.viewModel.sections.gifts).toBeDefined();
		expect(result!.viewModel.sections.quote).toBeDefined();
		expect(result!.viewModel.sections.thankYou).toBeDefined();
	});

	it('resolver returns null when neither source has content', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('unpublished draft content is never accessible via resolver', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		const result = await resolveInvitationContent('draft-only-slug', 'xv');

		expect(result).toBeNull();
	});

	it('static fallback works for demos when published content is missing', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedWithAccess.mockResolvedValue(null);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('does not serve the static demo fallback for an archived invitation', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockIsInvitationArchivedBySlug.mockResolvedValue(true);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).toBeNull();
	});

	it('keeps static demos routable during the app-before-migration rollout window', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedWithAccess.mockResolvedValue(null);
		mockIsInvitationArchivedBySlug.mockRejectedValue(
			new Error("Could not find the table 'public.invitations' in the schema cache"),
		);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result?.source).toBe('static');
	});

	it('resolver does not expose admin fields in the published view model', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedWithAccess.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {
				...validPublishedContent,
				title: 'Published',
			},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');
		const viewModel = result!.viewModel as unknown as Record<string, unknown>;

		expect(viewModel.invitation_project_id).toBeUndefined();
		expect(viewModel.tokenHash).toBeUndefined();
	});

	it('adaptEvent produces view model matching rendering shape', () => {
		const dbResult = adaptEvent({
			slug: 'my-invitation',
			content: {
				eventType: 'xv',
				title: 'Published',
				theme: { preset: 'jewelry-box' },
				hero: {
					name: 'Test',
					label: 'Event',
					date: '2027-01-01',
					backgroundImage: { type: 'internal', key: 'hero' },
					variant: 'jewelry-box',
				},
				envelope: { disabled: true },
			},
		});

		expect(dbResult).toMatchObject({
			theme: expect.objectContaining({ preset: 'jewelry-box' }),
			hero: expect.objectContaining({ name: 'Published' }),
			envelope: expect.objectContaining({ enabled: false }),
			sections: expect.any(Object),
		});
	});
});
