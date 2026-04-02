import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
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
	CreateUserResponse,
	UpdateUserRoleDTO,
	UserRoleChangeResponse,
} from './dto/users';
import type {
	CreateClaimCodeDTO,
	UpdateClaimCodeDTO,
	ClaimCodeCreateResponse,
	ClaimCodesListResponse,
} from './dto/claimcodes';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';

export class AdminApi {
	private handleResponse<T>(result: ApiResult<T>): T {
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.data;
	}

	// Events
	async listEvents(page = 1, perPage = 50): Promise<EventsListResponse> {
		const result = await dashboardApi.get<EventsListResponse>(
			`/api/dashboard/admin/events?page=${page}&perPage=${perPage}`,
		);
		return this.handleResponse(result);
	}

	async createEvent(payload: CreateEventDTO): Promise<EventListItemDTO> {
		const result = await dashboardApi.post<{ item: EventListItemDTO }>(
			'/api/dashboard/admin/events',
			payload,
		);
		return this.handleResponse(result).item;
	}

	async updateEvent(eventId: string, payload: UpdateEventDTO): Promise<EventListItemDTO> {
		const result = await dashboardApi.patch<{ item: EventListItemDTO }>(
			`/api/dashboard/admin/events/${encodeURIComponent(eventId)}`,
			payload,
		);
		return this.handleResponse(result).item;
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
		return this.handleResponse(result);
	}

	async createUser(payload: CreateUserDTO): Promise<CreateUserResponse> {
		const result = await dashboardApi.post<CreateUserResponse>(
			'/api/dashboard/admin/users',
			payload,
		);
		return this.handleResponse(result);
	}

	async updateUserRole(
		userId: string,
		payload: UpdateUserRoleDTO,
	): Promise<UserRoleChangeResponse> {
		const result = await dashboardApi.patch<{ item: UserRoleChangeResponse }>(
			`/api/dashboard/admin/users/${encodeURIComponent(userId)}/role`,
			payload,
		);
		return this.handleResponse(result).item;
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
		return this.handleResponse(result);
	}

	async createClaimCode(payload: CreateClaimCodeDTO): Promise<ClaimCodeCreateResponse> {
		const result = await dashboardApi.post<ClaimCodeCreateResponse>(
			'/api/dashboard/claimcodes',
			payload,
		);
		return this.handleResponse(result);
	}

	async updateClaimCode(claimCodeId: string, payload: UpdateClaimCodeDTO): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.patch<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async disableClaimCode(claimCodeId: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.delete<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
		);
		return this.handleResponse(result).item;
	}

	async validateClaimCode(claimCode: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.post<{ item: ClaimCodeDTO }>(
			'/api/dashboard/claimcodes/validate',
			{ claimCode },
		);
		return this.handleResponse(result).item;
	}
}

export const adminApi = new AdminApi();
