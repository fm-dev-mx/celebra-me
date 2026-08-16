/**
 * Pure presentation of canonical status. Does not classify schema or promotions.
 */
import { combineEvidence, ENVS } from './evidence';
import { isAuthoringLifecycle } from './promotion-lifecycle';
import type {
	CanonicalPromotionRow,
	EnvironmentPromotionState,
	EvidenceState,
	InvitationLifecycle,
	PromotionAction,
	PromotionDestination,
	PromotionHandoff,
	PromotionReasonCode,
	PromotionSource,
	SchemaLifecycleState,
	TargetEnv,
} from './types';

export function derivePromotionRoute(
	action: PromotionAction,
	reasonCode: PromotionReasonCode,
): { source: PromotionSource | null; destination: PromotionDestination | null } {
	if (action === 'PROMOTE_PREVIEW') return { source: 'canonical', destination: 'preview' };
	if (action === 'PROMOTE_PRODUCTION') return { source: 'preview', destination: 'production' };
	if (action === 'BLOCKED' && reasonCode === 'LOCAL_BEHIND_PREVIEW_ALIGNED') {
		return { source: 'canonical', destination: 'local' };
	}
	return { source: null, destination: null };
}

function emptyHandoff(
	overrides: Partial<PromotionHandoff> &
		Pick<PromotionHandoff, 'dryRunCommand' | 'dryRunStepType' | 'steps'>,
): PromotionHandoff {
	return {
		applyCommand: null,
		applyStepType: 'Manual/HITL',
		ownerApplyRequired: false,
		optionalDiagnosticCommand: null,
		...overrides,
	};
}
function promoteHandoff(
	slug: string,
	destination: 'preview' | 'production' | 'local',
	ownerApplyRequired: boolean,
): PromotionHandoff {
	const destLabel =
		destination === 'production'
			? 'Production'
			: destination[0]!.toUpperCase() + destination.slice(1);
	const applyCommand =
		destination === 'production'
			? `pnpm prod:apply -- --slug ${slug} --apply`
			: `pnpm invitation:release -- --slug ${slug} --targets ${destination} --apply`;
	return {
		dryRunCommand: null,
		dryRunStepType: 'Apply',
		applyCommand,
		applyStepType: 'Apply',
		ownerApplyRequired,
		optionalDiagnosticCommand: null,
		steps: [
			ownerApplyRequired
				? 'OWNER APPLY in TTY (CLI runs preflight and release-check)'
				: `Authorized ${destLabel} apply`,
		],
	};
}

function unknownPublicationHandoff(
	reasonCode: PromotionReasonCode,
	environments?: Record<TargetEnv, EnvironmentPromotionState>,
	envEvidence?: Record<TargetEnv, EvidenceState>,
): PromotionHandoff {
	if (reasonCode === 'CANONICAL_UNAVAILABLE') {
		return emptyHandoff({
			dryRunCommand: null,
			dryRunStepType: 'Manual/HITL',
			steps: ['Fix canonical registry definition', 'Do not promote'],
		});
	}
	const unknownEnvs = ENVS.filter((env) => environments?.[env] === 'unknown');
	const needsRevalidation = unknownEnvs.some(
		(env) => (envEvidence?.[env] ?? 'UNVERIFIED') === 'UNVERIFIED',
	);
	if (needsRevalidation) {
		return emptyHandoff({
			dryRunCommand: 'pnpm dbs',
			dryRunStepType: 'Diagnose',
			steps: ['Revalidate live evidence', 'Do not promote'],
		});
	}
	return emptyHandoff({
		dryRunCommand: null,
		dryRunStepType: 'Manual/HITL',
		optionalDiagnosticCommand: 'pnpm dbs --diagnostics',
		steps: [
			'No canonical remediation currently exists',
			'Optional diagnostics do not resolve UNKNOWN',
		],
	});
}

