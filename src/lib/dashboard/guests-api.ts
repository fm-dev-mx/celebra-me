import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { DashboardEventListResponse } from '@/interfaces/dashboard/admin.interface';
import type {
	GuestsListResponse,
	BulkImportDTO,
	CreateGuestDTO,
	UpdateGuestDTO,
} from '@/lib/dashboard/dto/guests';

class DashboardApiError extends Error {
	status: number;
	code: string;
	details?: unknown;

	constructor(result: Extract<ApiResult<unknown>, { ok: false }>) {
		super(result.message);
		this.name = 'DashboardApiError';
		this.status = result.status;
		this.code = result.code;
		this.details = result.details;
	}
}

function shouldRequestDashboardDebug(): boolean {
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('debug') === '1';
}

export class GuestsApi {
	private handleResponse<T>(result: ApiResult<T>, context: string): T {
		if (!result.ok) {
			if (shouldRequestDashboardDebug()) {
				console.log('[dashboard][client][api:error]', {
					context,
					status: result.status,
					code: result.code,
					message: result.message,
					details: result.details,
				});
			}
			throw new DashboardApiError(result);
		}
		if (shouldRequestDashboardDebug()) {
			console.log('[dashboard][client][api:ok]', {
				context,
				status: result.status,
				data: result.data,
			});
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
		return this.handleResponse(result, 'guests.list');
	}

	async create(payload: CreateGuestDTO): Promise<DashboardGuestItem> {
		const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
			'/api/dashboard/guests',
			payload,
		);
		return this.handleResponse(result, 'guests.create').item;
	}

	async update(guestId: string, payload: UpdateGuestDTO): Promise<DashboardGuestItem> {
		const result = await dashboardApi.patch<{ item: DashboardGuestItem }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
			payload,
		);
		return this.handleResponse(result, 'guests.update').item;
	}

	async delete(guestId: string): Promise<{ message: string }> {
		const result = await dashboardApi.delete<{ message: string }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}`,
		);
		return this.handleResponse(result, 'guests.delete');
	}

	async markShared(guestId: string): Promise<DashboardGuestItem> {
		const result = await dashboardApi.post<{ item: DashboardGuestItem }>(
			`/api/dashboard/guests/${encodeURIComponent(guestId)}/mark-shared`,
		);
		return this.handleResponse(result, 'guests.markShared').item;
	}

	async bulkImport(payload: BulkImportDTO): Promise<void> {
		const result = await dashboardApi.post<void>('/api/dashboard/guests/bulk', payload);
		this.handleResponse(result, 'guests.bulkImport');
	}

	async listEvents(): Promise<DashboardEventListResponse> {
		let path = '/api/dashboard/events';
		if (shouldRequestDashboardDebug()) {
			const params = new URLSearchParams({ debug: '1' });
			const slug = new URLSearchParams(window.location.search).get('slug');
			if (slug) params.set('slug', slug);
			path = `/api/dashboard/events?${params.toString()}`;
		}
		const result = await dashboardApi.get<DashboardEventListResponse>(path);
		return this.handleResponse(result, 'events.list');
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
