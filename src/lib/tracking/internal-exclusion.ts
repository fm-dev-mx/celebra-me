import type { TrackingRouteClass } from '@/lib/tracking/route-policy';

export const COOKIE_NAME_IGNORE_TRACKING = 'cm_ignore_tracking';

export interface InternalExclusionInput {
	cookieHeader?: string | null;
	isDashboardAuthenticated?: boolean;
	routeClass?: TrackingRouteClass;
	vercelEnv?: string;
}

export interface InternalExclusionResult {
	exclude: boolean;
	reason:
		| 'authenticated_dashboard'
		| 'device_opt_out'
		| 'excluded_environment'
		| 'excluded_route'
		| null;
}

function hasIgnoreCookie(cookieHeader?: string | null): boolean {
	if (!cookieHeader) return false;
	return cookieHeader
		.split(';')
		.map((part) => part.trim())
		.some((part) => part === `${COOKIE_NAME_IGNORE_TRACKING}=true`);
}

export function shouldExcludeInternalTraffic(
	input: InternalExclusionInput,
): InternalExclusionResult {
	if (input.isDashboardAuthenticated) {
		return { exclude: true, reason: 'authenticated_dashboard' };
	}

	if (hasIgnoreCookie(input.cookieHeader)) {
		return { exclude: true, reason: 'device_opt_out' };
	}

	if (input.vercelEnv !== 'production') {
		return { exclude: true, reason: 'excluded_environment' };
	}

	if (
		input.routeClass === 'dashboard_admin_auth' ||
		input.routeClass === 'generic_api' ||
		input.routeClass === 'rsvp_guest_api'
	) {
		return { exclude: true, reason: 'excluded_route' };
	}

	return { exclude: false, reason: null };
}
