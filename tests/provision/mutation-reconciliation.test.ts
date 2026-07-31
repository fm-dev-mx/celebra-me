/**
 * mutation-reconciliation.test.ts
 *
 * Behavioral coverage for invitation mutation + managed reconciliation:
 *  1. Production Mutation Restriction (PRODUCTION_PROMOTION_REQUIRED)
 *  2. Preview Write Scoped Authorization (PREVIEW_WRITE_AUTH_REQUIRED)
 *  3. Editor Boundary & Managed Divergence Calculation
 *  4. Guided Reconciliation Outcomes (KEEP_CANONICAL, KEEP_ENVIRONMENT, DEFER)
 *  5. Adaptive UX Scaling & Redacted Durable Artifact Persistence
 */

import { describe, expect, it } from '@jest/globals';
import {
	parseMutationTargets,
	parseTargets,
	validateUpdateOptions,
} from '../../scripts/provision/invitation-update-options.ts';
import { verifyPreviewWriteAuthorization } from '../../scripts/provision/preview-write-auth.ts';
import {
	computeReconciliationState,
	filterManagedDivergenceDeltas,
	type ManagedFieldDiff,
} from '../../scripts/provision/reconciliation-state.ts';
import { loadReconciliationArtifact } from '../../scripts/provision/reconciliation-artifact.ts';
import { formatAdaptiveReconciliationSummary } from '../../scripts/provision/reconciliation-presenter.ts';
import { runGuidedReconciliation } from '../../scripts/provision/reconciliation-cli.ts';
import type { SemanticDelta } from '../../scripts/provision/semantic-delta.ts';

describe('Mutation Surface & Target Restriction (PRODUCTION_PROMOTION_REQUIRED)', () => {
	it('accepts local, preview, and local+preview targets for mutation paths', () => {
		expect(parseMutationTargets('local')).toEqual(['local']);
		expect(parseMutationTargets('preview')).toEqual(['preview']);
		expect(parseMutationTargets('local,preview')).toEqual(['local', 'preview']);
	});

	it('rejects "all" for mutation targets with explicit local,preview guidance', () => {
		expect(() => parseMutationTargets('all')).toThrow('local,preview');
	});

	it('fails closed before mutation when production is explicitly targeted', () => {
		expect(() => parseMutationTargets('production')).toThrow('PRODUCTION_PROMOTION_REQUIRED');
		expect(() => parseMutationTargets('local,production')).toThrow('PRODUCTION_PROMOTION_REQUIRED');
		expect(() => parseMutationTargets('preview,production')).toThrow('PRODUCTION_PROMOTION_REQUIRED');

		expect(() =>
			validateUpdateOptions({
				slug: 'romina-rios-chaparro',
				targets: ['production'],
				isMutation: true,
			}),
		).toThrow('PRODUCTION_PROMOTION_REQUIRED');
	});

	it('preserves read-only production target inspection for status commands', () => {
		expect(parseTargets('all')).toEqual(['local', 'preview', 'production']);
		const statusTargets = parseTargets('production');
		expect(statusTargets).toEqual(['local', 'preview', 'production']);
		expect(() =>
			validateUpdateOptions({
				slug: 'romina-rios-chaparro',
				targets: statusTargets,
				isMutation: false,
			}),
		).not.toThrow();
	});
});

describe('Preview Write Scoped Authorization (PREVIEW_WRITE_AUTH_REQUIRED)', () => {
	it('authorizes interactive human Preview write', () => {
		const result = verifyPreviewWriteAuthorization({
			slug: 'romina-rios-chaparro',
			targets: ['preview'],
			apply: true,
			isInteractive: true,
		});
		expect(result.authorized).toBe(true);
		expect(result.actor).toBe('human_interactive');
	});

	it('fails closed for automated non-interactive Preview write when authorization token is missing', () => {
		expect(() =>
			verifyPreviewWriteAuthorization({
				slug: 'romina-rios-chaparro',
				targets: ['preview'],
				apply: true,
				isInteractive: false,
			}),
		).toThrow(/PREVIEW_WRITE_AUTH_REQUIRED[\s\S]*CELEBRA_TASK_SCOPE/);
	});

	it('accepts CELEBRA_TASK_SCOPE as the canonical Preview task assertion', () => {
		const previous = process.env.CELEBRA_TASK_SCOPE;
		process.env.CELEBRA_TASK_SCOPE = 'preview:romina-rios-chaparro:apply';
		try {
			const result = verifyPreviewWriteAuthorization({
				slug: 'romina-rios-chaparro',
				targets: ['preview'],
				apply: true,
				isInteractive: false,
			});
			expect(result.authorized).toBe(true);
			expect(result.actor).toBe('automated_scoped_token');
		} finally {
			if (previous === undefined) delete process.env.CELEBRA_TASK_SCOPE;
			else process.env.CELEBRA_TASK_SCOPE = previous;
		}
	});

	it('fails closed when token is bound to wrong invitation slug or operation', () => {
		expect(() =>
			verifyPreviewWriteAuthorization({
				slug: 'romina-rios-chaparro',
				targets: ['preview'],
				apply: true,
				isInteractive: false,
				authToken: 'preview:other-slug:apply',
			}),
		).toThrow('PREVIEW_WRITE_AUTH_REQUIRED');
	});

	it('authorizes automated non-interactive Preview write when valid scoped token is provided', () => {
		const result = verifyPreviewWriteAuthorization({
			slug: 'romina-rios-chaparro',
			targets: ['preview'],
			apply: true,
			isInteractive: false,
			authToken: 'preview:romina-rios-chaparro:apply',
		});
		expect(result.authorized).toBe(true);
		expect(result.actor).toBe('automated_scoped_token');
	});
});

