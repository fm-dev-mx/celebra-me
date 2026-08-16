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
	MigrateApplyError,
	orchestrateMigrate,
	preflightMigrate,
	type OrchestrateMigrateResult,
} from './migrate-orchestrator.ts';
import type { MigrationPlan } from './migration-plan.ts';
import {
	requireOwnerProductionApply,
	type OwnerProductionApplyInput,
} from './owner-production-apply.ts';
import {
	clearProductionWritePermit,
	matchProductionWritePermit,
	withProductionPermitScope,
} from './production-write-permit.ts';
import {
	ensureCriticalProductionBackup,
	revalidateCriticalProductionBackup,
	type CriticalProductionBackupPreparation,
} from './critical-production-backup.ts';
import {
	applyPreparedProductionPatch,
	prepareProductionPatchFile,
	ProductionPatchApplyError,
	resolveProductionPatchApiUrl,
} from './run-prod-patch.ts';
import { patchSqlRequiresOwnerUserId, productionPatchApplyCommand } from './sql-safety.ts';
import type { PreparedProductionPatch } from './run-prod-patch.ts';
import type { ProductionPatchPreviewAssessment } from './production-patch-preview.ts';
import { inspectPatch } from './production-apply-patch-plan.ts';
import { resolveInvitationPackageInput } from '../provision/invitation-package-input.ts';
import type { InvitationPackageData } from '../provision/invitation-package.ts';
import { orchestrateInvitationPromotion } from '../provision/invitation-promotion-orchestrator.ts';
import {
	runPromotionPreflight,
	type PromotionApplyReport,
	type PromotionPreflightReport,
} from '../provision/invitation-promote.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { resolvePromotionUpdateScope } from '../provision/invitation-update-options.ts';
import { revalidatePromotionVolatilePreconditions } from '../provision/promotion-volatile-revalidation.ts';
import type { UpdateScope } from '../provision/semantic-delta.ts';
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
import { toPublicProductionApplyPlan } from './production-apply-format.ts';

const PRODUCTION_APPLY_OPERATION_TYPE = 'production_apply';

export interface ProductionApplyAssemblerDeps {
	preflightSchema?: () => MigrationPlan;
	listSlugs?: () => string[];
	resolvePackage?: (slug: string) => Promise<InvitationPackageData>;
	resolveInvitationUpdateScope?: (slug: string) => UpdateScope | undefined;
	getProductionDbUrl?: () => { url: string };
	inspectPatchPreview?: (prepared: PreparedProductionPatch) => ProductionPatchPreviewAssessment;
	runInvitationPreflight?: (
		packageData: InvitationPackageData,
		updateScope?: UpdateScope,
	) => Promise<PromotionPreflightReport>;
	preparePatch?: typeof prepareProductionPatchFile;
}

