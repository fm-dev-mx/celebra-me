import { assertSameOrigin, resolveExpectedOrigin } from '@/lib/rsvp/security/auth-security';
import { createMockRequest } from '../helpers/api-mocks';

describe('auth origin resolution', () => {
	it('uses the request URL origin when only the Host header is present', () => {
		const request = createMockRequest(
			undefined,
			{
				Origin: 'http://localhost:4321',
				Host: 'localhost:4321',
			},
			'http://localhost:4321/api/auth/logout',
		) as unknown as Request;

		expect(resolveExpectedOrigin(request, 'http://localhost:4321')).toBe(
			'http://localhost:4321',
		);
		expect(() => assertSameOrigin(request, 'http://localhost:4321')).not.toThrow();
	});

	it('prefers forwarded proxy headers when they are available', () => {
		const request = createMockRequest(
			undefined,
			{
				Origin: 'https://preview.celebra.test',
				Host: 'internal.service.local',
				'X-Forwarded-Host': 'preview.celebra.test',
				'X-Forwarded-Proto': 'https',
			},
			'http://internal.service.local/api/auth/logout',
		) as unknown as Request;

		expect(resolveExpectedOrigin(request, 'http://internal.service.local')).toBe(
			'https://preview.celebra.test',
		);
		expect(() => assertSameOrigin(request, 'http://internal.service.local')).not.toThrow();
	});

	it('rejects mismatched origins', () => {
		const request = createMockRequest(
			undefined,
			{
				Origin: 'https://attacker.example',
				Host: 'localhost:4321',
			},
			'http://localhost:4321/api/auth/logout',
		) as unknown as Request;

		expect(() => assertSameOrigin(request, 'http://localhost:4321')).toThrow(
			'El origen es inválido.',
		);
	});
});
