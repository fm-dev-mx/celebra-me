import { resolveNextPath } from '@/lib/rsvp/auth/login';

describe('rsvp login helpers', () => {
	it('resolves safe next path and falls back for unsafe values', () => {
		expect(resolveNextPath('/dashboard/invitados', '/fallback')).toBe('/dashboard/invitados');
		expect(resolveNextPath('/dashboard/mfa-setup', '/fallback')).toBe('/dashboard/mfa-setup');
		expect(resolveNextPath('/admin', '/fallback')).toBe('/fallback');
		expect(resolveNextPath('/%2F%2Fevil.com', '/fallback')).toBe('/fallback');
		expect(resolveNextPath('/dashboard\\evil', '/fallback')).toBe('/fallback');
		expect(resolveNextPath('https://evil.com', '/fallback')).toBe('/fallback');
		expect(resolveNextPath('//evil.com', '/fallback')).toBe('/fallback');
		expect(resolveNextPath(null, '/fallback')).toBe('/fallback');
	});
});
