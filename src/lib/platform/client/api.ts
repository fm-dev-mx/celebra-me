/**
 * Browser-side API client for the platform usage console. The client only
 * paints: provider tokens and raw provider payloads never reach the browser.
 */

import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type { PlatformUsageReport } from '@/lib/platform/contract/types';

export const PLATFORM_ADMIN_API_PATH = '/api/dashboard/admin/platform';

export class PlatformRequestError extends Error {
	readonly status: number | null;

	constructor(status: number | null) {
		super('platform_request_failed');
		this.name = 'PlatformRequestError';
		this.status = status;
	}
}

function unwrap<T>(result: ApiResult<T>): T {
	if (!result.ok) throw new PlatformRequestError(result.status);
	return result.data;
}

export const platformAdminApi = {
	async usage(): Promise<PlatformUsageReport> {
		const payload = unwrap(
			await dashboardApi.get<{ usage: PlatformUsageReport }>(
				`${PLATFORM_ADMIN_API_PATH}/usage`,
			),
		);
		return payload.usage;
	},
};
