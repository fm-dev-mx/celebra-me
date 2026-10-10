/**
 * Preflight inspection helpers for the Production apply plan assembler.
 *
 * Extracted from production-apply-orchestrator.ts to keep that file under the
 * max-lines ESLint limit. Not intended for use outside the orchestrator.
 */
import { getProdDbUrl } from './db-workflow-lib.ts';
import { preflightMigrate } from './migrate-orchestrator.ts';
import type { MigrationPlan } from './migration-plan.ts';
import { resolveInvitationPackageInput } from '../provision/invitation-package-input.ts';
import type { InvitationPackageData } from '../provision/invitation-package.ts';
import {
	runPromotionPreflight,
	type PromotionPreflightReport,
} from '../provision/invitation-promote.ts';
import {
	LIFECYCLE_NOT_PUBLISHED,
	lifecycleReleaseBlockFor,
} from '../provision/invitations/lifecycle-gate.ts';
import {
	listArchivedInvitationDefinitions,
	listAuthoringInvitationDefinitions,
	listInvitationDefinitions,
	listPublishedInvitationDefinitions,
} from '../provision/invitations/registry.ts';
import { resolvePromotionUpdateScope } from '../provision/invitation-update-options.ts';
import type { UpdateScope } from '../provision/semantic-delta.ts';
import { TARGET_DIVERGENCE_BLOCK_CODE } from '../provision/promotion-comparison.ts';
import {
	classifyInvitationPreflight,
	classifySchemaError,
	classifySchemaPreflight,
	type ProductionApplyPlanItem,
} from './production-apply-plan.ts';
import type { ProductionApplyAssemblerDeps } from './production-apply-orchestrator.ts';

export function schemaItemFromPlan(plan: MigrationPlan): ProductionApplyPlanItem {
	const readiness = classifySchemaPreflight({
		pendingVersions: plan.pendingVersions,
		compatibilityStatus: plan.compatibilityStatus,
	});
	const pending = plan.pendingVersions.filter((version) => version !== 'none');
	const compatibilityBlocked = plan.compatibilityStatus !== 'allow';
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
		detail: compatibilityBlocked
			? formatCompatibilityReasons(plan.compatibilityReasons)
			: undefined,
		blockCode: compatibilityBlocked
			? compatibilityBlockCode(plan.compatibilityReasons)
			: undefined,
	};
}

function formatCompatibilityReasons(reasons: readonly string[]): string {
	const value = reasons
		.map((reason) => reason.replace(/https?:\/\/\S+/gi, '[URL redactada]'))
		.map((reason) => reason.replace(/\b[a-f0-9]{40}\b/gi, '[SHA redactado]'))
		.join('; ')
		.trim();
	return value || 'Compatibilidad de despliegue no verificada.';
}

function compatibilityBlockCode(reasons: readonly string[]): string {
	const combined = reasons.join('\n');
	if (/UNVERIFIED: Production deployment evidence unavailable/i.test(combined)) {
		return 'PRODUCTION_DEPLOYMENT_EVIDENCE_UNAVAILABLE';
	}
	if (/requires immutable deployed-application evidence|provides capability/i.test(combined)) {
		return 'DEPLOYED_APP_CAPABILITY_MISSING';
	}
	return 'DEPLOYMENT_COMPATIBILITY_BLOCKED';
}

