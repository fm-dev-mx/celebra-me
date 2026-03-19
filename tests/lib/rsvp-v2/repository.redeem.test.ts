import { redeemClaimCodeRpc } from '@/lib/rsvp/repositories/claim-code.repository';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

const supabaseRestRequestMock = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

describe('repository: redeemClaimCodeRpc', () => {
	it('correctly maps the new r_ prefixed response columns', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				r_success: true,
				r_event_id: 'evt-123',
				r_membership_role: 'owner',
				r_error_code: null,
			},
		] as never);

		const result = await redeemClaimCodeRpc({
			userId: 'user-1',
			codeKey: 'hashed-code',
		});

		expect(result).toEqual({
			success: true,
			eventId: 'evt-123',
			membershipRole: 'owner',
			errorCode: null,
		});

		expect(supabaseRestRequestMock).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: 'rpc/redeem_claim_code',
				body: {
					p_user_id: 'user-1',
					p_code_key: 'hashed-code',
				},
			}),
		);
	});

	it('returns success false and error code on failure', async () => {
		supabaseRestRequestMock.mockResolvedValueOnce([
			{
				r_success: false,
				r_event_id: null,
				r_membership_role: null,
				r_error_code: 'expired',
			},
		] as never);

		const result = await redeemClaimCodeRpc({
			userId: 'user-1',
			codeKey: 'hashed-code',
		});

		expect(result.success).toBe(false);
		expect(result.errorCode).toBe('expired');
	});
});
