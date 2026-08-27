import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { getCollection } from 'astro:content';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationBySlug } from '@/lib/intake/repositories/invitation.repository';

// Mock environment to prevent Jest import.meta issues
jest.mock('@/lib/environment', () => ({
	isDevEnvironment: () => false,
}));

// We mock astro:content to spy on getCollection
jest.mock('astro:content', () => ({
	getCollection: jest.fn(() => Promise.resolve([])),
}));

// We mock repositories
jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedBySlugAndEventType: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationBySlug: jest.fn(),
}));

describe('resolveInvitationContent Integration Fallback tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('missing invitation returns null', async () => {
		const mockFindPublished = findPublishedBySlugAndEventType as jest.Mock;
		const mockFindInv = findInvitationBySlug as jest.Mock;
		const mockGetCollection = getCollection as jest.Mock;

		mockFindPublished.mockResolvedValue(null);
		mockFindInv.mockResolvedValue(null);
		mockGetCollection.mockResolvedValue([]);

		const result = await resolveInvitationContent('missing-invitation', 'boda');

		expect(result).toBeNull();
		expect(mockGetCollection).toHaveBeenCalledWith('event-demos');
		expect(mockGetCollection).toHaveBeenCalledWith('event-templates');
	});

	it('Supabase credentials missing falls back to search static demos/templates and returns null if not found', async () => {
		const mockFindPublished = findPublishedBySlugAndEventType as jest.Mock;
		const mockFindInv = findInvitationBySlug as jest.Mock;
		const mockGetCollection = getCollection as jest.Mock;

		mockFindPublished.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY no configurada'));
		mockFindInv.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY no configurada'));
		mockGetCollection.mockResolvedValue([]);

		const result = await resolveInvitationContent('some-slug', 'boda');

		expect(result).toBeNull();
		expect(mockGetCollection).toHaveBeenCalledWith('event-demos');
		expect(mockGetCollection).toHaveBeenCalledWith('event-templates');
	});

	it('valid static demo entry resolves correctly when Supabase credentials are missing', async () => {
		const mockFindPublished = findPublishedBySlugAndEventType as jest.Mock;
		const mockFindInv = findInvitationBySlug as jest.Mock;
		const mockGetCollection = getCollection as jest.Mock;

		mockFindPublished.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY no configurada'));
		mockFindInv.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY no configurada'));

		const mockDemoEntry = {
			id: 'event-demos/boda/demo-boda',
			collection: 'event-demos',
			data: {
				isDemo: true,
				eventType: 'boda',
				slug: 'demo-boda',
				theme: { preset: 'jewelry-box' },
				hero: { name: 'Test', date: '2027-01-01', backgroundImage: '/img.jpg' },
				location: {
					venues: [
						{
							id: 'reception',
							type: 'reception',
							venueEvent: 'Recepción',
							venueName: 'Venue',
							address: 'City',
							city: 'City',
							date: '2027-01-01',
							time: '18:00',
						},
					],
				},
				sections: { rsvp: true },
				envelope: { enabled: false },
			},
		};

		mockGetCollection.mockImplementation((collectionName) => {
			if (collectionName === 'event-demos') {
				return Promise.resolve([mockDemoEntry]);
			}
			return Promise.resolve([]);
		});

		const result = await resolveInvitationContent('demo-boda', 'boda');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
		expect(result!.viewModel.id).toBe('demo-boda');
		expect(mockGetCollection).toHaveBeenCalledWith('event-demos');
	});
});
