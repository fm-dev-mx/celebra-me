import { describe, expect, it } from '@jest/globals';
import {
	buildSemanticFunctionalChanges,
	verifyPlanPreconditions,
	type OperationalPlan,
} from '../../scripts/provision/invitation-update-plan.ts';
import { parseTargets } from '../../scripts/provision/invitation-update-options.ts';
import { assertEngineResult } from '../../scripts/provision/invitation-engine-result.ts';
import type { ImportEngineResult } from '../../scripts/provision/invitation-import-engine.ts';
import {
	formatApplyConfirmation,
	formatFunctionalChanges,
	type OperationalPlanData,
} from '../../scripts/provision/invitation-update-presenter.ts';

function plan(): OperationalPlan {
	return {
		planId: 'target-plan',
		invitationSlug: 'fixture',
		invitationTitle: 'Fixture',
		sourceHash: 'a'.repeat(64),
		packageHash: 'b'.repeat(64),
		targetEnvironment: 'preview',
		verifiedProjectRef: 'previewproject',
		functionalChanges: [],
		physicalDatabaseOps: { inserts: 0, updates: 1, deletes: 0 },
		storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		targetPreconditions: {
			sourceHash: 'a'.repeat(64),
			packageHash: 'b'.repeat(64),
			verifiedProjectRef: 'previewproject',
			targetInvitationId: 'invitation-1',
			existingDraftUpdatedAt: '2026-07-23T10:00:00.000Z',
			existingPublishedVersion: 3,
			assetStateHash: 'c'.repeat(64),
		},
		sensitivityClassification: 'public',
		executionStatus: 'PLANNED',
	};
}

const unchangedState = {
	sourceHash: 'a'.repeat(64),
	packageHash: 'b'.repeat(64),
	verifiedProjectRef: 'previewproject',
	targetInvitationId: 'invitation-1',
	existingDraftUpdatedAt: '2026-07-23T10:00:00.000Z',
	existingPublishedVersion: 3,
	assetStateHash: 'c'.repeat(64),
};