function createMockDelta(partial: Partial<SemanticDelta> & { path: string }): SemanticDelta {
	return {
		path: partial.path,
		operation: partial.operation ?? 'replace',
		previousCanonicalPresent: partial.previousCanonicalPresent ?? true,
		currentCanonicalPresent: partial.currentCanonicalPresent ?? true,
		currentTargetPresent: partial.currentTargetPresent ?? true,
		previousCanonicalValue: partial.previousCanonicalValue ?? null,
		currentCanonicalValue: partial.currentCanonicalValue ?? null,
		currentTargetValue: partial.currentTargetValue ?? null,
		isAssetField: partial.isAssetField ?? false,
		status: partial.status ?? 'DRIFT',
		appliedValue: partial.appliedValue ?? null,
	};
}

describe('Managed Divergence Calculation & Exclusion Guardrails', () => {
	it('calculates managed divergence and excludes environment-local/target-owned fields', () => {
		const rawDeltas: SemanticDelta[] = [
			createMockDelta({
				path: 'details.ceremony.address',
				previousCanonicalValue: 'Calle A #123',
				currentCanonicalValue: 'Calle A #123',
				currentTargetValue: 'Calle B #456',
			}),
			createMockDelta({
				path: 'invitationId',
				previousCanonicalValue: 'uuid-1',
				currentCanonicalValue: 'uuid-1',
				currentTargetValue: 'uuid-local-2',
			}),
			createMockDelta({
				path: 'guestConfirmations.guestCount',
				previousCanonicalValue: 10,
				currentCanonicalValue: 10,
				currentTargetValue: 15,
			}),
		];

		const diffs = filterManagedDivergenceDeltas(rawDeltas);
		expect(diffs).toHaveLength(1);
		expect(diffs[0]?.path).toBe('details.ceremony.address');
		expect(diffs[0]?.section).toBe('details');
	});

	it('excludes RSVP and publication-owned paths from the ownership SSOT', () => {
		const diffs = filterManagedDivergenceDeltas([
			createMockDelta({ path: 'guestConfirmations.total', currentTargetValue: 2 }),
			createMockDelta({ path: 'publishedContent.version', currentTargetValue: 2 }),
			createMockDelta({ path: 'draftContent.details.title', currentTargetValue: 'Actualizado' }),
		]);
		expect(diffs.map((diff) => diff.path)).toEqual(['draftContent.details.title']);
	});

	it('computes CLEAN state when zero managed diffs exist', () => {
		const summary = computeReconciliationState({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			diffs: [],
		});
		expect(summary.state).toBe('CLEAN');
		expect(summary.isReleaseBlocked).toBe(false);
	});

	it('computes RECONCILIATION_REQUIRED and blocks release when unresolved diffs exist', () => {
		const diffs: ManagedFieldDiff[] = [
			{
				path: 'theme.primaryColor',
				section: 'theme',
				canonicalValue: '#ff0000',
				environmentValue: '#00ff00',
			},
		];
		const summary = computeReconciliationState({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			diffs,
		});
		expect(summary.state).toBe('RECONCILIATION_REQUIRED');
		expect(summary.isReleaseBlocked).toBe(true);
		expect(summary.unresolvedPaths).toEqual(['theme.primaryColor']);
	});
});

