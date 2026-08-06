/**
 * Read-only discovery for managed releases that may be promoted to Production.
 *
 * This composes existing registry, package, Preview approval, and managed-status
 * evidence. It does not introduce a second parity classifier and never mutates.
 */
import type { InvitationPackageData } from './invitation-package.ts';
import {
	resolveInvitationPackageInput,
	type ResolvedInvitationPackageInput,
} from './invitation-package-input.ts';
import {
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
} from './preview-approval-service.ts';
import {
	evaluateSingleTargetStatus,
	getOrCreateStatusProbeSession,
	resetStatusProbeSession,
	type PerInvitationTargetStatus,
} from './dbs-status.ts';
import { listInvitationDefinitions } from './invitations/registry.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';

export type PromotionCandidateDisposition = 'ready' | 'in-sync' | 'attention';

export interface InvitationPromotionCandidate {
	slug: string;
	title: string;
	eventType: string;
	route: string;
	lifecycle: InvitationDefinition['lifecycle'];
	deliveryScope: InvitationDefinition['deliveryScope'];
	disposition: PromotionCandidateDisposition;
	selectable: boolean;
	reason: string;
	packageInput?: ResolvedInvitationPackageInput;
	approval?: PreviewApprovalArtifact;
	production: PerInvitationTargetStatus;
}

export interface InvitationPromotionCandidateSummary {
	candidates: InvitationPromotionCandidate[];
	readyCount: number;
	inSyncCount: number;
	attentionCount: number;
}

type CandidateDefinition = Pick<
	InvitationDefinition,
	'slug' | 'title' | 'eventType' | 'createdAt' | 'lifecycle' | 'deliveryScope'
>;

export interface DiscoverInvitationPromotionCandidatesInput {
	approvalsDirs?: string[];
	now?: Date;
	definitions?: CandidateDefinition[];
	resolvePackage?: (input: { slug: string }) => Promise<ResolvedInvitationPackageInput>;
	verifyApproval?: (
		identity: {
			packageHash: string;
			sourceHash: string;
			metadataHash: string;
			projectionHash: string;
			assetManifestHash: string;
			slug: string;
			route: string;
		},
		approvalsDirs?: string[],
		now?: Date,
	) => PreviewApprovalArtifact;
	evaluateProduction?: (slug: string, packageHash: string) => PerInvitationTargetStatus;
}

function unavailableProduction(reason: string): PerInvitationTargetStatus {
	return {
		environment: 'production',
		status: 'UNVERIFIED',
		activeMatchCount: 0,
		resolvedId: null,
		resolvedSlug: null,
		provenanceDefinitionSlug: null,
		provenancePackageHash: null,
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		detail: reason,
	};
}

function approvalIdentity(packageData: InvitationPackageData) {
	return {
		packageHash: packageData.packageHash,
		sourceHash: packageData.sourceHash,
		metadataHash: packageData.metadataHash,
		projectionHash: packageData.projectionHash,
		assetManifestHash: packageData.assetManifestHash,
		slug: packageData.invitation.slug,
		route: `/${packageData.invitation.eventType}/${packageData.invitation.slug}`,
	};
}

function dispositionFor(input: {
	production: PerInvitationTargetStatus;
	approval?: PreviewApprovalArtifact;
	approvalFailure?: string;
}): Pick<InvitationPromotionCandidate, 'disposition' | 'selectable' | 'reason'> {
	if (input.production.status === 'MATCH_CANONICAL') {
		return {
			disposition: 'in-sync',
			selectable: false,
			reason: 'Production ya coincide con la release administrada actual.',
		};
	}

	if (!input.approval) {
		return {
			disposition: 'attention',
			selectable: false,
			reason:
				input.approvalFailure ??
				'La release actual no cuenta con una aprobación Preview vigente y exacta.',
		};
	}

	if (
		input.production.status === 'NOT_PRESENT' ||
		input.production.status === 'BEHIND_CANONICAL'
	) {
		return {
			disposition: 'ready',
			selectable: true,
			reason:
				input.production.status === 'NOT_PRESENT'
					? 'Aprobada en Preview y todavía ausente en Production.'
					: 'Aprobada en Preview y pendiente de alinear en Production.',
		};
	}

	return {
		disposition: 'attention',
		selectable: false,
		reason: input.production.detail || `Production reportó ${input.production.status}.`,
	};
}

async function inspectCandidate(
	definition: CandidateDefinition,
	input: DiscoverInvitationPromotionCandidatesInput,
): Promise<InvitationPromotionCandidate> {
	const route = `/${definition.eventType}/${definition.slug}`;
	let packageInput: ResolvedInvitationPackageInput;
	try {
		packageInput = await (input.resolvePackage ?? resolveInvitationPackageInput)({
			slug: definition.slug,
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return {
			slug: definition.slug,
			title: definition.title,
			eventType: definition.eventType,
			route,
			lifecycle: definition.lifecycle,
			deliveryScope: definition.deliveryScope,
			disposition: 'attention',
			selectable: false,
			reason: `No fue posible construir la release administrada: ${reason}`,
			production: unavailableProduction('No evaluado porque la release local no es válida.'),
		};
	}

	const packageData = packageInput.packageData;
	let approval: PreviewApprovalArtifact | undefined;
	let approvalFailure: string | undefined;
	try {
		approval = (input.verifyApproval ?? verifyPreviewApprovalArtifact)(
			approvalIdentity(packageData),
			input.approvalsDirs,
			input.now,
		);
	} catch (error) {
		approvalFailure = error instanceof Error ? error.message : String(error);
	}

	let production: PerInvitationTargetStatus;
	try {
		const evaluateProduction =
			input.evaluateProduction ??
			((slug: string, packageHash: string) =>
				evaluateSingleTargetStatus('production', slug, packageHash));
		production = evaluateProduction(definition.slug, packageData.packageHash);
	} catch (error) {
		production = unavailableProduction(error instanceof Error ? error.message : String(error));
	}

	return {
		slug: definition.slug,
		title: definition.title,
		eventType: definition.eventType,
		route,
		lifecycle: definition.lifecycle,
		deliveryScope: definition.deliveryScope,
		...dispositionFor({ production, approval, approvalFailure }),
		packageInput,
		approval,
		production,
	};
}

/**
 * Discover candidate releases using one execution-local read-only probe session.
 * Definitions are inspected deterministically and sorted for stable terminal UX.
 */
export async function discoverInvitationPromotionCandidates(
	input: DiscoverInvitationPromotionCandidatesInput = {},
): Promise<InvitationPromotionCandidateSummary> {
	const definitions = [...(input.definitions ?? listInvitationDefinitions())].sort(
		(a, b) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title),
	);

	if (!input.evaluateProduction) {
		resetStatusProbeSession();
		getOrCreateStatusProbeSession();
	}

	const candidates: InvitationPromotionCandidate[] = [];
	for (const definition of definitions) {
		candidates.push(await inspectCandidate(definition, input));
	}

	return {
		candidates,
		readyCount: candidates.filter((candidate) => candidate.disposition === 'ready').length,
		inSyncCount: candidates.filter((candidate) => candidate.disposition === 'in-sync').length,
		attentionCount: candidates.filter((candidate) => candidate.disposition === 'attention')
			.length,
	};
}
