/**
 * Thin Production apply orchestrator.
 *
 * Composes canonical schema preflight/migrate, invitation promotion preflight/apply,
 * and explicit patch primitives. Does not reimplement classifiers, fingerprints,
 * backups, receipts, or SQL execution.
 */
import { getProdDbUrl } from './db-workflow-lib.ts';
import { OperatorError } from './operator-cli-ux.ts';
import {
	orchestrateMigrate,
	preflightMigrate,
	type OrchestrateMigrateResult,
} from './migrate-orchestrator.ts';
import type { MigrationPlan } from './migration-plan.ts';
import {
	requireOwnerProductionApply,
	type OwnerProductionApplyInput,
} from './owner-production-apply.ts';
import { matchProductionWritePermit } from './production-write-permit.ts';
import {
	applyPreparedProductionPatch,
	prepareProductionPatchFile,
} from './run-prod-patch.ts';
import { resolveInvitationPackageInput } from '../provision/invitation-package-input.ts';
import type { InvitationPackageData } from '../provision/invitation-package.ts';
import { orchestrateInvitationPromotion } from '../provision/invitation-promotion-orchestrator.ts';
import {
	runPromotionPreflight,
	type PromotionApplyReport,
	type PromotionPreflightReport,
} from '../provision/invitation-promote.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import {
	assembleProductionApplyPlan,
	classifyInvitationPreflight,
	classifySchemaError,
	classifySchemaPreflight,
	evaluateApplyEligibility,
	mutationItemsOf,
	type ProductionApplyItemOutcome,
	type ProductionApplyPlan,
	type ProductionApplyPlanItem,
	type ProductionApplyScope,
} from './production-apply-plan.ts';
import type { ProductionApplyCliArgs } from './production-apply-cli-args.ts';

export interface ProductionApplyAssemblerDeps {
	preflightSchema?: () => MigrationPlan;
	listSlugs?: () => string[];
	resolvePackage?: (slug: string) => Promise<InvitationPackageData>;
	runInvitationPreflight?: (
		packageData: InvitationPackageData,
	) => Promise<PromotionPreflightReport>;
	preparePatch?: typeof prepareProductionPatchFile;
}

export interface ProductionApplyExecuteDeps extends ProductionApplyAssemblerDeps {
	getProductionDbUrl?: () => { url: string };
	requireOwnerApply?: (input: OwnerProductionApplyInput) => Promise<void>;
	applySchema?: (input: {
		authorizedPlanBindingHex: string;
	}) => Promise<OrchestrateMigrateResult>;
	applyInvitation?: (input: {
		packageData: InvitationPackageData;
		authorizedPlanBindingHex: string;
	}) => Promise<PromotionApplyReport>;
	applyPatch?: typeof applyPreparedProductionPatch;
}

export interface ProductionApplyOutcomeRow {
	id: string;
	outcome: ProductionApplyItemOutcome;
	detail?: string;
}

export interface ProductionApplyExecution {
	plan: ProductionApplyPlan;
	wrote: boolean;
	outcomes: ProductionApplyOutcomeRow[];
}

function defaultListSlugs(): string[] {
	return listInvitationDefinitions()
		.map((definition) => definition.slug)
		.sort((a, b) => a.localeCompare(b));
}

function scopeFromArgs(args: ProductionApplyCliArgs): ProductionApplyScope {
	return {
		schema: args.schema || args.inspectAll,
		slugs: args.inspectAll || args.allReady ? [] : args.slugs,
		allReady: args.allReady,
		patchFile: args.patchFile,
		inspectAll: args.inspectAll,
	};
}

function schemaItemFromPlan(plan: MigrationPlan): ProductionApplyPlanItem {
	const readiness = classifySchemaPreflight({
		pendingVersions: plan.pendingVersions,
		compatibilityStatus: plan.compatibilityStatus,
	});
	const pending = plan.pendingVersions.filter((version) => version !== 'none');
	return {
		domain: 'schema',
		id: 'schema',
		readiness,
		summary:
			readiness === 'IN_SYNC'
				? 'Sin migraciones pendientes'
				: `Pendientes: ${pending.join(', ')}`,
		binding: plan.planId,
		pendingVersions: pending,
		detail: readiness === 'READY' ? plan.planId : undefined,
	};
}

