import { updateUserEventMembershipAdmin } from '@/lib/rsvp/services/user-admin.service';
import {
	createEventMembershipService,
	findActiveEventMembershipService,
	softDeleteEventMembershipService,
} from '@/lib/rsvp/repositories/role-membership.repository';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import type { EventMembershipRecord } from '@/interfaces/auth/session.interface';

jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	createEventMembershipService: jest.fn(),
	findActiveEventMembershipService: jest.fn(),
	softDeleteEventMembershipService: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn(),
	logAdminActionStrict: jest.fn(),
}));

const createMock = createEventMembershipService as jest.MockedFunction<
	typeof createEventMembershipService
>;
const findMock = findActiveEventMembershipService as jest.MockedFunction<
	typeof findActiveEventMembershipService
>;
const softDeleteMock = softDeleteEventMembershipService as jest.MockedFunction<
	typeof softDeleteEventMembershipService
>;
const logMock = logAdminAction as jest.MockedFunction<typeof logAdminAction>;

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440099';
const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440000';

function membership(role: 'owner' | 'manager'): EventMembershipRecord {
	return {
		id: 'membership-1',
		eventId: EVENT_ID,
		userId: USER_ID,
		membershipRole: role,
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-09T00:00:00.000Z',
	};
}

describe('updateUserEventMembershipAdmin', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('assigns a new event as main host and audits it as an assignment', async () => {
		findMock.mockResolvedValue(null);
		createMock.mockResolvedValue(membership('owner'));

		const result = await updateUserEventMembershipAdmin({
			userId: USER_ID,
			eventId: EVENT_ID,
			action: 'assign',
			membershipRole: 'owner',
			actorUserId: ACTOR_ID,
		});

		expect(createMock).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			userId: USER_ID,
			membershipRole: 'owner',
		});
		expect(result).toMatchObject({ membershipRole: 'owner', previousMembershipRole: null });
		expect(logMock).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'assign_event_membership', oldData: null }),
		);
	});

	it('keeps manager as the role when none is sent', async () => {
		findMock.mockResolvedValue(null);
		createMock.mockResolvedValue(membership('manager'));

		await updateUserEventMembershipAdmin({
			userId: USER_ID,
			eventId: EVENT_ID,
			action: 'assign',
			actorUserId: ACTOR_ID,
		});

		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining({ membershipRole: 'manager' }),
		);
	});

	it('promotes an existing manager to owner and audits the previous role', async () => {
		const previous = membership('manager');
		findMock.mockResolvedValue(previous);
		createMock.mockResolvedValue(membership('owner'));

		const result = await updateUserEventMembershipAdmin({
			userId: USER_ID,
			eventId: EVENT_ID,
			action: 'assign',
			membershipRole: 'owner',
			actorUserId: ACTOR_ID,
		});

		expect(result).toMatchObject({
			membershipRole: 'owner',
			previousMembershipRole: 'manager',
		});
		expect(logMock).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'change_event_membership_role',
				oldData: previous,
				newData: expect.objectContaining({ membershipRole: 'owner' }),
			}),
		);
	});

	it('reports the removed role when an event is unassigned', async () => {
		softDeleteMock.mockResolvedValue(membership('owner'));

		const result = await updateUserEventMembershipAdmin({
			userId: USER_ID,
			eventId: EVENT_ID,
			action: 'remove',
			actorUserId: ACTOR_ID,
		});

		expect(result).toMatchObject({
			action: 'remove',
			membershipRole: null,
			previousMembershipRole: 'owner',
		});
		expect(findMock).not.toHaveBeenCalled();
	});
});
