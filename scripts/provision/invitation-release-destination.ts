/**
 * Destination readiness for the invitation:release wizard.
 * Operator chooses outcomes (Local / Prepare Preview / Production), not technical stages.
 */

import { getInvitationDefinition } from './invitations/registry.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import { verifyPreviewApprovalArtifact } from './preview-approval-service.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';

export type ReleaseDestination = 'local' | 'prepare_preview' | 'production';

export interface DestinationReadiness {
	slug: string;
	title: string;
	packageHash: string;
	sourceHash: string;
	/** Exact Preview approval only — not Production apply eligibility (`pnpm prod:apply`). */
	productionReady: boolean;
	productionBlockReason?: string;
	hasPendingPreviewApproval: boolean;
}

export async function resolveDestinationReadiness(input: {
	slug: string;
	sourceDir?: string;
	packagePath?: string;
	allowStalePackage?: boolean;
}): Promise<DestinationReadiness> {
	const definition = getInvitationDefinition(input.slug);
	const packageInput = await resolveInvitationPackageInput({
		slug: definition.slug,
		sourceDir: input.sourceDir,
		packagePath: input.packagePath,
		allowStalePackage: input.allowStalePackage,
	});
	const packageHash = packageInput.packageData.packageHash;
	const pending = getDefaultPreviewApprovalStore().get(packageHash);
	const hasPendingPreviewApproval =
		pending?.approvalState === 'pending_hosted_validation' &&
		pending.packageHash === packageHash;

	let productionReady = false;
	let productionBlockReason: string | undefined;
	try {
		verifyPreviewApprovalArtifact({
			packageHash,
			sourceHash: packageInput.packageData.sourceHash,
			metadataHash: packageInput.packageData.metadataHash,
			projectionHash: packageInput.packageData.projectionHash,
			assetManifestHash: packageInput.packageData.assetManifestHash,
			slug: packageInput.packageData.invitation.slug,
			route: `/${packageInput.packageData.invitation.eventType}/${packageInput.packageData.invitation.slug}`,
			intendedProductionProjectRef: SUPABASE_PROJECT_REFS.production,
		});
		productionReady = true;
	} catch (error) {
		productionBlockReason =
			error instanceof Error
				? error.message
				: 'Production requiere una aprobación Preview exacta y vigente.';
	}

	return {
		slug: definition.slug,
		title: definition.title,
		packageHash,
		sourceHash: packageInput.packageData.sourceHash,
		productionReady,
		productionBlockReason,
		hasPendingPreviewApproval,
	};
}

export function describeDestination(destination: ReleaseDestination): string {
	switch (destination) {
		case 'local':
			return 'Actualizar Local';
		case 'prepare_preview':
			return 'Preparar Preview (Local + Preview + verificación)';
		case 'production':
			return 'Publicar en Production';
	}
}
