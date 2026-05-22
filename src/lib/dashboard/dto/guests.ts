import type { DeliveryStatus } from '@/interfaces/rsvp/domain.interface';
import type { DashboardGuestListResponse } from '@/interfaces/dashboard/guest.interface';

export type GuestsListResponse = DashboardGuestListResponse;

export interface BulkImportGuestDTO {
	full_name: string;
	phone?: string | null;
	country_code?: string | null;
	email?: string | null;
	tags?: string[];
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
	phone?: string;
	countryCode?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
}

export interface UpdateGuestDTO {
	fullName?: string;
	phone?: string;
	countryCode?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
	deliveryStatus?: DeliveryStatus;
}
