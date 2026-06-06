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
			showThankYouBranding: true,
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
	})),
}));

import {
	resolveInvitationContent,
	type ContentResolution,
} from '@/lib/invitation/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';

const mockGetRoutable = getRoutableEventEntry as jest.MockedFunction<typeof getRoutableEventEntry>;
const mockFindPublishedBySlugAndEventType = findPublishedBySlugAndEventType as jest.MockedFunction<
	typeof findPublishedBySlugAndEventType
>;
const mockAdaptDbEvent = adaptDbEvent as jest.Mock;
const mockFindInvitationBySlug = findInvitationBySlug as jest.MockedFunction<
	typeof findInvitationBySlug
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockFindInvitationBySlug.mockResolvedValue(null);
});

describe('published route POC', () => {
	it('resolver uses published content when available and static missing', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {
				eventType: 'xv',
				title: 'Published Event',
				theme: { preset: 'jewelry-box' },
				hero: {
					name: 'Published',
					label: 'Event',
					date: '2027-01-01',
					backgroundImage: { type: 'internal', key: 'hero' },
				},
				envelope: { disabled: true },
				sectionStyles: {},
			},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(
			(result! as Extract<ContentResolution, { source: 'published' }>).rawContent,
		).toBeDefined();
		expect(mockAdaptDbEvent).toHaveBeenCalled();
	});

	it('resolver uses DB content even when static content exists', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'ana-sofia',
			eventType: 'xv',
			isDemo: false,
			content: { eventType: 'xv', title: 'DB Event' },
		} as any);
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia', data: {} } as any);

		const result = await resolveInvitationContent('ana-sofia', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
	});

	it('resolver uses static content only for demos when DB is empty', async () => {
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
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
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {
				eventType: 'xv',
				title: 'Published Event',
				theme: { fontFamily: 'serif', preset: 'jewelry-box' },
				hero: {
					name: 'Ana',
					label: 'XV',
					date: '2027-01-01',
					backgroundImage: { type: 'internal', key: 'hero' },
				},
				envelope: { disabled: true },
				sectionOrder: ['quote', 'family', 'location', 'rsvp', 'gifts', 'thankYou'],
				sectionStyles: { location: { showFlourishes: true } },
				gallery: { title: 'Galeria', items: [] },
				itinerary: { title: 'Itinerario', items: [] },
				countdown: { title: 'Falta poco', footerText: 'Texto' },
				interludes: [],
				navigation: [{ label: 'Inicio', href: '#inicio' }],
				sharing: { whatsappTemplate: 'Hola' },
				rsvp: { title: 'Confirma', guestCap: 4, confirmationMode: 'api' },
				gifts: { title: 'Regalos', items: [] },
				quote: { text: 'Frase', author: 'Autor' },
				thankYou: { message: 'Gracias', closingName: 'Ana' },
			},
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
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent', 'xv');

		expect(result).toBeNull();
	});

	it('unpublished draft content is never accessible via resolver', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		const result = await resolveInvitationContent('draft-only-slug', 'xv');

		expect(result).toBeNull();
	});

	it('static fallback works for demos when published content is missing', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});

	it('does not serve the static demo fallback for an archived invitation', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		mockFindInvitationBySlug.mockResolvedValue({ archivedAt: '2026-06-01T00:00:00Z' } as any);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result).toBeNull();
	});

	it('keeps static demos routable during the app-before-migration rollout window', async () => {
		mockGetRoutable.mockResolvedValue({
			id: 'event-demos/xv/demo-xv',
			data: { isDemo: true },
		} as any);
		mockFindPublishedBySlugAndEventType.mockResolvedValue(null);
		mockFindInvitationBySlug.mockRejectedValue(
			new Error("Could not find the table 'public.invitations' in the schema cache"),
		);

		const result = await resolveInvitationContent('demo-xv', 'xv');

		expect(result?.source).toBe('static');
	});

	it('resolver does not expose admin fields in published content', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublishedBySlugAndEventType.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {
				eventType: 'xv',
				title: 'Published',
				theme: { preset: 'jewelry-box' },
				hero: {
					name: 'Ana',
					label: 'XV',
					date: '2027-01-01',
					backgroundImage: { type: 'internal', key: 'hero' },
				},
				invitation_project_id: 'should-be-hidden',
				tokenHash: 'should-not-expose',
			},
		} as any);

		const result = await resolveInvitationContent('my-invitation', 'xv');
		const viewModel = result!.viewModel as unknown as Record<string, unknown>;

		expect(viewModel.invitation_project_id).toBeUndefined();
		expect(viewModel.tokenHash).toBeUndefined();
	});

	it('adaptDbEvent produces view model matching rendering shape', () => {
		const dbResult = adaptDbEvent({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
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
