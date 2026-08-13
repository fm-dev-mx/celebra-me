import { describe, expect, it } from '@jest/globals';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';
import {
	assembleProductionApplyPlan,
	buildProductionApplyPlanId,
	classifyInvitationPreflight,
	classifySchemaError,
	classifySchemaPreflight,
	evaluateApplyEligibility,
	mutationItemsOf,
	productionApplyHandoff,
	type ProductionApplyPlanItem,
	type ProductionApplyScope,
} from '../../scripts/db/production-apply-plan.ts';

const inspectScope: ProductionApplyScope = {
	schema: true,
	slugs: [],
	allReady: false,
	inspectAll: true,
};

function item(
	overrides: Partial<ProductionApplyPlanItem> & Pick<ProductionApplyPlanItem, 'id' | 'readiness'>,
): ProductionApplyPlanItem {
	return {
		domain: 'invitation',
		summary: overrides.readiness,
		...overrides,
	};
}

describe('production apply plan classification', () => {
	it('classifies schema pending as READY and empty as IN_SYNC', () => {
		expect(
			classifySchemaPreflight({
				pendingVersions: ['20260807120000'],
				compatibilityStatus: 'allow',
			}),
		).toBe('READY');
		expect(
			classifySchemaPreflight({
				pendingVersions: [],
				compatibilityStatus: 'allow',
			}),
		).toBe('IN_SYNC');
		expect(
			classifySchemaPreflight({
				pendingVersions: ['20260807120000'],
				compatibilityStatus: 'block',
			}),
		).toBe('BLOCKED');
	});

	it('classifies invitation PROMOTABLE/IN_SYNC/SCHEMA_INCOMPATIBLE with schema in plan', () => {
		expect(
			classifyInvitationPreflight({
				status: 'PROMOTABLE',
				schemaReadyInPlan: false,
			}),
		).toBe('READY');
		expect(
			classifyInvitationPreflight({
				status: 'IN_SYNC',
				schemaReadyInPlan: false,
			}),
		).toBe('IN_SYNC');
		expect(
			classifyInvitationPreflight({
				status: 'BLOCKED',
				blockCode: 'SCHEMA_INCOMPATIBLE',
				schemaReadyInPlan: true,
			}),
		).toBe('READY_AFTER_SCHEMA');
		expect(
			classifyInvitationPreflight({
				status: 'BLOCKED',
				blockCode: 'SCHEMA_INCOMPATIBLE',
				schemaReadyInPlan: false,
			}),
		).toBe('BLOCKED');
		expect(
			classifyInvitationPreflight({
				status: 'BLOCKED',
				blockCode: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
				schemaReadyInPlan: false,
			}),
		).toBe('UNKNOWN');
		expect(
			classifyInvitationPreflight({
				status: 'BLOCKED',
				schemaState: 'UNVERIFIED',
				schemaReadyInPlan: false,
			}),
		).toBe('UNKNOWN');
	});

	it('does not promote UNKNOWN to READY', () => {
		expect(
			classifyInvitationPreflight({
				status: 'BLOCKED',
				blockCode: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
				schemaReadyInPlan: true,
			}),
		).toBe('UNKNOWN');
	});

	it('classifies missing credentials as UNKNOWN schema evidence', () => {
		expect(classifySchemaError(new Error('PROD_DB_URL is required'))).toMatchObject({
			readiness: 'UNKNOWN',
		});
		expect(
			classifySchemaError(
				new OperatorError({
					title: 'x',
					cause: 'audit failed',
					code: 'PRODUCTION_AUDIT_FAILED',
					remediation: ['fix'],
				}),
			),
		).toMatchObject({ readiness: 'BLOCKED', blockCode: 'PRODUCTION_AUDIT_FAILED' });
	});
});

describe('production apply plan fingerprint and eligibility', () => {
	it('hashes only mutation items so IN_SYNC retries get a new remaining plan', () => {
		const ready = item({
			id: 'alpha',
			readiness: 'READY',
			binding: 'pkg-a',
		});
		const sync = item({
			id: 'schema',
			domain: 'schema',
			readiness: 'IN_SYNC',
			binding: 'schema-plan',
		});
		const withSync = assembleProductionApplyPlan(inspectScope, [sync, ready]);
		const remaining = assembleProductionApplyPlan(inspectScope, [ready]);
		expect(withSync.planId).toBe(remaining.planId);
		expect(buildProductionApplyPlanId([ready, sync])).toBe(buildProductionApplyPlanId([ready]));
	});

	it('keeps --all-ready BLOCKED out of mutation but refuses UNKNOWN', () => {
		const allReadyScope: ProductionApplyScope = {
			schema: true,
			slugs: ['a', 'b'],
			allReady: true,
			inspectAll: false,
		};
		const plan = assembleProductionApplyPlan(allReadyScope, [
			item({ id: 'schema', domain: 'schema', readiness: 'READY', binding: 's' }),
			item({ id: 'a', readiness: 'READY', binding: 'a' }),
			item({ id: 'b', readiness: 'BLOCKED', blockCode: 'MISSING_PREVIEW_APPROVAL' }),
		]);
		expect(mutationItemsOf(plan).map((row) => row.id)).toEqual(['schema', 'a']);
		expect(evaluateApplyEligibility(plan)).toEqual({ ok: true });

		const unknownPlan = assembleProductionApplyPlan(allReadyScope, [
			item({ id: 'schema', domain: 'schema', readiness: 'IN_SYNC' }),
			item({ id: 'a', readiness: 'UNKNOWN', blockCode: 'UNVERIFIED' }),
		]);
		expect(evaluateApplyEligibility(unknownPlan)).toMatchObject({
			ok: false,
			code: 'UNKNOWN_NOT_APPLICABLE',
		});
	});

	it('fails inspect-all apply as SCOPE_REQUIRED', () => {
		const plan = assembleProductionApplyPlan(inspectScope, [
			item({ id: 'alpha', readiness: 'READY', binding: 'a' }),
		]);
		expect(evaluateApplyEligibility(plan)).toMatchObject({
			ok: false,
			code: 'SCOPE_REQUIRED',
		});
	});

	it('fails explicit scope when BLOCKED or UNKNOWN is selected', () => {
		const scope: ProductionApplyScope = {
			schema: false,
			slugs: ['demo'],
			allReady: false,
			inspectAll: false,
		};
		const blocked = assembleProductionApplyPlan(scope, [
			item({ id: 'demo', readiness: 'BLOCKED', blockCode: 'MISSING_PREVIEW_APPROVAL' }),
		]);
		expect(evaluateApplyEligibility(blocked)).toMatchObject({
			ok: false,
			code: 'BLOCKED_NOT_APPLICABLE',
		});
	});

	it('builds an agent handoff from READY mutation counts', () => {
		const plan = assembleProductionApplyPlan(inspectScope, [
			item({
				id: 'schema',
				domain: 'schema',
				readiness: 'READY',
				binding: 's',
				pendingVersions: ['20260807120000'],
			}),
			item({ id: 'alpha', readiness: 'READY', binding: 'a' }),
			item({ id: 'beta', readiness: 'READY', binding: 'b' }),
		]);
		expect(productionApplyHandoff(plan)).toBe(
			'Production ready: 1 schema migration + 2 invitations. Owner apply required.',
		);
	});
});
