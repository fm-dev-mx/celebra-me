import { dashboardApi, type ApiResult } from './api-client';
import type { DashboardGuestItem } from '@/components/dashboard/guests/types';
import type {
	GuestsListResponse,
	BulkImportDTO,
	CreateGuestDTO,
	UpdateGuestDTO,
} from './dto/guests';

export class GuestsApi {
	private handleResponse<T>(result: ApiResult<T>): T {
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.data;
	}

	async list(params: {
		eventId: string;
		search?: string;
		status?: string;
	}): Promise<GuestsListResponse> {
		const query = new URLSearchParams({ eventId: params.eventId });
		if (params.search) query.set('search', params.search);
		if (params.status) query.set('status', params.status);

		const result = await dashboardApi.get<GuestsListResponse>(
			`/api/dashboard/guests?${query.toString()}`,
		);
		return this.handleResponse(result);
	}

	async create(payload: CreateGuestDTO): Promise<DashboardGuestItem> {
		const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
			'/api/dashboard/guests',
			payload,
		);
		return this.handleResponse(result).item;
	}

	async update(guestId: string, payload: UpdateGuestDTO): Promise<DashboardGuestItem> {
		const result = await dashboardApi.patch<{ item: DashboardGuestItem }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async delete(guestId: string): Promise<{ message: string }> {
		const result = await dashboardApi.delete<{ message: string }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
		);
		return this.handleResponse(result);
	}

	async markShared(guestId: string): Promise<DashboardGuestItem> {
		const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}/mark-shared`,
		);
		return this.handleResponse(result).item;
	}

	async bulkImport(payload: BulkImportDTO): Promise<void> {
		const result = await dashboardApi.post<void>('/api/dashboard/guests/bulk', payload);
		this.handleResponse(result);
	}

	async listEvents(): Promise<{
		items: { id: string; title: string; slug: string; eventType: string }[];
	}> {
		const result = await dashboardApi.get<{
			items: { id: string; title: string; slug: string; eventType: string }[];
		}>('/api/dashboard/events');
		return this.handleResponse(result);
	}
}

export const guestsApi = new GuestsApi();
