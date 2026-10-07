import { resolveInvitationCssLoadPlan } from '@/lib/invitation/section-css-resolver-map';

/** Stylesheet URLs of the load plan, in delivery order. */
export function resolveInvitationCssUrls(
	...args: Parameters<typeof resolveInvitationCssLoadPlan>
): string[] {
	return resolveInvitationCssLoadPlan(...args).map((item) => item.href);
}
