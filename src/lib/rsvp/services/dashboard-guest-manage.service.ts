import { findGuestByPhone, updateGuestById, deleteGuestById } from '@/lib/rsvp/repository';
import type { AttendanceStatus, DashboardGuestMutationResponse } from '@/lib/rsvp/types';
import { ApiError } from '@/lib/rsvp/errors';
import { publishGuestStreamEvent } from '@/lib/rsvp/stream';
import { mapSupabaseErrorToApiError } from '@/lib/rsvp/supabase-errors';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import {
	getEventPresentationData,
	getGuestAccessOrThrow,
} from '@/lib/rsvp/services/shared/dashboard-guest-context';
import { toGuestDto } from '@/lib/rsvp/services/shared/guest-dto';
import { normalizePhone, sanitize, toSafeAttendeeCount } from '@/lib/rsvp/utils';

export async function updateDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
	fullName?: string;
	phone?: string;
	maxAllowedAttendees?: number;
	attendanceStatus?: AttendanceStatus;
	attendeeCount?: number;
	guestMessage?: string;
	tags?: string[];
}): Promise<DashboardGuestMutationResponse> {
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);

	const nextStatus = input.attendanceStatus ?? existing.attendanceStatus;
	const requestedCount =
		input.attendeeCount !== undefined
			? toSafeAttendeeCount(input.attendeeCount)
			: existing.attendeeCount;
	const nextAttendeeCount = nextStatus === 'declined' ? 0 : requestedCount;
	const nextCap =
		input.maxAllowedAttendees !== undefined
			? Math.max(1, Math.min(20, Math.trunc(input.maxAllowedAttendees)))
			: existing.maxAllowedAttendees;

	if (nextStatus === 'confirmed' && nextAttendeeCount < 1) {
		throw new ApiError(400, 'bad_request', 'Confirmado requiere al menos un asistente.');
	}
	if (nextAttendeeCount > nextCap) {
		throw new ApiError(400, 'bad_request', `El maximo permitido es ${nextCap}.`);
	}

	let updated;
	try {
		const nextPhone = input.phone !== undefined ? normalizePhone(input.phone) : undefined;
		if (nextPhone && nextPhone !== existing.phone) {
			const duplicate = await findGuestByPhone(
				existing.eventId,
				nextPhone,
				input.hostAccessToken,
			);
			if (duplicate) {
				throw new ApiError(
					409,
					'conflict',
					'Este telefono ya esta registrado en este evento.',
				);
			}
		}

		updated = await updateGuestById(
			{
				guestId: input.guestId,
				fullName: input.fullName !== undefined ? sanitize(input.fullName, 140) : undefined,
				phone: nextPhone,
				maxAllowedAttendees: nextCap,
				attendanceStatus: nextStatus,
				attendeeCount: nextAttendeeCount,
				guestMessage:
					input.guestMessage !== undefined
						? sanitize(input.guestMessage, 500)
						: undefined,
				lastResponseSource: 'admin',
				respondedAt: nextStatus === 'pending' ? null : new Date().toISOString(),
				tags: input.tags,
			},
			input.hostAccessToken,
		);
	} catch (error) {
		throw mapSupabaseErrorToApiError(error);
	}

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'update_guest',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: updated as unknown as Record<string, unknown>,
		});
	}

	const presentation = await getEventPresentationData(updated.eventId, input.hostAccessToken);
	const item = toGuestDto(
		updated,
		input.origin,
		presentation.eventTitle,
		presentation.eventType,
		presentation.eventSlug,
		presentation.template,
	);

	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: updated.eventId,
		guestId: updated.id,
		updatedAt: item.updatedAt,
	});
	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}

export async function deleteDashboardGuest(input: {
	guestId: string;
	hostAccessToken: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
}): Promise<void> {
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'delete_guest',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: null,
		});
	}

	await deleteGuestById(input.guestId, input.hostAccessToken);
	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: existing.eventId,
		guestId: existing.id,
		updatedAt: new Date().toISOString(),
	});
}

export async function markGuestShared(input: {
	guestId: string;
	hostAccessToken: string;
	origin: string;
	actorUserId?: string;
	isSuperAdmin?: boolean;
}): Promise<DashboardGuestMutationResponse> {
	const existing = await getGuestAccessOrThrow(input.guestId, input.hostAccessToken);
	const updated = await updateGuestById(
		{
			guestId: input.guestId,
			deliveryStatus: 'shared',
		},
		input.hostAccessToken,
	);

	const presentation = await getEventPresentationData(updated.eventId, input.hostAccessToken);
	const item = toGuestDto(
		updated,
		input.origin,
		presentation.eventTitle,
		presentation.eventType,
		presentation.eventSlug,
		presentation.template,
	);

	if (input.isSuperAdmin && input.actorUserId) {
		await logAdminAction({
			actorId: input.actorUserId,
			action: 'mark_guest_shared',
			targetTable: 'guest_invitations',
			targetId: input.guestId,
			oldData: existing as unknown as Record<string, unknown>,
			newData: updated as unknown as Record<string, unknown>,
		});
	}

	publishGuestStreamEvent({
		type: 'guest_updated',
		eventId: updated.eventId,
		guestId: updated.id,
		updatedAt: item.updatedAt,
	});
	return {
		item,
		updatedAt: item.updatedAt,
		source: 'mutation',
	};
}
