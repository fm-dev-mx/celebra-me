/**
 * db-sync apply dispatch tests — mirror failures and exact-plan enforcement (mocked engines).
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockRunPreviewMirror = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAuthorizePreview = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
	authorized: true as const,
	actor: 'automated_scoped_token' as const,
}));
const mockVerifyAvailability = jest.fn<(...args: unknown[]) => unknown[]>(() => [
	{ environment: 'preview' as const, available: true },
	{ environment: 'production' as const, available: true },
]);
const mockEvaluateGeneralStatus = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
	environments: {
		local: {
			environment: 'local',
			configured: true,
			reachable: true,
			dbUrlRedacted: 'local',
			targetClassification: 'persistent-local',
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'CURRENT',
		},
		preview: {
			environment: 'preview',
			configured: true,
			reachable: true,
			dbUrlRedacted: 'preview',
			targetClassification: 'preview',
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'CURRENT',
		},
		production: {
			environment: 'production',
			configured: true,
			reachable: true,
			dbUrlRedacted: 'production',
			targetClassification: 'production',
			activeManagedCount: 0,
			identityConflictsCount: 0,
			schemaLifecycle: 'CURRENT',
		},
	},
	totalDefinitionsCount: 0,
}));

jest.mock('../../scripts/db/preview-sync-invitations.ts', () => ({
	runPreviewMirror: (...args: unknown[]) => mockRunPreviewMirror(...args),
}));

jest.mock('../../scripts/db/verify-required-database-availability.ts', () => ({
	verifyRequiredDatabaseAvailability: (...args: unknown[]) => mockVerifyAvailability(...args),
}));

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	evaluateGeneralStatus: (...args: unknown[]) => mockEvaluateGeneralStatus(...args),
	resetStatusProbeSession: jest.fn(),
}));

jest.mock('../../scripts/provision/preview-write-auth.ts', () => ({
	authorizePreviewWriteApply: (...args: unknown[]) => mockAuthorizePreview(...args),
}));

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	getProdDbUrl: () => ({
		url: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
	}),
	PROJECT_ROOT: process.cwd(),
}));

jest.mock('../../scripts/db/db-guard.ts', () => ({
	PREVIEW_SECRET_FILES: ['.env.preview.local'],
	LOCAL_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
	getSecretFromEnvOrFiles: () =>
		'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
}));

jest.mock('../../scripts/provision/content-parity-load.ts', () => ({
	loadSemanticSnapshotsForParity: () => ({}),
	resolveDbUrl: (env: string) => {
		if (env === 'local') return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
		if (env === 'preview') {
			return 'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';
		}
		if (env === 'production') {
			return 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres';
		}
		return null;
	},
}));

jest.mock('../../scripts/provision/content-parity.ts', () => ({
	compareAcrossEnvironments: () => ({
		ok: true,
		drifts: [],
		slug: '',
		eventType: '',
		environments: [],
	}),
	listSemanticDifferencePaths: () => [],
}));

jest.mock('../../scripts/provision/invitation-package-input.ts', () => ({
	resolveInvitationPackageInput: jest.fn(),
}));

jest.mock('../../scripts/provision/apply-local-invitation.ts', () => ({
	applyLocalInvitation: jest.fn(),
}));

jest.mock('../../scripts/provision/invitation-import-engine.ts', () => ({
	runImportEngine: jest.fn(),
}));

jest.mock('../../scripts/provision/preview-apply.ts', () => ({
	runPreviewApply: jest.fn(),
}));

jest.mock('../../scripts/provision/invitation-promote.ts', () => ({
	runPromotionPreflight: jest.fn(),
	runPromotionApply: jest.fn(),
}));

jest.mock('../../scripts/db/owner-production-apply.ts', () => ({
	requireOwnerProductionApply: jest.fn(),
}));

jest.mock('../../scripts/provision/invitation-promote-cli.ts', () => ({
	toPublicPromotionReport: (report: unknown) => report,
}));

describe('db-sync apply mirror dispatch', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('fails apply when mirror reports row/storage failures', async () => {
		mockRunPreviewMirror.mockResolvedValue({
			dryRun: false,
			startedAt: '2026-08-04T00:00:00.000Z',
			source: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			target: 'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
			created: { invitations: 1 },
			copiedAssets: 0,
			missingAssets: ['hero.png'],
			detectedDrift: [],
			excludedTableCounts: {},
			failures: ['PARTIAL_UPSERT: invitations id=1: boom'],
			status: 'failed',
		});

		const { orchestrateApply, orchestratePlan } =
			await import('../../scripts/db/db-sync-orchestrator.ts');

		const planned = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date(),
		});
		expect(planned.planId).toBeTruthy();

		const result = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: planned.planId,
			reviewedPlan: planned.plan,
			runMirror: mockRunPreviewMirror as never,
			authorizePreview: mockAuthorizePreview as never,
			now: new Date(),
		});

		expect(result.ok).toBe(false);
		expect(result.status).toBe('failed');
		expect(
			result.failures.some(
				(f) => f.includes('PARTIAL_UPSERT') || f.includes('MISSING_ASSET'),
			),
		).toBe(true);
		expect(mockAuthorizePreview).toHaveBeenCalled();
		expect(mockRunPreviewMirror).toHaveBeenCalledWith(
			expect.objectContaining({ apply: true, dryRun: false, skipAuthorization: true }),
		);
	});

	it('rejects apply without exact expected plan', async () => {
		const { orchestrateApply } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: 'not-the-real-plan',
			authorizePreview: mockAuthorizePreview as never,
			runMirror: mockRunPreviewMirror as never,
			now: new Date(),
		});
		expect(result.ok).toBe(false);
		expect(result.status).toBe('PLAN_INVALID');
		expect(mockRunPreviewMirror).not.toHaveBeenCalled();
	});

	it('rejects expired plans before authorizing or mutating', async () => {
		const { orchestratePlan, orchestrateApply } =
			await import('../../scripts/db/db-sync-orchestrator.ts');
		const planned = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date('2026-08-04T00:00:00.000Z'),
		});
		const result = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: planned.planId,
			reviewedPlan: planned.plan,
			authorizePreview: mockAuthorizePreview as never,
			runMirror: mockRunPreviewMirror as never,
			now: new Date('2026-08-04T01:00:00.000Z'),
		});
		expect(result.ok).toBe(false);
		expect(result.status).toBe('PLAN_INVALID');
		expect(result.failures.some((f) => f.includes('PLAN_EXPIRED'))).toBe(true);
		expect(mockAuthorizePreview).not.toHaveBeenCalled();
		expect(mockRunPreviewMirror).not.toHaveBeenCalled();
	});

	it('stops when Preview authorization fails', async () => {
		mockAuthorizePreview.mockRejectedValueOnce(new Error('PREVIEW_AUTH_REQUIRED'));
		const { orchestratePlan, orchestrateApply } =
			await import('../../scripts/db/db-sync-orchestrator.ts');
		const planned = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date(),
		});
		const result = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: planned.planId,
			reviewedPlan: planned.plan,
			authorizePreview: mockAuthorizePreview as never,
			runMirror: mockRunPreviewMirror as never,
			now: new Date(),
		});
		expect(result.ok).toBe(false);
		expect(result.status).toBe('FAILED');
		expect(result.failures.some((f) => f.includes('PREVIEW_AUTH_REQUIRED'))).toBe(true);
		expect(mockRunPreviewMirror).not.toHaveBeenCalled();
	});

	it('authorizes mirror with content-mirror:sync-invitations scope', async () => {
		mockRunPreviewMirror.mockResolvedValue({
			dryRun: false,
			startedAt: '2026-08-04T00:00:00.000Z',
			source: 'redacted',
			target: 'redacted',
			created: {},
			copiedAssets: 0,
			missingAssets: [],
			detectedDrift: [],
			excludedTableCounts: {},
			failures: [],
			status: 'applied',
		});
		const { orchestratePlan, orchestrateApply } =
			await import('../../scripts/db/db-sync-orchestrator.ts');
		const planned = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date(),
		});
		const result = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: planned.planId,
			reviewedPlan: planned.plan,
			authorizePreview: mockAuthorizePreview as never,
			runMirror: mockRunPreviewMirror as never,
			now: new Date(),
		});
		expect(result.ok).toBe(true);
		expect(mockAuthorizePreview).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: 'content-mirror',
				operation: 'sync-invitations',
			}),
		);
	});
});
