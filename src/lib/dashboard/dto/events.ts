import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

export interface EventListItemDTO {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
	status: EventRecord['status'];
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
}

/** Partial update body for PATCH /api/dashboard/admin/events/{eventId}; omitted fields are kept. */
export interface UpdateEventDTO {
	title?: string;
	slug?: string;
	eventType?: EventRecord['eventType'];
	status?: EventRecord['status'];
}
