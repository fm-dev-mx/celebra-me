export type InvitationOwnershipMode =
	| 'definition_managed'
	| 'definition_seed_target_owned'
	| 'target_operational'
	| 'managed_reconciled'
	| 'publication_owned'
	| 'rsvp_owned';

export const INVITATION_FIELD_OWNERSHIP = {
	eventType: 'definition_managed',
	baseDemoId: 'definition_managed',
	themeId: 'definition_managed',
	snapshot: 'definition_managed',
	kind: 'definition_managed',
	title: 'definition_seed_target_owned',
	slug: 'definition_seed_target_owned',
	clientName: 'definition_seed_target_owned',
	clientEmail: 'definition_seed_target_owned',
	clientWhatsapp: 'definition_seed_target_owned',
	photosReceived: 'definition_seed_target_owned',
	ownerUserId: 'definition_seed_target_owned',
	hostLoginAlias: 'definition_seed_target_owned',
	status: 'target_operational',
	draftContent: 'managed_reconciled',
	publishedContent: 'publication_owned',
	managedBaseline: 'managed_reconciled',
	assets: 'managed_reconciled',
	eventLinkage: 'target_operational',
	guestConfirmations: 'rsvp_owned',
} as const satisfies Record<string, InvitationOwnershipMode>;

export type InvitationOwnedField = keyof typeof INVITATION_FIELD_OWNERSHIP;

export interface ManagedInvitationMetadataIntent {
	title: string;
	slug: string;
	eventType: string;
	baseDemoId: string;
	themeId: string;
	snapshot: Record<string, unknown>;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	ownerUserId: string;
}

export interface TargetInvitationMetadataState extends ManagedInvitationMetadataIntent {
	status: string;
}

/**
 * Apply versioned managed intent without replacing state that became target-owned
 * after the invitation was first provisioned.
 */
export function resolveManagedInvitationMetadata(
	intent: ManagedInvitationMetadataIntent,
	existing: TargetInvitationMetadataState | null,
): TargetInvitationMetadataState {
	if (!existing) {
		return { ...intent, status: 'draft' };
	}

	return {
		...intent,
		title: existing.title,
		slug: existing.slug,
		clientName: existing.clientName,
		clientEmail: existing.clientEmail,
		clientWhatsapp: existing.clientWhatsapp,
		photosReceived: existing.photosReceived,
		ownerUserId: existing.ownerUserId,
		status: existing.status,
	};
}

/** Definitions seed aliases only. Once a target alias exists, managed updates preserve it. */
export function resolveManagedHostAlias(
	definitionAlias: string,
	targetAlias: string | null | undefined,
): string {
	return targetAlias?.trim() || definitionAlias;
}

export function isRsvpOwnedField(field: InvitationOwnedField): boolean {
	return INVITATION_FIELD_OWNERSHIP[field] === 'rsvp_owned';
}

const PATH_OWNERSHIP_ALIASES: Record<string, InvitationOwnedField> = {
	rsvp: 'guestConfirmations',
	published: 'publishedContent',
};

const RESIDUAL_INFRASTRUCTURE_PREFIXES = [
	'invitationId',
	'eventId',
	'storageHost',
	'cdnUrl',
	'receiptId',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'appliedAt',
	'guestCount',
] as const;

function ownershipKeyForPath(path: string): InvitationOwnedField | undefined {
	const topLevel = path.split(/[.[\]]/, 1)[0];
	if (!topLevel) return undefined;
	const key = PATH_OWNERSHIP_ALIASES[topLevel] ?? topLevel;
	return key in INVITATION_FIELD_OWNERSHIP ? (key as InvitationOwnedField) : undefined;
}

/** True when a semantic path is definition-managed or managed-reconciled (not target/RSVP/infra). */
export function isManagedInvitationPath(path: string): boolean {
	const ownershipKey = ownershipKeyForPath(path);
	if (
		ownershipKey &&
		INVITATION_FIELD_OWNERSHIP[ownershipKey] !== 'definition_managed' &&
		INVITATION_FIELD_OWNERSHIP[ownershipKey] !== 'managed_reconciled'
	) {
		return false;
	}
	return !RESIDUAL_INFRASTRUCTURE_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}.`),
	);
}
