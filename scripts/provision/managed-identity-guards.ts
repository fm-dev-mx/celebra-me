/**
 * managed-identity-guards.ts — Pure managed identity / rekey decision helpers.
 *
 * Extracted so hermetic Jest can cover IDENTITY_NOT_FOUND / IDENTITY_CONFLICT /
 * REKEY_REQUIRED / no-fuzzy-inference contracts without persistent Local Supabase.
 */

export type ManagedIdentityRow = {
	id: string;
	slug: string;
	managedIdentityId?: string | null;
};

export type RekeyIdentityDecision =
	| { ok: true; invitationId: string }
	| { ok: false; code: 'IDENTITY_CONFLICT' | 'IDENTITY_NOT_FOUND'; message: string };

export type IdentityResolutionDecision =
	| {
			ok: true;
			invitationId: string | null;
			mode: 'managed_identity' | 'slug' | 'provenance' | 'absent';
	  }
	| { ok: false; code: 'IDENTITY_CONFLICT' | 'REKEY_REQUIRED'; message: string };

/**
 * Decide rekey identity from explicit --rekey-from lookup results only.
 * Never consults client_name / fuzzy matching.
 */
export function decideRekeyIdentity(input: {
	slug: string;
	rekeyFrom: string;
	sourceByOldSlug: ManagedIdentityRow | null;
	collisionByTargetSlug: ManagedIdentityRow | null;
	expectedManagedIdentityId?: string;
}): RekeyIdentityDecision {
	const rekeyFrom = input.rekeyFrom.trim();
	const slug = input.slug.trim();

	if (!rekeyFrom) {
		return {
			ok: false,
			code: 'IDENTITY_NOT_FOUND',
			message: 'IDENTITY_NOT_FOUND: --rekey-from is required for explicit identity rekey.',
		};
	}

	if (rekeyFrom === slug) {
		return {
			ok: false,
			code: 'IDENTITY_CONFLICT',
			message: `IDENTITY_CONFLICT: Cannot rekey invitation "${slug}" to its own current slug.`,
		};
	}

	if (!input.sourceByOldSlug?.id) {
		return {
			ok: false,
			code: 'IDENTITY_NOT_FOUND',
			message: `IDENTITY_NOT_FOUND: Cannot rekey from "${rekeyFrom}". No active invitation found matching slug "${rekeyFrom}".`,
		};
	}

	if (input.collisionByTargetSlug?.id && input.collisionByTargetSlug.id !== input.sourceByOldSlug.id) {
		return {
			ok: false,
			code: 'IDENTITY_CONFLICT',
			message: `IDENTITY_CONFLICT: Target slug "${slug}" is already assigned to another active invitation (${input.collisionByTargetSlug.id}).`,
		};
	}

	if (
		input.expectedManagedIdentityId &&
		input.sourceByOldSlug.managedIdentityId &&
		input.sourceByOldSlug.managedIdentityId !== input.expectedManagedIdentityId
	) {
		return {
			ok: false,
			code: 'IDENTITY_CONFLICT',
			message: `IDENTITY_CONFLICT: Source slug "${rekeyFrom}" belongs to managed identity ${input.sourceByOldSlug.managedIdentityId}, not ${input.expectedManagedIdentityId}.`,
		};
	}

	return { ok: true, invitationId: input.sourceByOldSlug.id };
}

function checkPreviousSlugRekey(
	input: {
		slug: string;
		managedIdentityId: string;
		activeInvitationByPreviousSlug: ManagedIdentityRow | null;
		matchedPreviousSlug?: string | null;
	},
	managedId: string | null,
	provenanceId: string | null,
	slugId: string | null,
): IdentityResolutionDecision | null {
	const previousHit = input.activeInvitationByPreviousSlug;
	if (!previousHit?.id) return null;

	const sameManaged =
		previousHit.managedIdentityId &&
		previousHit.managedIdentityId === input.managedIdentityId;
	const sameAsManagedRow = managedId !== null && previousHit.id === managedId;
	const sameAsSlugRow = slugId !== null && previousHit.id === slugId;
	const sameAsProvenance = provenanceId !== null && previousHit.id === provenanceId;

	if (!sameManaged && !sameAsManagedRow && !sameAsSlugRow && !sameAsProvenance) {
		const matched = input.matchedPreviousSlug ?? previousHit.slug;
		return {
			ok: false,
			code: 'REKEY_REQUIRED',
			message: `REKEY_REQUIRED: Definition "${input.slug}" replaces prior slug "${matched}" (invitation ${previousHit.id}). Rerun with --rekey-from ${matched}.`,
		};
	}
	if (previousHit.slug !== input.slug) {
		const matched = input.matchedPreviousSlug ?? previousHit.slug;
		return {
			ok: false,
			code: 'REKEY_REQUIRED',
			message: `REKEY_REQUIRED: Managed identity ${input.managedIdentityId} is still bound to slug "${matched}". Rerun with --rekey-from ${matched}.`,
		};
	}
	return null;
}

/**
 * Without --rekey-from, identity resolution is managedIdentityId + slug + provenance only.
 * Matching client_name must never force a rekey. Historical previousSlugs require explicit rekey.
 */
export function resolveIdentityWithoutRekey(input: {
	slug: string;
	managedIdentityId: string;
	previousSlugs?: readonly string[];
	invitationByManagedIdentity: ManagedIdentityRow | null;
	provenanceInvitationId: string | null;
	invitationBySlug: ManagedIdentityRow | null;
	activeInvitationByPreviousSlug: ManagedIdentityRow | null;
	matchedPreviousSlug?: string | null;
	/** Present only to prove fuzzy client_name is ignored. */
	invitationByClientName?: ManagedIdentityRow | null;
}): IdentityResolutionDecision {
	void input.invitationByClientName; // intentionally unused — no fuzzy inference

	const managedId = input.invitationByManagedIdentity?.id ?? null;
	const provenanceId = input.provenanceInvitationId;
	const slugId = input.invitationBySlug?.id ?? null;

	const previousRekeyDecision = checkPreviousSlugRekey(input, managedId, provenanceId, slugId);
	if (previousRekeyDecision) return previousRekeyDecision;

	const candidates = [managedId, provenanceId, slugId].filter(
		(value): value is string => typeof value === 'string' && value.length > 0,
	);
	const unique = new Set(candidates);
	if (unique.size > 1) {
		return {
			ok: false,
			code: 'IDENTITY_CONFLICT',
			message: `IDENTITY_CONFLICT: Ambiguous identity lineage for slug "${input.slug}". managedIdentity=${managedId ?? 'none'}, provenance=${provenanceId ?? 'none'}, slug=${slugId ?? 'none'}.`,
		};
	}

	if (managedId) {
		return { ok: true, invitationId: managedId, mode: 'managed_identity' };
	}
	if (provenanceId) {
		return { ok: true, invitationId: provenanceId, mode: 'provenance' };
	}
	if (slugId) {
		return { ok: true, invitationId: slugId, mode: 'slug' };
	}
	return { ok: true, invitationId: null, mode: 'absent' };
}
