/**
 * invitation-promote.test.ts — Behavioral coverage for Production promotion gates.
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type {
	ImportEngineOptions,
	ImportEngineResult,
} from '../../scripts/provision/invitation-import-engine.ts';
import type { OperationalPlan } from '../../scripts/provision/invitation-update-plan.ts';
import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';
import {
	classifyPromotionDifferences,
	evaluatePromotionBackupGate,
	evaluatePromotionSchemaGate,
	runPromotionApply,
	runPromotionPreflight,
	type PromotionPreflightReport,
} from '../../scripts/provision/invitation-promote.ts';
import { toPublicPromotionReport } from '../../scripts/provision/invitation-promote-cli.ts';
import { MergeConflictError } from '../../scripts/provision/semantic-delta.ts';
import { parseMutationTargets } from '../../scripts/provision/invitation-update-options.ts';

const dirs: string[] = [];
const now = new Date('2026-07-23T12:00:00.000Z');
const packageHash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);
const metadataHash = 'c'.repeat(64);
const projectionHash = 'd'.repeat(32);
const assetManifestHash = 'e'.repeat(64);
const previewPlanId = 'preview-plan-executed';
const productionProjectRef = 'productionproject';

afterEach(() => {
	setDefaultPreviewApprovalStoreForTests(null);
	dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function packageData(): InvitationPackageData {
	return {
		packageHash,
		sourceHash,
		metadataHash,
		projectionHash,
		assetManifestHash,
		invitation: { slug: 'fixture', eventType: 'xv' },
	} as InvitationPackageData;
}

function approval(overrides: Partial<PreviewApprovalArtifact> = {}): PreviewApprovalArtifact {
	return {
		approvalState: 'approved',
		schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
		packageHash,
		sourceHash,
		metadataHash,
		canonicalProjectionHash: projectionHash,
		materializedProjectionHash: 'e'.repeat(32),
		assetManifestHash,
		planId: previewPlanId,
		slug: 'fixture',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		createdAt: '2026-07-23T11:00:00.000Z',
		approvedAt: '2026-07-23T11:30:00.000Z',
		approvedBy: 'qa@celebra-me.test',
		intendedProductionProjectRef: productionProjectRef,
		route: '/xv/fixture',
		expectedAssetHashes: {},
		hostedValidation: {
			packageHash,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/xv/fixture',
			projectionHash: 'e'.repeat(32),
			planId: previewPlanId,
			reviewedAt: '2026-07-23T11:30:00.000Z',
			reviewedBy: 'qa@celebra-me.test',
			intendedProductionProjectRef: productionProjectRef,
			checklistResults: { route: true, database: true, storage: true },
			storageHashVerification: {},
		},
		...overrides,
	};
}

function writeApproval(artifact = approval()): string {
	setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore([artifact]));
	const root = mkdtempSync(join(tmpdir(), 'invitation-promote-'));
	dirs.push(root);
	const approvalsDir = join(root, 'approvals');
	mkdirSync(approvalsDir, { recursive: true });
	writeFileSync(
		join(approvalsDir, `preview-approval-${packageHash.slice(0, 16)}.json`),
		JSON.stringify(artifact),
	);
	return approvalsDir;
}

function productionPlan(): OperationalPlan {
	return {
		planId: 'production-plan',
		invitationSlug: 'fixture',
		invitationTitle: 'Fixture',
		sourceHash,
		packageHash,
		targetEnvironment: 'production',
		verifiedProjectRef: productionProjectRef,
		functionalChanges: [
			{
				section: 'content',
				entity: 'title',
				label: 'Title',
				operation: 'update',
				field: 'content.title',
				previousValue: 'Old',
				newValue: 'New',
				scope: 'database',
				technicalWriteCount: 1,
			},
		],
		physicalDatabaseOps: { inserts: 0, updates: 1, deletes: 0 },
		storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		targetPreconditions: {},
		sensitivityClassification: 'public',
		executionStatus: 'PLANNED',
	};
}

function engineResult(overrides: Partial<ImportEngineResult> = {}): ImportEngineResult {
	return {
		plan: productionPlan(),
		actions: [],
		plannedMutations: 1,
		executedMutations: 0,
		isZeroDrift: false,
		isZeroDriftRerun: false,
		packageHash,
		projectRef: productionProjectRef,
		publishedVersion: 3,
		functionalChanges: productionPlan().functionalChanges,
		receipt: undefined,
		...overrides,
	} as ImportEngineResult;
}

describe('Promotion target boundaries', () => {
	it('never exposes a target database URL in the public CLI report', () => {
		const report = toPublicPromotionReport({
			targetDbUrl: 'postgresql://user:password@production.invalid/postgres',
		} as PromotionPreflightReport);

		expect(report).not.toHaveProperty('targetDbUrl');
	});

	it('rejects Production as invitation:update mutation destination', () => {
		expect(() => parseMutationTargets('production')).toThrow('invitation:promote');
		expect(() => parseMutationTargets('local')).not.toThrow();
		expect(() => parseMutationTargets('preview')).not.toThrow();
	});

	it('registers invitation:promote as the public package script', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['invitation:promote']).toContain('invitation-promote-cli.ts');
		expect(pkg.scripts['dbs']).toContain('dbs-cli.ts');
	});
});

describe('evaluatePromotionSchemaGate', () => {
	it('allows CURRENT schemas', () => {
		const result = evaluatePromotionSchemaGate({
			dbUrl: 'postgresql://example',
			expectedVersions: ['1', '2'],
			fetchRemote: () => ({ remoteVersions: ['1', '2'], isUninitialized: false }),
		});
		expect(result.state).toBe('CURRENT');
		expect(result.compatible).toBe(true);
	});

	it('blocks BEHIND schemas without invoking migrations', () => {
		const result = evaluatePromotionSchemaGate({
			dbUrl: 'postgresql://example',
			expectedVersions: ['1', '2', '3'],
			fetchRemote: () => ({ remoteVersions: ['1', '2'], isUninitialized: false }),
		});
		expect(result.state).toBe('BEHIND');
		expect(result.compatible).toBe(false);
		expect(result.blockCode).toBe('SCHEMA_INCOMPATIBLE');
		expect(result.detail).toContain('never runs migrations');
	});

	it('blocks SCHEMA_DRIFT and UNVERIFIED', () => {
		const drift = evaluatePromotionSchemaGate({
			dbUrl: 'postgresql://example',
			expectedVersions: ['1'],
			fetchRemote: () => ({ remoteVersions: ['1', 'orphan'], isUninitialized: false }),
		});
		expect(drift.state).toBe('SCHEMA_DRIFT');
		expect(drift.compatible).toBe(false);

		const unverified = evaluatePromotionSchemaGate({
			dbUrl: 'postgresql://example',
			expectedVersions: ['1'],
			fetchRemote: () => {
				throw new Error('psql failed');
			},
		});
		expect(unverified.state).toBe('UNVERIFIED');
		expect(unverified.compatible).toBe(false);
	});
});

describe('evaluatePromotionBackupGate', () => {
	it('blocks missing required backup before write', () => {
		const root = mkdtempSync(join(tmpdir(), 'promote-backup-empty-'));
		dirs.push(root);
		const result = evaluatePromotionBackupGate({
			backupRoot: root,
			required: true,
			now,
		});
		expect(result.acceptable).toBe(false);
		expect(result.blockCode).toBe('BACKUP_REQUIRED');
		expect(result.canonicalCommand).toBe('pnpm db:prod:backup:critical');
	});

	it('accepts a fresh verified critical manifest', () => {
		const root = mkdtempSync(join(tmpdir(), 'promote-backup-ok-'));
		dirs.push(root);
		const dir = join(root, 'critical-20260723');
		mkdirSync(dir, { recursive: true });
		const artifacts = ['database', 'auth', 'storage-metadata', 'storage-objects'].map(
			(kind) => {
				const artifactPath = join(dir, `${kind}.bin`);
				writeFileSync(artifactPath, Buffer.alloc(64, 1));
				return {
					kind,
					path: artifactPath,
					bytes: 64,
					sha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex'),
				};
			},
		);
		const manifestPath = join(dir, 'manifest.json');
		writeFileSync(
			manifestPath,
			JSON.stringify({
				version: 1,
				createdAt: '2026-07-23T11:00:00.000Z',
				environment: 'production',
				projectRef: productionProjectRef,
				artifacts,
			}),
		);
		const result = evaluatePromotionBackupGate({
			manifestPath,
			productionProjectRef,
			required: true,
			now,
		});
		expect(result.acceptable).toBe(true);
		expect(result.manifestPath).toBe(manifestPath);
	});
});

describe('classifyPromotionDifferences', () => {
	it('maps semantic statuses onto promotion classifications', () => {
		const summary = classifyPromotionDifferences([
			{
				path: 'a',
				operation: 'replace',
				previousCanonicalPresent: true,
				currentCanonicalPresent: true,
				currentTargetPresent: true,
				previousCanonicalValue: 1,
				currentCanonicalValue: 2,
				currentTargetValue: 1,
				isAssetField: false,
				status: 'APPLY',
				appliedValue: 2,
			},
			{
				path: 'b',
				operation: 'replace',
				previousCanonicalPresent: true,
				currentCanonicalPresent: true,
				currentTargetPresent: true,
				previousCanonicalValue: 1,
				currentCanonicalValue: 2,
				currentTargetValue: 9,
				isAssetField: false,
				status: 'DRIFT',
				appliedValue: 2,
			},
			{
				path: 'c',
				operation: 'replace',
				previousCanonicalPresent: true,
				currentCanonicalPresent: true,
				currentTargetPresent: true,
				previousCanonicalValue: 1,
				currentCanonicalValue: 2,
				currentTargetValue: 3,
				isAssetField: false,
				status: 'BLOCKED_BY_SCOPE',
				appliedValue: 3,
			},
		]);
		expect(summary.safeManagedChanges).toHaveLength(1);
		expect(summary.targetOwnedDifferences).toHaveLength(1);
		expect(summary.managedDivergences).toHaveLength(1);
		expect(summary.blocksPromotion).toBe(true);
	});
});

describe('runPromotionPreflight / apply', () => {
	it('blocks when exact approval is missing', async () => {
		setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore());
		const report = await runPromotionPreflight({
			packageData: packageData(),
			requireBackup: false,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			approvalsDirs: [join(tmpdir(), 'missing-approvals-dir')],
			runEngine: async () => engineResult(),
		});
		expect(report.status).toBe('BLOCKED');
		expect(report.blockCode).toBe('MISSING_PREVIEW_APPROVAL');
	});

	it('blocks package/hash mismatch against approval', async () => {
		const approvalsDir = writeApproval(approval({ packageHash: 'f'.repeat(64) }));
		const report = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			runEngine: async () => engineResult(),
		});
		expect(report.status).toBe('BLOCKED');
		expect(report.blockCode).toBe('MISSING_PREVIEW_APPROVAL');
	});

	it('blocks wrong intended Production target', async () => {
		const approvalsDir = writeApproval(
			approval({ intendedProductionProjectRef: 'otherprojectref' }),
		);
		const report = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			runEngine: async () => engineResult(),
		});
		expect(report.status).toBe('BLOCKED');
		expect(report.blockCode).toBe('APPROVAL_IDENTITY_MISMATCH');
	});

	it('blocks managed divergence from merge conflicts', async () => {
		const approvalsDir = writeApproval();
		const report = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			runEngine: async () => {
				throw new MergeConflictError('drift', [
					{
						path: 'content.title',
						operation: 'replace',
						previousCanonicalPresent: true,
						currentCanonicalPresent: true,
						currentTargetPresent: true,
						previousCanonicalValue: 'A',
						currentCanonicalValue: 'B',
						currentTargetValue: 'C',
						isAssetField: false,
						status: 'DRIFT',
						appliedValue: 'B',
					},
				]);
			},
		});
		expect(report.status).toBe('BLOCKED');
		expect(report.blockCode).toBe('MANAGED_DIVERGENCE');
		expect(report.divergence.blocksPromotion).toBe(true);
	});

	it('reports PROMOTABLE for approved exact release with CURRENT schema', async () => {
		const approvalsDir = writeApproval();
		const report = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			evaluateBackup: () => ({
				required: false,
				acceptable: true,
				canonicalCommand: 'pnpm db:prod:backup:critical',
				detail: 'skipped',
			}),
			runEngine: async () => engineResult(),
		});
		expect(report.status).toBe('PROMOTABLE');
		expect(report.approval?.packageHash).toBe(packageHash);
		expect(report.divergence.safeManagedChanges.length).toBeGreaterThan(0);
	});

	it('uses managed writer on apply and returns APPLIED_BUT_VERIFICATION_FAILED on verify failure', async () => {
		const approvalsDir = writeApproval();
		const preflight = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			evaluateBackup: () => ({
				required: false,
				acceptable: true,
				canonicalCommand: 'pnpm db:prod:backup:critical',
				detail: 'skipped',
			}),
			runEngine: async () => engineResult(),
		});
		expect(preflight.status).toBe('PROMOTABLE');

		let applyCalls = 0;
		const report = await runPromotionApply({
			preflight,
			packageData: packageData(),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			runEngine: async (options: ImportEngineOptions) => {
				applyCalls += 1;
				if (options.dryRun === false) {
					expect(options.target).toBe('production');
					expect(options.plan?.planId).toBe('production-plan');
					return engineResult({
						executedMutations: 1,
						receipt: {
							planId: 'production-plan',
							executedAt: now.toISOString(),
							status: 'EXECUTED',
							completedOperations: 1,
						},
					});
				}
				return engineResult({ plannedMutations: 2, isZeroDrift: false });
			},
		});
		expect(applyCalls).toBeGreaterThanOrEqual(2);
		expect(report.status).toBe('APPLIED_BUT_VERIFICATION_FAILED');
		expect(report.verification?.ok).toBe(false);
	});

	it('returns PROMOTED when apply and verification succeed', async () => {
		const approvalsDir = writeApproval();
		const preflight = await runPromotionPreflight({
			packageData: packageData(),
			approvalsDirs: [approvalsDir],
			requireBackup: false,
			now,
			getProductionDbUrl: () => ({
				url: 'postgresql://user@db.productionproject.supabase.co/postgres',
			}),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			evaluateBackup: () => ({
				required: false,
				acceptable: true,
				canonicalCommand: 'pnpm db:prod:backup:critical',
				detail: 'skipped',
			}),
			runEngine: async () => engineResult(),
		});

		const report = await runPromotionApply({
			preflight,
			packageData: packageData(),
			evaluateSchema: () => ({
				state: 'CURRENT',
				migrationHead: '2',
				pendingMigrations: [],
				extraMigrations: [],
				compatible: true,
				detail: 'ok',
			}),
			runEngine: async (options: ImportEngineOptions) => {
				if (options.dryRun === false) {
					return engineResult({
						executedMutations: 1,
						receipt: {
							planId: 'production-plan',
							executedAt: now.toISOString(),
							status: 'EXECUTED',
							completedOperations: 1,
						},
					});
				}
				return engineResult({
					plannedMutations: 0,
					isZeroDrift: true,
					functionalChanges: [],
				});
			},
		});
		expect(report.status).toBe('PROMOTED');
		expect(report.verification?.ok).toBe(true);
	});
});

describe('removed dead public registrations', () => {
	it('does not register removed ops commands in package scripts', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['invitation:promote']).toBeTruthy();
		expect(pkg.scripts.ops).toContain('cli.mjs');
	});

	it('ops dispatcher no longer registers dead commands or dbs alias', () => {
		const cli = readFileSync('scripts/cli.mjs', 'utf8');
		expect(cli).toMatch(/const SCRIPTS = \{[\s\S]*?\};/);
		const scriptsBlock = cli.match(/const SCRIPTS = \{[\s\S]*?\};/)?.[0] ?? '';
		expect(scriptsBlock).not.toContain('optimize-assets');
		expect(scriptsBlock).not.toContain('new-invitation');
		expect(scriptsBlock).not.toContain('adopt-legacy-events');
		expect(scriptsBlock).not.toContain('dbs:');
		expect(cli).toContain("command === 'dbs'");
		expect(cli).toContain('pnpm dbs');
	});
});
