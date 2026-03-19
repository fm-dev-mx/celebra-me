import type { EventRecord } from '@/lib/rsvp/core/types';

export interface CreateEventDTO {
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
	status?: EventRecord['status'];
}

export interface UpdateEventDTO {
	title?: string;
	slug?: string;
	eventType?: EventRecord['eventType'];
	status?: EventRecord['status'];
}

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

export interface EventsListResponse {
	items: EventListItemDTO[];
	total: number;
	page: number;
	perPage: number;
}

export interface EventDetailResponse {
	item: EventListItemDTO;
}
