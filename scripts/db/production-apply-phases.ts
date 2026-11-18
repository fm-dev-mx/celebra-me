/** Separate schema authorization from publication and present each exact plan to the owner. */
import { getProdDbUrl } from './db-workflow-lib.ts';
import type { OwnerProductionApplyInput } from './owner-production-apply.ts';
import { OperatorError } from './operator-cli-ux.ts';
import {
	mutationItemsOf,
	type ProductionApplyPlan,
	type ProductionApplyPlanItem,
} from './production-apply-plan.ts';
import type { ProductionApplyCliArgs } from './production-apply-cli-args.ts';
import type {
	ProductionApplyExecuteDeps,
	ProductionApplyExecution,
} from './production-apply-orchestrator.ts';

interface PhaseHandlers {
	buildPlan: (
		args: ProductionApplyCliArgs,
		deps: ProductionApplyExecuteDeps,
	) => Promise<ProductionApplyPlan>;
	applyPhase: (
		args: ProductionApplyCliArgs,
		deps: ProductionApplyExecuteDeps,
		reviewed: ProductionApplyPlan,
	) => Promise<ProductionApplyExecution>;
}

export const PRODUCTION_APPLY_OPERATION_TYPE = 'production_apply';

export async function applyProductionApplyPhases(
	args: ProductionApplyCliArgs,
	deps: ProductionApplyExecuteDeps,
	reviewed: ProductionApplyPlan,
	handlers: PhaseHandlers,
): Promise<ProductionApplyExecution> {
	const mutations = mutationItemsOf(reviewed);
	if (
		!mutations.some((item) => item.domain === 'schema') ||
		!mutations.some((item) => item.domain !== 'schema')
	) {
		return handlers.applyPhase(args, deps, reviewed);
	}
	// The schema plan excludes every invitation and patch inspected before migration.
	const schemaArgs = { ...args, slugs: [], allReady: false, patchFile: undefined };
	const schema = await handlers.applyPhase(
		schemaArgs,
		deps,
		await handlers.buildPlan(schemaArgs, deps),
	);
	// applyPhase verifies the schema and clears its permit before this new plan is built.
	try {
		// The expected pending-set pin belongs to the completed schema phase only.
		const publicationArgs = { ...args, expectedPin: null };
		const publication = await handlers.buildPlan(publicationArgs, deps);
		if (publication.items.find((item) => item.domain === 'schema')?.readiness !== 'IN_SYNC') {
			throw new OperatorError({
				title: 'El esquema no quedó verificado para publicar',
				cause: 'El plan posterior a la migración no confirma un esquema sin pendientes.',
				code: 'SCHEMA_NOT_IN_SYNC',
				remediation: [
					'Revise el esquema y genere un plan nuevo; no reutilice la autorización anterior.',
				],
			});
		}
		const result = await handlers.applyPhase(publicationArgs, deps, publication);
		const schemaOutcome = schema.outcomes.find((item) => item.id === 'schema');
		return {
			...result,
			wrote: schema.wrote || result.wrote,
			outcomes: result.outcomes.map((item) =>
				item.id === 'schema' && schemaOutcome ? schemaOutcome : item,
			),
		};
	} catch (error) {
		if (!schema.wrote) throw error;
		throw new OperatorError({
			title: 'Esquema aplicado; publicación incompleta',
			cause: error instanceof Error ? error.message : String(error),
			code: error instanceof OperatorError ? error.code : 'PUBLICATION_APPLY_FAILED',
			remediation: [
				'Revise el estado vivo y genere un plan nuevo con una confirmación nueva.',
			],
			noChangesMessage:
				'El esquema ya se aplicó y verificó. La publicación quedó incompleta; revise qué invitaciones se aplicaron antes de reintentar.',
		});
	}
}

/** Owner gate input for the exact reviewed plan; the orchestrator runs the gate itself. */
export function ownerGateInputFor(
	reviewed: ProductionApplyPlan,
	mutations: readonly ProductionApplyPlanItem[],
	deps: ProductionApplyExecuteDeps,
): OwnerProductionApplyInput {
	const getProductionDbUrl = deps.getProductionDbUrl ?? getProdDbUrl;
	const { url: dbUrl } = getProductionDbUrl();
	const discardDraftSlugs = mutations
		.filter((item) => item.readiness === 'READY_AFTER_DISCARD')
		.map((item) => item.id);
	const ownerGateInput: OwnerProductionApplyInput = {
		apply: true,
		dbUrl,
		operationType: PRODUCTION_APPLY_OPERATION_TYPE,
		operationVerb: 'APPLY',
		bindingHex: reviewed.planId,
		applyActionLabel: 'Aplicar plan',
		summaryTitle: 'Apply Production',
		summary: [
			[
				'Operación',
				mutations.some((item) => item.domain === 'schema')
					? 'Esquema Production'
					: 'Publicación Production',
			],
			['Mutaciones', String(mutations.length)],
			['Alcance', mutations.map((item) => `${item.domain}:${item.id}`).join(', ')],
			[
				'Borradores inéditos',
				discardDraftSlugs.length > 0
					? `Se reemplazarán: ${discardDraftSlugs.join(', ')}`
					: 'Ninguno',
			],
			['Autorización', 'Una confirmación cubre el plan exacto'],
		],
		technicalReview: [
			['Impacto', 'Delega a primitivas canónicas de schema, promoción y parche'],
			['Plan', reviewed.planId],
			['Orden', 'Esquema por separado → plan nuevo → confirmación nueva → publicación'],
			['Controles', 'TTY · agente bloqueado · permiso ligado al plan · sin token'],
		],
	};
	return ownerGateInput;
}
