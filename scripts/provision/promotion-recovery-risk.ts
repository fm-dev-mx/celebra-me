import type { AssetPolicy } from './asset-reconciliation.ts';
import type { PromotionPreflightReport } from './invitation-promote.ts';
import type { UpdateScope } from './semantic-delta.ts';

export interface PromotionRecoveryRiskInput {
	reviewed: PromotionPreflightReport;
	updateScope?: UpdateScope;
	deliveryScope?: string;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
}

export interface PromotionRecoveryRisk {
	level: 'routine' | 'critical';
	reasons: string[];
}

const MUTATING_ACTIONS = new Set(['create', 'replace', 'delete']);
const KNOWN_ACTIONS = new Set(['create', 'replace', 'reuse', 'skip', 'delete']);
const KNOWN_FUNCTIONAL_OPERATIONS = new Set([
	'insert',
	'update',
	'delete',
	'move',
	'upload',
	'overwrite',
	'reuse',
	'repair_metadata',
	'skip',
]);
const KNOWN_RESOURCES = new Set([
	'auth_host',
	'event_memberships',
	'events',
	'invitation',
	'invitation_assets',
	'invitation_content_drafts',
	'invitations',
	'managed_invitation_release_provenance',
	'published_invitation_content',
]);

function resolvedScope(input: PromotionRecoveryRiskInput): UpdateScope | undefined {
	const scope = input.updateScope ?? input.deliveryScope;
	return scope === 'content-only' || scope === 'content-and-assets' || scope === 'assets-only'
		? scope
		: undefined;
}

/**
 * Selects recovery coverage from the already-reviewed mutation plan.
 *
 * Unknown inputs and classifier failures deliberately require the full critical
 * backup. Routine recovery relies on managed provenance/preimage evidence when
 * the reviewed plan has no asset overwrite/delete/prune, auth/identity create,
 * or other destructive signals — including `content-and-assets` plans whose
 * Storage ops are zero (scope label alone is not risk).
 */
// eslint-disable-next-line complexity -- Recovery classification intentionally evaluates every fail-closed risk signal in one pure decision.
export function classifyPromotionRecoveryRisk(
	input: PromotionRecoveryRiskInput,
): PromotionRecoveryRisk {
	try {
		const plan = input.reviewed.engineResult?.plan;
		const actions = input.reviewed.engineResult?.actions;
		const scope = resolvedScope(input);
		if (!plan || !Array.isArray(actions)) {
			return {
				level: 'critical',
				reasons: ['unclassifiable-plan'],
			};
		}

		const reasons = new Set<string>();
		if (!scope) reasons.add('unclassifiable-scope');
		if (input.pruneAssets === true) reasons.add('asset-prune-requested');

		for (const action of actions) {
			if (
				typeof action?.resource !== 'string' ||
				typeof action?.action !== 'string' ||
				typeof action?.name !== 'string'
			) {
				reasons.add('unclassifiable-action');
				continue;
			}
			if (!KNOWN_ACTIONS.has(action.action)) {
				reasons.add(`unclassifiable-action:${action.action}`);
				continue;
			}
			if (!MUTATING_ACTIONS.has(action.action)) continue;
			if (!KNOWN_RESOURCES.has(action.resource)) {
				reasons.add(`unclassifiable-resource:${action.resource}`);
				continue;
			}
			if (action.resource === 'auth_host' || action.resource.includes('identity')) {
				reasons.add('auth-or-identity-change');
			}
			if (action.resource === 'invitation' && action.action === 'create') {
				reasons.add('invitation-identity-create');
			}
			if (
				action.resource === 'invitation_assets' &&
				(action.action === 'create' ||
					action.action === 'replace' ||
					action.action === 'delete')
			) {
				reasons.add(`asset-${action.action}`);
			}
			if (action.action === 'delete' && action.resource !== 'invitation_assets') {
				reasons.add(`destructive-metadata:${action.resource}`);
			}
		}

		if (
			plan.functionalChanges.some((change) =>
				/(^|\.)(slug|eventType|managedIdentityId|createdBy|ownerUserId)$/i.test(
					change.field ?? '',
				),
			)
		) {
			reasons.add('invitation-identity-change');
		}
		if (
			plan.functionalChanges.some(
				(change) => !KNOWN_FUNCTIONAL_OPERATIONS.has(change.operation),
			)
		) {
			reasons.add('unclassifiable-functional-change');
		}
		if (plan.storageOps.uploads > 0) reasons.add('asset-upload');
		if (plan.storageOps.overwrites > 0) reasons.add('asset-overwrite');
		if (plan.storageOps.deletes > 0) reasons.add('asset-delete');
		if (
			(input.assetPolicy === 'sync' || input.assetPolicy === 'missing') &&
			(input.pruneAssets === true ||
				plan.storageOps.overwrites > 0 ||
				plan.storageOps.deletes > 0)
		) {
			reasons.add(`asset-policy-${input.assetPolicy}-with-destructive-intent`);
		}

		if (reasons.size > 0) {
			return { level: 'critical', reasons: [...reasons] };
		}
		return {
			level: 'routine',
			reasons: [
				scope === 'content-only'
					? 'content-only-managed-preimage-recovery'
					: 'managed-content-preimage-recovery-no-asset-mutations',
			],
		};
	} catch {
		return {
			level: 'critical',
			reasons: ['recovery-risk-classification-error'],
		};
	}
}