function schemaItemFromError(error: unknown): ProductionApplyPlanItem {
	const classified = classifySchemaError(error);
	return {
		domain: 'schema',
		id: 'schema',
		readiness: classified.readiness,
		summary: classified.detail,
		detail: classified.detail,
		blockCode: classified.blockCode,
	};
}

async function inspectSchema(
	include: boolean,
	deps: ProductionApplyAssemblerDeps,
): Promise<ProductionApplyPlanItem> {
	if (!include) {
		return {
			domain: 'schema',
			id: 'schema',
			readiness: 'NOT_APPLICABLE',
			summary: 'Schema no está en el alcance',
		};
	}
	try {
		const build =
			deps.preflightSchema ??
			(() =>
				preflightMigrate({
					target: 'production',
					mode: 'preflight',
					expectedPin: null,
				}));
		return schemaItemFromPlan(build());
	} catch (error) {
		return schemaItemFromError(error);
	}
}

async function inspectInvitation(
	slug: string,
	schemaReadyInPlan: boolean,
	deps: ProductionApplyAssemblerDeps,
): Promise<ProductionApplyPlanItem> {
	try {
		const resolvePackage =
			deps.resolvePackage ??
			(async (target: string) => {
				const resolved = await resolveInvitationPackageInput({ slug: target });
				return resolved.packageData;
			});
		const packageData = await resolvePackage(slug);
		const runPreflight =
			deps.runInvitationPreflight ??
			((data: InvitationPackageData) =>
				runPromotionPreflight({
					packageData: data,
					requireBackup: false,
					getProductionDbUrl: getProdDbUrl,
				}));
		const preflight = await runPreflight(packageData);
		const readiness = classifyInvitationPreflight({
			status: preflight.status,
			blockCode: preflight.blockCode,
			schemaState: preflight.schema.state,
			schemaReadyInPlan,
		});
		return {
			domain: 'invitation',
			id: slug,
			readiness,
			summary: preflight.reason ?? preflight.status,
			detail: preflight.reason ?? preflight.schema.detail,
			blockCode: preflight.blockCode,
			binding: packageData.packageHash,
			packageHash: packageData.packageHash,
		};
	} catch (error) {
		const classified = classifySchemaError(error);
		const readiness =
			classified.readiness === 'UNKNOWN' ||
			/UNVERIFIED|CREDENTIALS|UNREACHABLE/i.test(classified.detail)
				? 'UNKNOWN'
				: 'BLOCKED';
		return {
			domain: 'invitation',
			id: slug,
			readiness,
			summary: classified.detail,
			detail: classified.detail,
			blockCode: classified.blockCode,
		};
	}
}

function inspectPatch(
	file: string | undefined,
	deps: ProductionApplyAssemblerDeps,
): ProductionApplyPlanItem | null {
	if (!file) return null;
	try {
		const prepared = (deps.preparePatch ?? prepareProductionPatchFile)(file);
		return {
			domain: 'patch',
			id: file,
			readiness: 'READY',
			summary: 'Lint de parche aprobado (SQL no ejecutado)',
			binding: prepared.fingerprint,
			detail: 'Parche especializado; no forma parte de --all-ready',
		};
	} catch (error) {
		const classified = classifySchemaError(error);
		return {
			domain: 'patch',
			id: file,
			readiness: 'BLOCKED',
			summary: classified.detail,
			detail: classified.detail,
			blockCode: classified.blockCode,
		};
	}
}