describe('Guided Reconciliation Outcomes & Artifact Persistence', () => {
	const mockDeltas: SemanticDelta[] = [
		createMockDelta({
			path: 'details.ceremony.address',
			currentCanonicalValue: 'Calle Canónica 123',
			currentTargetValue: 'Calle Ambiente 456',
		}),
		createMockDelta({
			path: 'theme.primaryColor',
			currentCanonicalValue: '#111111',
			currentTargetValue: '#222222',
		}),
	];

	it('resolves to CLEAN when KEEP_CANONICAL is selected for all diffs', async () => {
		const { summary } = await runGuidedReconciliation({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			deltas: mockDeltas,
			canonicalPackageHash: 'b'.repeat(64),
			providedDecisions: {
				'details.ceremony.address': 'KEEP_CANONICAL',
				'theme.primaryColor': 'KEEP_CANONICAL',
			},
		});

		expect(summary.state).toBe('CLEAN');
		expect(summary.isReleaseBlocked).toBe(false);
	});

	it('generates source update plan when KEEP_ENVIRONMENT is selected and blocks release until source update', async () => {
		const { summary } = await runGuidedReconciliation({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			deltas: mockDeltas,
			canonicalPackageHash: 'b'.repeat(64),
			providedDecisions: {
				'details.ceremony.address': 'KEEP_ENVIRONMENT',
				'theme.primaryColor': 'KEEP_CANONICAL',
			},
		});

		expect(summary.state).toBe('SOURCE_UPDATE_REQUIRED');
		expect(summary.isReleaseBlocked).toBe(true);
		expect(summary.sourceUpdatePlan).toBeDefined();
		expect(summary.sourceUpdatePlan?.items).toHaveLength(1);
		expect(summary.sourceUpdatePlan?.items[0]?.semanticPath).toBe('details.ceremony.address');
	});

	it('blocks release when DEFER is selected for any diff', async () => {
		const { summary } = await runGuidedReconciliation({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			deltas: mockDeltas,
			canonicalPackageHash: 'b'.repeat(64),
			providedDecisions: {
				'details.ceremony.address': 'DEFER',
				'theme.primaryColor': 'KEEP_CANONICAL',
			},
		});

		expect(summary.state).toBe('DEFERRED');
		expect(summary.isReleaseBlocked).toBe(true);
	});

	it('persists a durable redacted artifact containing exact decisions', async () => {
		const { artifactPath } = await runGuidedReconciliation({
			slug: 'romina-rios-chaparro',
			targetEnvironment: 'preview',
			deltas: [
				createMockDelta({
					path: 'details.secretDbUrl',
					currentCanonicalValue: 'postgresql://user:secret@127.0.0.1:54322/db',
					currentTargetValue: 'postgresql://user:secret@127.0.0.1:54322/db',
				}),
			],
			canonicalPackageHash: 'b'.repeat(64),
			providedDecisions: {
				'details.secretDbUrl': 'KEEP_CANONICAL',
			},
		});

		expect(artifactPath).toContain('reconciliation-romina-rios-chaparro-preview.json');
		expect(artifactPath).toContain('.agent');
		expect(artifactPath).toContain('runtime');
		expect(artifactPath).toContain('reconciliation');
		const loaded = loadReconciliationArtifact('romina-rios-chaparro', 'preview');
		expect(loaded).toBeDefined();
		expect(loaded?.invitationSlug).toBe('romina-rios-chaparro');
	});
});

describe('Adaptive UX Presentation Thresholds', () => {
	it('formats small diff (<=10 paths) as direct field list', () => {
		const diffs: ManagedFieldDiff[] = [
			{ path: 'theme.color', section: 'theme', canonicalValue: '#1', environmentValue: '#2' },
		];
		const summary = computeReconciliationState({ slug: 'test', targetEnvironment: 'local', diffs });
		const formatted = formatAdaptiveReconciliationSummary(summary);
		expect(formatted).toContain('REVISIÓN DIRECTA DE CAMPOS');
	});

	it('formats medium diff (11-40 paths) grouped by semantic section', () => {
		const diffs: ManagedFieldDiff[] = Array.from({ length: 15 }, (_, i) => ({
			path: `section${i % 3}.field${i}`,
			section: `section${i % 3}`,
			canonicalValue: i,
			environmentValue: i + 1,
		}));
		const summary = computeReconciliationState({ slug: 'test', targetEnvironment: 'local', diffs });
		const formatted = formatAdaptiveReconciliationSummary(summary);
		expect(formatted).toContain('REVISIÓN AGRUPADA POR SECCIÓN');
	});

	it('formats large diff (>40 paths) as executive summary with risk indicators', () => {
		const diffs: ManagedFieldDiff[] = Array.from({ length: 45 }, (_, i) => ({
			path: `section${i % 4}.field${i}`,
			section: `section${i % 4}`,
			canonicalValue: i,
			environmentValue: i + 1,
		}));
		const summary = computeReconciliationState({ slug: 'test', targetEnvironment: 'local', diffs });
		const formatted = formatAdaptiveReconciliationSummary(summary);
		expect(formatted).toContain('RESUMEN EJECUTIVO AGRUPADO');
	});
});
