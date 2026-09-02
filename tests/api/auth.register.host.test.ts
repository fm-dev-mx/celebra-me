import type { APIContext } from 'astro';
import { POST as registerHost } from '@/pages/api/auth/register-host';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as authAccessService from '@/lib/rsvp/services/auth-access.service';
import * as authIdentifierService from '@/lib/rsvp/services/auth-identifier.service';
import { createMockRequest } from '../helpers/api-mocks';
import { AuthRequestError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	signUpWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/auth-access.service', () => ({
	claimEventForUserByClaimCode: jest.fn(),
	ensureUserRole: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	generateTemporaryPassword: jest.fn(() => 'TempPass!123'),
}));

jest.mock('@/lib/rsvp/services/auth-identifier.service', () => ({
	findExistingAuthUserByEmail: jest.fn(),
}));

describe('API: /api/auth/register-host', () => {
	const signUpMock = authApi.signUpWithPassword as jest.Mock;
	const findUserMock = authIdentifierService.findExistingAuthUserByEmail as jest.Mock;
	const claimEventMock = authAccessService.claimEventForUserByClaimCode as jest.Mock;
	const ensureRoleMock = authAccessService.ensureUserRole as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('Scenario: Standard Host Registration with Claim Code', async () => {
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

	it('Scenario: Superadmin Registration without Claim Code is rejected', async () => {
		const response = await registerHost({
			request: createMockRequest({
				email: 'admin@celebra.me',
				password: 'adminPassword123',
				method: 'password',
				// No claimCode provided
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(400);
		expect(claimEventMock).not.toHaveBeenCalled();
		expect(signUpMock).not.toHaveBeenCalled();
	});

	it('Scenario: Forbidden Registration (No Claim Code, Not Admin)', async () => {
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

	it('Scenario: Legacy eventSlug no longer replaces claimCode', async () => {
		const response = await registerHost({
			request: createMockRequest({
				email: 'legacy@test.com',
				password: 'password123',
				eventSlug: 'demo-event',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.message).toContain('claimCode');
	});

	it('Scenario: User Already Exists does not claim an account without proof', async () => {
		signUpMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'sign_up', status: 422 }),
		);
		findUserMock.mockResolvedValue({ id: 'existing-001', email: 'old@test.com' });

		const response = await registerHost({
			request: createMockRequest({
				email: 'old@test.com',
				password: 'password123',
				claimCode: 'CLAIM-123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(409);
		expect(findUserMock).not.toHaveBeenCalled();
		expect(claimEventMock).not.toHaveBeenCalled();
	});

	it('returns 503 without an existing-user lookup when signup is transiently unavailable', async () => {
		signUpMock.mockRejectedValue(
			new AuthRequestError({ kind: 'timeout', operation: 'sign_up' }),
		);

		const response = await registerHost({
			request: createMockRequest({
				email: 'new@test.com',
				password: 'password123',
				claimCode: 'CLAIM-123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('5');
		expect(findUserMock).not.toHaveBeenCalled();
		expect(claimEventMock).not.toHaveBeenCalled();
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
