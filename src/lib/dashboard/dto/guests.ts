import type { DeliveryStatus } from '@/interfaces/rsvp/domain.interface';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

export type GuestsListResponse = DashboardGuestListResponse;

interface BulkImportGuestDTO {
	full_name: string;
	phone?: string | null;
	country_code?: string | null;
	email?: string | null;
	tags?: string[];
	max_allowed_attendees?: number;
	max_allowed_children?: number;
}

export interface BulkImportDTO {
	eventId: string;
	guests: BulkImportGuestDTO[];
}

export interface BulkImportResult {
	created: number;
	updated: number;
	skipped?: number;
	conflicts?: number;
	status: string;
	errors?: string[];
}

export interface CreateGuestDTO {
	eventId: string;
	fullName: string;
	phone?: string | null;
	countryCode?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
	maxAllowedChildren?: number;
	isTest?: boolean;
}

export interface UpdateGuestDTO {
	fullName?: string;
	phone?: string | null;
	countryCode?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
	maxAllowedChildren?: number;
	childrenCount?: number;
	deliveryStatus?: DeliveryStatus;
	lastReminderSentAt?: string | null;
	lastMemoriesReminderSentAt?: string | null;
	isTest?: boolean;
}
