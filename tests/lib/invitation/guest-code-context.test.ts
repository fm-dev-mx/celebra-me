jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventByInvitationPublic: jest.fn(),
	findEventBySlugService: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/guest.repository', () => ({
	findGuestByEventAndCodePublic: jest.fn(),
	findGuestByInviteIdPublic: jest.fn(),
	findGuestByShortIdPublic: jest.fn(),
}));

import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { findGuestByEventAndCodePublic } from '@/lib/rsvp/repositories/guest.repository';
import {
	getInvitationContextBySlugAndCode,
	isGuestCodeFormat,
} from '@/lib/rsvp/services/invitation-context.service';

const mockedEventBySlug = findEventBySlugService as jest.Mock;
const mockedGuestByCode = findGuestByEventAndCodePublic as jest.Mock;

const oliviaEvent = {
	id: 'event-olivia',
	slug: 'olivia-y-antonio',
	eventType: 'boda',
	title: 'Boda de Olivia y Antonio',
	brandingRemovalGuestLimit: 0,
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('getInvitationContextBySlugAndCode', () => {
	it('looks the code up inside the invitation of the slug only', async () => {
		mockedEventBySlug.mockResolvedValue(oliviaEvent);
		mockedGuestByCode.mockResolvedValue(null);

		await expect(
			getInvitationContextBySlugAndCode('olivia-y-antonio', 'k7q2'),
		).rejects.toMatchObject({ status: 404 });
		expect(mockedGuestByCode).toHaveBeenCalledWith('event-olivia', 'k7q2');
	});

	it('returns the guest context when the code belongs to the invitation', async () => {
		mockedEventBySlug.mockResolvedValue(oliviaEvent);
		mockedGuestByCode.mockResolvedValue({
			inviteId: 'invite-olivia-1',
			fullName: 'Francisco Prueba',
			maxAllowedAttendees: 2,
			attendanceStatus: 'pending',
			attendeeCount: 0,
			guestComment: '',
			hideCelebraMeBranding: false,
		});

		const context = await getInvitationContextBySlugAndCode('olivia-y-antonio', 'k7q2');

		expect(context.inviteId).toBe('invite-olivia-1');
		expect(context.eventSlug).toBe('olivia-y-antonio');
		expect(context.guest.fullName).toBe('Francisco Prueba');
	});

	it('answers 404 for an unknown slug', async () => {
		mockedEventBySlug.mockResolvedValue(null);

		await expect(getInvitationContextBySlugAndCode('nadie', 'k7q2')).rejects.toMatchObject({
			status: 404,
		});
		expect(mockedGuestByCode).not.toHaveBeenCalled();
	});

	it.each(['K7Q2', 'k7q', 'k7q2x', 'o7q2', 'l7q2', 'i7q2', '07q2', '17q2', 'wp-a'])(
		'rejects %s without querying the database',
		async (code) => {
			await expect(getInvitationContextBySlugAndCode('america', code)).rejects.toMatchObject({
				status: 404,
			});
			expect(mockedEventBySlug).not.toHaveBeenCalled();
		},
	);
});

describe('isGuestCodeFormat', () => {
	it('accepts 4 lowercase characters without look-alikes', () => {
		expect(isGuestCodeFormat('k7q2')).toBe(true);
		expect(isGuestCodeFormat('aph3')).toBe(true);
	});
});
