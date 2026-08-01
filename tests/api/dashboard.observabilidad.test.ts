/**
 * API contract tests for Local observability endpoint wiring.
 */

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(async () => true),
	hashIp: jest.fn(() => 'hashed-ip'),
}));

jest.mock('@/lib/observability/access', () => ({
	requireLocalObservabilityAccess: jest.fn(),
}));

jest.mock('@/lib/observability/server/snapshot', () => ({
	buildObservabilitySnapshot: jest.fn(),
}));

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import { buildObservabilitySnapshot } from '@/lib/observability/server/snapshot';
import { ApiError } from '@/lib/rsvp/core/errors';
import { ADMIN_RATE_LIMIT_OPERATIONS } from '@/lib/rsvp/security/admin-rate-limit';
import {
	GET,
	OBSERVABILITY_RATE_LIMIT_OPERATION,
} from '@/pages/api/dashboard/observabilidad/index';
import type { ObservabilitySnapshot } from '@/lib/observability/types';

const mockAccess = requireLocalObservabilityAccess as jest.MockedFunction<
	typeof requireLocalObservabilityAccess
>;
const mockSnapshot = buildObservabilitySnapshot as jest.MockedFunction<
	typeof buildObservabilitySnapshot
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function minimalSnapshot(): ObservabilitySnapshot {
	return {
		schemaVersion: 2,
		generatedAt: '2026-07-31T12:00:00.000Z',
		overallStatus: 'UNVERIFIED',
		cache: { state: 'fresh', refreshAfter: '2026-07-31T12:01:00.000Z' },
		source: {
			branch: 'dev-local',
			commitShaShort: 'abcdef1',
			workingTreeDirty: false,
		},
		health: {
			environments: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
			invitations: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
			migrations: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
			assets: { total: 0, ok: 0, warning: 0, blocking: 0, unverified: 0 },
			validations: { total: 2, ok: 0, warning: 0, blocking: 0, unverified: 2 },
		},
		issues: [
			{
				id: 'probe_degraded:aggregation',
				code: 'PROBE_DEGRADED',
				severity: 'unverified',
				domain: 'data_quality',
				scope: 'Agregación',
				title: 'Señal degradada',
				description: 'La cobertura es incompleta.',
				actionIds: [],
			},
		],
		validationEvidence: [
			{
				type: 'regression',
				freshness: 'NOT_RUN',
				completedAt: null,
				passed: null,
				total: null,
			},
			{
				type: 'screenshots',
				freshness: 'NOT_RUN',
				completedAt: null,
				passed: null,
				total: null,
			},
		],
		recommendedActions: [],
	};
}

describe('GET /api/dashboard/observabilidad', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue(true);
	});

	it('registers its rate-limit operation in the canonical config', () => {
		expect(ADMIN_RATE_LIMIT_OPERATIONS).toContain(OBSERVABILITY_RATE_LIMIT_OPERATION);
	});

	it('returns 200 sanitized snapshot for authorized Local super_admin', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			role: 'super_admin',
			isSuperAdmin: true,
			amr: [],
		} as never);
		mockSnapshot.mockResolvedValue(minimalSnapshot());

		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad'),
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		const body = (await response.json()) as ObservabilitySnapshot;
		expect(body.schemaVersion).toBe(2);
		expect(body.issues.length).toBeGreaterThan(0);
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
		expect(serialized).not.toMatch(/password=/i);
		expect(mockAccess).toHaveBeenCalled();
		expect(mockCheckRateLimit).toHaveBeenCalled();
		expect(mockSnapshot).toHaveBeenCalled();
	});

	it('rejects unauthorized before probing', async () => {
		mockAccess.mockRejectedValue(new ApiError(401, 'unauthorized', 'Unauthorized.'));
		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad'),
		} as never);
		expect(response.status).toBe(401);
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
	});

	it('returns not_found for non-Local runtime after auth', async () => {
		mockAccess.mockRejectedValue(new ApiError(404, 'not_found', 'Not found.'));
		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad'),
		} as never);
		expect(response.status).toBe(404);
		expect(mockSnapshot).not.toHaveBeenCalled();
	});

	it('returns 429 when rate limited after authorization', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			isSuperAdmin: true,
		} as never);
		mockCheckRateLimit.mockResolvedValue(false);

		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad'),
		} as never);
		expect(response.status).toBe(429);
		expect(mockSnapshot).not.toHaveBeenCalled();
	});
});
