/**
 * db-sync read-only modes must never call mutation engines or auth gates.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRunPreviewMirror = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAuthorizePreview = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRequireOwner = jest.fn<(...args: unknown[]) => unknown>();
const mockApplyLocal = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunImport = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunPreviewApply = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPromotionPreflight = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPromotionApply = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockVerifyAvailability = jest.fn<(...args: unknown[]) => unknown[]>(() => [
	{ environment: 'local' as const, available: true },
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
jest.mock('../../scripts/db/owner-production-apply.ts', () => ({
	requireOwnerProductionApply: (...args: unknown[]) => mockRequireOwner(...args),
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
	loadSemanticSnapshotsForParity: () => ({
		local: { invitation: { slug: 'demo' }, identityConflict: false },
		preview: { invitation: { slug: 'demo' }, identityConflict: false },
	}),
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
		slug: 'demo',
		eventType: 'boda',
		environments: ['local', 'preview'],
	}),
	listSemanticDifferencePaths: () => [],
}));
jest.mock('../../scripts/provision/invitation-package-input.ts', () => ({
	resolveInvitationPackageInput: jest.fn(async () => ({
		packageData: {
			packageHash: 'pkghash',
			sourceHash: 'srchash',
			projectionHash: 'proj',
			assetManifestHash: 'assets',
			invitation: { slug: 'demo' },
		},
	})),
}));
jest.mock('../../scripts/provision/apply-local-invitation.ts', () => ({
	applyLocalInvitation: (...args: unknown[]) => mockApplyLocal(...args),
}));
jest.mock('../../scripts/provision/invitation-import-engine.ts', () => ({
	runImportEngine: (...args: unknown[]) => mockRunImport(...args),
}));
jest.mock('../../scripts/provision/preview-apply.ts', () => ({
	runPreviewApply: (...args: unknown[]) => mockRunPreviewApply(...args),
}));
jest.mock('../../scripts/provision/invitation-promote.ts', () => ({
	runPromotionPreflight: (...args: unknown[]) => mockPromotionPreflight(...args),
	runPromotionApply: (...args: unknown[]) => mockPromotionApply(...args),
}));
jest.mock('../../scripts/provision/invitation-promote-cli.ts', () => ({
	toPublicPromotionReport: (report: unknown) => report,
}));

function assertNoMutations(): void {
	expect(mockRunPreviewMirror).not.toHaveBeenCalled();
	expect(mockAuthorizePreview).not.toHaveBeenCalled();
	expect(mockRequireOwner).not.toHaveBeenCalled();
	expect(mockRunPreviewApply).not.toHaveBeenCalled();
	expect(mockPromotionApply).not.toHaveBeenCalled();
	const localApplyCalls = mockApplyLocal.mock.calls.filter((call) => {
		const arg = call[0] as { apply?: boolean } | undefined;
		return arg?.apply === true;
	});
	expect(localApplyCalls).toHaveLength(0);
	const importWriteCalls = mockRunImport.mock.calls.filter((call) => {
		const arg = call[0] as { dryRun?: boolean } | undefined;
		return arg?.dryRun === false;
	});
	expect(importWriteCalls).toHaveLength(0);
}

describe('db-sync read-only mutation boundary', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockApplyLocal.mockResolvedValue({
			plan: { planId: 'local-plan' },
			isZeroDrift: true,
			receipt: null,
		});
		mockRunImport.mockResolvedValue({
			plan: { planId: 'preview-plan' },
			isZeroDrift: true,
		});
		mockPromotionPreflight.mockResolvedValue({
			status: 'PROMOTABLE',
			engineResult: { plan: { planId: 'promote-plan' } },
			targetDbUrl:
				'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
		});
	});

	it('diagnose never mutates', async () => {
		const { orchestrateDiagnose } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestrateDiagnose({ mode: 'diagnose' });
		expect(result.mode).toBe('diagnose');
		assertNoMutations();
	});

	it('compare never mutates', async () => {
		const { orchestrateCompare } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestrateCompare({
			mode: 'compare',
			slug: 'demo',
			eventType: 'boda',
			envs: ['local', 'preview'],
		});
		expect(result.mode).toBe('compare');
		expect(result.status).toBe('MATCH_CANONICAL');
		assertNoMutations();
	});

	it('plan never mutates and only dry-runs engines', async () => {
		const { orchestratePlan } = await import('../../scripts/db/db-sync-orchestrator.ts');
		const result = await orchestratePlan({
			mode: 'plan',
			direction: 'definition-to-local',
			slug: 'demo',
			packagePath: 'pkg.json',
			now: new Date(),
		});
		expect(result.mode).toBe('plan');
		expect(result.planId).toBeTruthy();
		assertNoMutations();
		expect(mockApplyLocal).toHaveBeenCalledWith(expect.objectContaining({ apply: false }));
	});
});
