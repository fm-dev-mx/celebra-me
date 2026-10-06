jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventByIdService: jest.fn(),
}));

jest.mock('@/lib/invitation/content-resolver', () => ({
	resolveInvitationContent: jest.fn(),
}));

jest.mock('@/lib/intake/invitation-validity', () => ({
	resolveInvitationSchedule: jest.fn(() => ({ eventDate: '2026-11-28' })),
}));

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { resolveMemoriesEventIdentity } from '@/lib/memories/server/event-identity.service';

const mockEvent = findEventByIdService as jest.MockedFunction<typeof findEventByIdService>;
const mockContent = resolveInvitationContent as jest.MockedFunction<
	typeof resolveInvitationContent
>;

const space = { eventId: 'e1', eventTitle: 'Boda de Daniela y Martín' };

function published(hero: Record<string, unknown>, preset = 'jewelry-box-wedding') {
	return {
		source: 'published',
		rawContent: {},
		version: 1,
		viewModel: { hero, theme: { preset } },
	} as unknown as Awaited<ReturnType<typeof resolveInvitationContent>>;
}

describe('resolveMemoriesEventIdentity', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEvent.mockResolvedValue({ slug: 'daniela-y-martin', eventType: 'boda' } as never);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('reads names, date, preset and cover from the published invitation', async () => {
		mockContent.mockResolvedValue(
			published({
				name: 'Daniela',
				secondaryName: 'Martín',
				backgroundImage: { src: '/cover.jpg' },
			}),
		);

		await expect(resolveMemoriesEventIdentity(space)).resolves.toEqual({
			names: 'Daniela & Martín',
			eventDate: '2026-11-28',
			preset: 'jewelry-box-wedding',
			coverImage: '/cover.jpg',
		});
		expect(mockContent).toHaveBeenCalledWith('daniela-y-martin', 'boda');
	});

	it('falls back to the space title and default preset without a published invitation', async () => {
		mockContent.mockResolvedValue(null);

		await expect(resolveMemoriesEventIdentity(space)).resolves.toMatchObject({
			names: 'Boda de Daniela y Martín',
			preset: 'jewelry-box',
			coverImage: null,
		});
	});

	it('never fails the page when the invitation cannot be read', async () => {
		mockContent.mockRejectedValue(new Error('database down'));

		await expect(resolveMemoriesEventIdentity(space)).resolves.toMatchObject({
			names: 'Boda de Daniela y Martín',
		});
	});

	it('ignores a preset the theme contract does not know', async () => {
		mockContent.mockResolvedValue(
			published({ name: 'Sofía', backgroundImage: { src: { src: '/xv.jpg' } } }, 'retired'),
		);

		await expect(resolveMemoriesEventIdentity(space)).resolves.toMatchObject({
			names: 'Sofía',
			preset: 'jewelry-box',
			coverImage: '/xv.jpg',
		});
	});
});
