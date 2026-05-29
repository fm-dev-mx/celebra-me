jest.mock('@/lib/content/events', () => ({
	getRoutableEventEntry: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedBySlug: jest.fn(),
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

import {
	resolveInvitationContent,
	resolveInvitationContentBySource,
} from '@/lib/invitations/content-resolver';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlug } from '@/lib/intake/repositories/published-invitation-content.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';

const mockGetRoutable = getRoutableEventEntry as jest.MockedFunction<typeof getRoutableEventEntry>;
const mockFindPublished = findPublishedBySlug as jest.MockedFunction<typeof findPublishedBySlug>;
const mockAdaptEvent = adaptEvent as jest.Mock;
const mockAdaptDbEvent = adaptDbEvent as jest.Mock;

beforeEach(() => {
	jest.clearAllMocks();
});

describe('resolveInvitationContent', () => {
	it('resolves static/demo content when it exists', async () => {
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia-cota-guillen', data: {} } as any);

		const result = await resolveInvitationContent('ana-sofia-cota-guillen', 'xv');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
		expect(result!.viewModel.title).toBe('XV Anos — Ana Sofia');
		expect(mockAdaptEvent).toHaveBeenCalled();
	});

	it('falls back to published content when static does not exist', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublished.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {},
		} as any);

		const result = await resolveInvitationContent('my-invitation');

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
		expect(result!.viewModel.title).toBe('Published Event');
		expect(mockAdaptDbEvent).toHaveBeenCalled();
	});

	it('returns null when neither static nor published content exists', async () => {
		mockGetRoutable.mockResolvedValue(null);
		mockFindPublished.mockResolvedValue(null);

		const result = await resolveInvitationContent('non-existent');

		expect(result).toBeNull();
	});

	it('prefers static over published when both exist', async () => {
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia-cota-guillen', data: {} } as any);
		mockFindPublished.mockResolvedValue({ slug: 'my-invitation', content: {} } as any);

		const result = await resolveInvitationContent('ana-sofia-cota-guillen', 'xv');

		expect(result!.source).toBe('static');
		expect(mockFindPublished).not.toHaveBeenCalled();
	});
});

describe('resolveInvitationContentBySource', () => {
	it('prefers published when preferSource is set', async () => {
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia-cota-guillen', data: {} } as any);
		mockFindPublished.mockResolvedValue({
			slug: 'my-invitation',
			eventType: 'xv',
			isDemo: false,
			content: {},
		} as any);

		const result = await resolveInvitationContentBySource(
			'my-invitation',
			undefined,
			'published',
		);

		expect(result).not.toBeNull();
		expect(result!.source).toBe('published');
	});

	it('falls back to static when published is preferred but missing', async () => {
		mockGetRoutable.mockResolvedValue({ id: 'events/ana-sofia-cota-guillen', data: {} } as any);
		mockFindPublished.mockResolvedValue(null);

		const result = await resolveInvitationContentBySource(
			'ana-sofia-cota-guillen',
			'xv',
			'published',
		);

		expect(result).not.toBeNull();
		expect(result!.source).toBe('static');
	});
});