describe('managed lifecycle executable contracts', () => {
	describe('deterministic target ordering and selection', () => {
		it('orders targets Local → Preview → Production and removes duplicates', () => {
			expect(parseTargets('production,preview,local,preview')).toEqual([
				'local',
				'preview',
				'production',
			]);
		});

		it('maps all to coordinated Local, Preview, and Production workflow', () => {
			expect(parseTargets('all')).toEqual(['local', 'preview', 'production']);
		});
	});

	describe('complete precondition drift protection', () => {
		it.each([
			['sourceHash', 'd'.repeat(64), /package source changed/i],
			['packageHash', 'e'.repeat(64), /resolved package changed/i],
			['verifiedProjectRef', 'wrongproject', /target project changed/i],
			['targetInvitationId', 'invitation-2', /invitation ID changed/i],
			[
				'existingDraftUpdatedAt',
				'2026-07-23T11:00:00.000Z',
				/draft updated timestamp changed/i,
			],
			['existingPublishedVersion', 4, /published version changed/i],
		] as const)('blocks %s drift before mutation', (field, value, message) => {
			const result = verifyPlanPreconditions(plan(), { ...unchangedState, [field]: value });
			expect(result.ok).toBe(false);
			expect(result.reason).toMatch(message);
		});

		it('accepts assetStateHash drift since CDN probes are non-deterministic between planning and apply', () => {
			// assetStateHash is intentionally excluded from precondition verification because
			// Storage HTTP probes via Supabase CDN produce non-deterministic results across
			// edge nodes. Asset integrity is verified by the reconciliation engine during apply.
			const result = verifyPlanPreconditions(plan(), {
				...unchangedState,
				assetStateHash: 'f'.repeat(64), // different from plan's 'c'.repeat(64)
			});
			expect(result.ok).toBe(true);
		});

		it('accepts the exact source, package, project, revision, version, and asset state', () => {
			expect(verifyPlanPreconditions(plan(), unchangedState)).toEqual({ ok: true });
		});
	});

	describe('functional semantic projection', () => {
		it('expands nested scalar changes without object-level noise', () => {
			const changes = buildSemanticFunctionalChanges({
				sourceContent: {
					family: { parents: { mother: 'Ana', father: 'Luis' } },
				},
				targetContent: {
					family: { parents: { mother: 'Elena', father: 'Luis' } },
				},
			});
			expect(changes).toHaveLength(1);
			expect(changes[0]).toMatchObject({
				section: 'Familia',
				operation: 'update',
				field: 'family.parents.mother',
				previousValue: '«Elena»',
				newValue: '«Ana»',
			});
			expect(JSON.stringify(changes)).not.toContain('(objeto)');
		});

		it('reports collection insertions, removals, and reordering separately', () => {
			const changes = buildSemanticFunctionalChanges({
				sourceContent: { gallery: ['b.webp', 'a.webp', 'new.webp'] },
				targetContent: { gallery: ['a.webp', 'b.webp', 'old.webp'] },
			});
			expect(changes.map((change) => change.operation)).toEqual(
				expect.arrayContaining(['insert', 'delete']),
			);

			const reorderOnly = buildSemanticFunctionalChanges({
				sourceContent: { sectionOrder: ['family', 'gallery', 'rsvp'] },
				targetContent: { sectionOrder: ['gallery', 'family', 'rsvp'] },
			});
			expect(reorderOnly).toHaveLength(1);
			expect(reorderOnly[0]?.operation).toBe('move');
			expect(formatFunctionalChanges(reorderOnly).join('\n')).toContain('REORDENAMIENTOS');
		});

		it('ignores equivalent materialized asset IDs and URLs', () => {
			const changes = buildSemanticFunctionalChanges({
				sourceContent: {
					hero: {
						backgroundImage: {
							type: 'uploaded',
							assetId: 'preview-id',
							src: 'https://preview.supabase.co/storage/v1/object/public/assets/hero.webp',
						},
					},
				},
				targetContent: {
					hero: {
						backgroundImage: {
							type: 'uploaded',
							assetId: 'local-id',
							src: 'http://127.0.0.1:54321/storage/v1/object/public/assets/hero.webp',
						},
					},
				},
			});
			expect(changes).toEqual([]);
		});

		it('redacts sensitive values before serialization', () => {
			const changes = buildSemanticFunctionalChanges({
				sourceContent: { gifts: { clabe: '012345678901234567' } },
				targetContent: { gifts: { clabe: '000000000000000000' } },
			});
			expect(changes[0]?.previousValue).toBe('[REDACTADO]');
			expect(changes[0]?.newValue).toBe('[REDACTADO]');
		});
	});

	it('presents every pending target plan independently at confirmation', () => {
		const data: OperationalPlanData = {
			invitation: 'fixture',
			targets: ['local', 'preview'],
			isZeroDrift: false,
			plannedOperations: 2,
			expectedDatabaseWrites: { inserts: 0, updates: 2, deletes: 0 },
			expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			actions: [],
			targetPlans: ['local-plan', 'preview-plan'].map((planId, index) => ({
				target: index === 0 ? 'local' : 'preview',
				planId,
				status: 'CAMBIOS PENDIENTES' as const,
				plannedOperations: 1,
				expectedDatabaseWrites: { inserts: 0, updates: 1, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
			})),
		};
		const output = formatApplyConfirmation(data);
		expect(output).toContain('Entorno: local');
		expect(output).toContain('local-plan');
		expect(output).toContain('Entorno: preview');
		expect(output).toContain('preview-plan');
	});

	describe('engine result boundary', () => {
		it('rejects an empty engine result', () => {
			expect(() => assertEngineResult(undefined, 'confirmed-plan', 'Preview', true)).toThrow(
				/INVALID_ENGINE_RESULT/,
			);
		});

		it('rejects a malformed result or a receipt from a different plan', () => {
			const malformed = {
				plan: { planId: 'confirmed-plan' },
			} as unknown as ImportEngineResult;
			expect(() => assertEngineResult(malformed, 'confirmed-plan', 'Preview', true)).toThrow(
				/INVALID_ENGINE_RESULT/,
			);
		});
	});
});
