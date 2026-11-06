/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/server/security-events', () => ({
	logSecurityEvent: jest.fn(),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { logSecurityEvent } from '@/lib/server/security-events';
import { POST } from '@/pages/api/security/csp-report';
import { createApiContext, createMockRequest } from '../helpers/api-mocks';

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockLogSecurityEvent = logSecurityEvent as jest.MockedFunction<typeof logSecurityEvent>;

const VALID_CSP_REPORT = {
	'csp-report': {
		'document-uri': 'https://www.celebra-me.com/boda/demo',
		'violated-directive': 'script-src',
		'effective-directive': 'script-src',
		'blocked-uri': 'https://evil.example.com/inject.js',
		'original-policy': "default-src 'self'",
		disposition: 'report',
		'status-code': 200,
	},
};

const ENDPOINT_URL = 'https://www.celebra-me.com/api/security/csp-report';

beforeEach(() => {
	jest.clearAllMocks();
	mockCheckRateLimit.mockResolvedValue(true);
});

describe('/api/security/csp-report', () => {
	it('accepts a valid CSP report and responds 204', async () => {
		const request = createMockRequest(VALID_CSP_REPORT, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(204);
		expect(mockLogSecurityEvent).toHaveBeenCalledWith('csp_violation', {
			directive: 'script-src',
			blocked: 'https://evil.example.com/inject.js',
		});
	});

	it('strips query strings from blocked-uri for privacy', async () => {
		const report = {
			'csp-report': {
				'effective-directive': 'img-src',
				'blocked-uri':
					'https://tracker.example.com/pixel?user=john@example.com&session=abc',
			},
		};
		const request = createMockRequest(report, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(204);
		expect(mockLogSecurityEvent).toHaveBeenCalledWith('csp_violation', {
			directive: 'img-src',
			blocked: 'https://tracker.example.com/pixel',
		});
	});

	it('returns 429 when rate limited', async () => {
		mockCheckRateLimit.mockResolvedValue(false);
		const request = createMockRequest(VALID_CSP_REPORT, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(429);
		expect(mockLogSecurityEvent).not.toHaveBeenCalled();
	});

	it('returns 400 for non-JSON body', async () => {
		const request = createMockRequest(
			'not json {{{',
			{ 'Content-Type': 'text/plain' },
			ENDPOINT_URL,
		);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(400);
		expect(mockLogSecurityEvent).not.toHaveBeenCalled();
	});

	it('returns 400 for invalid report shape', async () => {
		const request = createMockRequest(
			{ unexpected: 'shape', 'csp-report': [1, 2] },
			{},
			ENDPOINT_URL,
		);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(400);
		expect(mockLogSecurityEvent).not.toHaveBeenCalled();
	});

	it('returns 413 for oversized body', async () => {
		const oversized = { 'csp-report': { 'blocked-uri': 'x'.repeat(9000) } };
		const request = createMockRequest(oversized, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(413);
		expect(mockLogSecurityEvent).not.toHaveBeenCalled();
	});

	it('accepts a report with an empty csp-report object', async () => {
		const request = createMockRequest({ 'csp-report': {} }, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(204);
	});

	it('falls back to violated-directive when effective-directive is absent', async () => {
		const report = {
			'csp-report': {
				'violated-directive': 'style-src',
				'blocked-uri': 'inline',
			},
		};
		const request = createMockRequest(report, {}, ENDPOINT_URL);
		const response = await POST(createApiContext(request) as never);

		expect(response.status).toBe(204);
		expect(mockLogSecurityEvent).toHaveBeenCalledWith('csp_violation', {
			directive: 'style-src',
			blocked: '(invalid)',
		});
	});
});
