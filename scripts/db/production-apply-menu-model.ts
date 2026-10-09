/**
 * Pure menu model for the interactive pnpm prod:apply flow.
 *
 * Menu selections are translated into the same public flags the CLI parser accepts, so the
 * interactive path can never reach a scope the flag path would reject. No I/O, no prompts.
 */
import { mutationItemsOf, type ProductionApplyPlan } from './production-apply-plan.ts';

export type ProductionApplyScopeKind =
	'inspect_all' | 'schema' | 'invitations' | 'all_ready' | 'patch' | 'image_namespace';

export interface ProductionApplySelection {
	kind: ProductionApplyScopeKind;
	slugs?: readonly string[];
	expectedPin?: readonly string[];
	patchFile?: string;
	ownerUserId?: string;
	imageManifestPath?: string;
	imageRollback?: boolean;
	acknowledgeDiscardUnpublishedDraft?: boolean;
	apply?: boolean;
	json?: boolean;
}

export type ProductionApplyRootAction = ProductionApplyScopeKind | 'json' | 'exit';

export interface ProductionApplyMenuItem<T extends string> {
	value: T;
	label: string;
	hint?: string;
	danger?: boolean;
}

export function shouldOpenProductionApplyMenu(
	args: readonly string[],
	interactive: boolean,
): boolean {
	return interactive && args.filter((arg) => arg !== '--').length === 0;
}

/** Root menu: read-only planning first, rare scopes last, apply never here. */
export function productionApplyRootMenu(): {
	items: ProductionApplyMenuItem<ProductionApplyRootAction>[];
	initial: ProductionApplyRootAction;
} {
	return {
		initial: 'inspect_all',
		items: [
			{
				value: 'inspect_all',
				label: 'Plan everything (read-only)',
				hint: 'Schema + every registry invitation; no writes',
			},
			{ value: 'schema', label: 'Plan schema only', hint: 'Pending migrations (--schema)' },
			{
				value: 'invitations',
				label: 'Plan invitation(s)…',
				hint: 'Pick slugs from the registry (--slug / --slugs)',
			},
			{
				value: 'all_ready',
				label: 'Plan all READY',
				hint: 'READY schema + READY invitations; never discards drafts (--all-ready)',
			},
			{
				value: 'patch',
				label: 'Specialized SQL patch…',
				hint: 'Reviewed manifest patch file (--patch)',
			},
			{
				value: 'image_namespace',
				label: 'Image namespace migration / rollback…',
				hint: 'Reviewed manifest (--image-namespace / --image-namespace-rollback)',
			},
			{
				value: 'json',
				label: 'Print plan JSON',
				hint: 'Secret-free inspect-all plan (--json)',
			},
			{ value: 'exit', label: 'Exit' },
		],
	};
}

/** Public flags equivalent to a menu selection (consumed by parseProductionApplyCliArgs). */
export function argvFromSelection(selection: ProductionApplySelection): string[] {
	const argv: string[] = [];
	switch (selection.kind) {
		case 'schema':
			argv.push('--schema');
			break;
		case 'invitations':
			if (selection.slugs && selection.slugs.length > 0)
				argv.push('--slugs', selection.slugs.join(','));
			break;
		case 'all_ready':
			argv.push('--all-ready');
			break;
		case 'patch':
			if (selection.patchFile) argv.push('--patch', selection.patchFile);
			break;
		case 'image_namespace':
			if (selection.imageManifestPath)
				argv.push(
					selection.imageRollback ? '--image-namespace-rollback' : '--image-namespace',
					selection.imageManifestPath,
				);
			break;
		case 'inspect_all':
			break;
	}
	if (selection.expectedPin && selection.expectedPin.length > 0)
		argv.push('--expected', selection.expectedPin.join(','));
	if (selection.acknowledgeDiscardUnpublishedDraft)
		argv.push('--acknowledge-discard-unpublished-draft');
	if (selection.ownerUserId) argv.push('--owner-user-id', selection.ownerUserId);
	if (selection.apply) argv.push('--apply');
	if (selection.json) argv.push('--json');
	return argv;
}

