import { z } from 'zod';
import type { CanonicalStatusView } from './types';

const targetEnv = z.enum(['local', 'preview', 'production']);
const evidence = z.enum(['LIVE', 'CACHED', 'UNVERIFIED']);
const schemaLifecycle = z.enum(['CURRENT', 'BEHIND', 'SCHEMA_DRIFT', 'UNVERIFIED']);
const readiness = z.enum([
	'READY',
	'NEEDS_DISPOSABLE_PROOF',
	'PENDING_MIGRATIONS',
	'SCHEMA_DRIFT',
	'UNREACHABLE',
	'NOT_CONFIGURED',
	'UNVERIFIED',
]);
const authorizationIntegrity = z.enum([
	'RECORDED',
	'MISSING',
	'GRANDFATHERED',
	'NOT_APPLICABLE',
	'UNVERIFIED',
]);
const envState = z.enum(['match', 'behind', 'absent', 'diverged', 'conflict', 'unknown']);
const action = z.enum(['PROMOTE_PREVIEW', 'PROMOTE_PRODUCTION', 'BLOCKED', 'UNKNOWN']);
const reasonCode = z.enum([
	'IN_SYNC',
	'EVIDENCE_INCOMPLETE',
	'CANONICAL_UNAVAILABLE',
	'IDENTITY_CONFLICT',
	'MANAGED_DIVERGENCE',
	'PRODUCTION_AHEAD_OF_PREVIEW',
	'PREVIEW_ALIGNED_PRODUCTION_BEHIND',
	'LOCAL_BEHIND_PREVIEW_ALIGNED',
	'PREVIEW_BEHIND_CANONICAL',
]);
const slug = z.string().regex(/^[a-z0-9-]{1,100}$/);
const migrationVersion = z.string().regex(/^\d{14}$/);

const envSummary = z
	.object({
		environment: targetEnv,
		schemaLifecycle,
		appliedCount: z.number().int().nonnegative().nullable(),
		expectedCount: z.number().int().nonnegative(),
		migrationHead: migrationVersion.nullable(),
		pendingMigrations: z.array(migrationVersion).max(200),
		extraMigrations: z.array(migrationVersion).max(200),
		invitationAttentionCount: z.number().int().nonnegative().max(1000),
		identityConflictsCount: z.number().int().nonnegative().max(100_000),
		targetClassification: z.string().min(1).max(80),
		environmentIdentityOk: z.boolean(),
		schemaOperationReadiness: readiness,
		schemaNextAction: z.string().max(400).nullable(),
		authorizationIntegrity,
		authorizationMissingVersions: z.array(migrationVersion).max(200),
		evidence,
		probedAt: z.iso.datetime({ offset: true }).nullable(),
	})
	.strict();

const diagnosticCode = z.enum([
	'ENVIRONMENT_IDENTITY_CONFLICT',
	'AUTHORITATIVE_COUNT_MISMATCH',
	'INVITATION_IDENTITY_CONFLICT',
	'DRAFT_INVALID',
	'BASELINE_UNAVAILABLE',
	'BASELINE_VERSION_INCOMPATIBLE',
	'MANAGED_DRIFT',
	'DELIVERY_SCOPE_BLOCKED',
	'REQUIRED_PUBLISHED_ASSET_MISSING',
	'UNPUBLISHED_ASSET_PENDING',
	'ASSET_IDENTITY_UNVERIFIED',
	'LIFECYCLE_METADATA_STALE',
	'DETAIL_BUDGET_EXCEEDED',
	'PRODUCTION_AUTHORIZATION_MISSING',
]);

const diagnostic = z
	.object({
		code: diagnosticCode,
		slug: slug.optional(),
		environment: targetEnv.optional(),
		cause: z.string().min(1).max(240),
		affectedFieldCount: z.number().int().nonnegative().max(100_000),
		affectedSectionCount: z.number().int().nonnegative().max(1000),
		semanticPaths: z.array(z.string().min(1).max(160)).max(50),
	})
	.strict();

const promotionRow = z
	.object({
		slug,
		title: z.string().min(1).max(200),
		eventType: z.string().min(1).max(40),
		action,
		reasonCode,
		environments: z
			.object({
				local: envState,
				preview: envState,
				production: envState,
			})
			.strict(),
		source: z.enum(['canonical', 'preview', 'local']).nullable(),
		destination: z.enum(['preview', 'production', 'local']).nullable(),
		evidence,
		envEvidence: z
			.object({
				local: evidence,
				preview: evidence,
				production: evidence,
			})
			.strict(),
		uncertaintyNotes: z.array(z.string().min(1).max(80)).max(8),
		handoff: z
			.object({
				dryRunCommand: z.string().max(400).nullable(),
				applyCommand: z.string().max(400).nullable(),
				ownerApplyRequired: z.boolean(),
				steps: z.array(z.string().min(1).max(80)).max(8),
			})
			.strict(),
	})
	.strict();

export const CanonicalStatusViewSchema: z.ZodType<CanonicalStatusView> = z
	.object({
		schemaVersion: z.literal(1),
		generatedAt: z.iso.datetime({ offset: true }),
		evidence,
		expectedMigrationHead: migrationVersion.nullable(),
		expectedMigrationCount: z.number().int().nonnegative(),
		registryCount: z.number().int().nonnegative().max(1000),
		inSyncCount: z.number().int().nonnegative().max(1000),
		inSyncSlugs: z.array(slug).max(1000),
		environments: z
			.object({
				local: envSummary,
				preview: envSummary,
				production: envSummary,
			})
			.strict(),
		disposableProof: z
			.object({
				status: z.enum(['valid', 'missing', 'stale']),
				reason: z.string().min(1).max(500),
				evidence,
			})
			.strict(),
		promotions: z.array(promotionRow).max(200),
		activeRowCounts: z
			.object({
				local: z.number().int().nonnegative().max(100_000),
				preview: z.number().int().nonnegative().max(100_000),
				production: z.number().int().nonnegative().max(100_000),
			})
			.strict(),
		identityConflictCounts: z
			.object({
				local: z.number().int().nonnegative().max(100_000),
				preview: z.number().int().nonnegative().max(100_000),
				production: z.number().int().nonnegative().max(100_000),
			})
			.strict(),
		diagnostics: z.array(diagnostic).max(200),
		debugCounters: z
			.object({
				invocations: z.number().int().nonnegative(),
				memoHits: z.number().int().nonnegative(),
				timeoutDegraded: z.boolean(),
			})
			.strict()
			.optional(),
	})
	.strict();
