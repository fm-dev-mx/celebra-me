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
	return {
		schemaVersion: 1,
		generatedAt: '2026-07-31T12:00:00.000Z',
		overallStatus: 'UNVERIFIED',
		source: {
			branch: 'dev-local',
			commitSha: 'abc',
			workingTreeDirty: false,
			degraded: false,
		},
		fingerprints: { corpusFingerprint: 'c', inputFingerprint: 'i' },
		validation: {
			regression: { validationType: 'regression', freshness: 'NOT_RUN', snapshot: null },
			screenshots: { validationType: 'screenshots', freshness: 'NOT_RUN', snapshot: null },
		},
		migrations: [],
		assets: [],
		invitations: [],
		environments: [],
		recommendedCommands: [],
		degradedNotes: ['Invitation matrix degraded: probe timeout'],
	};
}

function minimalSummary(): ObservabilitySummaryPayload {
	return {
		schemaVersion: 1,
		generatedAt: '2026-07-31T12:00:00.000Z',
		overallStatus: 'UNVERIFIED',
		source: {
			branch: 'dev-local',
			commitSha: 'abc',
			workingTreeDirty: false,
			degraded: false,
		},
		summary: {
			migrations: { hasPending: false, pendingCount: 0, localLifecycle: 'UNVERIFIED' },
			invitations: { totalCount: 13, alignedCount: 13, divergedCount: 0, behindCount: 0, issueSlugs: [] },
			validation: { regressionFreshness: 'NOT_RUN', screenshotsFreshness: 'NOT_RUN' },
		},
		categorizedCommands: [],
		degradedNotes: ['Invitation matrix degraded: probe timeout'],
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
		expect(body.schemaVersion).toBe(1);
		expect(body.degradedNotes.length).toBeGreaterThan(0);
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
		expect(body.schemaVersion).toBe(1);
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
			request: new Request('http://127.0.0.1:4321/api/dashboard/observabilidad?mode=unsupported'),
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
