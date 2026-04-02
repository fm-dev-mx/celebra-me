import { buildInvitationPath } from '@/utils/invitation-link';
import type { InvitationGuestContext } from '@/lib/invitation/page-data';
import {
	getInvitationContextByInviteId,
} from '@/lib/rsvp/services/invitation-context.service';
import { trackInvitationView } from '@/lib/rsvp/services/rsvp-submission.service';

export interface InvitationRouteAccessDecision {
	allowGuestContext: boolean;
	redirectPath: string | null;
}

export function decideInvitationRouteAccess(input: {
	currentPathWithQuery: string;
	routeEventType: string;
	routeSlug: string;
	routeIsDemo: boolean;
	inviteContext: Pick<InvitationGuestContext, 'inviteId' | 'eventSlug' | 'eventType'>;
}): InvitationRouteAccessDecision {
	const canonicalPath = buildInvitationPath({
		eventType: input.inviteContext.eventType,
		eventSlug: input.inviteContext.eventSlug,
		inviteId: input.inviteContext.inviteId,
	});
	const routeMatches =
		input.inviteContext.eventType === input.routeEventType &&
		input.inviteContext.eventSlug === input.routeSlug;

	if (input.routeIsDemo || !routeMatches) {
		return {
			allowGuestContext: false,
			redirectPath: canonicalPath !== input.currentPathWithQuery ? canonicalPath : null,
		};
	}

	return {
		allowGuestContext: true,
		redirectPath: null,
	};
}

export async function resolveRoutePersonalization(input: {
	inviteId: string | null;
	currentPathWithQuery: string;
	routeEventType: string;
	routeSlug: string;
	routeIsDemo: boolean;
}): Promise<{
	guestContext: InvitationGuestContext | null;
	redirectPath: string | null;
}> {
	if (!input.inviteId) {
		return {
			guestContext: null,
			redirectPath: null,
		};
	}

	try {
		const inviteContext = await getInvitationContextByInviteId(input.inviteId);
		const decision = decideInvitationRouteAccess({
			currentPathWithQuery: input.currentPathWithQuery,
			routeEventType: input.routeEventType,
			routeSlug: input.routeSlug,
			routeIsDemo: input.routeIsDemo,
			inviteContext,
		});

		if (decision.redirectPath || !decision.allowGuestContext) {
			return {
				guestContext: null,
				redirectPath: decision.redirectPath,
			};
		}

		void trackInvitationView(inviteContext.inviteId);
		return {
			guestContext: inviteContext,
			redirectPath: null,
		};
	} catch (error) {
		console.warn(
			'[invitation][route-personalization] Unable to resolve invite context.',
			error,
		);
		return {
			guestContext: null,
			redirectPath: null,
		};
	}
}
