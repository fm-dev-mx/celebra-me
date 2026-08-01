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
	buildObservabilitySummaryPayload: jest.fn(),
}));

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import {
	buildObservabilitySnapshot,
	buildObservabilitySummaryPayload,
} from '@/lib/observability/server/snapshot';
import { ApiError } from '@/lib/rsvp/core/errors';
import { ADMIN_RATE_LIMIT_OPERATIONS } from '@/lib/rsvp/security/admin-rate-limit';
import {
	GET,
	OBSERVABILITY_RATE_LIMIT_OPERATION,
} from '@/pages/api/dashboard/observabilidad/index';
import type { ObservabilitySnapshot, ObservabilitySummaryPayload } from '@/lib/observability/types';
import {
	buildObservabilitySnapshotFixture,
	buildObservabilitySummaryFixture,
} from '../helpers/observability-snapshot-fixture';

const mockAccess = requireLocalObservabilityAccess as jest.MockedFunction<
	typeof requireLocalObservabilityAccess
>;
const mockSnapshot = buildObservabilitySnapshot as jest.MockedFunction<
	typeof buildObservabilitySnapshot
>;
const mockSummary = buildObservabilitySummaryPayload as jest.MockedFunction<
	typeof buildObservabilitySummaryPayload
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function minimalSnapshot(): ObservabilitySnapshot {
	return buildObservabilitySnapshotFixture({
		generatedAt: '2026-07-31T12:00:00.000Z',
		freshness: 'PARTIAL',
		operationalStatus: 'UNVERIFIED',
		deliveryStatus: 'UNVERIFIED',
		coverage: [
			{ environment: 'local', status: 'AVAILABLE' },
			{
				environment: 'preview',
				status: 'UNAVAILABLE',
				reasonCode: 'ENVIRONMENT_UNAVAILABLE',
			},
			{
				environment: 'production',
				status: 'UNAVAILABLE',
				reasonCode: 'ENVIRONMENT_UNAVAILABLE',
			},
		],
		cache: { refreshAfter: '2026-07-31T12:01:00.000Z' },
		issues: [
			{
				impact: 'OPERATIONAL',
				reasonCode: 'ENVIRONMENT_UNAVAILABLE',
				nextStep: 'RETRY_PROBE',
				operationalStatus: 'UNVERIFIED',
				deliveryStatus: 'UNVERIFIED',
				detailStatus: 'DETAIL_UNAVAILABLE',
				affectedFieldCount: 0,
				affectedSectionCount: 0,
				semanticPaths: [],
				environment: 'preview',
			},
		],
		environmentSummaries: ['local', 'preview', 'production'].map((environment) => ({
			environment: environment as 'local' | 'preview' | 'production',
			operationalStatus: environment === 'local' ? 'HEALTHY' : 'UNVERIFIED',
			deliveryStatus: environment === 'local' ? 'ALIGNED' : 'UNVERIFIED',
			coverage: environment === 'local' ? 'AVAILABLE' : 'UNAVAILABLE',
			counts: { invitations: 0, issues: environment === 'preview' ? 1 : 0, workItems: 0 },
		})),
	});
}

function minimalSummary(): ObservabilitySummaryPayload {
	return buildObservabilitySummaryFixture({
		generatedAt: '2026-07-31T12:00:00.000Z',
		freshness: 'PARTIAL',
		operationalStatus: 'UNVERIFIED',
		deliveryStatus: 'UNVERIFIED',
		coverage: minimalSnapshot().coverage,
		counts: { invitations: 13, issues: 1, workItems: 0 },
	});
}

describe('GET /api/dashboard/observabilidad', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue(true);
	});

	it('registers its rate-limit operation in the canonical config', () => {
		expect(ADMIN_RATE_LIMIT_OPERATIONS).toContain(OBSERVABILITY_RATE_LIMIT_OPERATION);
	});

	it('returns 200 summary payload for authorized Local super_admin by default', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			role: 'super_admin',
			isSuperAdmin: true,
			amr: [],
		} as never);
		mockSummary.mockResolvedValue(minimalSummary());

		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad'),
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toContain('no-store');
		const body = (await response.json()) as ObservabilitySummaryPayload;
		expect(body.schemaVersion).toBe(3);
		expect(body.freshness).toBe('PARTIAL');
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
		expect(serialized).not.toMatch(/password=/i);
		expect(mockAccess).toHaveBeenCalled();
		expect(mockCheckRateLimit).toHaveBeenCalled();
		expect(mockSummary).toHaveBeenCalled();
	});

	it('returns 200 detail snapshot for mode=detail', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			role: 'super_admin',
			isSuperAdmin: true,
			amr: [],
		} as never);
		mockSnapshot.mockResolvedValue(minimalSnapshot());

		const response = await GET({
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad?mode=detail'),
		} as never);
		expect(response.status).toBe(200);
		const body = (await response.json()) as ObservabilitySnapshot;
		expect(body.schemaVersion).toBe(3);
		expect(body.issues.length).toBeGreaterThan(0);
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/postgres:\/\//i);
		expect(serialized).not.toMatch(/service_role/i);
		expect(serialized).not.toMatch(/password=/i);
		expect(mockSnapshot).toHaveBeenCalled();
	});

	it('returns 400 for invalid mode query parameter', async () => {
		mockAccess.mockResolvedValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			role: 'super_admin',
			isSuperAdmin: true,
			amr: [],
		} as never);

		const response = await GET({
			request: new Request(
				'http://127.0.0.1:4321/api/dashboard/observabilidad?mode=unsupported',
			),
		} as never);
		expect(response.status).toBe(400);
		expect(mockSnapshot).not.toHaveBeenCalled();
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
