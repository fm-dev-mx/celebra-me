import { claimEventForUserByClaimCode } from '@/lib/rsvp-v2/service';
import {
	createEventMembershipService,
	findClaimCodeRecordByKeyService,
	incrementClaimCodeUsageService,
} from '@/lib/rsvp-v2/repository';

jest.mock('@/lib/rsvp-v2/repository', () => ({
	findClaimCodeRecordByKeyService: jest.fn(),
	createEventMembershipService: jest.fn(),
	incrementClaimCodeUsageService: jest.fn(),
}));

describe('rsvp-v2 claim code service', () => {
	const findClaimCodeRecordByKeyServiceMock =
		findClaimCodeRecordByKeyService as jest.MockedFunction<
			typeof findClaimCodeRecordByKeyService
		>;
	const createEventMembershipServiceMock = createEventMembershipService as jest.MockedFunction<
		typeof createEventMembershipService
	>;
	const incrementClaimCodeUsageServiceMock =
		incrementClaimCodeUsageService as jest.MockedFunction<
			typeof incrementClaimCodeUsageService
		>;

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('throws forbidden when claim code is invalid', async () => {
		findClaimCodeRecordByKeyServiceMock.mockResolvedValue(null);

		await expect(
			claimEventForUserByClaimCode({
				userId: 'u1',
				claimCode: 'MISSING',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
	});

	it('throws forbidden when claim code is expired', async () => {
		findClaimCodeRecordByKeyServiceMock.mockResolvedValue({
			id: 'claim-1',
			eventId: 'evt-1',
			active: true,
			expiresAt: '2000-01-01T00:00:00.000Z',
			maxUses: 1,
			usedCount: 0,
		});

		await expect(
			claimEventForUserByClaimCode({
				userId: 'u1',
				claimCode: 'EXPIRED',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
	});

	it('throws forbidden when claim code is exhausted', async () => {
		findClaimCodeRecordByKeyServiceMock.mockResolvedValue({
			id: 'claim-1',
			eventId: 'evt-1',
			active: true,
			expiresAt: null,
			maxUses: 1,
			usedCount: 1,
		});

		await expect(
			claimEventForUserByClaimCode({
				userId: 'u1',
				claimCode: 'USED',
			}),
		).rejects.toMatchObject({
			status: 403,
			code: 'forbidden',
		});
	});

	it('creates membership and increments usage when claim is valid', async () => {
		findClaimCodeRecordByKeyServiceMock.mockResolvedValue({
			id: 'claim-1',
			eventId: 'evt-1',
			active: true,
			expiresAt: null,
			maxUses: 2,
			usedCount: 1,
		});

		const result = await claimEventForUserByClaimCode({
			userId: 'u1',
			claimCode: 'VALID',
		});

		expect(createEventMembershipServiceMock).toHaveBeenCalledWith({
			eventId: 'evt-1',
			userId: 'u1',
			membershipRole: 'owner',
		});
		expect(incrementClaimCodeUsageServiceMock).toHaveBeenCalledWith('claim-1', 2);
		expect(result).toEqual({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
	});
});
