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

/** Static catalog demos (src/invitations/demos) are not published rows, so they keep the long path. */
const CATALOG_DEMO_PREFIX = 'demo-';

/**
 * From 2026-10-19 every invitation is shared as `/{slug}`. Catalog demos keep
 * `/{eventType}/{slug}`; the long form still resolves for every invitation (no redirect).
 */
export function usesShortInvitationPath(slug: string): boolean {
	return !slug.startsWith(CATALOG_DEMO_PREFIX);
}
