import type { DashboardGuestListResponse } from '@/components/dashboard/guests/types';

export type GuestsListResponse = DashboardGuestListResponse;

export interface BulkImportGuestDTO {
	full_name: string;
	phone_?: string | null;
	email?: string | null;
	tags?: string[];
}

export interface BulkImportDTO {
	eventId: string;
	guests: BulkImportGuestDTO[];
}

export interface CreateGuestDTO {
	eventId: string;
	fullName: string;
	phone?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
}

export interface UpdateGuestDTO {
	fullName?: string;
	phone?: string;
	email?: string | null;
	tags?: string[];
	maxAllowedAttendees?: number;
}