export async function buildProductionApplyPlan(
	args: ProductionApplyCliArgs,
	deps: ProductionApplyAssemblerDeps = {},
): Promise<ProductionApplyPlan> {
	const scope = scopeFromArgs(args);
	const schemaItem = await inspectSchema(scope.schema, deps);
	const schemaReadyInPlan = schemaItem.readiness === 'READY';

	const slugList =
		scope.inspectAll || scope.allReady
			? (deps.listSlugs ?? defaultListSlugs)()
			: [...scope.slugs];

	const invitationItems: ProductionApplyPlanItem[] = [];
	for (const slug of slugList) {
		invitationItems.push(await inspectInvitation(slug, schemaReadyInPlan, deps));
	}

	const patchItem = inspectPatch(scope.patchFile, deps);
	const items: ProductionApplyPlanItem[] = [schemaItem, ...invitationItems];
	if (patchItem) items.push(patchItem);

	return assembleProductionApplyPlan(
		{
			...scope,
			slugs: slugList,
		},
		items,
	);
}

function assertDelegatedPermit(dbUrl: string, bindingHex: string): void {
	const match = matchProductionWritePermit({ dbUrl, bindingHex });
	if (match === 'ok') return;
	throw new OperatorError({
		title: 'Autorización de Production no reutilizable',
		cause: `El permiso interno no coincide con el plan aprobado (${match}).`,
		code: 'PRODUCTION_WRITE_PERMIT_REQUIRED',
		remediation: [
			'Ejecute pnpm prod:apply con --apply en una TTY del propietario.',
			'Un permiso de otro plan, proceso o proyecto no autoriza esta operación.',
		],
	});
}

function outcomeFromItem(item: ProductionApplyPlanItem): ProductionApplyOutcomeRow {
	if (item.readiness === 'NOT_APPLICABLE') {
		return { id: item.id, outcome: 'skipped_out_of_scope', detail: item.summary };
	}
	if (item.readiness === 'IN_SYNC') {
		return { id: item.id, outcome: 'already_applied', detail: item.summary };
	}
	if (item.readiness === 'BLOCKED') {
		return { id: item.id, outcome: 'blocked', detail: item.detail };
	}
	if (item.readiness === 'UNKNOWN') {
		return { id: item.id, outcome: 'unknown', detail: item.detail };
	}
	return { id: item.id, outcome: 'pending', detail: item.summary };
}

