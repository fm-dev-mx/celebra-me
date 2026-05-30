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
