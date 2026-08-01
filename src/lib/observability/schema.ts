import { z } from 'zod';
import type { ObservabilitySnapshot } from './types';

const isoDate = z.iso.datetime({ offset: true });
const healthCounts = z
	.object({
		total: z.number().int().nonnegative(),
		ok: z.number().int().nonnegative(),
		warning: z.number().int().nonnegative(),
		blocking: z.number().int().nonnegative(),
		unverified: z.number().int().nonnegative(),
	})
	.strict()
	.refine(
		(value) => value.ok + value.warning + value.blocking + value.unverified === value.total,
		{
			message: 'health_counts_inconsistent',
		},
	);

const issueCode = z.enum([
	'DATA_INTEGRITY',
	'SOURCE_UNVERIFIED',
	'SOURCE_DIRTY',
	'PROBE_DEGRADED',
	'ENV_CONNECTION',
	'ENV_SCHEMA',
	'ENV_PARITY',
	'INVITATION_MISSING',
	'INVITATION_IDENTITY_CONFLICT',
	'INVITATION_BEHIND',
	'INVITATION_DIVERGED',
	'INVITATION_UNVERIFIED',
	'MIGRATION_BEHIND',
	'MIGRATION_DRIFT',
	'MIGRATION_UNVERIFIED',
	'ASSET_MISSING',
	'ASSET_PARTIAL',
	'ASSET_UNVERIFIED',
	'VALIDATION_FAILED',
	'VALIDATION_STALE',
	'VALIDATION_NOT_RUN',
	'VALIDATION_INVALID',
	'SNAPSHOT_REFRESH_FAILED',
]);

const safeCommand = z
	.string()
	.min(1)
	.max(180)
	.refine(
		(value) =>
			value.startsWith('pnpm ') &&
			!/[;&|`$<>\r\n]/.test(value) &&
			!/(?:prod.*(?:migrate|patch|promote)|invitation:update.*production)/i.test(value),
		{ message: 'unsafe_command' },
	);

export const ObservabilitySnapshotSchema: z.ZodType<ObservabilitySnapshot> = z
	.object({
		schemaVersion: z.literal(2),
		generatedAt: isoDate,
		overallStatus: z.enum(['HEALTHY', 'ATTENTION', 'BLOCKED', 'UNVERIFIED']),
		cache: z
			.object({
				state: z.enum(['fresh', 'stale-fallback']),
				refreshAfter: isoDate,
			})
			.strict(),
		source: z
			.object({
				branch: z
					.string()
					.max(128)
					.regex(/^[A-Za-z0-9._/-]+$/)
					.nullable(),
				commitShaShort: z
					.string()
					.regex(/^[0-9a-f]{7,12}$/i)
					.nullable(),
				workingTreeDirty: z.boolean().nullable(),
			})
			.strict(),
		health: z
			.object({
				environments: healthCounts,
				invitations: healthCounts,
				migrations: healthCounts,
				assets: healthCounts,
				validations: healthCounts,
			})
			.strict(),
		issues: z
			.array(
				z
					.object({
						id: z.string().min(1).max(160),
						code: issueCode,
						severity: z.enum(['blocking', 'warning', 'unverified']),
						domain: z.enum([
							'environment',
							'invitation',
							'migration',
							'asset',
							'validation',
							'source',
							'data_quality',
						]),
						scope: z.string().min(1).max(120),
						title: z.string().min(1).max(160),
						description: z.string().min(1).max(240),
						environment: z.enum(['local', 'preview', 'production']).optional(),
						slug: z
							.string()
							.regex(/^[a-z0-9-]{1,100}$/)
							.optional(),
						actionIds: z.array(z.string().min(1).max(120)).max(3),
					})
					.strict(),
			)
			.max(200),
		validationEvidence: z
			.array(
				z
					.object({
						type: z.enum(['regression', 'screenshots']),
						freshness: z.enum(['PASS', 'FAIL', 'STALE', 'NOT_RUN', 'INVALID']),
						completedAt: isoDate.nullable(),
						passed: z.number().int().nonnegative().nullable(),
						total: z.number().int().nonnegative().nullable(),
					})
					.strict(),
			)
			.length(2),
		recommendedActions: z
			.array(
				z
					.object({
						id: z.string().min(1).max(120),
						label: z.string().min(1).max(100),
						command: safeCommand,
						reason: z.string().min(1).max(200),
					})
					.strict(),
			)
			.max(100),
	})
	.strict();
