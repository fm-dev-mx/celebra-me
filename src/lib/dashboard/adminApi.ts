import { dashboardApi } from './apiClient';
import type {
	CreateEventDTO,
	UpdateEventDTO,
	EventListItemDTO,
	EventsListResponse,
} from './dto/events';
import type {
	UserListItemDTO,
	UsersListResponse,
	CreateUserDTO,
	UpdateUserRoleDTO,
	UserRoleChangeResponse,
} from './dto/users';
import type {
	CreateClaimCodeDTO,
	UpdateClaimCodeDTO,
	ClaimCodeCreateResponse,
	ClaimCodesListResponse,
} from './dto/claimcodes';
import type { ClaimCodeDTO } from '@/lib/rsvp-v2/types';

export class AdminApi {
	// Events
	async listEvents(page = 1, perPage = 50): Promise<EventsListResponse> {
		const result = await dashboardApi.get<EventsListResponse>(
			`/api/dashboard/admin/events?page=${page}&perPage=${perPage}`,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data;
	}

	async createEvent(payload: CreateEventDTO): Promise<EventListItemDTO> {
		const result = await dashboardApi.post<{ item: EventListItemDTO }>(
			'/api/dashboard/admin/events',
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}

	async updateEvent(eventId: string, payload: UpdateEventDTO): Promise<EventListItemDTO> {
		const result = await dashboardApi.patch<{ item: EventListItemDTO }>(
			`/api/dashboard/admin/events/${encodeURIComponent(eventId)}`,
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}

	async archiveEvent(eventId: string): Promise<EventListItemDTO> {
		return this.updateEvent(eventId, { status: 'archived' });
	}

	async publishEvent(eventId: string): Promise<EventListItemDTO> {
		return this.updateEvent(eventId, { status: 'published' });
	}

	// Users
	async listUsers(page = 1, perPage = 50): Promise<UsersListResponse> {
		const result = await dashboardApi.get<UsersListResponse>(
			`/api/dashboard/admin/users?page=${page}&perPage=${perPage}`,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data;
	}

	async createUser(payload: CreateUserDTO): Promise<UserListItemDTO> {
		const result = await dashboardApi.post<{ item: UserListItemDTO }>(
			'/api/dashboard/admin/users',
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}

	async updateUserRole(
		userId: string,
		payload: UpdateUserRoleDTO,
	): Promise<UserRoleChangeResponse> {
		const result = await dashboardApi.patch<UserRoleChangeResponse>(
			`/api/dashboard/admin/users/${encodeURIComponent(userId)}/role`,
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data;
	}

	// Claim Codes
	async listClaimCodes(
		eventId?: string,
		page = 1,
		perPage = 50,
	): Promise<ClaimCodesListResponse> {
		const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
		if (eventId) query.set('eventId', eventId);
		const result = await dashboardApi.get<ClaimCodesListResponse>(
			`/api/dashboard/claimcodes?${query.toString()}`,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data;
	}

	async createClaimCode(payload: CreateClaimCodeDTO): Promise<ClaimCodeCreateResponse> {
		const result = await dashboardApi.post<ClaimCodeCreateResponse>(
			'/api/dashboard/claimcodes',
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data;
	}

	async updateClaimCode(claimCodeId: string, payload: UpdateClaimCodeDTO): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.patch<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
			payload,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}

	async disableClaimCode(claimCodeId: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.delete<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}

	async validateClaimCode(claimCode: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.post<{ item: ClaimCodeDTO }>(
			'/api/dashboard/claimcodes/validate',
			{ claimCode },
		);
		if (!result.ok) throw new Error(result.message);
		return result.data.item;
	}
}

export const adminApi = new AdminApi();
