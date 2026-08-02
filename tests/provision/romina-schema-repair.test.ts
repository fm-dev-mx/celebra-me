import { describe, expect, it } from '@jest/globals';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { buildRominaSchemaRepairPlan } from '../../scripts/provision/romina-schema-repair.ts';

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
});
