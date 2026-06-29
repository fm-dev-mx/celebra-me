export type TrackingRouteClass =
	| 'commercial'
	| 'demo'
	| 'real_invitation'
	| 'personalized_invitation'
	| 'rsvp_guest_api'
	| 'dashboard_admin_auth'
	| 'generic_api'
	| 'unknown';

export interface TrackingRoutePolicy {
	routeClass: TrackingRouteClass;
	internalAllowed: boolean;
	gaAllowed: boolean;
	metaAllowed: boolean;
	reason: string;
}

export interface AnalyticsEnvironment {
	vercelEnv?: string;
	gaId?: string;
}

const COMMERCIAL_PATHS = new Set(['/', '/privacidad', '/terminos']);
const EVENT_TYPES = new Set(['xv', 'boda', 'bautizo', 'cumple', 'baby-shower', 'primera-comunion']);

function normalizePath(input: string | URL): {
	pathname: string;
	searchParams: URLSearchParams;
} {
	const url = typeof input === 'string' ? new URL(input, 'https://www.celebra-me.com') : input;
	const pathname = url.pathname !== '/' ? url.pathname.replace(/\/+$/, '') : '/';
	return {
		pathname,
		searchParams: url.searchParams,
	};
}

function isEventRoute(pathname: string): boolean {
	const parts = pathname.split('/').filter(Boolean);
	return parts.length === 2 && EVENT_TYPES.has(parts[0]);
}

function isNestedShortInvitationRoute(pathname: string): boolean {
	const parts = pathname.split('/').filter(Boolean);
	return parts.length === 4 && EVENT_TYPES.has(parts[0]) && parts[2] === 'i';
}

export function classifyTrackingRoute(input: string | URL): TrackingRoutePolicy {
	const { pathname, searchParams } = normalizePath(input);

	if (pathname === '/login' || pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
		return {
			routeClass: 'dashboard_admin_auth',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'dashboard_or_auth_route',
		};
	}

	if (pathname.startsWith('/api/dashboard/') || pathname.startsWith('/api/auth/')) {
		return {
			routeClass: 'dashboard_admin_auth',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'dashboard_or_auth_api',
		};
	}

	if (pathname.startsWith('/api/invitacion/')) {
		return {
			routeClass: 'rsvp_guest_api',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'rsvp_guest_api',
		};
	}

	if (pathname.startsWith('/api/')) {
		return {
			routeClass: 'generic_api',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'generic_api',
		};
	}

	if (
		searchParams.has('invite') ||
		pathname.startsWith('/i/') ||
		isNestedShortInvitationRoute(pathname)
	) {
		return {
			routeClass: 'personalized_invitation',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'personalized_invitation',
		};
	}

	if (COMMERCIAL_PATHS.has(pathname)) {
		return {
			routeClass: 'commercial',
			internalAllowed: true,
			gaAllowed: true,
			metaAllowed: true,
			reason: 'commercial_route',
		};
	}

	if (isEventRoute(pathname)) {
		const slug = pathname.split('/').filter(Boolean)[1] ?? '';
		if (slug.startsWith('demo-')) {
			return {
				routeClass: 'demo',
				internalAllowed: true,
				gaAllowed: true,
				metaAllowed: true,
				reason: 'demo_catalog_route',
			};
		}

		return {
			routeClass: 'real_invitation',
			internalAllowed: false,
			gaAllowed: false,
			metaAllowed: false,
			reason: 'real_invitation_route',
		};
	}

	return {
		routeClass: 'unknown',
		internalAllowed: false,
		gaAllowed: false,
		metaAllowed: false,
		reason: 'unknown_route',
	};
}

export function isProductionAnalyticsEnvironment(env: AnalyticsEnvironment): boolean {
	return env.vercelEnv === 'production';
}

export function shouldLoadGoogleAnalytics(input: string | URL, env: AnalyticsEnvironment): boolean {
	const gaId = env.gaId?.trim();
	if (!gaId || !isProductionAnalyticsEnvironment(env)) return false;
	return classifyTrackingRoute(input).gaAllowed;
}
