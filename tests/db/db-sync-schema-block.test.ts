/**
 * Behavioral: BEHIND/UNVERIFIED schema blocks db:sync plan without auto-migrate.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyAvailability = jest.fn<(...args: unknown[]) => unknown[]>(() => [
	{ environment: 'preview' as const, available: true },
	{ environment: 'local' as const, available: true },
	{ environment: 'production' as const, available: true },
]);

const mockEvaluateGeneralStatus = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPlanAndApplyLocal = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPlanAndApplyPreview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAuthorizePreview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunMirror = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../scripts/db/verify-required-database-availability.ts', () => ({
	verifyRequiredDatabaseAvailability: (...args: unknown[]) => mockVerifyAvailability(...args),
}));

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	evaluateGeneralStatus: (...args: unknown[]) => mockEvaluateGeneralStatus(...args),
	resetStatusProbeSession: jest.fn(),
}));

jest.mock('../../scripts/provision/invitation-content-apply.ts', () => ({
	assertContentSchemaCurrent: jest.fn(),
	contentMigrateCommandForTarget: (target: string) =>
		target === 'local' ? 'pnpm db:local:migrate' : 'pnpm db:preview:migrate',
	planAndApplyLocalContent: (...args: unknown[]) => mockPlanAndApplyLocal(...args),
	planAndApplyPreviewContent: (...args: unknown[]) => mockPlanAndApplyPreview(...args),
}));

jest.mock('../../scripts/provision/preview-write-auth.ts', () => ({
	authorizePreviewWriteApply: (...args: unknown[]) => mockAuthorizePreview(...args),
}));

jest.mock('../../scripts/db/preview-sync-invitations.ts', () => ({
	runPreviewMirror: (...args: unknown[]) => mockRunMirror(...args),
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
	resolveInvitationPackageInput: jest.fn(async () => ({
		packageData: {
			invitation: { slug: 'demo-slug', eventType: 'boda' },
			packageHash: 'abc',
		},
	})),
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

jest.mock('../../scripts/provision/invitation-promotion-orchestrator.ts', () => ({
	orchestrateInvitationPromotion: jest.fn(),
}));

jest.mock('../../scripts/provision/invitation-promote-cli.ts', () => ({
	toPublicPromotionReport: (report: unknown) => report,
}));

describe('db-sync schema CURRENT gate', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEvaluateGeneralStatus.mockResolvedValue({
			environments: {
				local: {
					environment: 'local',
					configured: true,
					reachable: true,
					schemaLifecycle: 'CURRENT',
				},
				preview: {
					environment: 'preview',
					configured: true,
					reachable: true,
					schemaLifecycle: 'BEHIND',
				},
				production: {
					environment: 'production',
					configured: true,
					reachable: true,
					schemaLifecycle: 'CURRENT',
				},
			},
			totalDefinitionsCount: 0,
		});
	});

	it('blocks definition-to-preview plan when preview schema is BEHIND', async () => {
		const { orchestratePlan } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestratePlan({
			mode: 'plan',
			direction: 'definition-to-preview',
			slug: 'demo-slug',
			packagePath: 'pkg.json',
			now: new Date(),
		});

		expect(result.ok).toBe(false);
		expect(result.status).toBe('PLAN_BLOCKED');
		expect(result.failures.some((f) => f.includes('SCHEMA_INCOMPATIBLE'))).toBe(true);
		expect(result.failures.some((f) => f.includes('pnpm db:preview:migrate'))).toBe(true);
		expect(mockPlanAndApplyPreview).not.toHaveBeenCalled();
		expect(mockAuthorizePreview).not.toHaveBeenCalled();
	});

	it('blocks mirror plan without authorizing when preview schema is BEHIND', async () => {
		const { orchestratePlan } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date(),
		});

		expect(result.ok).toBe(false);
		expect(result.status).toBe('PLAN_BLOCKED');
		expect(result.failures.some((f) => /SCHEMA_INCOMPATIBLE/.test(f))).toBe(true);
		expect(mockAuthorizePreview).not.toHaveBeenCalled();
		expect(mockRunMirror).not.toHaveBeenCalled();
	});
});

describe('db-sync network/availability before mutation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockVerifyAvailability.mockReturnValue([
			{ environment: 'preview', available: false, reasonCode: 'CREDENTIALS_REQUIRED' },
			{ environment: 'production', available: false, reasonCode: 'CREDENTIALS_REQUIRED' },
		]);
		mockEvaluateGeneralStatus.mockResolvedValue({
			environments: {},
			totalDefinitionsCount: 0,
		});
	});

	it('does not authorize or mirror when availability fails', async () => {
		const { orchestratePlan, orchestrateApply } =
			await import('../../scripts/db/db-sync-orchestrator.ts');
		const planned = await orchestratePlan({
			mode: 'plan',
			direction: 'production-to-preview-mirror',
			now: new Date(),
		});
		expect(planned.ok).toBe(false);
		expect(planned.failures.some((f) => f.includes('CREDENTIALS_REQUIRED'))).toBe(true);

		const applied = await orchestrateApply({
			mode: 'apply',
			direction: 'production-to-preview-mirror',
			apply: true,
			expectedPlan: planned.planId,
			reviewedPlan: planned.plan,
			authorizePreview: mockAuthorizePreview as never,
			runMirror: mockRunMirror as never,
			now: new Date(),
		});
		expect(applied.ok).toBe(false);
		expect(mockAuthorizePreview).not.toHaveBeenCalled();
		expect(mockRunMirror).not.toHaveBeenCalled();
	});
});
