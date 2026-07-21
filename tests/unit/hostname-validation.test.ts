export function isHostOrSubdomain(hostname: string, domain: string): boolean {
	const normalizedHost = hostname.toLowerCase();
	const normalizedDomain = domain.toLowerCase();
	return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

describe('isHostOrSubdomain validation', () => {
	it('accepts exact host matches', () => {
		expect(isHostOrSubdomain('google.com', 'google.com')).toBe(true);
		expect(isHostOrSubdomain('apple.com', 'apple.com')).toBe(true);
		expect(isHostOrSubdomain('waze.com', 'waze.com')).toBe(true);
		expect(isHostOrSubdomain('vercel.app', 'vercel.app')).toBe(true);
	});

	it('accepts valid dot-delimited subdomains', () => {
		expect(isHostOrSubdomain('maps.google.com', 'google.com')).toBe(true);
		expect(isHostOrSubdomain('www.google.com', 'google.com')).toBe(true);
		expect(isHostOrSubdomain('maps.apple.com', 'apple.com')).toBe(true);
		expect(isHostOrSubdomain('my-preview.vercel.app', 'vercel.app')).toBe(true);
		expect(isHostOrSubdomain('maps.app.goo.gl', 'goo.gl')).toBe(true);
	});

	it('rejects malicious suffix matches and sibling domains', () => {
		expect(isHostOrSubdomain('evilapple.com', 'apple.com')).toBe(false);
		expect(isHostOrSubdomain('fakewaze.com', 'waze.com')).toBe(false);
		expect(isHostOrSubdomain('notgoogle.example', 'google.com')).toBe(false);
		expect(isHostOrSubdomain('vercel.attacker.example', 'vercel.app')).toBe(false);
		expect(isHostOrSubdomain('apple.com.attacker.com', 'apple.com')).toBe(false);
	});
});
