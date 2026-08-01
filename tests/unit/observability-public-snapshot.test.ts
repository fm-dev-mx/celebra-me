import { describe, expect, it } from '@jest/globals';
import { buildPublicObservabilitySnapshot } from '../../scripts/observability/public-snapshot.ts';
import type {
	AssetHealthRow,
	EnvironmentHealthRow,
	InvitationHealthRow,
	MigrationEnvHealth,
	ValidationEvidenceView,
} from '../../scripts/observability/types.ts';

function environment(environment: 'local' | 'preview' | 'production'): EnvironmentHealthRow {
	return {
		environment,
		connection: 'ok',
		runtimeIdentity: environment,
		schemaLifecycle: 'CURRENT',
		activeInvitationRows: 1,
		supportedCorpusPresence: '1/1',
		renderEffectiveParity: 'ALL_ALIGNED',
	};
}

function invitation(slug = 'sample'): InvitationHealthRow {
	const env = (environment: 'local' | 'preview' | 'production') => ({
		environment,
		status: 'MATCH_CANONICAL' as const,
		publishedVersion: 1,
		assetCount: 1,
	});
	return {
		slug,
		eventType: 'xv',
		referenceClassification: 'CANONICAL_MANAGED',
		themeId: null,
		visualProfileId: null,
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		publicRoute: `/xv/${slug}`,
		environments: {
			local: env('local'),
			preview: env('preview'),
			production: env('production'),
		},
		recommendedCommand: null,
		failureCause: null,
	};
}

const asset: AssetHealthRow = {
	slug: 'sample',
	assetStrategy: 'VERSIONED_MANAGED_ASSET',
	status: 'OK',
	localFileCount: 1,
	remoteMediaReferenceCount: 0,
	localAssetKeyReferenceCount: 1,
	dbAssetCount: 1,
};

const migrations: MigrationEnvHealth[] = ['local', 'preview', 'production'].map((environment) => ({
	environment: environment as 'local' | 'preview' | 'production',
	appliedCount: 1,
	pending: [],
	schemaLifecycle: 'CURRENT',
	reachable: true,
	configured: true,
}));

function evidence(validationType: 'regression' | 'screenshots'): ValidationEvidenceView {
	return {
		validationType,
		freshness: 'PASS',
		snapshot: {
			schemaVersion: 1,
			validationType,
			command:
				validationType === 'regression'
					? 'pnpm test:local-render-corpus'
					: 'pnpm screenshot:local-render-corpus',
			startedAt: '2026-08-01T11:59:00.000Z',
			completedAt: '2026-08-01T12:00:00.000Z',
			status: 'pass',
			branch: 'dev-local',
			commitSha: 'abcdef1234',
			workingTreeDirty: false,
			inputFingerprint: 'input',
			corpusFingerprint: 'corpus',
			total: 1,
			passed: 1,
			failed: 0,
			failures: [],
			artifactLocation: `.tmp/observability/validation/${validationType}.json`,
		},
	};
}

function input() {
	return {
		generatedAt: '2026-08-01T12:00:00.000Z',
		overallStatus: 'HEALTHY' as const,
		source: {
			branch: 'dev-local',
			commitSha: 'abcdef1234',
			workingTreeDirty: false,
			degraded: false,
		},
		environments: [environment('local'), environment('preview'), environment('production')],
		invitations: [invitation()],
		migrations,
		assets: [asset],
		regression: evidence('regression'),
		screenshots: evidence('screenshots'),
		degraded: false,
	};
}

describe('public observability snapshot', () => {
	it('keeps only healthy counts when no anomaly exists', () => {
		const result = buildPublicObservabilitySnapshot(input());
		expect(result.schemaVersion).toBe(2);
		expect(result.issues).toEqual([]);
		expect(result.health.invitations).toEqual({
			total: 1,
			ok: 1,
			warning: 0,
			blocking: 0,
			unverified: 0,
		});
		expect(result).not.toHaveProperty('invitations');
		expect(result).not.toHaveProperty('assets');
		expect(result).not.toHaveProperty('fingerprints');
	});

	it('blocks contradictory data and orders blocking issues first', () => {
		const invalid = input();
		invalid.invitations = [invitation(), invitation()];
		invalid.environments[1] = {
			...environment('preview'),
			connection: 'unreachable',
			renderEffectiveParity: 'ALL_ALIGNED',
		};
		const result = buildPublicObservabilitySnapshot(invalid);
		expect(result.overallStatus).toBe('BLOCKED');
		expect(result.issues[0]?.code).toBe('DATA_INTEGRITY');
		expect(result.issues.some((issue) => issue.code === 'ENV_CONNECTION')).toBe(true);
	});
});
