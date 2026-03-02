import type { APIContext } from 'astro';
import { POST as registerHost } from '@/pages/api/auth/register-host';
import * as authApi from '@/lib/rsvp/authApi';
import * as service from '@/lib/rsvp/service';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp/authApi', () => ({
	signUpWithPassword: jest.fn(),
	findAuthUserByEmail: jest.fn(),
	sendMagicLink: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	claimEventForUserByClaimCode: jest.fn(),
	ensureUserRole: jest.fn(),
	generateTemporaryPassword: jest.fn(() => 'TempPass!123'),
	isSuperAdminEmail: jest.fn(),
}));

describe('API: /api/auth/register-host', () => {
	const signUpMock = authApi.signUpWithPassword as jest.Mock;
	const findUserMock = authApi.findAuthUserByEmail as jest.Mock;
	const isSuperAdminMock = service.isSuperAdminEmail as jest.Mock;
	const claimEventMock = service.claimEventForUserByClaimCode as jest.Mock;
	const ensureRoleMock = service.ensureUserRole as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('Scenario: Standard Host Registration with Claim Code', async () => {
		isSuperAdminMock.mockReturnValue(false);
		signUpMock.mockResolvedValue({
			access_token: 'valid-token',
			user: { id: 'user-001', email: 'client@test.com' },
		});
		ensureRoleMock.mockResolvedValue('host_client');

		const response = await registerHost({
			request: createMockRequest({
				email: 'client@test.com',
				password: 'password123',
				claimCode: 'CLAIM-OK',
				method: 'password',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
		expect(claimEventMock).toHaveBeenCalledWith({
			userId: 'user-001',
			claimCode: 'CLAIM-OK',
		});
		expect(ensureRoleMock).toHaveBeenCalled();
	});

	it('Scenario: Superadmin Registration without Claim Code', async () => {
		isSuperAdminMock.mockReturnValue(true); // Whitelisted email
		signUpMock.mockResolvedValue({
			access_token: 'admin-token',
			user: { id: 'admin-001', email: 'admin@celebra.me' },
		});
		ensureRoleMock.mockResolvedValue('super_admin');

		const response = await registerHost({
			request: createMockRequest({
				email: 'admin@celebra.me',
				password: 'adminPassword123',
				method: 'password',
				// No claimCode provided
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
		expect(claimEventMock).not.toHaveBeenCalled();
		expect(ensureRoleMock).toHaveBeenCalled();
	});

	it('Scenario: Forbidden Registration (No Claim Code, Not Admin)', async () => {
		isSuperAdminMock.mockReturnValue(false);

		const response = await registerHost({
			request: createMockRequest({
				email: 'stranger@test.com',
				password: 'password123',
				// No claimCode
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.message).toContain('claimCode');
	});

	it('Scenario: User Already Exists (Login Fallback)', async () => {
		isSuperAdminMock.mockReturnValue(false);
		signUpMock.mockRejectedValue(new Error('User already registered'));
		findUserMock.mockResolvedValue({ id: 'existing-001', email: 'old@test.com' });

		const response = await registerHost({
			request: createMockRequest({
				email: 'old@test.com',
				password: 'password123',
				claimCode: 'CLAIM-123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		expect(findUserMock).toHaveBeenCalled();
		expect(claimEventMock).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'existing-001' }),
		);
	});

	it('Scenario: Reject Cross-Origin Registration Request', async () => {
		const response = await registerHost({
			request: createMockRequest(
				{
					email: 'client@test.com',
					password: 'password123',
					claimCode: 'CLAIM-OK',
					method: 'password',
				},
				{ Origin: 'https://attacker.example' },
			),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error.code).toBe('forbidden');
	});
});
