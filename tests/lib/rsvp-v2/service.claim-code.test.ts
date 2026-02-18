import { claimEventForUserByClaimCode } from '@/lib/rsvp/service';
import { redeemClaimCodeRpc } from '@/lib/rsvp/repository';

jest.mock('@/lib/rsvp/repository');

const redeemClaimCodeRpcMock = redeemClaimCodeRpc as jest.MockedFunction<typeof redeemClaimCodeRpc>;

describe('rsvp claim code service (atomic RPC)', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('throws forbidden when claim code is invalid', async () => {
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: false,
			eventId: null,
			membershipRole: null,
			errorCode: 'invalid_code',
		});

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
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: false,
			eventId: null,
			membershipRole: null,
			errorCode: 'expired',
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
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: false,
			eventId: null,
			membershipRole: null,
			errorCode: 'exhausted',
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

	it('returns event details when claim is successful', async () => {
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: true,
			eventId: 'evt-1',
			membershipRole: 'owner',
			errorCode: null,
		});

		const result = await claimEventForUserByClaimCode({
			userId: 'u1',
			claimCode: 'VALID',
		});

		expect(redeemClaimCodeRpcMock).toHaveBeenCalledWith({
			userId: 'u1',
			codeKey: expect.any(String),
		});
		expect(result).toEqual({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
	});

	it('is idempotent - retry returns same result without error', async () => {
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: true,
			eventId: 'evt-1',
			membershipRole: 'owner',
			errorCode: null,
		});

		// First attempt
		await claimEventForUserByClaimCode({
			userId: 'u1',
			claimCode: 'VALID',
		});

		// Retry (simulating user clicking twice)
		const retry = await claimEventForUserByClaimCode({
			userId: 'u1',
			claimCode: 'VALID',
		});

		expect(retry).toEqual({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
	});
});
