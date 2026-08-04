import { describe, expect, it } from '@jest/globals';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import {
	buildRominaDraftResetPlan,
	isRominaDraftResetApplied,
	verifyRominaDraftResetOutcome,
} from '../../scripts/provision/romina-draft-reset.ts';
import { buildRominaDraftResetTransactionSql } from '../../scripts/provision/romina-draft-reset-service.ts';

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
	const draftContent = JSON.parse(JSON.stringify(publishedContent)) as Record<string, unknown>;
	const family = draftContent.family as Record<string, unknown>;
	family.godparents = 'Fernando Nájera\nEsmeralda Carbajal';
	(draftContent as { hero: Record<string, unknown> }).hero.nickname = 'legacy-only';
	return { draftContent, publishedContent };
}

describe('Romina full draft reset planner', () => {
	it('builds a deterministic full-replacement dry-run that discards draft-only paths', () => {
		const input = fixture();
		const plan = buildRominaDraftResetPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});
		expect(plan.writes).toBe(0);
		expect(plan.acknowledgement).toBe('DISCARD_UNPUBLISHED_DRAFT_DIFFERENCES');
		expect(plan.hashes.draftAfter).toBe(plan.hashes.published);
		expect(plan.hashes.draftBefore).not.toBe(plan.hashes.draftAfter);
		expect(plan.changedPaths).toEqual(
			expect.arrayContaining(['family.godparents', 'hero.nickname']),
		);
		expect(plan.provenanceAndReceipts.publishedContent).toBe('unchanged');
	});

	it('verifies semantic equality and describes guarded receipt SQL', () => {
		const input = fixture();
		const plan = buildRominaDraftResetPlan({
			slug: 'romina-rios-chaparro',
			...input,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			publishedVersion: 10,
		});
		verifyRominaDraftResetOutcome(plan, input.publishedContent, input.publishedContent);
		expect(
			isRominaDraftResetApplied({
				slug: 'romina-rios-chaparro',
				draftContent: input.publishedContent,
				publishedContent: input.publishedContent,
			}),
		).toBe(true);
		const sql = buildRominaDraftResetTransactionSql({
			plan,
			draftContent: input.draftContent,
			publishedContent: input.publishedContent,
			draftStatus: 'approved',
			draftUpdatedAt: '2026-07-24T18:31:47.138647+00:00',
			targetDbUrl: 'postgresql://production.example.invalid/db',
		});
		expect(sql).toContain('romina_draft_reset');
		expect(sql).toContain('ROMINA_DRAFT_RESET_PUBLISHED_CHANGED');
		expect(sql).toContain('ROMINA_DRAFT_RESET_STALE_DRAFT');
	});
});
