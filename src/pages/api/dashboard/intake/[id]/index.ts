import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findInvitationById,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import { getIntakeRequestsByInvitationId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import { UpdateInvitationSchema } from '@/lib/intake/schemas/invitation.schema';
import { findEventByInvitationIdService } from '@/lib/rsvp/repositories/event.repository';
import { toIntakeRequestDTO, toIntakeSubmissionDTO } from '@/lib/dashboard/dto/intake-mapper';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { toEnrichedInvitationDTO } from '@/lib/intake/services/invitation.service';
import { hasRsvpContent } from '@/lib/intake/utils';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const invitation = await findInvitationById(id);
		if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

		const requests = await getIntakeRequestsByInvitationId(id, 'client');
		const activeRequest = requests[0] ?? null;

		let submission = null;
		if (activeRequest) {
			const sub = await getSubmissionByRequestId(activeRequest.id);
			if (sub) submission = toIntakeSubmissionDTO(sub);
		}

		// Look up associated RSVP event by invitation_project_id
		const event = await findEventByInvitationIdService(id);
		let rsvpEvent = null;
		if (event) {
			const eventId = event.id;
			const [guestRows, claimRows] = await Promise.all([
				supabaseRestRequest<Array<{ attendance_status: string }>>({
					pathWithQuery: `guest_invitations?select=attendance_status&event_id=eq.${encodeURIComponent(eventId)}&deleted_at=is.null`,
					useServiceRole: true,
				}),
				supabaseRestRequest<Array<{ id: string }>>({
					pathWithQuery: `event_claim_codes?select=id&event_id=eq.${encodeURIComponent(eventId)}&deleted_at=is.null`,
					useServiceRole: true,
				}),
			]);

			const guests = Array.isArray(guestRows) ? guestRows : [];
			const claimCodes = Array.isArray(claimRows) ? claimRows : [];

			rsvpEvent = {
				id: event.id,
				slug: event.slug,
				eventType: event.eventType,
				title: event.title,
				status: event.status,
				guestCount: guests.length,
				confirmedCount: guests.filter((g) => g.attendance_status === 'confirmed').length,
				declinedCount: guests.filter((g) => g.attendance_status === 'declined').length,
				pendingCount: guests.filter((g) => g.attendance_status === 'pending').length,
				claimCodeCount: claimCodes.length,
			};
		}

		const publishedContent = await findPublishedByInvitationId(id);
		return jsonResponse({
			item: toEnrichedInvitationDTO(invitation, {
				request: activeRequest,
				hasSubmission: Boolean(submission),
				published: Boolean(publishedContent),
				rsvpEvent: event,
				rsvpSectionHasContent: hasRsvpContent(publishedContent?.content),
			}),
			request: activeRequest ? toIntakeRequestDTO(activeRequest) : null,
			submission,
			rsvpEvent,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:update');

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const parsed = await validateBodyOrRespond(request, UpdateInvitationSchema);
		if (parsed instanceof Response) return parsed;

		const invitation = await updateInvitation(id, parsed);
		const [requests, publishedContent, event] = await Promise.all([
			getIntakeRequestsByInvitationId(id, 'client'),
			findPublishedByInvitationId(id),
			findEventByInvitationIdService(id),
		]);
		const activeRequest = requests[0] ?? null;
		const submission = activeRequest ? await getSubmissionByRequestId(activeRequest.id) : null;

		return jsonResponse({
			item: toEnrichedInvitationDTO(invitation, {
				request: activeRequest,
				hasSubmission: Boolean(submission),
				published: Boolean(publishedContent),
				rsvpEvent: event,
				rsvpSectionHasContent: hasRsvpContent(publishedContent?.content),
			}),
		});
	} catch (error) {
		return errorResponse(error);
	}
};
