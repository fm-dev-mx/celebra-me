import { checkRateLimit, peekRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { getClientIp } from '@/lib/server/platform-request';

/**
 * Failed guest codes allowed per connection and hour, shared by `/i/{shortId}` and
 * `/{slug}/{guestCode}`. Only unknown codes count; once they run out, every guest link from
 * that connection answers 429 until the window ends, so a valid code cannot be told apart.
 *
 * Workers rate limiting bindings only support 10 s and 60 s periods, so this one-hour window
 * always uses the per-instance buckets of the rate limit provider.
 */
export const GUEST_LINK_FAILURE_LIMIT = { maxHits: 20, windowSec: 3600 } as const;

function failureLimitInput(request: Request) {
	return {
		namespace: 'guest-link' as const,
		entityId: 'failed-code',
		ip: getClientIp(request) ?? 'unknown',
		...GUEST_LINK_FAILURE_LIMIT,
	};
}

export async function isGuestLinkBlocked(request: Request): Promise<boolean> {
	return !(await peekRateLimit(failureLimitInput(request)));
}

export async function recordGuestLinkFailure(request: Request): Promise<void> {
	await checkRateLimit(failureLimitInput(request));
}
