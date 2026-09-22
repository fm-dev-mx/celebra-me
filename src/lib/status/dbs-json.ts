import { z } from 'zod';
import type { OperationalActionPlan } from './action-plan';
import { CanonicalStatusViewSchema } from './schema';
import type { CanonicalStatusView, TargetEnv } from './types';
import type { MediaReferencesStatus } from './media-reference-types';

export type DbsStatusJson = CanonicalStatusView & {
	operationalPlan: OperationalActionPlan;
	mediaReferences?: MediaReferencesStatus;
	excludedTargets?: TargetEnv[];
};

const actionStep = z
	.object({
		type: z.enum(['Diagnose', 'Verify', 'Plan', 'Apply', 'Manual/HITL']),
		label: z.string().min(1).max(120),
		command: z.string().max(1000).nullable(),
		prerequisite: z.string().max(500).nullable(),
		requiresOwner: z.boolean(),
		optional: z.boolean(),
	})
	.strict();

const operationalPlan = z
	.object({
		health: z
			.object({
				status: z.enum(['GREEN', 'ACTION_REQUIRED', 'UNVERIFIED']),
				label: z.string().min(1).max(120),
				summary: z.string().min(1).max(500),
				applicableChecks: z.number().int().nonnegative(),
				unresolvedChecks: z.number().int().nonnegative(),
			})
			.strict(),
		actions: z
			.array(
				z
					.object({
						id: z.string().min(1).max(200),
						domain: z.enum([
							'schema',
							'readiness',
							'authorization',
							'evidence',
							'publication',
							'patch',
							'disposable',
							'media',
						]),
						title: z.string().min(1).max(240),
						summary: z.string().max(500),
						semantic: z.enum(['verified', 'unverified', 'blocked', 'neutral']),
						priority: z.number().int().nonnegative(),
						environments: z.array(z.string().min(1).max(80)).max(3),
						subject: z.string().max(200).nullable(),
						steps: z.array(actionStep).max(20),
						verifyWhen: z.string().min(1).max(500),
						why: z.string().max(1000).nullable(),
						noCanonicalRemediation: z.boolean(),
						deploymentPrerequisite: z.enum(['YES', 'NO', 'UNVERIFIED']),
						deploymentStatus: z.enum([
							'SATISFIED',
							'UNSATISFIED',
							'UNVERIFIED',
							'NOT_APPLICABLE',
						]),
						executionOrder: z.number().int().nonnegative(),
					})
					.strict(),
			)
			.max(500),
	})
	.strict();

const mediaReferenceEnvironmentStatus = z
	.object({
		status: z.enum(['MATCH', 'REFERENCE_DRIFT', 'MISSING_ASSET', 'UNVERIFIED']),
		invitations: z.number().int().nonnegative(),
		references: z.number().int().nonnegative(),
		findings: z.array(
			z
				.object({
					route: z.string(),
					slug: z.string(),
					path: z.string(),
					assetKey: z.string(),
					issue: z.enum(['REFERENCE_DRIFT', 'MISSING_ASSET']),
				})
				.strict(),
		),
	})
	.strict()
	.nullable();

export const DbsStatusJsonSchema = z
	.looseObject({
		operationalPlan,
		mediaReferences: z
			.object({
				preview: mediaReferenceEnvironmentStatus,
				production: mediaReferenceEnvironmentStatus,
			})
			.strict()
			.optional(),
		excludedTargets: z
			.array(z.enum(['local', 'preview', 'production']))
			.max(3)
			.optional(),
	})
	.superRefine((value, ctx) => {
		const {
			operationalPlan: _plan,
			mediaReferences: _media,
			excludedTargets: _excluded,
			...canonical
		} = value;
		const result = CanonicalStatusViewSchema.safeParse(canonical);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({
					code: 'custom',
					path: issue.path,
					message: issue.message,
				});
			}
		}
	});
