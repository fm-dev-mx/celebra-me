/**
 * Guided next-action derivation for invitation:release.
 * Order: definition → Local → Preview → approved → Production.
 */
import { evaluateInvitationReadiness } from './invitation-readiness.ts';
import { discoverInvitationPromotionCandidates } from './invitation-promotion-candidates.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';

export type InvitationReleaseNextAction =
	| 'local'
	| 'preview'
	| 'approve'
	| 'production'
	| 'in_sync'
	| 'blocked';

export interface InvitationReleaseNextActionResult {
	action: InvitationReleaseNextAction;
	slug: string;
	title: string;
	reason: string;
	/** Suggested mutation targets for content stages. */
	targets?: Array<'local' | 'preview' | 'production'>;
	packageHash?: string;
	remediation?: readonly string[];
}

/**
 * Derive the single next valid human action for a managed invitation release.
 */
export async function deriveInvitationReleaseNextAction(input: {
	slug: string;
}): Promise<InvitationReleaseNextActionResult> {
	const definition = getInvitationDefinition(input.slug);
	const base = { slug: definition.slug, title: definition.title };

	let localReady = false;
	try {
		const readiness = await evaluateInvitationReadiness({ slug: definition.slug });
		localReady = readiness.verdict === 'READY';
		if (readiness.verdict === 'BLOCKED') {
			return {
				...base,
				action: 'blocked',
				reason: readiness.reasons[0] ?? 'Local no pudo verificarse.',
				remediation: ['Revise Supabase local y vuelva a ejecutar pnpm invitation:release.'],
			};
		}
	} catch (error) {
		return {
			...base,
			action: 'local',
			targets: ['local'],
			reason:
				error instanceof Error
					? error.message
					: 'Local aún no está listo para la release administrada.',
		};
	}

	if (!localReady) {
		return {
			...base,
			action: 'local',
			targets: ['local'],
			reason: 'La definición existe, pero Local aún no está sincronizado con la release.',
		};
	}

	const summary = await discoverInvitationPromotionCandidates({
		definitions: [definition],
	});
	const candidate = summary.candidates[0];
	if (!candidate) {
		return {
			...base,
			action: 'blocked',
			reason: 'No fue posible evaluar el estado de la release.',
		};
	}

	if (candidate.disposition === 'in-sync') {
		return {
			...base,
			action: 'in_sync',
			reason: candidate.reason,
		};
	}

	if (candidate.disposition === 'ready' && candidate.selectable) {
		return {
			...base,
			action: 'production',
			targets: ['production'],
			packageHash: candidate.packageInput?.packageData.packageHash,
			reason: candidate.reason,
		};
	}

	// Attention: prefer finalize when a pending approval already exists for the current package.
	try {
		const packageInput = candidate.packageInput ?? (await resolveInvitationPackageInput({
			slug: definition.slug,
		}));
		const packageHash = packageInput.packageData.packageHash;
		const pending = getDefaultPreviewApprovalStore().get(packageHash);
		if (pending && pending.approvalState === 'pending_hosted_validation') {
			return {
				...base,
				action: 'approve',
				packageHash,
				reason: 'Preview tiene una aprobación pendiente de finalización.',
			};
		}
	} catch {
		// Fall through to Preview content apply.
	}

	return {
		...base,
		action: 'preview',
		targets: ['preview'],
		reason:
			candidate.remediation[0] ??
			candidate.reason ??
			'Aplique y apruebe la release en Preview antes de Production.',
		remediation: candidate.remediation,
	};
}

export function describeReleaseNextAction(result: InvitationReleaseNextActionResult): string {
	switch (result.action) {
		case 'local':
			return `Siguiente: aplicar en Local (${result.slug})`;
		case 'preview':
			return `Siguiente: aplicar en Preview (${result.slug})`;
		case 'approve':
			return `Siguiente: finalizar aprobación Preview (${result.slug})`;
		case 'production':
			return `Siguiente: promover a Production (${result.slug})`;
		case 'in_sync':
			return `Production ya está sincronizada (${result.slug})`;
		case 'blocked':
			return `Bloqueado: ${result.reason}`;
	}
}
