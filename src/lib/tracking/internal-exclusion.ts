import type { HostedDeployEnvironment } from '@/lib/server/deploy-identity';
import type { TrackingRouteClass } from '@/lib/tracking/route-policy';

export const COOKIE_NAME_IGNORE_TRACKING = 'cm_ignore_tracking';
export const IGNORE_TRACKING_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type IgnoreTrackingCookieOptions = {
	path: string;
	httpOnly: boolean;
	sameSite: 'lax';
	maxAge: number;
	secure: boolean;
};

export function buildIgnoreTrackingCookieOptions(isLocal = false): IgnoreTrackingCookieOptions {
	return {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		maxAge: IGNORE_TRACKING_MAX_AGE_SECONDS,
		secure: !isLocal,
	};
}

export interface CookieStoreLike {
	set(
		name: string,
		value: string,
		options: IgnoreTrackingCookieOptions | Record<string, unknown>,
	): void;
	delete(name: string, options: { path: string } | Record<string, unknown>): void;
}

export function setIgnoreTrackingCookie(cookies: CookieStoreLike, isLocal = false): void {
	cookies.set(COOKIE_NAME_IGNORE_TRACKING, 'true', buildIgnoreTrackingCookieOptions(isLocal));
}

export function clearIgnoreTrackingCookie(cookies: CookieStoreLike): void {
	cookies.delete(COOKIE_NAME_IGNORE_TRACKING, { path: '/' });
}

export interface InternalExclusionInput {
	cookieHeader?: string | null;
	isDashboardAuthenticated?: boolean;
	routeClass?: TrackingRouteClass;
	deployEnvironment?: HostedDeployEnvironment | null;
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

/** Client-safe: also read by the browser tracker and the Meta Pixel from `document.cookie`. */
export function hasIgnoreCookie(cookieHeader?: string | null): boolean {
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

	if (input.deployEnvironment !== 'production') {
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
