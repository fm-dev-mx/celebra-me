import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';

export interface CreateClaimCodeDTO {
	eventId: string;
	maxUses?: number;
	expiresAt?: string | null;
}

export interface UpdateClaimCodeDTO {
	active?: boolean;
	expiresAt?: string | null;
	maxUses?: number;
}

export interface ClaimCodeCreateResponse {
	plainCode: string;
	item: ClaimCodeDTO;
}

export interface ClaimCodesListResponse {
	items: ClaimCodeDTO[];
	total: number;
	page: number;
	perPage: number;
}
