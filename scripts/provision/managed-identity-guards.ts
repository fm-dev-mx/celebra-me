/**
 * managed-identity-guards.ts — Pure managed identity / rekey decision helpers.
 *
 * Extracted so hermetic Jest can cover IDENTITY_NOT_FOUND / IDENTITY_CONFLICT /
 * no-fuzzy-inference contracts without persistent Local Supabase.
 */

export type ManagedIdentityRow = {
	id: string;
	slug: string;
};

export type RekeyIdentityDecision =
	| { ok: true; invitationId: string }
	| { ok: false; code: 'IDENTITY_CONFLICT' | 'IDENTITY_NOT_FOUND'; message: string };

/**
 * Decide rekey identity from explicit --rekey-from lookup results only.
 * Never consults client_name / fuzzy matching.
 */
export function decideRekeyIdentity(input: {
	slug: string;
	rekeyFrom: string;
	sourceByOldSlug: ManagedIdentityRow | null;
	collisionByTargetSlug: ManagedIdentityRow | null;
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

	return { ok: true, invitationId: input.sourceByOldSlug.id };
}

/**
 * Without --rekey-from, identity resolution is slug + provenance only.
 * Matching client_name must never force a rekey.
 */
export function resolveIdentityWithoutRekey(input: {
	slug: string;
	provenanceInvitationId: string | null;
	invitationBySlug: ManagedIdentityRow | null;
	/** Present only to prove fuzzy client_name is ignored. */
	invitationByClientName?: ManagedIdentityRow | null;
}):
	| { ok: true; invitationId: string | null; mode: 'slug' | 'provenance' | 'absent' }
	| { ok: false; code: 'IDENTITY_CONFLICT'; message: string } {
	void input.invitationByClientName; // intentionally unused — no fuzzy inference

	const provenanceId = input.provenanceInvitationId;
	const slugId = input.invitationBySlug?.id ?? null;

	if (provenanceId && slugId && provenanceId !== slugId) {
		return {
			ok: false,
			code: 'IDENTITY_CONFLICT',
			message: `IDENTITY_CONFLICT: Ambiguous identity lineage for slug "${input.slug}". Provenance links to invitation ${provenanceId}, but active invitation slug matches ${slugId}.`,
		};
	}

	if (provenanceId) {
		return { ok: true, invitationId: provenanceId, mode: 'provenance' };
	}
	if (slugId) {
		return { ok: true, invitationId: slugId, mode: 'slug' };
	}
	return { ok: true, invitationId: null, mode: 'absent' };
}
