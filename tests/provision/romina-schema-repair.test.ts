import { describe, expect, it } from '@jest/globals';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import {
	buildRominaSchemaRepairPlan,
	buildRominaSchemaRepairReplayIdentity,
	isRominaSchemaRepairApplied,
	verifyRominaSchemaRepairOutcome,
} from '../../scripts/provision/romina-schema-repair.ts';
import { buildRominaSchemaRepairTransactionSql } from '../../scripts/provision/romina-schema-repair-service.ts';

function fixture(): {
	draftContent: Record<string, unknown>;
	publishedContent: Record<string, unknown>;
} {
	const assets = Object.fromEntries(
		ROMINA_ASSET_SPECS.map((asset, index) => [
			asset.key,
			{
				type: 'uploaded',
				assetId: `__INVITATION_ASSET_KEY__:${asset.key}-${index}`,
				src: `/assets/${asset.relativePath}`,
			},
		]),
	) as RominaAssetMap;
	const publishedContent = buildRominaPublishedContent(assets);
	const location = publishedContent.location as Record<string, unknown>;
	const ceremony = location.ceremony as Record<string, unknown>;
	const reception = location.reception as Record<string, unknown>;
	location.venues = [
		{ ...ceremony, type: 'ceremony', label: 'Ceremonia' },
		{ ...reception, type: 'reception', label: 'Recepción' },
	];
	const draftContent = JSON.parse(JSON.stringify(publishedContent)) as Record<string, unknown>;
	const venues = (draftContent.location as Record<string, unknown>).venues as Record<
		string,
		unknown
	>[];
	delete venues[0]!.venueEvent;
	delete venues[1]!.venueEvent;
	const family = draftContent.family as Record<string, unknown>;
	family.godparents = 'Fernando Nájera\nEsmeralda Carbajal';
	return { draftContent, publishedContent };
}

describe('Romina schema repair planner', () => {
	it('builds a deterministic, three-field, no-write repair plan', () => {
		const input = fixture();
		const first = buildRominaSchemaRepairPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});
		const second = buildRominaSchemaRepairPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});

		expect(first).toEqual(second);
		expect(first.writes).toBe(0);
		expect(first.changedPaths).toEqual([
			'family.godparents',
			'location.venues[0].venueEvent',
			'location.venues[1].venueEvent',
		]);
		expect(first.before.venueEvents).toEqual([undefined, undefined]);
		expect(first.after.venueEvents).toEqual(['Ceremonia', 'Recepción']);
		expect(first.after.godparents).toEqual([
			{ name: 'Fernando Nájera' },
			{ name: 'Esmeralda Carbajal' },
		]);
		expect(first.hashes.unrelatedBefore).toBe(first.hashes.unrelatedAfter);
		expect(first.executionContract.validateBeforeWrite).toBe(true);
	});

	it('blocks a wrong slug and semantic godparent mismatch', () => {
		const input = fixture();
		expect(() =>
			buildRominaSchemaRepairPlan({
				slug: 'abril-michelle-becerra-rea',
				...input,
				draftStatus: 'approved',
				draftUpdatedAt: null,
				publishedVersion: 10,
			}),
		).toThrow('ROMINA_REPAIR_SCOPE_BLOCKED');

		(input.draftContent.family as Record<string, unknown>).godparents = 'Persona distinta';
		expect(() =>
			buildRominaSchemaRepairPlan({
				slug: 'romina-rios-chaparro',
				...input,
				draftStatus: 'approved',
				draftUpdatedAt: null,
				publishedVersion: 10,
			}),
		).toThrow('ROMINA_REPAIR_SEMANTIC_MISMATCH');
	});

	it('describes guarded receipts and verifies the complete repaired document', () => {
		const input = fixture();
		const plan = buildRominaSchemaRepairPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});
		const repaired = JSON.parse(JSON.stringify(input.draftContent)) as Record<string, unknown>;
		const location = repaired.location as Record<string, unknown>;
		const venues = location.venues as Record<string, unknown>[];
		venues[0]!.venueEvent = plan.after.venueEvents[0];
		venues[1]!.venueEvent = plan.after.venueEvents[1];
		(repaired.family as Record<string, unknown>).godparents = plan.after.godparents;

		verifyRominaSchemaRepairOutcome(plan, repaired);
		const sql = buildRominaSchemaRepairTransactionSql({
			plan,
			draftContent: input.draftContent,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			targetDbUrl: 'postgresql://production.example.invalid/db',
		});
		expect(plan.affectedTables).toEqual([
			'invitation_content_drafts',
			'production_authorization_receipts',
			'invitation_mutation_operation_receipts',
		]);
		expect(plan.provenanceAndReceipts.managedReleaseProvenance).toBe('unchanged');
		expect(sql).toContain('BEGIN;');
		expect(sql).toContain("'romina_schema_repair'");
		expect(sql).toContain('ROMINA_REPAIR_STALE_DRAFT');
		expect(sql).toContain('invitation_mutation_operation_receipts');
	});

	it('derives a durable replay identity only after the canonical fields are applied', () => {
		const input = fixture();
		const plan = buildRominaSchemaRepairPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});
		const repaired = JSON.parse(JSON.stringify(input.draftContent)) as Record<string, unknown>;
		const location = repaired.location as Record<string, unknown>;
		const venues = location.venues as Record<string, unknown>[];
		venues[0]!.venueEvent = plan.after.venueEvents[0];
		venues[1]!.venueEvent = plan.after.venueEvents[1];
		(repaired.family as Record<string, unknown>).godparents = plan.after.godparents;

		expect(
			isRominaSchemaRepairApplied({
				slug: 'romina-rios-chaparro',
				draftContent: input.draftContent,
				publishedContent: input.publishedContent,
			}),
		).toBe(false);
		expect(
			isRominaSchemaRepairApplied({
				slug: 'romina-rios-chaparro',
				draftContent: repaired,
				publishedContent: input.publishedContent,
			}),
		).toBe(true);

		const identity = buildRominaSchemaRepairReplayIdentity({
			slug: 'romina-rios-chaparro',
			draftContent: repaired,
			publishedContent: input.publishedContent,
			publishedVersion: 10,
		});
		const repeated = buildRominaSchemaRepairReplayIdentity({
			slug: 'romina-rios-chaparro',
			draftContent: repaired,
			publishedContent: input.publishedContent,
			publishedVersion: 10,
		});

		expect(identity).toEqual(repeated);
		expect(identity.afterHash).toBe(plan.hashes.after);
		expect(() =>
			buildRominaSchemaRepairReplayIdentity({
				slug: 'abril-michelle-becerra-rea',
				draftContent: repaired,
				publishedContent: input.publishedContent,
				publishedVersion: 10,
			}),
		).toThrow('ROMINA_REPAIR_REPLAY_NOT_APPLIED');
	});
});