export function describeSelection(selection: ProductionApplySelection): string {
	switch (selection.kind) {
		case 'inspect_all':
			return 'everything (inspection)';
		case 'schema':
			return selection.expectedPin?.length
				? `schema (pinned: ${selection.expectedPin.join(', ')})`
				: 'schema';
		case 'invitations': {
			const slugs = selection.slugs ?? [];
			return slugs.length === 1 ? `invitation ${slugs[0]}` : `${slugs.length} invitations`;
		}
		case 'all_ready':
			return 'all READY items';
		case 'patch':
			return `patch ${selection.patchFile ?? ''}`.trim();
		case 'image_namespace':
			return `${selection.imageRollback ? 'image namespace rollback' : 'image namespace migration'} ${selection.imageManifestPath ?? ''}`.trim();
	}
}

export interface ProductionApplyOffer {
	label: string;
	selection: ProductionApplySelection;
}

function invitationOffer(slug: string): ProductionApplyOffer {
	return { label: `Apply ${slug}`, selection: { kind: 'invitations', slugs: [slug] } };
}

/** The only apply offer for an image namespace manifest (its own owner gate runs inside). */
export function imageNamespaceOffer(selection: ProductionApplySelection): ProductionApplyOffer {
	return {
		label: selection.imageRollback ? 'Roll back images' : 'Migrate images',
		selection: { ...selection, apply: true },
	};
}

/**
 * Apply options derived from a reviewed plan. Every offer is a danger item for the caller.
 * Inspect-all plans narrow to concrete scopes; scoped plans offer their own scope once.
 */
export function applyOffersFromPlan(
	plan: ProductionApplyPlan,
	selection: ProductionApplySelection,
): ProductionApplyOffer[] {
	const offers: ProductionApplyOffer[] = [];
	const visible = plan.items.filter((item) => item.readiness !== 'NOT_APPLICABLE');
	const schemaReady = visible.some(
		(item) => item.domain === 'schema' && item.readiness === 'READY',
	);
	const readyInvitations = visible.filter(
		(item) => item.domain === 'invitation' && item.readiness === 'READY',
	);

	if (selection.kind === 'inspect_all') {
		const mutations = mutationItemsOf({ ...plan, scope: { ...plan.scope, allReady: true } });
		if (mutations.length > 0) {
			const ids = mutations.map((item) => item.id);
			const detail = ids.length <= 3 ? ids.join(', ') : `${ids.length} items`;
			offers.push({
				label: `Apply all READY (${detail})`,
				selection: { kind: 'all_ready' },
			});
		}
		if (schemaReady) offers.push({ label: 'Apply schema only', selection: { kind: 'schema' } });
		// READY_AFTER_SCHEMA invitations have no narrower scope than "Apply all READY".
		for (const item of readyInvitations) offers.push(invitationOffer(item.id));
	} else if (selection.kind === 'image_namespace') {
		return [imageNamespaceOffer(selection)];
	} else if (mutationItemsOf(plan).length > 0) {
		offers.push({
			label: `Apply ${describeSelection(selection)}`,
			selection: { ...selection },
		});
	}
	return offers;
}

export function summarizePlanRows(plan: ProductionApplyPlan): Array<readonly [string, string]> {
	const visible = plan.items.filter((item) => item.readiness !== 'NOT_APPLICABLE');
	const count = (readiness: string): number =>
		visible.filter((item) => item.readiness === readiness).length;
	const mutations = mutationItemsOf(plan);
	return [
		['Scope', plan.scope.inspectAll ? 'everything (inspection)' : describeScope(plan)],
		['Mutations', String(mutations.length)],
		[
			'Ready',
			String(count('READY') + count('READY_AFTER_SCHEMA') + count('READY_AFTER_DISCARD')),
		],
		['In sync', String(count('IN_SYNC'))],
		['Blocked', String(count('BLOCKED'))],
		['Unknown', String(count('UNKNOWN'))],
		['Plan', plan.planId.slice(0, 8)],
	];
}

function describeScope(plan: ProductionApplyPlan): string {
	if (plan.scope.allReady) return 'all READY';
	const parts: string[] = [];
	if (plan.scope.schema) parts.push('schema');
	if (plan.scope.slugs.length > 0) parts.push(plan.scope.slugs.join(', '));
	if (plan.scope.patchFile) parts.push(`patch ${plan.scope.patchFile}`);
	return parts.join(' + ') || 'none';
}
