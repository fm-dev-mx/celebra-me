import { describe, expect, it } from '@jest/globals';
import { parseProductionApplyCliArgs } from '../../scripts/db/production-apply-cli-args.ts';
import {
	applyOffersFromPlan,
	argvFromSelection,
	describeSelection,
	imageNamespaceOffer,
	productionApplyRootMenu,
	shouldOpenProductionApplyMenu,
	summarizePlanRows,
	type ProductionApplySelection,
} from '../../scripts/db/production-apply-menu-model.ts';
import {
	assembleProductionApplyPlan,
	type ProductionApplyPlanItem,
} from '../../scripts/db/production-apply-plan.ts';

function parse(selection: ProductionApplySelection) {
	return parseProductionApplyCliArgs(['node', 'prod-apply', ...argvFromSelection(selection)]);
}

function plan(
	items: ProductionApplyPlanItem[],
	scope: Partial<Parameters<typeof assembleProductionApplyPlan>[0]> = {},
) {
	return assembleProductionApplyPlan(
		{ schema: true, slugs: [], allReady: false, inspectAll: true, ...scope },
		items,
	);
}

const schemaReady: ProductionApplyPlanItem = {
	domain: 'schema',
	id: 'schema',
	readiness: 'READY',
	summary: 'Pendientes: 20260901000000',
	binding: 'plan-schema',
	pendingVersions: ['20260901000000'],
};
const schemaInSync: ProductionApplyPlanItem = {
	...schemaReady,
	readiness: 'IN_SYNC',
	summary: 'Sin migraciones pendientes',
	pendingVersions: [],
};
const invitationReady: ProductionApplyPlanItem = {
	domain: 'invitation',
	id: 'victoria-y-roberto',
	readiness: 'READY',
	summary: 'READY',
	binding: 'pkg-1',
};
const invitationAfterSchema: ProductionApplyPlanItem = {
	...invitationReady,
	id: 'daniela-y-martin',
	readiness: 'READY_AFTER_SCHEMA',
};
const invitationDiscard: ProductionApplyPlanItem = {
	...invitationReady,
	id: 'aithan-darell',
	readiness: 'READY_AFTER_DISCARD',
};
const invitationBlocked: ProductionApplyPlanItem = {
	...invitationReady,
	id: 'blocked-one',
	readiness: 'BLOCKED',
	blockCode: 'SCHEMA_INCOMPATIBLE',
};

describe('prod:apply menu model', () => {
	it('opens the menu only on an interactive session without flags', () => {
		expect(shouldOpenProductionApplyMenu([], true)).toBe(true);
		expect(shouldOpenProductionApplyMenu(['--'], true)).toBe(true);
		expect(shouldOpenProductionApplyMenu([], false)).toBe(false);
		expect(shouldOpenProductionApplyMenu(['--schema'], true)).toBe(false);
	});

	it('puts read-only planning first and never offers apply at the root', () => {
		const root = productionApplyRootMenu();
		expect(root.initial).toBe('inspect_all');
		expect(root.items[0]?.value).toBe('inspect_all');
		expect(root.items.at(-1)?.value).toBe('exit');
		expect(root.items.some((item) => item.label.toLowerCase().includes('apply'))).toBe(false);
	});

	it('translates selections into flags the CLI parser accepts', () => {
		expect(parse({ kind: 'inspect_all' })).toMatchObject({ inspectAll: true, apply: false });
		expect(parse({ kind: 'schema', expectedPin: ['20260901000000'] })).toMatchObject({
			schema: true,
			expectedPin: ['20260901000000'],
		});
		expect(parse({ kind: 'invitations', slugs: ['b', 'a'] })).toMatchObject({
			slugs: ['b', 'a'],
			schema: false,
		});
		expect(parse({ kind: 'all_ready' })).toMatchObject({ allReady: true, schema: true });
		expect(parse({ kind: 'patch', patchFile: 'x.sql', ownerUserId: 'uuid' })).toMatchObject({
			patchFile: 'x.sql',
			ownerUserId: 'uuid',
		});
		expect(
			parse({ kind: 'image_namespace', imageManifestPath: 'm.json', imageRollback: true }),
		).toMatchObject({ imageManifestPath: 'm.json', imageRollback: true });
		expect(
			parse({
				kind: 'invitations',
				slugs: ['a'],
				acknowledgeDiscardUnpublishedDraft: true,
				apply: true,
			}),
		).toMatchObject({ acknowledgeDiscardUnpublishedDraft: true, apply: true });
	});

	it('keeps the parser invariants (no apply without scope, no discard outside slug scope)', () => {
		expect(() => parse({ kind: 'inspect_all', apply: true })).toThrow(/SCOPE_REQUIRED/);
		expect(() => parse({ kind: 'schema', acknowledgeDiscardUnpublishedDraft: true })).toThrow(
			/requires an explicit --slug/,
		);
	});

	it('derives apply offers from an inspect-all plan without preselecting any', () => {
		const offers = applyOffersFromPlan(
			plan([
				schemaReady,
				invitationReady,
				invitationAfterSchema,
				invitationDiscard,
				invitationBlocked,
			]),
			{ kind: 'inspect_all' },
		);
		const labels = offers.map((offer) => offer.label);
		expect(labels[0]).toMatch(/^Apply all READY/);
		expect(labels).toContain('Apply schema only');
		expect(labels).toContain('Apply victoria-y-roberto');
		// READY_AFTER_SCHEMA is covered by "Apply all READY"; no misleading per-slug offer.
		expect(labels[0]).toContain('daniela-y-martin');
		expect(labels.filter((label) => label.includes('daniela-y-martin'))).toHaveLength(1);
		// Discard readiness only exists in an explicit --slug plan that already carries the
		// acknowledgement, so inspect-all never offers a per-slug discard.
		expect(labels.some((label) => label.includes('discarding'))).toBe(false);
		expect(labels.some((label) => label.includes('blocked-one'))).toBe(false);
	});

	it('offers a scoped plan once and nothing when there is no mutation', () => {
		const scoped = applyOffersFromPlan(plan([schemaReady], { inspectAll: false, slugs: [] }), {
			kind: 'schema',
		});
		expect(scoped.map((offer) => offer.label)).toEqual(['Apply schema']);
		const empty = applyOffersFromPlan(plan([schemaInSync], { inspectAll: false, slugs: [] }), {
			kind: 'schema',
		});
		expect(empty).toEqual([]);
	});

	it('describes selections and summarizes plans for the result block', () => {
		expect(describeSelection({ kind: 'invitations', slugs: ['a', 'b'] })).toBe('2 invitations');
		expect(describeSelection({ kind: 'patch', patchFile: 'p.sql' })).toBe('patch p.sql');
		expect(imageNamespaceOffer({ kind: 'image_namespace', imageRollback: true }).label).toBe(
			'Roll back images',
		);
		const rows = summarizePlanRows(plan([schemaReady, invitationBlocked]));
		expect(rows.find(([label]) => label === 'Mutations')?.[1]).toBe('1');
		expect(rows.find(([label]) => label === 'Blocked')?.[1]).toBe('1');
	});
});
