import { buildHostLoginRedirect, resolveNextPath } from '@/lib/rsvp-v2/login';

describe('rsvp-v2 login helpers', () => {
	it('builds login redirect with encoded next', () => {
		expect(buildHostLoginRedirect('/dashboard/invitados')).toBe(
			'/login?next=%2Fdashboard%2Finvitados',
		);
	});

	it('resolves safe next path and falls back for unsafe values', () => {
		expect(resolveNextPath('/dashboard/invitados', '/fallback')).toBe('/dashboard/invitados');
		expect(resolveNextPath('https://evil.com', '/fallback')).toBe('/fallback');
		expect(resolveNextPath('//evil.com', '/fallback')).toBe('/fallback');
		expect(resolveNextPath(null, '/fallback')).toBe('/fallback');
	});
});
