import { z } from 'zod';
import type { ObservabilitySnapshot, ObservabilitySummaryPayload } from './types';

const environment = z.enum(['local', 'preview', 'production']);
const operationalStatus = z.enum(['HEALTHY', 'ATTENTION', 'BLOCKED', 'UNVERIFIED']);
const deliveryStatus = z.enum(['ALIGNED', 'IN_PROGRESS', 'ACTION_REQUIRED', 'UNVERIFIED']);
const comparisonOutcome = z.enum([
	'APPLY',
	'ALREADY_APPLIED',
	'DRIFT',
	'DELIVERY_SCOPE_BLOCKED',
	'UNVERIFIED',
]);
const detailStatus = z.enum(['AVAILABLE', 'DETAIL_UNAVAILABLE']);
const coverageStatus = z.enum(['AVAILABLE', 'UNAVAILABLE', 'NOT_PROBED']);
const lifecycle = z.enum(['in_progress', 'published']);
const reasonCode = z.enum([
	'ENVIRONMENT_UNAVAILABLE',
	'ENVIRONMENT_IDENTITY_CONFLICT',
	'SCHEMA_BEHIND',
	'SCHEMA_DRIFT',
	'SCHEMA_UNAVAILABLE',
	'AUTHORITATIVE_COUNT_MISMATCH',
	'INVITATION_IDENTITY_CONFLICT',
	'INVITATION_MISSING',
	'CANONICAL_INVALID',
	'DRAFT_INVALID',
	'BASELINE_UNAVAILABLE',
	'BASELINE_VERSION_INCOMPATIBLE',
	'MANAGED_DRIFT',
	'DELIVERY_SCOPE_BLOCKED',
	'LIFECYCLE_SEQUENCE_INVALID',
	'LIFECYCLE_METADATA_STALE',
	'REQUIRED_PUBLISHED_ASSET_MISSING',
	'UNPUBLISHED_ASSET_PENDING',
	'ASSET_IDENTITY_UNVERIFIED',
	'CANONICAL_CHANGE_PENDING',
	'VALID_DRAFT_PENDING',
	'PARTIAL_PROMOTION',
	'DETAIL_BUDGET_EXCEEDED',
	'SNAPSHOT_REFRESH_FAILED',
]);
const nextStep = z.enum([
	'NONE',
	'RETRY_PROBE',
	'AUDIT_SCHEMA',
	'RESOLVE_IDENTITY',
	'VERIFY_BASELINE',
	'RECONCILE_MANAGED_CONTENT',
	'APPLY_LOCAL',
	'PROMOTE_PREVIEW',
	'PROMOTE_PRODUCTION',
	'FIX_CANONICAL_DEFINITION',
	'UPDATE_LIFECYCLE_METADATA',
	'PROVIDE_REQUIRED_ASSET',
	'VERIFY_ASSET_EVIDENCE',
]);
const slug = z.string().regex(/^[a-z0-9-]{1,100}$/);
const boundedCount = z.number().int().nonnegative().max(100_000);
const semanticPath = z
	.string()
	.min(1)
	.max(160)
	.regex(/^[A-Za-z0-9_$.-]+(?:\[[0-9]+\])?(?:(?:\.|\[)[A-Za-z0-9_$\]-]+)*$/);
const semanticPaths = z.array(semanticPath).max(50);

const comparisonSummary = z
	.object({
		environment,
		outcome: comparisonOutcome,
		detailStatus,
		affectedFieldCount: boundedCount,
		affectedSectionCount: boundedCount,
		semanticPaths,
	})
	.strict()
	.refine((value) => value.detailStatus === 'AVAILABLE' || value.semanticPaths.length === 0, {
		message: 'detail_unavailable_must_not_include_paths',
	});

const signal = z
	.object({
		impact: z.enum(['OPERATIONAL', 'DELIVERY']),
		reasonCode,
		nextStep,
		operationalStatus,
		deliveryStatus,
		detailStatus,
		affectedFieldCount: boundedCount,
		affectedSectionCount: boundedCount,
		semanticPaths,
		environment: environment.optional(),
		slug: slug.optional(),
		lifecycle: lifecycle.optional(),
		comparisonOutcome: comparisonOutcome.optional(),
	})
	.strict()
	.refine((value) => value.detailStatus === 'AVAILABLE' || value.semanticPaths.length === 0, {
		message: 'detail_unavailable_must_not_include_paths',
	});

const expectedEnvironmentOrder = ['local', 'preview', 'production'] as const;
function hasEnvironmentOrder(values: readonly { environment: string }[]): boolean {
	return (
		values.length === expectedEnvironmentOrder.length &&
		values.every((value, index) => value.environment === expectedEnvironmentOrder[index])
	);
}

const coverageArray = z
	.array(
		z
			.object({
				environment,
				status: coverageStatus,
				reasonCode: reasonCode.optional(),
			})
			.strict()
			.refine((value) => value.status === 'AVAILABLE' || Boolean(value.reasonCode), {
				message: 'unavailable_coverage_requires_reason',
			}),
	)
	.refine(hasEnvironmentOrder, { message: 'coverage_environment_order' });

export const ObservabilitySnapshotSchema: z.ZodType<ObservabilitySnapshot> = z
	.object({
		schemaVersion: z.literal(3),
		generatedAt: z.iso.datetime({ offset: true }),
		freshness: z.enum(['FRESH', 'STALE', 'PARTIAL']),
		operationalStatus,
		deliveryStatus,
		coverage: coverageArray,
		cache: z.object({ refreshAfter: z.iso.datetime({ offset: true }) }).strict(),
		issues: z.array(signal).max(200),
		workItems: z.array(signal).max(200),
		environmentSummaries: z
			.array(
				z
					.object({
						environment,
						operationalStatus,
						deliveryStatus,
						coverage: coverageStatus,
						counts: z
							.object({
								invitations: boundedCount,
								issues: boundedCount,
								workItems: boundedCount,
							})
							.strict(),
					})
					.strict(),
			)
			.refine(hasEnvironmentOrder, { message: 'summary_environment_order' }),
		invitationSummaries: z
			.array(
				z
					.object({
						slug,
						lifecycle,
						operationalStatus,
						deliveryStatus,
						comparisons: z.array(comparisonSummary).max(3),
					})
					.strict(),
			)
			.max(100),
	})
	.strict();

export const ObservabilitySummarySchema: z.ZodType<ObservabilitySummaryPayload> = z
	.object({
		schemaVersion: z.literal(3),
		generatedAt: z.iso.datetime({ offset: true }),
		freshness: z.enum(['FRESH', 'STALE', 'PARTIAL']),
		operationalStatus,
		deliveryStatus,
		coverage: coverageArray,
		counts: z
			.object({
				invitations: boundedCount,
				issues: boundedCount,
				workItems: boundedCount,
			})
			.strict(),
	})
	.strict();