export function schemaItemFromError(error: unknown): ProductionApplyPlanItem {
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

export async function inspectSchema(
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

/**
 * Retry an unpublished-draft divergence only after an explicit CLI acknowledgement.
 * Managed-baseline drift is never eligible for this recovery path.
 */
export async function resolveWithDiscardIfDraftDivergence(
	first: PromotionPreflightReport,
	runPreflight: (
		data: InvitationPackageData,
		scope?: UpdateScope,
		acknowledgeDiscardUnpublishedDraft?: boolean,
	) => Promise<PromotionPreflightReport>,
	packageData: InvitationPackageData,
	updateScope: UpdateScope | undefined,
	acknowledgeDiscardUnpublishedDraft: boolean,
): Promise<PromotionPreflightReport | undefined> {
	if (
		!acknowledgeDiscardUnpublishedDraft ||
		first.status !== 'BLOCKED' ||
		first.blockCode !== TARGET_DIVERGENCE_BLOCK_CODE
	) {
		return undefined;
	}
	return runPreflight(packageData, updateScope, true);
}

function sortedSlugs(definitions: readonly { slug: string }[]): string[] {
	return definitions.map((definition) => definition.slug).sort((a, b) => a.localeCompare(b));
}

/** Discovery (`--all-ready`, inspect-all): published definitions plan; the rest are reported apart. */
export function discoverProductionApplySlugs(deps: ProductionApplyAssemblerDeps): {
	slugs: string[];
	archivedSlugs: string[];
	authoringSlugs: string[];
} {
	return {
		slugs: (deps.listSlugs ?? (() => sortedSlugs(listPublishedInvitationDefinitions())))(),
		archivedSlugs: (
			deps.listArchivedSlugs ?? (() => sortedSlugs(listArchivedInvitationDefinitions()))
		)(),
		authoringSlugs: (
			deps.listAuthoringSlugs ?? (() => sortedSlugs(listAuthoringInvitationDefinitions()))
		)(),
	};
}

export async function inspectInvitation(
	slug: string,
	schemaReadyInPlan: boolean,
	deps: ProductionApplyAssemblerDeps,
	acknowledgeDiscardUnpublishedDraft = false,
): Promise<ProductionApplyPlanItem> {
	const lifecycleBlock = (deps.lifecycleReleaseBlock ?? lifecycleReleaseBlockFor)(
		slug,
		'production',
	);
	if (lifecycleBlock) {
		return {
			domain: 'invitation',
			id: slug,
			readiness: 'BLOCKED',
			summary: lifecycleBlock,
			detail: lifecycleBlock,
			blockCode: LIFECYCLE_NOT_PUBLISHED,
		};
	}
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
			((
				data: InvitationPackageData,
				scope?: UpdateScope,
				acknowledgeDiscardUnpublishedDraft?: boolean,
			) =>
				runPromotionPreflight({
					packageData: data,
					requireBackup: false,
					updateScope: scope,
					acknowledgeDiscardUnpublishedDraft,
					getProductionDbUrl: getProdDbUrl,
				}));
		const firstPreflight = await runPreflight(packageData, updateScope);
		const recovered = await resolveWithDiscardIfDraftDivergence(
			firstPreflight,
			runPreflight,
			packageData,
			updateScope,
			acknowledgeDiscardUnpublishedDraft,
		);
		const preflight = recovered ?? firstPreflight;
		const draftDiscarded = recovered !== undefined && preflight.status !== 'BLOCKED';
		const readiness = draftDiscarded
			? 'READY_AFTER_DISCARD'
			: classifyInvitationPreflight({
					status: preflight.status,
					blockCode: preflight.blockCode,
					schemaState: preflight.schema.state,
					schemaReadyInPlan,
				});
		return {
			domain: 'invitation',
			id: slug,
			readiness,
			summary: draftDiscarded
				? `El borrador inédito se reemplazará tras confirmación del propietario; ${preflight.reason ?? preflight.status}`
				: (preflight.reason ?? preflight.status),
			detail:
				preflight.reason ??
				(preflight.status === 'IN_SYNC' && preflight.approvalFailure
					? `Production ya coincide; ${preflight.approvalFailure.label} (no se requiere: no hay escrituras).`
					: preflight.schema.detail),
			blockCode: draftDiscarded ? TARGET_DIVERGENCE_BLOCK_CODE : preflight.blockCode,
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

function defaultInvitationUpdateScope(slug: string): UpdateScope | undefined {
	const definition = listInvitationDefinitions().find((candidate) => candidate.slug === slug);
	return resolvePromotionUpdateScope({ deliveryScope: definition?.deliveryScope });
}
