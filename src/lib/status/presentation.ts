/**
 * Pure presentation of canonical status. Does not classify schema or promotions.
 */
import type {
	CanonicalPromotionRow,
	EnvironmentPromotionState,
	EvidenceState,
	PromotionAction,
	PromotionDestination,
	PromotionHandoff,
	PromotionReasonCode,
	PromotionSource,
	SchemaLifecycleState,
	TargetEnv,
} from './types';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

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

export function derivePromotionHandoff(
	action: PromotionAction,
	reasonCode: PromotionReasonCode,
	slug: string,
	eventType?: string,
	environments?: Record<TargetEnv, EnvironmentPromotionState>,
): PromotionHandoff {
	if (action === 'PROMOTE_PREVIEW') {
		return {
			dryRunCommand: `pnpm invitation:release -- --slug ${slug} --targets preview --dry-run`,
			dryRunStepType: 'Verify',
			applyCommand: `pnpm invitation:release -- --slug ${slug} --targets preview --apply`,
			applyStepType: 'Apply',
			ownerApplyRequired: false,
			steps: ['Verify dry-run', 'Authorized Preview apply', 'Verify match'],
		};
	}
	if (action === 'PROMOTE_PRODUCTION') {
		return {
			dryRunCommand: `pnpm invitation:release -- --slug ${slug} --targets production --dry-run`,
			dryRunStepType: 'Verify',
			applyCommand: `pnpm invitation:release -- --slug ${slug} --targets production --apply`,
			applyStepType: 'Apply',
			ownerApplyRequired: true,
			steps: ['Verify dry-run', 'OWNER APPLY in TTY', 'Verify match'],
		};
	}
	if (action === 'BLOCKED' && reasonCode === 'LOCAL_BEHIND_PREVIEW_ALIGNED') {
		return {
			dryRunCommand: `pnpm invitation:release -- --slug ${slug} --targets local --dry-run`,
			dryRunStepType: 'Verify',
			applyCommand: `pnpm invitation:release -- --slug ${slug} --targets local --apply`,
			applyStepType: 'Apply',
			ownerApplyRequired: false,
			steps: ['Verify dry-run', 'Authorized Local apply', 'Verify match'],
		};
	}
	if (action === 'BLOCKED' && reasonCode === 'IDENTITY_CONFLICT') {
		const conflictEnv = (['local', 'preview', 'production'] as const).find(
			(env) => environments?.[env] === 'conflict',
		) ?? 'local';
		const dryRunCommand =
			conflictEnv === 'production'
				? null
				: `pnpm invitation:diagnose-identity -- --target ${conflictEnv}`;
		return {
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			applyCommand: null,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			steps: ['Diagnose identity conflict', 'Do not promote'],
		};
	}
	if (action === 'BLOCKED' && reasonCode === 'MANAGED_DIVERGENCE') {
		const dryRunCommand = eventType
			? `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`
			: null;
		return {
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			applyCommand: null,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			steps: ['Diagnose semantic content divergence', 'Do not promote'],
		};
	}
	if (action === 'BLOCKED' && reasonCode === 'PRODUCTION_AHEAD_OF_PREVIEW') {
		const dryRunCommand = eventType
			? `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`
			: null;
		return {
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			applyCommand: null,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			steps: ['Diagnose content parity', 'Update Preview before Production'],
		};
	}
	if (action === 'BLOCKED') {
		return {
			dryRunCommand: null,
			dryRunStepType: 'Manual/HITL',
			applyCommand: null,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			steps: ['Investigate blocker', 'Do not promote'],
		};
	}
	if (action === 'UNKNOWN') {
		if (reasonCode === 'CANONICAL_UNAVAILABLE') {
			return {
				dryRunCommand: null,
				dryRunStepType: 'Manual/HITL',
				applyCommand: null,
				applyStepType: 'Manual/HITL',
				ownerApplyRequired: false,
				steps: ['Fix canonical registry definition', 'Do not promote'],
			};
		}
		const unverifiedEnvs = (['local', 'preview', 'production'] as const).filter(
			(env) => environments?.[env] === 'unknown',
		);
		const dryRunCommand =
			unverifiedEnvs.length > 0
				? `pnpm db:availability:verify -- --targets ${unverifiedEnvs.join(',')}`
				: null;
		return {
			dryRunCommand,
			dryRunStepType: dryRunCommand ? 'Diagnose' : 'Manual/HITL',
			applyCommand: null,
			applyStepType: 'Manual/HITL',
			ownerApplyRequired: false,
			steps: ['Diagnose target database availability', 'Do not promote'],
		};
	}
	return {
		dryRunCommand: null,
		dryRunStepType: 'Verify',
		applyCommand: null,
		applyStepType: 'Verify',
		ownerApplyRequired: false,
		steps: [],
	};
}

export function uncertaintyNotesForEnvironments(
	environments: Record<TargetEnv, EnvironmentPromotionState>,
): string[] {
	const notes: string[] = [];
	for (const env of ENVS) {
		if (environments[env] === 'unknown') {
			notes.push(`${env.toUpperCase()} UNVERIFIED`);
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
	const sourceLabel = source === 'canonical' ? 'Canonical' : source[0]!.toUpperCase() + source.slice(1);
	const destLabel = destination[0]!.toUpperCase() + destination.slice(1);
	return `${sourceLabel} → ${destLabel}`;
}

export function formatPublicationReason(
	environments: Record<TargetEnv, EnvironmentPromotionState>,
	reasonCode: PromotionReasonCode,
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
	if (reasonCode === 'IN_SYNC') {
		return 'Local, Preview, and Production match canonical.';
	}
	return reasonCode;
}

export function combineEvidence(states: readonly EvidenceState[]): EvidenceState {
	if (states.length === 0) return 'UNVERIFIED';
	if (states.every((state) => state === 'LIVE')) return 'LIVE';
	if (states.every((state) => state === 'CACHED')) return 'CACHED';
	if (states.includes('UNVERIFIED') && !states.includes('LIVE') && !states.includes('CACHED')) {
		return 'UNVERIFIED';
	}
	if (states.includes('LIVE') && !states.includes('CACHED')) return 'LIVE';
	return 'CACHED';
}

export function invitationAttentionCount(
	environmentsBySlug: ReadonlyMap<string, Record<TargetEnv, EnvironmentPromotionState>>,
	env: TargetEnv,
): number {
	let count = 0;
	for (const states of environmentsBySlug.values()) {
		if (states[env] !== 'match') count += 1;
	}
	return count;
}

/**
 * Presentation row from an already-decided promotion action. Does not re-decide.
 */
export function presentPromotionRow(input: {
	slug: string;
	title: string;
	eventType: string;
	action: Exclude<PromotionAction, 'NONE'>;
	reasonCode: PromotionReasonCode;
	environments: Record<TargetEnv, EnvironmentPromotionState>;
	envEvidence: Record<TargetEnv, EvidenceState>;
}): CanonicalPromotionRow {
	const route = derivePromotionRoute(input.action, input.reasonCode);
	return {
		slug: input.slug,
		title: input.title,
		eventType: input.eventType,
		action: input.action,
		reasonCode: input.reasonCode,
		environments: input.environments,
		source: route.source,
		destination: route.destination,
		evidence: combineEvidence(ENVS.map((env) => input.envEvidence[env])),
		envEvidence: input.envEvidence,
		uncertaintyNotes: uncertaintyNotesForEnvironments(input.environments),
		handoff: derivePromotionHandoff(
			input.action,
			input.reasonCode,
			input.slug,
			input.eventType,
			input.environments,
		),
	};
}

