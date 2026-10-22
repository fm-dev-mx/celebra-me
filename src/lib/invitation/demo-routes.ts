import { DEMO_INVITATIONS } from '@/invitations/demos';

/** Catalog metadata only: this module never loads invitation content or image assets. */
export function findDemoByRouteSlug(routeSlug: string) {
	return DEMO_INVITATIONS.find((demo) => demo.routeSlug === routeSlug);
}

export function getDemoRouteSlug(slug: string): string | undefined {
	return DEMO_INVITATIONS.find((demo) => demo.slug === slug)?.routeSlug;
}
