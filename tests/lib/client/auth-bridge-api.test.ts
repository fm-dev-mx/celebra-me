import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';

describe('authBridgeApi.logout', () => {
	it('uses same-origin credentials for logout requests', async () => {
		const fetchMock = global.fetch as jest.Mock;
		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		} as Response);

		await authBridgeApi.logout();

		expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
		});
	});

	it('throws the API error message when logout fails', async () => {
		const fetchMock = global.fetch as jest.Mock;
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 403,
			json: async () => ({
				success: false,
				error: {
					code: 'forbidden',
					message: 'El origen es inválido.',
				},
			}),
		} as Response);

		await expect(authBridgeApi.logout()).rejects.toThrow('El origen es inválido.');
	});
});
