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
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { resolvePromotionUpdateScope } from '../provision/invitation-update-options.ts';
import type { UpdateScope } from '../provision/semantic-delta.ts';
import {
	isTargetDivergenceConflictMessage,
	TARGET_DIVERGENCE_BLOCK_CODE,
} from '../provision/promotion-comparison.ts';
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
 * When the first preflight is blocked solely because the target has an unpublished draft
 * whose content diverges from both the incoming package and the last published version,
 * retry with `acknowledgeDiscardUnpublishedDraft: true`.
 *
 * This mirrors the interactive recovery that the release wizard already performs, but
 * without a user prompt: the draft has never been approved as a release, so discarding it
 * in favour of the package-approved content is always safe.
 *
 * Returns `undefined` when the first result is not a draft-divergence block, signalling
 * the caller to keep the original preflight unchanged.
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
): Promise<PromotionPreflightReport | undefined> {
	if (first.status !== 'BLOCKED') return undefined;
	if (!isTargetDivergenceConflictMessage(first.reason ?? '')) return undefined;
	return runPreflight(packageData, updateScope, true);
}

export async function inspectInvitation(
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
			((data: InvitationPackageData, scope?: UpdateScope, acknowledgeDiscardUnpublishedDraft?: boolean) =>
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
				? `Borrador inédito descartado automáticamente; ${preflight.reason ?? preflight.status}`
				: (preflight.reason ?? preflight.status),
			detail: preflight.reason ?? preflight.schema.detail,
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
