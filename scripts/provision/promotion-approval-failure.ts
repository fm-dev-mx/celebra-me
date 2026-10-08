/**
 * Exact Preview approval enforcement for Production promotion and the operator wording for each
 * failure reason (never approved, other hash, pending, expired, ...).
 */
import type { InvitationPackageData } from './invitation-package.ts';
import {
	PreviewApprovalError,
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
	type PreviewApprovalFailureReason,
} from './preview-approval-service.ts';
import type { PreviewLiveVerificationResult } from './preview-live-verification.ts';
import { ProductionPreflightError } from './production-preflight.ts';

export interface PromotionApprovalFailure {
	reason: PreviewApprovalFailureReason | 'UNCLASSIFIED';
	/** Spanish operator label for the reason. */
	label: string;
	detail: string;
}

export function requireApprovedRelease(
	packageData: InvitationPackageData,
	now?: Date,
	intendedProductionProjectRef?: string,
	liveRecheck?: PreviewLiveVerificationResult,
): PreviewApprovalArtifact {
	try {
		return verifyPreviewApprovalArtifact(
			{
				packageHash: packageData.packageHash,
				sourceHash: packageData.sourceHash,
				metadataHash: packageData.metadataHash,
				projectionHash: packageData.projectionHash,
				assetManifestHash: packageData.assetManifestHash,
				slug: packageData.invitation.slug,
				route: `/${packageData.invitation.eventType}/${packageData.invitation.slug}`,
				intendedProductionProjectRef,
			},
			{ now, liveRecheck },
		);
	} catch (error) {
		throw new ProductionPreflightError(
			'MISSING_PREVIEW_APPROVAL',
			`MISSING_PREVIEW_APPROVAL: exact approved Preview release is required. ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
}

const APPROVAL_FAILURE_LABELS: Record<PromotionApprovalFailure['reason'], string> = {
	NEVER_APPROVED: 'nunca aprobada en Preview',
	APPROVED_OTHER_HASH: 'aprobación de otro hash (la definición cambió tras la última aprobación)',
	PENDING_HOSTED_VALIDATION: 'aprobación pendiente de validación en Preview',
	EXPIRED: 'aprobación caducada (más de 7 días sin recheck en vivo)',
	OBSOLETE_CONTRACT: 'aprobación con contrato obsoleto',
	IDENTITY_MISMATCH: 'aprobación que no coincide con la release exacta',
	INCOMPLETE_EVIDENCE: 'evidencia de aprobación incompleta',
	UNCLASSIFIED: 'aprobación no verificable',
};

export function describeApprovalFailure(error: unknown): PromotionApprovalFailure {
	const cause =
		error instanceof ProductionPreflightError ? (error.technicalCause ?? error) : error;
	const reason = cause instanceof PreviewApprovalError ? cause.reason : 'UNCLASSIFIED';
	return {
		reason,
		label: APPROVAL_FAILURE_LABELS[reason],
		detail:
			cause instanceof Error
				? cause.message
				: cause
					? String(cause)
					: 'Sin detalle de error.',
	};
}

export function missingApprovalReason(slug: string, failure: PromotionApprovalFailure): string {
	return (
		`MISSING_PREVIEW_APPROVAL (${failure.label}): Production difiere del paquete y escribir exige ` +
		`la aprobación Preview exacta. Siguiente paso: pnpm invitation:release -- --slug ${slug} --targets preview. ` +
		`Detalle: ${failure.detail}`
	);
}
