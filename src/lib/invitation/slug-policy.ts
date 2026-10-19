import { EVENT_TYPES } from '@/lib/theme/theme-contract';

/**
 * Invitations published from 2026-10-19 may be opened at `/{slug}`, so a slug can never
 * shadow a first-level route. Event types are reserved too: `/xv` is not an invitation.
 */
const RESERVED_ROUTE_SLUGS = [
	'404',
	'api',
	'dashboard',
	'demos',
	'i',
	'invitacion',
	'login',
	'privacidad',
	'r',
	'terminos',
	'vista-previa',
] as const;

const RESERVED_SLUGS: ReadonlySet<string> = new Set([...RESERVED_ROUTE_SLUGS, ...EVENT_TYPES]);

export const RESERVED_SLUG_MESSAGE = 'Ese slug está reservado. Elige uno diferente.';

export function isReservedInvitationSlug(slug: string): boolean {
	return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/**
 * Invitations shared as `/{slug}`. Every other published invitation keeps `/{eventType}/{slug}`
 * (both forms resolve). Add a slug here when the owner switches an invitation to the short URL.
 */
const SHORT_PATH_SLUGS: ReadonlySet<string> = new Set(['america', 'olivia-y-antonio']);

export function usesShortInvitationPath(slug: string): boolean {
	return SHORT_PATH_SLUGS.has(slug);
}