function blockedPromotionHandoff(
	reasonCode: PromotionReasonCode,
	slug: string,
	eventType?: string,
	environments?: Record<TargetEnv, EnvironmentPromotionState>,
	packageHash?: string,
	hasPendingPreviewApproval?: boolean,
): PromotionHandoff {
	if (reasonCode === 'LOCAL_BEHIND_PREVIEW_ALIGNED') {
		return promoteHandoff(slug, 'local', false);
	}
	if (reasonCode === 'IDENTITY_CONFLICT') {
		const conflictEnv = ENVS.find((env) => environments?.[env] === 'conflict') ?? 'local';
		const dryRunCommand =
			conflictEnv === 'production'
				? null
				: `pnpm invitation:diagnose-identity -- --target ${conflictEnv}`;
		return emptyHandoff({
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			steps: ['Diagnose identity conflict', 'Do not promote'],
		});
	}
	if (reasonCode === 'MANAGED_DIVERGENCE') {
		const dryRunCommand = eventType
			? `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`
			: null;
		return emptyHandoff({
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			steps: ['Diagnose semantic content divergence', 'Do not promote'],
		});
	}
	if (reasonCode === 'PRODUCTION_AHEAD_OF_PREVIEW') {
		const dryRunCommand = eventType
			? `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`
			: null;
		return emptyHandoff({
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			steps: ['Diagnose content parity', 'Update Preview before Production'],
		});
	}
	if (reasonCode === 'PREVIEW_APPROVAL_REQUIRED') {
		const approveCommand =
			hasPendingPreviewApproval && packageHash
				? `pnpm invitation:release -- --package-hash ${packageHash} --approve`
				: null;
		return {
			dryRunCommand: `pnpm invitation:release -- --slug ${slug} --targets preview --dry-run`,
			dryRunStepType: 'Verify',
			applyCommand:
				approveCommand ??
				`pnpm invitation:release -- --slug ${slug} --targets preview --apply`,
			applyStepType: approveCommand ? 'Manual/HITL' : 'Apply',
			ownerApplyRequired: false,
			optionalDiagnosticCommand: null,
			steps: approveCommand
				? [
						'Confirme paridad Preview con el dry-run canónico.',
						'Apruebe el package-hash exacto en Preview antes de Production.',
					]
				: [
						'Confirme paridad Preview con el dry-run canónico.',
						'Aplique Preview para crear o refrescar el artefacto pending (cero escrituras de contenido si ya está IN_SYNC).',
						'Apruebe el package-hash impreso antes de Production.',
					],
		};
	}
	if (reasonCode === 'PRODUCTION_PREFLIGHT_BLOCKED') {
		return emptyHandoff({
			dryRunCommand: `pnpm prod:apply -- --slug ${slug}`,
			dryRunStepType: 'Verify',
			steps: ['Inspect the canonical Production plan', 'Do not apply while BLOCKED'],
		});
	}
	return emptyHandoff({
		dryRunCommand: null,
		dryRunStepType: 'Manual/HITL',
		steps: ['Investigate blocker', 'Do not promote'],
	});
}

function unknownPromotionHandoff(
	reasonCode: PromotionReasonCode,
	slug: string,
	environments?: Record<TargetEnv, EnvironmentPromotionState>,
	envEvidence?: Record<TargetEnv, EvidenceState>,
): PromotionHandoff {
	if (reasonCode === 'PRODUCTION_PREFLIGHT_UNVERIFIED') {
		return emptyHandoff({
			dryRunCommand: `pnpm prod:apply -- --slug ${slug}`,
			dryRunStepType: 'Verify',
			steps: ['Re-run the canonical Production plan', 'Do not apply without live evidence'],
		});
	}
	return unknownPublicationHandoff(reasonCode, environments, envEvidence);
}

function derivePromotionHandoff(
	action: PromotionAction,
	reasonCode: PromotionReasonCode,
	slug: string,
	eventType?: string,
	environments?: Record<TargetEnv, EnvironmentPromotionState>,
	envEvidence?: Record<TargetEnv, EvidenceState>,
	packageHash?: string,
	hasPendingPreviewApproval?: boolean,
): PromotionHandoff {
	if (action === 'PROMOTE_PREVIEW') return promoteHandoff(slug, 'preview', false);
	if (action === 'PROMOTE_PRODUCTION') return promoteHandoff(slug, 'production', true);
	if (action === 'BLOCKED') {
		return blockedPromotionHandoff(
			reasonCode,
			slug,
			eventType,
			environments,
			packageHash,
			hasPendingPreviewApproval,
		);
	}
	if (action === 'UNKNOWN') {
		return unknownPromotionHandoff(reasonCode, slug, environments, envEvidence);
	}
	return emptyHandoff({
		dryRunCommand: null,
		dryRunStepType: 'Verify',
		applyStepType: 'Verify',
		steps: [],
	});
}

export function uncertaintyNotesForEnvironments(
	environments: Record<TargetEnv, EnvironmentPromotionState>,
): string[] {
	const notes: string[] = [];
	for (const env of ENVS) {
		if (environments[env] === 'unknown') {
			notes.push(`${env.toUpperCase()} UNKNOWN`);
		}
	}
	return notes;
}

export function formatSchemaMigrationsLabel(
	lifecycle: SchemaLifecycleState,
	appliedCount: number | null,
	expectedCount: number,
): string {
	if (appliedCount == null) {
		return `Schema migrations: ${lifecycle}`;
	}
	return `Schema migrations: ${lifecycle} ${appliedCount}/${expectedCount}`;
}

