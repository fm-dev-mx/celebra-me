import { describe, expect, it } from '@jest/globals';
import { classifyValidationFreshness } from '../../scripts/observability/validation-evidence.ts';
import { computeOverallStatus } from '../../scripts/observability/overall-status.ts';
import type {
	AssetHealthRow,
	EnvironmentHealthRow,
	InvitationHealthRow,
	MigrationEnvHealth,
	ObservabilityFingerprints,
	ObservabilitySourceState,
	ValidationEvidenceSnapshot,
	ValidationEvidenceView,
} from '../../scripts/observability/types.ts';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';

const fingerprints: ObservabilityFingerprints = {
	corpusFingerprint: 'corpus-a',
	inputFingerprint: 'input-a',
};

const source: ObservabilitySourceState = {
	branch: 'feat/x',
	commitSha: 'abc123',
	workingTreeDirty: false,
	degraded: false,
};

function baseSnapshot(
	overrides: Partial<ValidationEvidenceSnapshot> = {},
): ValidationEvidenceSnapshot {
	return {
		schemaVersion: 1,
		validationType: 'regression',
		command: 'pnpm test:local-render-corpus',
		startedAt: '2026-07-31T00:00:00.000Z',
		completedAt: '2026-07-31T00:01:00.000Z',
		status: 'pass',
		branch: 'feat/x',
		commitSha: 'abc123',
		workingTreeDirty: false,
		inputFingerprint: 'input-a',
		corpusFingerprint: 'corpus-a',
		total: 13,
		passed: 13,
		failed: 0,
		failures: [],
		artifactLocation: '.tmp/observability/validation/regression.json',
		...overrides,
	};
}

describe('observability validation freshness', () => {
	it('PASS when fingerprints and source match a passing snapshot', () => {
		expect(classifyValidationFreshness(baseSnapshot(), fingerprints, source)).toBe('PASS');
	});

	it('STALE when input fingerprint changes', () => {
		expect(
			classifyValidationFreshness(
				baseSnapshot(),
				{ ...fingerprints, inputFingerprint: 'other' },
				source,
			),
		).toBe('STALE');
	});

	it('STALE when corpus fingerprint changes', () => {
		expect(
			classifyValidationFreshness(
				baseSnapshot(),
				{ ...fingerprints, corpusFingerprint: 'other' },
				source,
			),
		).toBe('STALE');
	});

	it('NOT_RUN when snapshot missing', () => {
		expect(classifyValidationFreshness(null, fingerprints, source)).toBe('NOT_RUN');
	});

	it('FAIL when latest run failed', () => {
		expect(
			classifyValidationFreshness(
				baseSnapshot({ status: 'fail', failed: 1, passed: 12 }),
				fingerprints,
				source,
			),
		).toBe('FAIL');
	});

	it('INVALID for unsupported schema', () => {
		expect(
			classifyValidationFreshness(
				baseSnapshot({ schemaVersion: 2 as unknown as 1 }),
				fingerprints,
				source,
			),
		).toBe('INVALID');
	});
});

describe('observability corpus SSOT', () => {
	it('dashboard invitation rows derive from corpus registry (13 clients)', () => {
		const corpus = listLocalRenderCorpus();
		expect(corpus).toHaveLength(13);
		expect(corpus.every((entry) => entry.assetStrategy)).toBe(true);
	});
});

function emptyEvidence(freshness: ValidationEvidenceView['freshness']): ValidationEvidenceView {
	return {
		validationType: 'regression',
		freshness,
		snapshot: freshness === 'PASS' ? baseSnapshot() : null,
	};
}

describe('observability overall status', () => {
	const healthyEnv = (environment: 'local' | 'preview' | 'production'): EnvironmentHealthRow => ({
		environment,
		connection: 'ok',
		runtimeIdentity: environment === 'local' ? 'persistent-local' : environment,
		schemaLifecycle: 'CURRENT',
		activeInvitationRows: 20,
		supportedCorpusPresence: '13/13',
		renderEffectiveParity: 'ALL_ALIGNED',
	});

	const healthyInvite = (slug: string): InvitationHealthRow => ({
		slug,
		eventType: 'xv',
		referenceClassification: 'LOCAL_CORPUS_REFERENCE',
		themeId: null,
		visualProfileId: null,
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		publicRoute: `/xv/${slug}`,
		environments: {
			local: {
				environment: 'local',
				status: 'MATCH_REFERENCE',
				publishedVersion: 1,
				assetCount: 1,
			},
			preview: {
				environment: 'preview',
				status: 'MATCH_REFERENCE',
				publishedVersion: 1,
				assetCount: 1,
			},
			production: {
				environment: 'production',
				status: 'MATCH_REFERENCE',
				publishedVersion: 1,
				assetCount: 1,
			},
		},
		recommendedCommand: null,
		failureCause: null,
	});

	const healthyAsset = (slug: string): AssetHealthRow => ({
		slug,
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		status: 'REMOTE_REFERENCE',
		localFileCount: 0,
		remoteMediaReferenceCount: 1,
		localAssetKeyReferenceCount: 0,
		dbAssetCount: 1,
	});

	const migrationsOk: MigrationEnvHealth[] = [
		{
			environment: 'repository',
			appliedCount: 10,
			pending: '—',
			schemaLifecycle: 'SOURCE',
			reachable: true,
			configured: true,
		},
		{
			environment: 'local',
			appliedCount: 10,
			pending: [],
			schemaLifecycle: 'CURRENT',
			reachable: true,
			configured: true,
		},
		{
			environment: 'preview',
			appliedCount: 10,
			pending: [],
			schemaLifecycle: 'CURRENT',
			reachable: true,
			configured: true,
		},
		{
			environment: 'production',
			appliedCount: 10,
			pending: [],
			schemaLifecycle: 'CURRENT',
			reachable: true,
			configured: true,
		},
	];

	it('BLOCKED when Local corpus invitation missing', () => {
		const invite = healthyInvite('missing-one');
		invite.environments.local.status = 'NOT_PRESENT';
		expect(
			computeOverallStatus({
				environments: [
					healthyEnv('local'),
					healthyEnv('preview'),
					healthyEnv('production'),
				],
				invitations: [invite],
				migrations: migrationsOk,
				assets: [healthyAsset('missing-one')],
				regression: emptyEvidence('PASS'),
				screenshots: emptyEvidence('PASS'),
				corpusComplete: true,
			}),
		).toBe('BLOCKED');
	});

	it('UNVERIFIED when evidence not run', () => {
		expect(
			computeOverallStatus({
				environments: [
					healthyEnv('local'),
					healthyEnv('preview'),
					healthyEnv('production'),
				],
				invitations: [healthyInvite('x')],
				migrations: migrationsOk,
				assets: [{ ...healthyAsset('x'), status: 'OK' }],
				regression: emptyEvidence('NOT_RUN'),
				screenshots: emptyEvidence('PASS'),
				corpusComplete: true,
			}),
		).toBe('UNVERIFIED');
	});

	it('ATTENTION when evidence stale but environments ok', () => {
		expect(
			computeOverallStatus({
				environments: [
					healthyEnv('local'),
					healthyEnv('preview'),
					healthyEnv('production'),
				],
				invitations: [healthyInvite('x')],
				migrations: migrationsOk,
				assets: [{ ...healthyAsset('x'), status: 'OK' }],
				regression: emptyEvidence('STALE'),
				screenshots: emptyEvidence('PASS'),
				corpusComplete: true,
			}),
		).toBe('ATTENTION');
	});
});
