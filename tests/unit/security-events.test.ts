import { SECURITY_EVENT, logSecurityEvent } from '@/lib/server/security-events';

describe('security events', () => {
	it('logs one JSON line Workers Logs can filter by event and kind', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			logSecurityEvent('login_failed', { route: 'change-password' });
			expect(warn).toHaveBeenCalledTimes(1);
			expect(JSON.parse(String(warn.mock.calls[0][0]))).toEqual({
				event: SECURITY_EVENT,
				kind: 'login_failed',
				route: 'change-password',
			});
		} finally {
			warn.mockRestore();
		}
	});
});
