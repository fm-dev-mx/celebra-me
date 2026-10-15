import {
	STATIC_SECURITY_HEADERS_MARKER,
	appendStaticSecurityHeaders,
} from '../../scripts/shared/cloudflare-static-headers.ts';
import { SECURITY_HEADERS } from '@/lib/server/security-headers';

describe('Cloudflare static asset security headers', () => {
	it('appends one rule with every middleware security header after existing rules', () => {
		const existing = '/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n';
		const content = appendStaticSecurityHeaders(existing, SECURITY_HEADERS);
		expect(content.startsWith(existing.trimEnd())).toBe(true);
		const rule = content.slice(content.indexOf(STATIC_SECURITY_HEADERS_MARKER)).split('\n');
		expect(rule[1]).toBe('/*');
		for (const [name, value] of SECURITY_HEADERS) {
			expect(rule).toContain(`  ${name}: ${value}`);
		}
		expect(content.endsWith('\n')).toBe(true);
	});

	it('is idempotent and works without an existing file', () => {
		const once = appendStaticSecurityHeaders('', SECURITY_HEADERS);
		expect(once.startsWith(STATIC_SECURITY_HEADERS_MARKER)).toBe(true);
		expect(appendStaticSecurityHeaders(once, SECURITY_HEADERS)).toBe(once);
	});
});