function failureDetail(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function throwIfIneligible(plan: ProductionApplyPlan): void {
	const eligibility = evaluateApplyEligibility(plan);
	if (eligibility.ok) return;
	throw new OperatorError({
		title: 'El plan no es aplicable',
		cause: eligibility.detail,
		code: eligibility.code,
		remediation: [
			'Corrija los elementos BLOCKED o UNKNOWN.',
			'Vuelva a ejecutar pnpm prod:apply sin --apply para revisar el plan.',
		],
	});
}

function throwIfPatchMissingOwner(
	mutations: readonly ProductionApplyPlanItem[],
	ownerUserId: string | undefined,
): void {
	if (!mutations.some((item) => item.domain === 'patch') || ownerUserId) return;
	throw new OperatorError({
		title: 'Falta --owner-user-id',
		cause: 'El apply de un parche especializado exige --owner-user-id.',
		code: 'OWNER_USER_ID_REQUIRED',
		remediation: ['Reintente con --patch <file> --owner-user-id <uuid> --apply.'],
	});
}

async function authorizeReviewedPlan(
	reviewed: ProductionApplyPlan,
	mutations: readonly ProductionApplyPlanItem[],
	deps: ProductionApplyExecuteDeps,
): Promise<void> {
	const getProductionDbUrl = deps.getProductionDbUrl ?? getProdDbUrl;
	const { url: dbUrl } = getProductionDbUrl();
	const ownerGateInput: OwnerProductionApplyInput = {
		apply: true,
		dbUrl,
		operationType: 'production_apply',
		operationVerb: 'APPLY',
		bindingHex: reviewed.planId,
		applyActionLabel: 'Aplicar plan',
		summaryTitle: 'Apply Production',
		summary: [
			['Operación', 'Plan mixto Production'],
			['Mutaciones', String(mutations.length)],
			['Alcance', mutations.map((item) => `${item.domain}:${item.id}`).join(', ')],
			['Autorización', 'Una confirmación cubre el plan exacto'],
		],
		technicalReview: [
			['Impacto', 'Delega a primitivas canónicas de schema, promoción y parche'],
			['Plan', reviewed.planId],
			['Orden', 'schema → verificar → invitaciones → parche explícito'],
			['Controles', 'TTY · agente bloqueado · permiso ligado al plan · sin token'],
		],
	};
	if (deps.requireOwnerApply) {
		await deps.requireOwnerApply(ownerGateInput);
		return;
	}
	await requireOwnerProductionApply(ownerGateInput);
}

function throwIfPlanDrifted(reviewed: ProductionApplyPlan, live: ProductionApplyPlan): void {
	if (live.planId === reviewed.planId) return;
	throw new OperatorError({
		title: 'El plan cambió antes de aplicar',
		cause: 'La evidencia en vivo ya no coincide con el plan autorizado.',
		code: 'PLAN_DRIFT',
		remediation: [
			'Vuelva a ejecutar pnpm prod:apply sin --apply.',
			'Revisar el plan nuevo y aplicar de nuevo (no reutilice la autorización anterior).',
		],
	});
}

async function applySchemaMutation(
	mutations: readonly ProductionApplyPlanItem[],
	reviewed: ProductionApplyPlan,
	deps: ProductionApplyExecuteDeps,
	outcomes: ProductionApplyOutcomeRow[],
): Promise<boolean> {
	const schemaMutation = mutations.find((item) => item.domain === 'schema');
	if (!schemaMutation) return false;
	try {
		const applySchema =
			deps.applySchema ??
			((input: { authorizedPlanBindingHex: string }) =>
				orchestrateMigrate({
					target: 'production',
					mode: 'apply',
					expectedPin: null,
					authorizedPlanBindingHex: input.authorizedPlanBindingHex,
				}));
		const result = await applySchema({ authorizedPlanBindingHex: reviewed.planId });
		replaceOutcome(outcomes, 'schema', {
			id: 'schema',
			outcome: 'applied_verified',
			detail: result.plan.pendingVersions.join(', '),
		});
		return result.wrote;
	} catch (error) {
		replaceOutcome(outcomes, 'schema', {
			id: 'schema',
			outcome: 'failed',
			detail: failureDetail(error),
		});
		throw error;
	}
}

function throwInvitationApplyFailure(report: PromotionApplyReport): never {
	throw new OperatorError({
		title: 'Promoción de invitación fallida',
		cause: report.reason ?? report.status,
		code: report.blockCode ?? 'INVITATION_APPLY_FAILED',
		remediation: [
			'Corrija el bloqueo y vuelva a ejecutar pnpm prod:apply.',
			'El plan se reconstruye desde el estado vivo; no edite receipts.',
		],
	});
}

async function applyOneInvitationMutation(
	item: ProductionApplyPlanItem,
	reviewed: ProductionApplyPlan,
	deps: ProductionApplyExecuteDeps,
	outcomes: ProductionApplyOutcomeRow[],
): Promise<boolean> {
	const resolvePackage =
		deps.resolvePackage ??
		(async (slug: string) => {
			const resolved = await resolveInvitationPackageInput({ slug });
			return resolved.packageData;
		});
	const packageData = await resolvePackage(item.id);
	const applyInvitation =
		deps.applyInvitation ??
		((input: {
			packageData: InvitationPackageData;
			authorizedPlanBindingHex: string;
		}) =>
			orchestrateInvitationPromotion({
				packageData: input.packageData,
				requireOwnerApply: async (gate) => {
					assertDelegatedPermit(gate.dbUrl, input.authorizedPlanBindingHex);
				},
			}));
	const report = await applyInvitation({
		packageData,
		authorizedPlanBindingHex: reviewed.planId,
	});
	if (report.status === 'BLOCKED' || report.status === 'APPLIED_BUT_VERIFICATION_FAILED') {
		replaceOutcome(outcomes, item.id, {
			id: item.id,
			outcome: 'failed',
			detail: report.reason ?? report.status,
		});
		throwInvitationApplyFailure(report);
	}
	replaceOutcome(outcomes, item.id, {
		id: item.id,
		outcome: report.status === 'IN_SYNC' ? 'already_applied' : 'applied_verified',
		detail: report.status,
	});
	return report.status === 'PROMOTED';
}

async function applyInvitationMutations(
	mutations: readonly ProductionApplyPlanItem[],
	reviewed: ProductionApplyPlan,
	deps: ProductionApplyExecuteDeps,
	outcomes: ProductionApplyOutcomeRow[],
): Promise<boolean> {
	let wrote = false;
	for (const item of mutations.filter((entry) => entry.domain === 'invitation')) {
		try {
			wrote = (await applyOneInvitationMutation(item, reviewed, deps, outcomes)) || wrote;
		} catch (error) {
			if (
				!(error instanceof OperatorError) ||
				outcomes.find((row) => row.id === item.id)?.outcome !== 'failed'
			) {
				replaceOutcome(outcomes, item.id, {
					id: item.id,
					outcome: 'failed',
					detail: failureDetail(error),
				});
			}
			throw error;
		}
	}
	return wrote;
}

async function applyPatchMutation(
	mutations: readonly ProductionApplyPlanItem[],
	reviewed: ProductionApplyPlan,
	ownerUserId: string | undefined,
	deps: ProductionApplyExecuteDeps,
	outcomes: ProductionApplyOutcomeRow[],
): Promise<boolean> {
	const patchMutation = mutations.find((item) => item.domain === 'patch');
	if (!patchMutation) return false;
	if (!ownerUserId) {
		throwIfPatchMissingOwner(mutations, ownerUserId);
		return false;
	}
	try {
		const prepared = (deps.preparePatch ?? prepareProductionPatchFile)(patchMutation.id);
		const applyPatch = deps.applyPatch ?? applyPreparedProductionPatch;
		await applyPatch({
			prepared,
			ownerUserId,
			authorizedPlanBindingHex: reviewed.planId,
		});
		replaceOutcome(outcomes, patchMutation.id, {
			id: patchMutation.id,
			outcome: 'applied_verified',
		});
		return true;
	} catch (error) {
		replaceOutcome(outcomes, patchMutation.id, {
			id: patchMutation.id,
			outcome: 'failed',
			detail: failureDetail(error),
		});
		throw error;
	}
}

export async function applyProductionApplyPlan(
	args: ProductionApplyCliArgs,
	deps: ProductionApplyExecuteDeps = {},
): Promise<ProductionApplyExecution> {
	const reviewed = await buildProductionApplyPlan(args, deps);
	throwIfIneligible(reviewed);

	const mutations = mutationItemsOf(reviewed);
	const ownerUserId = args.ownerUserId;
	throwIfPatchMissingOwner(mutations, ownerUserId);
	if (mutations.length === 0) {
		return { plan: reviewed, wrote: false, outcomes: reviewed.items.map(outcomeFromItem) };
	}

	await authorizeReviewedPlan(reviewed, mutations, deps);
	throwIfPlanDrifted(reviewed, await buildProductionApplyPlan(args, deps));

	const outcomes = reviewed.items.map(outcomeFromItem);
	const wroteSchema = await applySchemaMutation(mutations, reviewed, deps, outcomes);
	const wroteInvitations = await applyInvitationMutations(mutations, reviewed, deps, outcomes);
	const wrotePatch = await applyPatchMutation(
		mutations,
		reviewed,
		ownerUserId,
		deps,
		outcomes,
	);
	return {
		plan: reviewed,
		wrote: wroteSchema || wroteInvitations || wrotePatch,
		outcomes,
	};
}

function replaceOutcome(
	outcomes: ProductionApplyOutcomeRow[],
	id: string,
	row: ProductionApplyOutcomeRow,
): void {
	const index = outcomes.findIndex((item) => item.id === id);
	if (index === -1) {
		outcomes.push(row);
		return;
	}
	outcomes[index] = row;
}
