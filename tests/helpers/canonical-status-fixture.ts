import type { CanonicalStatusView } from '@/lib/status/types';

export function buildCanonicalStatusViewFixture(
	overrides: Partial<CanonicalStatusView> = {},
): CanonicalStatusView {
	const env = (environment: 'local' | 'preview' | 'production') => ({
		environment,
		schemaLifecycle: 'CURRENT' as const,
		appliedCount: 75,
		expectedCount: 75,
		migrationHead: '20260806120000',
		pendingMigrations: [],
		extraMigrations: [],
		invitationAttentionCount: 1,
		identityConflictsCount: 0,
		targetClassification: environment === 'local' ? 'persistent-local' : environment,
		environmentIdentityOk: true,
		schemaOperationReadiness: 'NEEDS_DISPOSABLE_PROOF' as const,
		authorizationIntegrity:
			environment === 'production' ? ('GRANDFATHERED' as const) : ('NOT_APPLICABLE' as const),
		authorizationMissingVersions: [],
		evidence: 'LIVE' as const,
		probedAt: '2026-08-12T22:11:46.000Z',
	});
	return {
		schemaVersion: 1,
		generatedAt: '2026-08-12T22:11:54.000Z',
		evidence: 'LIVE',
		expectedMigrationHead: '20260806120000',
		expectedMigrationCount: 75,
		registryCount: 5,
		inSyncCount: 0,
		inSyncSlugs: [],
		environments: {
			local: env('local'),
			preview: env('preview'),
			production: env('production'),
		},
		disposableProof: {
			status: 'missing',
			reason: 'Missing disposable migration proof.',
			evidence: 'LIVE',
		},
		promotions: [
			{
				slug: 'victoria-y-roberto',
				title: 'Boda de Victoria y Roberto',
				eventType: 'boda',
				action: 'PROMOTE_PRODUCTION',
				reasonCode: 'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
				environments: { local: 'match', preview: 'match', production: 'behind' },
				source: 'preview',
				destination: 'production',
				evidence: 'LIVE',
				envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
				uncertaintyNotes: [],
				handoff: {
					dryRunCommand:
						'pnpm invitation:release -- --slug victoria-y-roberto --targets production --dry-run',
					applyCommand:
						'pnpm invitation:release -- --slug victoria-y-roberto --targets production --apply',
					ownerApplyRequired: true,
					steps: ['Dry-run', 'OWNER APPLY', 'Verify'],
				},
			},
		],
		activeRowCounts: { local: 26, preview: 27, production: 26 },
		identityConflictCounts: { local: 0, preview: 0, production: 0 },
		diagnostics: [],
		...overrides,
	};
}
