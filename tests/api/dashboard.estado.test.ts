jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(async () => true),
	hashIp: jest.fn(() => 'hashed-ip'),
}));

jest.mock('@/lib/observability/access', () => ({
	requireLocalObservabilityAccess: jest.fn(),
}));

jest.mock('@/lib/status/server/canonical-status', () => ({
	getCanonicalStatusView: jest.fn(),
	refreshCanonicalStatusView: jest.fn(),
}));

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import {
	getCanonicalStatusView,
	refreshCanonicalStatusView,
} from '@/lib/status/server/canonical-status';
import { ApiError } from '@/lib/rsvp/core/errors';
import { ADMIN_RATE_LIMIT_OPERATIONS } from '@/lib/rsvp/security/admin-rate-limit';
import {
	GET,
	CANONICAL_STATUS_RATE_LIMIT_OPERATION,
} from '@/pages/api/dashboard/estado/index';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture';

const mockAccess = requireLocalObservabilityAccess as jest.MockedFunction<
	typeof requireLocalObservabilityAccess
>;
const mockGet = getCanonicalStatusView as jest.MockedFunction<typeof getCanonicalStatusView>;
const mockRefresh = refreshCanonicalStatusView as jest.MockedFunction<
	typeof refreshCanonicalStatusView
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('GET /api/dashboard/estado', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue(true);
	});

	it('registers its rate-limit operation', () => {
		expect(ADMIN_RATE_LIMIT_OPERATIONS).toContain(CANONICAL_STATUS_RATE_LIMIT_OPERATION);
	});

	it('returns cached or local view without probing when refresh is absent', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			isSuperAdmin: true,
		} as never);
		mockGet.mockResolvedValue(buildCanonicalStatusViewFixture({ evidence: 'CACHED' }));

		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/estado'),
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		const body = await response.json();
		expect(body.schemaVersion).toBe(1);
		expect(body.evidence).toBe('CACHED');
		expect(mockRefresh).not.toHaveBeenCalled();
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
	});

	it('refreshes live evidence only when refresh=1', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			isSuperAdmin: true,
		} as never);
		mockRefresh.mockResolvedValue(buildCanonicalStatusViewFixture());

		const response = await GET({
			request: new Request(
				'http://127.0.0.1:4321/api/dashboard/estado?refresh=1&env=preview&domain=content',
			),
		} as never);
		expect(response.status).toBe(200);
		expect(mockRefresh).toHaveBeenCalledWith({ env: 'preview', domain: 'content' });
		expect(mockGet).not.toHaveBeenCalled();
	});

	it('rejects invalid env before probing', async () => {
		mockAccess.mockResolvedValue({ userId: 'admin-1', isSuperAdmin: true } as never);
		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/estado?refresh=1&env=stage'),
		} as never);
		expect(response.status).toBe(400);
		expect(mockRefresh).not.toHaveBeenCalled();
	});

	it('does not import mutation CLIs', () => {
		const fs = jest.requireActual('fs') as typeof import('node:fs');
		const text = fs.readFileSync('src/pages/api/dashboard/estado/index.ts', 'utf8');
		expect(text).toContain('refreshCanonicalStatusView');
		expect(text).not.toContain('invitation:update');
		expect(text).not.toContain('invitation:promote');
		expect(text).not.toContain('invitation:release');
		expect(text).not.toContain('apply-migrations');
		expect(text).not.toContain('child_process');
	});

	it('rejects unauthorized before probing', async () => {
		mockAccess.mockRejectedValue(new ApiError(401, 'unauthorized', 'Unauthorized.'));
		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/estado?refresh=1'),
		} as never);
		expect(response.status).toBe(401);
		expect(mockRefresh).not.toHaveBeenCalled();
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
	});
});
