/**
 * reconciliation-cli.ts — Guided Canonical Content Reconciliation CLI Entrypoint
 *
 * Implements interactive and non-interactive guided semantic reconciliation.
 *
 * Exposes supported decision outcomes:
 *  - KEEP_CANONICAL
 *  - KEEP_ENVIRONMENT
 *  - DEFER
 */

import {
	computeReconciliationState,
	filterManagedDivergenceDeltas,
	type ManagedDivergenceSummary,
	type ManagedFieldDiff,
	type ReconciliationDecisionOutcome,
} from './reconciliation-state.ts';
import {
	formatAdaptiveReconciliationSummary,
} from './reconciliation-presenter.ts';
import {
	saveReconciliationArtifact,
} from './reconciliation-artifact.ts';
import { formatSourceUpdatePlanMarkdown } from './reconciliation-source-plan.ts';
import type { SemanticDelta } from './semantic-delta.ts';

export interface ReconciliationExecutionOptions {
	slug: string;
	targetEnvironment: 'local' | 'preview' | 'production';
	deltas: Array<Partial<SemanticDelta> & { path: string }>;
	canonicalPackageHash: string;
	isInteractive?: boolean;
	providedDecisions?: Record<string, ReconciliationDecisionOutcome>;
	defaultDecision?: ReconciliationDecisionOutcome;
	projectRoot?: string;
}

export async function runGuidedReconciliation(
	options: ReconciliationExecutionOptions,
): Promise<{
	summary: ManagedDivergenceSummary;
	artifactPath: string;
	sourceUpdatePlanMarkdown?: string;
}> {
	const {
		slug,
		targetEnvironment,
		deltas,
		canonicalPackageHash,
		isInteractive = false,
		providedDecisions = {},
		defaultDecision,
		projectRoot,
	} = options;

	const diffs: ManagedFieldDiff[] = filterManagedDivergenceDeltas(deltas);
	const decisions: Record<string, ReconciliationDecisionOutcome> = { ...providedDecisions };

	if (diffs.length > 0) {
		if (isInteractive) {
			const { select } = await import('@inquirer/prompts');
			console.log(
				formatAdaptiveReconciliationSummary(
					computeReconciliationState({ slug, targetEnvironment, diffs, decisions }),
				),
			);

			for (const diff of diffs) {
				if (decisions[diff.path]) continue;

				console.log(`\nReconciliando campo [${diff.section.toUpperCase()}] "${diff.path}":`);
				console.log(`  Valor Canónico (TS):    ${JSON.stringify(diff.canonicalValue)}`);
				console.log(`  Valor Ambiente (Draft): ${JSON.stringify(diff.environmentValue)}`);

				const answer = (await select({
					message: `Seleccione la decisión para "${diff.path}":`,
					choices: [
						{
							name: 'Conservar Canónico (Sobrescribir borrador de ambiente con valor de paquete TS)',
							value: 'KEEP_CANONICAL',
						},
						{
							name: 'Conservar Ambiente (Mantener borrador y generar plan para actualizar archivo TS)',
							value: 'KEEP_ENVIRONMENT',
						},
						{
							name: 'Diferir decisión (Mantener diferencia sin resolver; bloquea lanzamiento)',
							value: 'DEFER',
						},
					],
				})) as ReconciliationDecisionOutcome;

				decisions[diff.path] = answer;
			}
		} else if (defaultDecision) {
			for (const diff of diffs) {
				if (!decisions[diff.path]) {
					decisions[diff.path] = defaultDecision;
				}
			}
		}
	}

	const summary = computeReconciliationState({
		slug,
		targetEnvironment,
		diffs,
		decisions,
	});

	const artifactPath = saveReconciliationArtifact(summary, canonicalPackageHash, projectRoot);
	const sourceUpdatePlanMarkdown = summary.sourceUpdatePlan
		? formatSourceUpdatePlanMarkdown(summary.sourceUpdatePlan)
		: undefined;

	return {
		summary,
		artifactPath,
		sourceUpdatePlanMarkdown,
	};
}
