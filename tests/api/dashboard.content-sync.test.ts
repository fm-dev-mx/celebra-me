import { GET as getDrift } from '@/pages/api/dashboard/admin/content-drift';
import { POST as dryRunPublish } from '@/pages/api/dashboard/admin/demo-publish/dry-run';
import { POST as confirmPublish } from '@/pages/api/dashboard/admin/demo-publish/confirm';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { buildDemoDriftReport } from '@/lib/content-publication/demo-drift';
import { confirmDemoPublish, dryRunDemoPublish } from '@/lib/content-publication/demo-publish';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rsvp/security/csrf', () => ({
	validateCsrfToken: jest.fn(),
	shouldSkipCsrfValidation: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/content-publication/demo-drift', () => ({
	buildDemoDriftReport: jest.fn(),
}));

jest.mock('@/lib/content-publication/demo-publish', () => ({
	dryRunDemoPublish: jest.fn(),
	confirmDemoPublish: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const requireAdminMutationAccessMock = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const buildDemoDriftReportMock = buildDemoDriftReport as jest.MockedFunction<
	typeof buildDemoDriftReport
>;
const dryRunDemoPublishMock = dryRunDemoPublish as jest.MockedFunction<typeof dryRunDemoPublish>;
const confirmDemoPublishMock = confirmDemoPublish as jest.MockedFunction<typeof confirmDemoPublish>;

const adminSession = {
	userId: '550e8400-e29b-41d4-a716-446655440001',
	email: 'admin@test.com',
	accessToken: 'token',
	role: 'super_admin' as const,
	isSuperAdmin: true,
};

describe('content sync admin APIs', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		requireAdminStrongSessionMock.mockResolvedValue(adminSession);
		requireAdminMutationAccessMock.mockResolvedValue(adminSession);
	});

	it('rejects drift report access for non-admin users', async () => {
		requireAdminStrongSessionMock.mockRejectedValue(
			new ApiError(403, 'forbidden', 'Not authorized.'),
		);

		const response = await getDrift({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/admin/content-drift',
			),
		} as never);

		expect(response.status).toBe(403);
	});

	it('returns demo drift report for admin users', async () => {
		buildDemoDriftReportMock.mockResolvedValue({
			generated_at: '2026-06-06T00:00:00.000Z',
			scope: 'demos',
			source_environment: 'local',
			target_environment: 'production',
			summary: {
				in_sync: 1,
				different: 0,
				missing_in_prod: 0,
				missing_locally: 0,
				schema_mismatch: 0,
				unsafe_target: 0,
			},
			items: [],
		});

		const response = await getDrift({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/dashboard/admin/content-drift',
			),
		} as never);

		expect(response.status).toBe(200);
		expect(buildDemoDriftReportMock).toHaveBeenCalled();
	});

	it('dry-run endpoint does not call confirmed publish', async () => {
		dryRunDemoPublishMock.mockResolvedValue({
			can_publish: true,
			event_type: 'xv',
			slug: 'demo-xv-jewelry-box',
			route_key: 'xv/demo-xv-jewelry-box',
			local_hash: 'local',
			prod_hash: 'prod',
			expected_prod_hash: 'prod',
			status: 'different',
			changed_paths: ['title'],
			diff_examples: [],
			warnings: [],
		});

		const response = await dryRunPublish({
			request: createMockRequest(
				{ event_type: 'xv', slug: 'demo-xv-jewelry-box' },
				undefined,
				'http://localhost/api/dashboard/admin/demo-publish/dry-run',
			),
			cookies: {},
		} as never);

		expect(response.status).toBe(200);
		expect(dryRunDemoPublishMock).toHaveBeenCalledWith({
			eventType: 'xv',
			slug: 'demo-xv-jewelry-box',
		});
		expect(confirmDemoPublishMock).not.toHaveBeenCalled();
	});

	it('confirm endpoint passes actor and expected hash to service', async () => {
		confirmDemoPublishMock.mockResolvedValue({
			published: true,
			event_type: 'xv',
			slug: 'demo-xv-jewelry-box',
			route_key: 'xv/demo-xv-jewelry-box',
			previous_version: 1,
			new_version: 2,
			local_hash: 'local',
			prod_hash_before: 'prod',
			prod_hash_after: 'local',
			audit_log_id: undefined,
		});

		const response = await confirmPublish({
			request: createMockRequest(
				{
					event_type: 'xv',
					slug: 'demo-xv-jewelry-box',
					expected_prod_hash: 'prod',
				},
				undefined,
				'http://localhost/api/dashboard/admin/demo-publish/confirm',
			),
			cookies: {},
		} as never);

		expect(response.status).toBe(200);
		expect(confirmDemoPublishMock).toHaveBeenCalledWith({
			eventType: 'xv',
			slug: 'demo-xv-jewelry-box',
			expectedProdHash: 'prod',
			actorUserId: adminSession.userId,
		});
	});
});
