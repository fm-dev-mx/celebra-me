import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import type {
	GuestsListResponse,
	BulkImportDTO,
	CreateGuestDTO,
	UpdateGuestDTO,
} from '@/lib/dashboard/dto/guests';

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
		items: { id: string; title: string; slug: string; eventType: EventRecord['eventType'] }[];
	}> {
		const result = await dashboardApi.get<{
			items: {
				id: string;
				title: string;
				slug: string;
				eventType: EventRecord['eventType'];
			}[];
		}>('/api/dashboard/events');
		return this.handleResponse(result);
	}

	/**
	 * Downloads the guest list as a CSV file.
	 * Uses raw fetch (blob response) because the shared fetchJSON helper
	 * only handles JSON payloads.
	 */
	async exportCsv(eventId: string): Promise<void> {
		const query = new URLSearchParams({ eventId });
		const response = await fetch(`/api/dashboard/guests/export.csv?${query.toString()}`);

		if (!response.ok) {
			throw new Error('Error al exportar CSV');
		}

		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `invitados-${eventId}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(anchor);
	}
}

export const guestsApi = new GuestsApi();
