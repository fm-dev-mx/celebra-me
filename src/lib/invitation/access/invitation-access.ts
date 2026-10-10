/**
 * Commercial access state of a client invitation (`invitation_access_controls`).
 *
 * `paymentStatus` and `publicAccess` are independent: a disabled invitation keeps its
 * payment status, so re-enabling it restores the previous state. Pure module: safe to
 * import from server code and from client islands (no I/O, no secrets).
 */

export const INVITATION_PAYMENT_STATUSES = ['unpaid', 'paid'] as const;
export const INVITATION_PUBLIC_ACCESS_VALUES = ['enabled', 'disabled'] as const;

export type InvitationPaymentStatus = (typeof INVITATION_PAYMENT_STATUSES)[number];
export type InvitationPublicAccess = (typeof INVITATION_PUBLIC_ACCESS_VALUES)[number];

export interface InvitationAccessState {
	paymentStatus: InvitationPaymentStatus;
	publicAccess: InvitationPublicAccess;
}

/**
 * Applied when a published client invitation has no readable access row. Every
 * invitation gets one on insertion, so a gap is an anomaly: never render the clean
 * invitation because of it, but keep it reachable.
 */
export const MISSING_INVITATION_ACCESS: InvitationAccessState = Object.freeze({
	paymentStatus: 'unpaid',
	publicAccess: 'enabled',
});

/** How the public route renders a reachable client invitation. */
export type PublicInvitationMode = 'live' | 'preview';

export function resolvePublicInvitationMode(access: InvitationAccessState): PublicInvitationMode {
	return access.paymentStatus === 'paid' ? 'live' : 'preview';
}

export function isInvitationPubliclyDisabled(access: InvitationAccessState): boolean {
	return access.publicAccess === 'disabled';
}

export function isInvitationPaymentStatus(value: unknown): value is InvitationPaymentStatus {
	return (
		typeof value === 'string' &&
		(INVITATION_PAYMENT_STATUSES as readonly string[]).includes(value)
	);
}

export function isInvitationPublicAccess(value: unknown): value is InvitationPublicAccess {
	return (
		typeof value === 'string' &&
		(INVITATION_PUBLIC_ACCESS_VALUES as readonly string[]).includes(value)
	);
}

/**
 * Parse an `invitation_access_controls` row as PostgREST embeds it: an object for the
 * one-to-one relationship, an array on older schema caches, or null. Unknown values
 * yield null so the caller applies its fail-closed default.
 */
export function parseInvitationAccessRow(row: unknown): InvitationAccessState | null {
	const candidate = Array.isArray(row) ? row[0] : row;
	if (!candidate || typeof candidate !== 'object') return null;
	const record = candidate as { payment_status?: unknown; public_access?: unknown };
	if (
		!isInvitationPaymentStatus(record.payment_status) ||
		!isInvitationPublicAccess(record.public_access)
	) {
		return null;
	}
	return { paymentStatus: record.payment_status, publicAccess: record.public_access };
}

/** Robots policy for every client invitation response: private event data is never indexed. */
export const CLIENT_INVITATION_ROBOTS = 'noindex, nofollow, noarchive, noimageindex';

/** Robots policy for the neutral unavailable page. */
export const UNAVAILABLE_INVITATION_ROBOTS = 'noindex, nofollow, noarchive';
