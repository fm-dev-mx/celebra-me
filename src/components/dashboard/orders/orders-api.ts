import { dashboardApi } from '@/lib/dashboard/api-client';

export const API = '/api/dashboard/commercial';

export async function getData<T>(path: string): Promise<T> {
	const result = await dashboardApi.get<{ data: T }>(path);
	if (!result.ok) throw new Error(result.message || 'No se pudo cargar la información.');
	return result.data.data;
}

export class OrdersMutationError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export async function postData<T>(path: string, body: unknown): Promise<T> {
	const result = await dashboardApi.post<{ data: T }>(path, body);
	if (!result.ok)
		throw new OrdersMutationError(
			result.message || 'No se pudo guardar. Intente de nuevo.',
			result.status,
		);
	return result.data.data;
}