export function formatTransitionLabel(
	source: PromotionSource | null,
	destination: PromotionDestination | null,
): string {
	if (!source || !destination) return 'No valid promotion path';
	const sourceLabel =
		source === 'canonical' ? 'Canonical' : source[0]!.toUpperCase() + source.slice(1);
	const destLabel = destination[0]!.toUpperCase() + destination.slice(1);
	return `${sourceLabel} → ${destLabel}`;
}

export function formatPublicationReason(
	environments: Record<TargetEnv, EnvironmentPromotionState>,
	reasonCode: PromotionReasonCode,
	details?: { preflightBlockCode?: string | null; preflightReason?: string | null },
): string {
	const local = environments.local;
	const preview = environments.preview;
	const production = environments.production;
	if (reasonCode === 'PREVIEW_ALIGNED_PRODUCTION_BEHIND') {
		return `Local + Preview ${local === 'match' && preview === 'match' ? 'match canonical' : `local ${local}, preview ${preview}`}. Production is ${production}.`;
	}
	if (reasonCode === 'PREVIEW_BEHIND_CANONICAL') {
		return `Local ${local}. Preview is ${preview}. Production is ${production}.`;
	}
	if (reasonCode === 'PRODUCTION_AHEAD_OF_PREVIEW') {
		return `Production matches canonical while Preview is ${preview}. Not forward progression.`;
	}
	if (reasonCode === 'LOCAL_BEHIND_PREVIEW_ALIGNED') {
		return `Preview + Production match canonical. Local is ${local}.`;
	}
	if (reasonCode === 'IDENTITY_CONFLICT') {
		return 'Duplicate or identity-conflicting invitation rows.';
	}
	if (reasonCode === 'MANAGED_DIVERGENCE') {
		return 'Published content matches canonical but draft diverges, or managed content conflicts.';
	}
	if (reasonCode === 'CANONICAL_UNAVAILABLE') {
		return 'Canonical fingerprint could not be built from the registry definition.';
	}
	if (reasonCode === 'EVIDENCE_INCOMPLETE') {
		return 'Live promotional evidence is incomplete.';
	}
	if (reasonCode === 'PREVIEW_APPROVAL_REQUIRED') {
		return 'Production requires an exact, live-verified Preview approval for this package.';
	}
	if (reasonCode === 'PRODUCTION_PREFLIGHT_BLOCKED') {
		const code = details?.preflightBlockCode;
		const detail = details?.preflightReason;
		if (code && detail) return `Production preflight blocked: ${code} — ${detail}`;
		if (code) return `Production preflight blocked: ${code}`;
		return 'The canonical Production preflight blocked this promotion.';
	}
	if (reasonCode === 'PRODUCTION_PREFLIGHT_UNVERIFIED') {
		return 'The canonical Production preflight did not return verifiable evidence.';
	}
	if (reasonCode === 'IN_SYNC') {
		return 'Local, Preview, and Production match canonical.';
	}
	return reasonCode;
}

/**
 * Presentation row from an already-decided promotion action. Does not re-decide.
 */
export function presentPromotionRow(input: {
	slug: string;
	title: string;
	eventType: string;
	lifecycle?: InvitationLifecycle;
	action: Exclude<PromotionAction, 'NONE'>;
	reasonCode: PromotionReasonCode;
	environments: Record<TargetEnv, EnvironmentPromotionState>;
	envEvidence: Record<TargetEnv, EvidenceState>;
	packageHash?: string;
	hasPendingPreviewApproval?: boolean;
	preflightBlockCode?: string | null;
	preflightReason?: string | null;
}): CanonicalPromotionRow {
	const lifecycle = input.lifecycle ?? 'published';
	const route = derivePromotionRoute(input.action, input.reasonCode);
	const handoff = isAuthoringLifecycle(lifecycle)
		? emptyHandoff({
				dryRunCommand: null,
				dryRunStepType: 'Manual/HITL',
				steps: [
					'Authoring in_progress',
					'Do not invitation:release or prod:apply until lifecycle is published',
				],
			})
		: derivePromotionHandoff(
				input.action,
				input.reasonCode,
				input.slug,
				input.eventType,
				input.environments,
				input.envEvidence,
				input.packageHash,
				input.hasPendingPreviewApproval,
			);
	return {
		slug: input.slug,
		title: input.title,
		eventType: input.eventType,
		lifecycle,
		action: input.action,
		reasonCode: input.reasonCode,
		environments: input.environments,
		source: route.source,
		destination: route.destination,
		evidence: combineEvidence(ENVS.map((env) => input.envEvidence[env])),
		envEvidence: input.envEvidence,
		uncertaintyNotes: uncertaintyNotesForEnvironments(input.environments),
		handoff,
		preflightBlockCode: input.preflightBlockCode ?? null,
		preflightReason: input.preflightReason ?? null,
	};
}
