import { fetchJSON, type ApiResult } from '@/lib/api-client-shared';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

export interface RsvpPayload {
	attendanceStatus: 'confirmed' | 'declined';
	attendeeCount: number;
	guestMessage?: string;
}

export interface PublicRsvpPayload extends RsvpPayload {
	fullName: string;
	phone: string;
}

export interface ContactPayload {
	name: string;
	email: string;
	message: string;
}

class RsvpApi {
	private handleResponse<T>(result: ApiResult<T>): T {
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.data;
	}

	async submitRsvp(inviteId: string, payload: RsvpPayload): Promise<{ rsvpId: string }> {
		const result = await fetchJSON<{ rsvpId: string; data?: { rsvpId?: string } }>(
			`/api/invitacion/${encodeURIComponent(inviteId)}/rsvp`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			},
		);
		const data = this.handleResponse(result);
		return { rsvpId: data.rsvpId || data.data?.rsvpId || '' };
	}

	async submitPublicRsvp(
		eventType: EventRecord['eventType'],
		eventSlug: string,
		payload: PublicRsvpPayload,
	): Promise<{ inviteId?: string; guestId?: string }> {
		const result = await fetchJSON<{
			inviteId?: string;
			guestId?: string;
			data?: { inviteId?: string; guestId?: string };
		}>(
			`/api/invitacion/public/${encodeURIComponent(eventType)}/${encodeURIComponent(eventSlug)}/rsvp`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			},
		);
		const data = this.handleResponse(result);
		return {
			inviteId: data.inviteId || data.data?.inviteId,
			guestId: data.guestId || data.data?.guestId,
		};
	}

	async markViewed(inviteId: string): Promise<void> {
		const result = await fetchJSON<void>(
			`/api/invitacion/${encodeURIComponent(inviteId)}/view`,
			{ method: 'POST' },
		);
		this.handleResponse(result);
	}

	async trackAction(rsvpId: string, action: string, channel: string = 'whatsapp'): Promise<void> {
		const result = await fetchJSON<void>('/api/rsvp/channel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rsvpId, channel, action }),
		});
		this.handleResponse(result);
	}

	async submitContact(payload: ContactPayload): Promise<void> {
		const result = await fetchJSON<void>('/api/contact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		this.handleResponse(result);
	}
}

export const rsvpApi = new RsvpApi();
