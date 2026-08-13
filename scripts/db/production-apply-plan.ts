/**
 * Pure Production apply plan types, fingerprinting, and readiness classification.
 * No database I/O, credentials, or side effects.
 */
import { createHash } from 'node:crypto';
import type { UpdateScope } from '../provision/semantic-delta.ts';
import type { PromotionPreflightReport } from '../provision/invitation-promote.ts';

export type ProductionApplyReadiness =
	'READY' | 'READY_AFTER_SCHEMA' | 'IN_SYNC' | 'BLOCKED' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type ProductionApplyDomain = 'schema' | 'invitation' | 'patch';

export type ProductionApplyItemOutcome =
	| 'pending'
	| 'APPLIED_AND_VERIFIED'
	| 'APPLIED_VERIFICATION_FAILED'
	| 'NOT_APPLIED'
	| 'already_applied'
	| 'skipped_out_of_scope'
	| 'blocked'
	| 'unknown';

export interface ProductionApplyScope {
	schema: boolean;
	slugs: readonly string[];
	allReady: boolean;
	patchFile?: string;
	/** True when the operator passed no scope flags (read-only inspection). */
	inspectAll: boolean;
}

export interface ProductionApplyPlanItem {
	domain: ProductionApplyDomain;
	id: string;
	readiness: ProductionApplyReadiness;
	summary: string;
	detail?: string;
	blockCode?: string;
	/** Secret-free identity used in the plan fingerprint. */
	binding?: string;
	pendingVersions?: readonly string[];
	packageHash?: string;
	updateScope?: UpdateScope;
	/** In-process only; stripped from public JSON. Not part of planId. */
	preflight?: PromotionPreflightReport;
}

export interface ProductionApplyPlan {
	planId: string;
	scope: ProductionApplyScope;
	items: ProductionApplyPlanItem[];
}

const PLAN_ID_VERSION = 2;

function isMutationReadiness(readiness: ProductionApplyReadiness): boolean {
	return readiness === 'READY' || readiness === 'READY_AFTER_SCHEMA';
}

export function mutationItemsOf(plan: ProductionApplyPlan): ProductionApplyPlanItem[] {
	return plan.items.filter((item) => {
		if (!isMutationReadiness(item.readiness)) return false;
		if (plan.scope.allReady && item.domain === 'patch') return false;
		return true;
	});
}

export function buildProductionApplyPlanId(items: readonly ProductionApplyPlanItem[]): string {
	const mutation = items
		.filter((item) => isMutationReadiness(item.readiness))
		.map((item) => ({
			domain: item.domain,
			id: item.id,
			binding: item.binding ?? '',
			updateScope: item.updateScope ?? '',
		}))
		.sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id));
	return createHash('sha256')
		.update(JSON.stringify({ v: PLAN_ID_VERSION, mutation }))
		.digest('hex');
}

export function assembleProductionApplyPlan(
	scope: ProductionApplyScope,
	items: readonly ProductionApplyPlanItem[],
): ProductionApplyPlan {
	const planItems = [...items];
	return {
		planId: buildProductionApplyPlanId(planItems),
		scope,
		items: planItems,
	};
}

export function classifySchemaPreflight(input: {
	pendingVersions: readonly string[];
	compatibilityStatus?: string;
}): ProductionApplyReadiness {
	if (input.compatibilityStatus && input.compatibilityStatus !== 'allow') {
		return 'BLOCKED';
	}
	const pending = input.pendingVersions.filter((version) => version !== 'none');
	return pending.length === 0 ? 'IN_SYNC' : 'READY';
}

export function classifySchemaError(error: unknown): {
	readiness: ProductionApplyReadiness;
	blockCode: string;
	detail: string;
} {
	const code =
		error && typeof error === 'object' && 'code' in error
			? String((error as { code?: string }).code ?? 'SCHEMA_PREFLIGHT_FAILED')
			: 'SCHEMA_PREFLIGHT_FAILED';
	const detail = error instanceof Error ? error.message : String(error);
	if (
		/PROD_DB_URL is required/i.test(detail) ||
		/UNREACHABLE|ECONNREFUSED|CREDENTIALS/i.test(detail) ||
		code === 'PRODUCTION_CREDENTIALS_UNAVAILABLE'
	) {
		return { readiness: 'UNKNOWN', blockCode: code, detail };
	}
	return { readiness: 'BLOCKED', blockCode: code, detail };
}

export function classifyInvitationPreflight(input: {
	status: string;
	blockCode?: string;
	schemaState?: string;
	schemaReadyInPlan: boolean;
}): ProductionApplyReadiness {
	if (input.status === 'PROMOTABLE') return 'READY';
	if (input.status === 'IN_SYNC') return 'IN_SYNC';
	if (
		input.status === 'BLOCKED' &&
		input.blockCode === 'SCHEMA_INCOMPATIBLE' &&
		input.schemaReadyInPlan
	) {
		return 'READY_AFTER_SCHEMA';
	}
	if (
		input.blockCode === 'PRODUCTION_CREDENTIALS_UNAVAILABLE' ||
		input.schemaState === 'UNVERIFIED'
	) {
		return 'UNKNOWN';
	}
	return 'BLOCKED';
}

/**
 * Explicit selected items that are BLOCKED or UNKNOWN must fail apply.
 * --all-ready omits BLOCKED from mutation but refuses UNKNOWN.
 */
export function evaluateApplyEligibility(
	plan: ProductionApplyPlan,
): { ok: true } | { ok: false; code: string; detail: string } {
	if (plan.scope.inspectAll) {
		return {
			ok: false,
			code: 'SCOPE_REQUIRED',
			detail: '--apply requires an explicit scope (--schema, --slug/--slugs, --all-ready, or --patch). No arguments never apply.',
		};
	}

	const unknown = plan.items.filter((item) => item.readiness === 'UNKNOWN');
	const blocked = plan.items.filter((item) => item.readiness === 'BLOCKED');

	if (unknown.length > 0) {
		return {
			ok: false,
			code: 'UNKNOWN_NOT_APPLICABLE',
			detail: unknown.map((item) => `${item.id}:${item.blockCode ?? 'UNKNOWN'}`).join('; '),
		};
	}

	if (!plan.scope.allReady && blocked.length > 0) {
		return {
			ok: false,
			code: 'BLOCKED_NOT_APPLICABLE',
			detail: blocked.map((item) => `${item.id}:${item.blockCode ?? 'BLOCKED'}`).join('; '),
		};
	}

	return { ok: true };
}

export function productionApplyHandoff(plan: ProductionApplyPlan): string {
	const mutations = mutationItemsOf(plan);
	const schema = mutations.filter((item) => item.domain === 'schema').length;
	const invitations = mutations.filter((item) => item.domain === 'invitation').length;
	const patch = mutations.filter((item) => item.domain === 'patch').length;
	const parts: string[] = [];
	if (schema > 0) parts.push(`${schema} schema migration`);
	if (invitations > 0) parts.push(`${invitations} invitation${invitations === 1 ? '' : 's'}`);
	if (patch > 0) parts.push(`${patch} specialized patch`);
	if (parts.length === 0) {
		return 'Production ready: none. Owner apply not required.';
	}
	return `Production ready: ${parts.join(' + ')}. Owner apply required.`;
}
