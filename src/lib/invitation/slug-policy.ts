import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import { findDemoByRouteSlug } from '@/lib/invitation/demo-routes';

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
	const normalized = slug.trim().toLowerCase();
	return RESERVED_SLUGS.has(normalized) || Boolean(findDemoByRouteSlug(normalized));
}

/** Static catalog demos keep their internal identity out of managed guest-code links. */
const CATALOG_DEMO_PREFIX = 'demo-';

/**
 * Managed invitations use `/{slug}`. Demo aliases are resolved separately by the public path
 * builder; a demo's internal `demo-*` slug never opts into managed guest-code routing.
 */
export function usesShortInvitationPath(slug: string): boolean {
	return !slug.startsWith(CATALOG_DEMO_PREFIX);
}