export interface ProductionApplyExecuteDeps extends ProductionApplyAssemblerDeps {
	requireOwnerApply?: (input: OwnerProductionApplyInput) => Promise<void>;
	applySchema?: (input: {
		authorizedPlanBindingHex: string;
	}) => Promise<
		Omit<OrchestrateMigrateResult, 'state'> & Partial<Pick<OrchestrateMigrateResult, 'state'>>
	>;
	applyInvitation?: (input: {
		packageData: InvitationPackageData;
		authorizedPlanBindingHex: string;
		updateScope?: UpdateScope;
		reviewedPreflight?: PromotionPreflightReport;
	}) => Promise<PromotionApplyReport>;
	revalidateInvitationPlan?: (reviewed: ProductionApplyPlan) => Promise<void>;
	applyPatch?: typeof applyPreparedProductionPatch;
	ensurePatchBackup?: (input: {
		prodDbUrl: string;
		purpose: 'standalone';
		planId: string;
		retryCommand: string;
		operationLabel: string;
	}) => Pick<CriticalProductionBackupPreparation, 'manifestPath'>;
	revalidatePatchBackup?: (input: {
		prodDbUrl: string;
		manifestPath: string;
		retryCommand: string;
	}) => unknown;
	ensureSharedBackup?: typeof ensureCriticalProductionBackup;
	preparedCriticalBackupManifestPath?: string;
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

function defaultInvitationUpdateScope(slug: string): UpdateScope | undefined {
	const definition = listInvitationDefinitions().find((candidate) => candidate.slug === slug);
	return resolvePromotionUpdateScope({ deliveryScope: definition?.deliveryScope });
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
	expectedPin: readonly string[] | null = null,
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
					expectedPin,
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
		const updateScope = (deps.resolveInvitationUpdateScope ?? defaultInvitationUpdateScope)(
			slug,
		);
		const runPreflight =
			deps.runInvitationPreflight ??
			((data: InvitationPackageData, scope?: UpdateScope) =>
				runPromotionPreflight({
					packageData: data,
					requireBackup: false,
					updateScope: scope,
					getProductionDbUrl: getProdDbUrl,
				}));
		const preflight = await runPreflight(packageData, updateScope);
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
			updateScope,
			preflight,
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

export async function buildProductionApplyPlan(
	args: ProductionApplyCliArgs,
	deps: ProductionApplyAssemblerDeps = {},
): Promise<ProductionApplyPlan> {
	const scope = scopeFromArgs(args);
	const schemaItem = await inspectSchema(scope.schema, deps, args.expectedPin);
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
	const match = matchProductionWritePermit({
		dbUrl,
		bindingHex,
		operationType: PRODUCTION_APPLY_OPERATION_TYPE,
	});
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
	deps: ProductionApplyExecuteDeps,
): void {
	if (ownerUserId) return;
	const patch = mutations.find((item) => item.domain === 'patch');
	if (!patch) return;
	const prepared = (deps.preparePatch ?? prepareProductionPatchFile)(patch.id);
	if (!patchSqlRequiresOwnerUserId(prepared.sql)) return;
	throw new OperatorError({
		title: 'Falta --owner-user-id',
		cause: 'Este parche asigna dueño y exige --owner-user-id.',
		code: 'OWNER_USER_ID_REQUIRED',
		remediation: [`Reintente con ${productionPatchApplyCommand(patch.id, prepared.sql)}.`],
	});
}

function throwIfPatchApiIdentityInvalid(
	mutations: readonly ProductionApplyPlanItem[],
	deps: ProductionApplyExecuteDeps,
): void {
	if (!mutations.some((item) => item.domain === 'patch')) return;
	const dbUrl = (deps.getProductionDbUrl ?? getProdDbUrl)().url;
	try {
		resolveProductionPatchApiUrl(dbUrl);
	} catch (error: unknown) {
		throw new OperatorError({
			title: 'Falta la identidad API de Production',
			cause: error instanceof Error ? error.message : String(error),
			code: 'PRODUCTION_API_IDENTITY_INVALID',
			remediation: [
				'PROD_DB_URL debe apuntar al proyecto Production allowlisted.',
				'Si define PROD_SUPABASE_URL, debe coincidir con ese proyecto.',
				'No use SUPABASE_URL local. Este chequeo corre antes del respaldo.',
			],
		});
	}
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
		operationType: PRODUCTION_APPLY_OPERATION_TYPE,
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

function isInvitationOnlyPlan(plan: ProductionApplyPlan): boolean {
	return (
		!plan.scope.schema &&
		!plan.scope.patchFile &&
		plan.items.some((item) => item.domain === 'invitation')
	);
}

async function revalidateInvitationOnlyPlan(
	reviewed: ProductionApplyPlan,
	deps: ProductionApplyExecuteDeps,
): Promise<void> {
	if (deps.revalidateInvitationPlan) {
		await deps.revalidateInvitationPlan(reviewed);
		return;
	}
	const resolvePackage =
		deps.resolvePackage ??
		(async (target: string) => {
			const resolved = await resolveInvitationPackageInput({ slug: target });
			return resolved.packageData;
		});
	for (const item of reviewed.items.filter((entry) => entry.domain === 'invitation')) {
		const packageData = await resolvePackage(item.id);
		if (item.packageHash && packageData.packageHash !== item.packageHash) {
			throw new OperatorError({
				title: 'El artefacto de invitación cambió antes de aplicar',
				cause: `La huella actual de ${item.id} no coincide con el plan autorizado.`,
				code: 'PLAN_DRIFT',
				remediation: [
					'Vuelva a ejecutar pnpm prod:apply sin --apply.',
					'Revisar el plan nuevo y aplicar de nuevo (no reutilice la autorización anterior).',
				],
			});
		}
		if (!item.preflight) continue;
		await revalidatePromotionVolatilePreconditions({
			reviewed: item.preflight,
			packageData,
			getProductionDbUrl: deps.getProductionDbUrl ?? getProdDbUrl,
		});
	}
}

async function applySchemaMutation(
	mutations: readonly ProductionApplyPlanItem[],
	reviewed: ProductionApplyPlan,
	deps: ProductionApplyExecuteDeps,
	outcomes: ProductionApplyOutcomeRow[],
	expectedPin: readonly string[] | null = null,
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
					expectedPin,
					authorizedPlanBindingHex: input.authorizedPlanBindingHex,
					authorizedPermitOperationType: PRODUCTION_APPLY_OPERATION_TYPE,
					preparedCriticalBackupManifestPath: deps.preparedCriticalBackupManifestPath,
				}));
		const result = await applySchema({ authorizedPlanBindingHex: reviewed.planId });
		replaceOutcome(outcomes, 'schema', {
			id: 'schema',
			outcome: 'APPLIED_AND_VERIFIED',
			detail: result.plan.pendingVersions.join(', '),
		});
		return result.wrote;
	} catch (error) {
		replaceOutcome(outcomes, 'schema', {
			id: 'schema',
			outcome: error instanceof MigrateApplyError ? error.state : 'NOT_APPLIED',
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
	if (packageData.packageHash !== item.binding) {
		throw new OperatorError({
			title: 'El artefacto de invitación cambió antes de escribir',
			cause: `La huella actual de ${item.id} no coincide con el plan revisado.`,
			code: 'ARTIFACT_DRIFT',
			remediation: [
				'Vuelva a generar y revisar el plan de Production.',
				'No reutilice la autorización de un artefacto anterior.',
			],
		});
	}
	const applyInvitation =
		deps.applyInvitation ??
		((input: {
			packageData: InvitationPackageData;
			authorizedPlanBindingHex: string;
			updateScope?: UpdateScope;
			reviewedPreflight?: PromotionPreflightReport;
		}) =>
			orchestrateInvitationPromotion({
				packageData: input.packageData,
				updateScope: input.updateScope,
				reviewedPreflight: input.reviewedPreflight,
				authorizedProductionPermit: {
					bindingHex: input.authorizedPlanBindingHex,
					operationType: PRODUCTION_APPLY_OPERATION_TYPE,
				},
				requireOwnerApply: async (gate) => {
					assertDelegatedPermit(gate.dbUrl, input.authorizedPlanBindingHex);
				},
			}));
	const report = await applyInvitation({
		packageData,
		authorizedPlanBindingHex: reviewed.planId,
		updateScope: item.updateScope,
		reviewedPreflight: item.preflight,
	});
	if (report.status === 'BLOCKED' || report.status === 'APPLIED_BUT_VERIFICATION_FAILED') {
		replaceOutcome(outcomes, item.id, {
			id: item.id,
			outcome:
				report.status === 'APPLIED_BUT_VERIFICATION_FAILED'
					? 'APPLIED_VERIFICATION_FAILED'
					: 'NOT_APPLIED',
			detail: report.reason ?? report.status,
		});
		throwInvitationApplyFailure(report);
	}
	replaceOutcome(outcomes, item.id, {
		id: item.id,
		outcome: report.status === 'IN_SYNC' ? 'already_applied' : 'APPLIED_AND_VERIFIED',
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
				!['NOT_APPLIED', 'APPLIED_VERIFICATION_FAILED'].includes(
					outcomes.find((row) => row.id === item.id)?.outcome ?? '',
				)
			) {
				replaceOutcome(outcomes, item.id, {
					id: item.id,
					outcome: 'NOT_APPLIED',
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
	try {
		const prepared = (deps.preparePatch ?? prepareProductionPatchFile)(patchMutation.id);
		if (prepared.fingerprint !== patchMutation.binding) {
			throw new OperatorError({
				title: 'El artefacto de parche cambió antes de escribir',
				cause: `La huella actual de ${patchMutation.id} no coincide con el plan revisado.`,
				code: 'ARTIFACT_DRIFT',
				remediation: [
					'Vuelva a generar y revisar el plan de Production.',
					'No reutilice la autorización de un parche anterior.',
				],
			});
		}
		const dbUrl = (deps.getProductionDbUrl ?? getProdDbUrl)().url;
		const retryCommand = productionPatchApplyCommand(patchMutation.id, prepared.sql);
		const manifestPath =
			deps.preparedCriticalBackupManifestPath ??
			(deps.ensurePatchBackup ?? ensureCriticalProductionBackup)({
				prodDbUrl: dbUrl,
				purpose: 'standalone',
				planId: reviewed.planId,
				retryCommand,
				operationLabel: 'la aplicación del parche especializado',
			}).manifestPath;
		(deps.revalidatePatchBackup ?? revalidateCriticalProductionBackup)({
			prodDbUrl: dbUrl,
			manifestPath,
			retryCommand,
		});
		const applyPatch = deps.applyPatch ?? applyPreparedProductionPatch;
		await applyPatch({
			prepared,
			ownerUserId,
			authorizedPlanBindingHex: reviewed.planId,
		});
		replaceOutcome(outcomes, patchMutation.id, {
			id: patchMutation.id,
			outcome: 'APPLIED_AND_VERIFIED',
		});
		return true;
	} catch (error) {
		replaceOutcome(outcomes, patchMutation.id, {
			id: patchMutation.id,
			outcome:
				error instanceof ProductionPatchApplyError
					? 'APPLIED_VERIFICATION_FAILED'
					: 'NOT_APPLIED',
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
	throwIfPatchMissingOwner(mutations, ownerUserId, deps);
	throwIfPatchApiIdentityInvalid(mutations, deps);
	if (mutations.length === 0) {
		return {
			plan: toPublicProductionApplyPlan(reviewed),
			wrote: false,
			outcomes: reviewed.items.map(outcomeFromItem),
		};
	}

	const hasSchema = mutations.some((item) => item.domain === 'schema');
	const hasPatch = mutations.some((item) => item.domain === 'patch');
	const shouldPrepareSharedBackup =
		(hasSchema || hasPatch) &&
		Boolean(
			deps.ensureSharedBackup ||
			deps.ensurePatchBackup ||
			(hasSchema && !deps.applySchema) ||
			(hasPatch && !deps.applyPatch),
		);
	let sharedBackupManifest: string | undefined;
	if (shouldPrepareSharedBackup) {
		const dbUrl = (deps.getProductionDbUrl ?? getProdDbUrl)().url;
		const sharedInput = {
			prodDbUrl: dbUrl,
			planId: reviewed.planId,
			retryCommand: 'pnpm prod:apply',
			operationLabel: 'la autorización del plan Production',
		};
		const backup = deps.ensureSharedBackup
			? deps.ensureSharedBackup({
					...sharedInput,
					purpose: hasSchema ? 'migrate-pre' : 'standalone',
					reuseExisting: true,
				})
			: deps.ensurePatchBackup
				? deps.ensurePatchBackup({
						...sharedInput,
						purpose: 'standalone',
					})
				: ensureCriticalProductionBackup({
						...sharedInput,
						purpose: hasSchema ? 'migrate-pre' : 'standalone',
						reuseExisting: true,
					});
		sharedBackupManifest = backup.manifestPath;
	}
	const executeDeps: ProductionApplyExecuteDeps = {
		...deps,
		preparedCriticalBackupManifestPath:
			sharedBackupManifest ?? deps.preparedCriticalBackupManifestPath,
	};

	try {
		await authorizeReviewedPlan(reviewed, mutations, executeDeps);
		if (isInvitationOnlyPlan(reviewed)) {
			await revalidateInvitationOnlyPlan(reviewed, executeDeps);
		} else {
			throwIfPlanDrifted(reviewed, await buildProductionApplyPlan(args, executeDeps));
		}

		const outcomes = reviewed.items.map(outcomeFromItem);
		const wrote = await withProductionPermitScope(
			{
				bindingHex: reviewed.planId,
				operationType: PRODUCTION_APPLY_OPERATION_TYPE,
			},
			async () => {
				const wroteSchema = await applySchemaMutation(
					mutations,
					reviewed,
					executeDeps,
					outcomes,
					args.expectedPin,
				);
				const wroteInvitations = await applyInvitationMutations(
					mutations,
					reviewed,
					executeDeps,
					outcomes,
				);
				const wrotePatch = await applyPatchMutation(
					mutations,
					reviewed,
					ownerUserId,
					executeDeps,
					outcomes,
				);
				return wroteSchema || wroteInvitations || wrotePatch;
			},
		);
		return {
			plan: toPublicProductionApplyPlan(reviewed),
			wrote,
			outcomes,
		};
	} finally {
		clearProductionWritePermit();
	}
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
