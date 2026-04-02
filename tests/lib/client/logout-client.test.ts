import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

jest.mock('@/lib/client/auth/auth-bridge-api', () => ({
	authBridgeApi: {
		logout: jest.fn(),
	},
}));

describe('logoutAndRedirect', () => {
	const logoutMock = authBridgeApi.logout as jest.MockedFunction<typeof authBridgeApi.logout>;
	const originalLocation = window.location;
	const assignMock = jest.fn();
	const removeItemMock = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: {
				assign: assignMock,
			},
		});
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				removeItem: removeItemMock,
			},
		});
	});

	afterAll(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: originalLocation,
		});
	});

	it('clears local storage and redirects to /login after a successful logout', async () => {
		logoutMock.mockResolvedValueOnce();

		await logoutAndRedirect();

		expect(removeItemMock).toHaveBeenCalledWith('rsvp-dashboard-event-id');
		expect(assignMock).toHaveBeenCalledWith('/login');
	});

	it('does not redirect when logout fails', async () => {
		logoutMock.mockRejectedValueOnce(new Error('Unable to sign out.'));

		await expect(logoutAndRedirect()).rejects.toThrow('Unable to sign out.');
		expect(removeItemMock).not.toHaveBeenCalled();
		expect(assignMock).not.toHaveBeenCalled();
	});
});
