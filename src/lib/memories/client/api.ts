/**
 * Browser-side API client for event memories. Guests use same-origin fetch;
 * organizer and admin surfaces go through the dashboard client so every
 * mutation carries the CSRF token.
 */

import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type {
	MemoriesAdminSpaceItem,
	MemoriesAdminTotals,
	MemoriesGuestProfile,
	MemoriesGuestQuota,
	MemoriesMediaPublicItem,
	MemoriesOrganizerListResponse,
	MemoriesOrganizerUploader,
	MemoriesReadiness,
	MemoriesSpaceHostSummary,
	MemoriesSpaceRecord,
	MemoriesSpaceSummary,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ADMIN_API_PATH,
	buildMemoriesGuestApiPath,
	buildMemoriesOrganizerApiPath,
} from '@/lib/memories/contract/private-request';
import type { MemoriesSpaceLimits } from '@/lib/memories/contract/limits';

export class MemoriesRequestError extends Error {
	readonly status: number | null;
	readonly code: string | undefined;
	/** Machine-readable cause of a refusal (`error.details.reason`), when the server names one. */
	readonly reason: string | undefined;

	constructor(status: number | null, code?: string, reason?: string) {
		super('memories_request_failed');
		this.name = 'MemoriesRequestError';
		this.status = status;
		this.code = code;
		this.reason = reason;
	}
}

function readErrorBody(payload: unknown): { code?: string; reason?: string } {
	if (typeof payload !== 'object' || payload === null) return {};
	const error = (payload as { error?: { code?: unknown; details?: { reason?: unknown } } }).error;
	return {
		code: typeof error?.code === 'string' ? error.code : undefined,
		reason: typeof error?.details?.reason === 'string' ? error.details.reason : undefined,
	};
}

async function guestRequest<T>(url: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			headers: {
				Accept: 'application/json',
				...(init?.body ? { 'Content-Type': 'application/json' } : {}),
				...init?.headers,
			},
		});
	} catch {
		throw new MemoriesRequestError(null);
	}
	const payload = (await response.json().catch(() => null)) as T | null;
	if (!response.ok || payload === null) {
		const { code, reason } = readErrorBody(payload);
		throw new MemoriesRequestError(response.status, code, reason);
	}
	return payload;
}

function unwrap<T>(result: ApiResult<T>): T {
	if (!result.ok) throw new MemoriesRequestError(result.status, result.code);
	return result.data;
}

// Guest -------------------------------------------------------------------------

export type MemoriesReservation = {
	item: MemoriesMediaPublicItem;
	/** Null when a replayed request already uploaded its bytes: go straight to `complete`. */
	upload: {
		uploadUrl: string;
		requiredHeaders: Record<string, string>;
		expiresAt: string;
	} | null;
};

export function createMemoriesGuestApi(publicSlug: string) {
	const base = buildMemoriesGuestApiPath(publicSlug);
	const sessionUrl = `${base}/session`;
	const itemsUrl = `${base}/items`;
	const itemUrl = (itemId: string) => `${itemsUrl}/${encodeURIComponent(itemId)}`;

	return {
		itemsUrl,
		itemMediaUrl: itemUrl,
		/** The small preview when it exists; the server falls back to the original. */
		itemThumbnailUrl: (itemId: string) => `${itemUrl(itemId)}?variant=thumb`,
		async getSession(): Promise<MemoriesGuestProfile | null> {
			const payload = await guestRequest<{ profile: MemoriesGuestProfile | null }>(
				sessionUrl,
			);
			return payload.profile;
		},
		async createSession(displayName: string): Promise<{
			profile: MemoriesGuestProfile;
			recoveryCode: string | null;
		}> {
			const payload = await guestRequest<{
				profile: MemoriesGuestProfile;
				recoveryCode?: string;
			}>(sessionUrl, {
				method: 'POST',
				body: JSON.stringify({ action: 'create', displayName }),
			});
			return { profile: payload.profile, recoveryCode: payload.recoveryCode ?? null };
		},
		async recoverSession(recoveryCode: string): Promise<MemoriesGuestProfile> {
			const payload = await guestRequest<{ profile: MemoriesGuestProfile }>(sessionUrl, {
				method: 'POST',
				body: JSON.stringify({ action: 'recover', recoveryCode }),
			});
			return payload.profile;
		},
		async updateProfile(displayName: string): Promise<MemoriesGuestProfile> {
			const payload = await guestRequest<{ profile: MemoriesGuestProfile }>(sessionUrl, {
				method: 'PATCH',
				body: JSON.stringify({ displayName }),
			});
			return payload.profile;
		},
		listItems(): Promise<{
			items: MemoriesMediaPublicItem[];
			quota: MemoriesGuestQuota;
			/** The space cannot take more files; absent from servers before this field existed. */
			eventFull?: boolean;
		}> {
			return guestRequest(itemsUrl);
		},
		reserve(input: {
			mimeType: string;
			sizeBytes: number;
			checksumSha256: string;
			durationSeconds: number | undefined;
			clientRequestId: string;
		}): Promise<MemoriesReservation> {
			return guestRequest(itemsUrl, {
				method: 'POST',
				body: JSON.stringify({ action: 'reserve', ...input }),
			});
		},
		complete(itemId: string): Promise<{ item: MemoriesMediaPublicItem }> {
			return guestRequest(itemUrl(itemId), {
				method: 'POST',
				body: JSON.stringify({ action: 'complete' }),
			});
		},
		updateCaption(itemId: string, caption: string): Promise<{ item: MemoriesMediaPublicItem }> {
			return guestRequest(itemUrl(itemId), {
				method: 'PATCH',
				body: JSON.stringify({ caption }),
			});
		},
		deleteItem(itemId: string): Promise<{ success: boolean }> {
			return guestRequest(itemUrl(itemId), { method: 'DELETE' });
		},
		reserveThumbnail(
			itemId: string,
			input: { sizeBytes: number; checksumSha256: string },
		): Promise<{ upload: MemoriesReservation['upload'] }> {
			return guestRequest(`${itemUrl(itemId)}/thumbnail`, {
				method: 'POST',
				body: JSON.stringify({ action: 'reserve', ...input }),
			});
		},
		confirmThumbnail(itemId: string): Promise<{ hasThumbnail: boolean }> {
			return guestRequest(`${itemUrl(itemId)}/thumbnail`, {
				method: 'POST',
				body: JSON.stringify({ action: 'confirm' }),
			});
		},
	};
}

export type MemoriesGuestApi = ReturnType<typeof createMemoriesGuestApi>;

// Organizer ---------------------------------------------------------------------

export type OrganizerSpaceItem = MemoriesSpaceSummary & { eventId: string };

export type OrganizerCatalogFilters = {
	status: string;
	uploader: string;
	uploaderAlias: string;
	kind: string;
	visibility: string;
	createdFrom: string;
	createdTo: string;
};

export function buildOrganizerCatalogUrl(
	eventId: string,
	page: number,
	filters: Partial<OrganizerCatalogFilters>,
): string {
	const params = new URLSearchParams({ page: String(page) });
	if (filters.status && filters.status !== 'all') params.set('status', filters.status);
	const uploader = (filters.uploader ?? '').replace(/\s+/g, ' ').trim();
	if (uploader) params.set('uploader', uploader);
	if (filters.uploaderAlias) params.set('uploaderAlias', filters.uploaderAlias);
	if (filters.kind) params.set('kind', filters.kind);
	if (filters.visibility) params.set('visibility', filters.visibility);
	if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
	if (filters.createdTo) params.set('createdTo', filters.createdTo);
	return `${buildMemoriesOrganizerApiPath(eventId)}?${params.toString()}`;
}

export const memoriesOrganizerApi = {
	async listItems(
		eventId: string,
		page: number,
		filters: Partial<OrganizerCatalogFilters>,
		signal?: AbortSignal,
	): Promise<MemoriesOrganizerListResponse & { space: MemoriesSpaceSummary }> {
		return unwrap(
			await dashboardApi.get<MemoriesOrganizerListResponse & { space: MemoriesSpaceSummary }>(
				buildOrganizerCatalogUrl(eventId, page, filters),
				{ signal },
			),
		);
	},
	itemMediaUrl(eventId: string, itemId: string, mode?: 'preview' | 'thumb'): string {
		const base = `${buildMemoriesOrganizerApiPath(eventId)}/items/${encodeURIComponent(itemId)}`;
		return mode ? `${base}?mode=${mode}` : base;
	},
	async updateItem(
		eventId: string,
		itemId: string,
		body: { caption?: string; status?: string; hidden?: boolean },
	): Promise<MemoriesMediaPublicItem> {
		const payload = unwrap(
			await dashboardApi.patch<{ item: MemoriesMediaPublicItem }>(
				`${buildMemoriesOrganizerApiPath(eventId)}/items/${encodeURIComponent(itemId)}`,
				body,
			),
		);
		return payload.item;
	},
	async deleteItem(eventId: string, itemId: string): Promise<void> {
		unwrap(
			await dashboardApi.delete<{ success: boolean }>(
				`${buildMemoriesOrganizerApiPath(eventId)}/items/${encodeURIComponent(itemId)}`,
			),
		);
	},
	async revokeUploader(eventId: string, guestAlias: string): Promise<void> {
		unwrap(
			await dashboardApi.post<{ success: boolean }>(buildMemoriesOrganizerApiPath(eventId), {
				action: 'revoke_session',
				guestAlias,
			}),
		);
	},
	async summary(eventId: string, signal?: AbortSignal): Promise<MemoriesSpaceHostSummary> {
		const payload = unwrap(
			await dashboardApi.get<{ summary: MemoriesSpaceHostSummary }>(
				`${buildMemoriesOrganizerApiPath(eventId)}/summary`,
				{ signal },
			),
		);
		return payload.summary;
	},
	qrUrl(eventId: string): string {
		return `${buildMemoriesOrganizerApiPath(eventId)}/qr`;
	},
	async share(
		eventId: string,
		action: 'enable' | 'disable' | 'rotate',
	): Promise<{ shareUrl: string | null }> {
		return unwrap(
			await dashboardApi.post<{ shareUrl: string | null }>(
				`${buildMemoriesOrganizerApiPath(eventId)}/share`,
				{ action },
			),
		);
	},
	async uploaders(eventId: string, signal?: AbortSignal): Promise<MemoriesOrganizerUploader[]> {
		const payload = unwrap(
			await dashboardApi.get<{ uploaders: MemoriesOrganizerUploader[] }>(
				`${buildMemoriesOrganizerApiPath(eventId)}/uploaders`,
				{ signal },
			),
		);
		return payload.uploaders;
	},
	async fetchItemBlob(eventId: string, itemId: string): Promise<Blob> {
		const response = await fetch(memoriesOrganizerApi.itemMediaUrl(eventId, itemId));
		if (!response.ok) throw new MemoriesRequestError(response.status);
		return response.blob();
	},
};

// Admin ---------------------------------------------------------------------------

export type AdminSpaceCandidate = {
	eventId: string;
	eventSlug: string;
	eventTitle: string;
	eventDate: string | null;
	defaults: {
		publicSlug: string;
		timeZone: string;
		uploadStartsLocal: string;
		uploadEndsLocal: string;
		retentionEndsLocal: string;
		limits: MemoriesSpaceLimits;
	};
};

export type AdminSpaceList = {
	items: MemoriesAdminSpaceItem[];
	totals: MemoriesAdminTotals;
	candidates: AdminSpaceCandidate[];
	/** Settings the module is missing; absent from servers before readiness existed. */
	readiness?: MemoriesReadiness;
	/** Origin of guest links in this environment; the canonical domain in Production. */
	publicOrigin?: string;
};

export const memoriesAdminApi = {
	async list(): Promise<AdminSpaceList> {
		return unwrap(await dashboardApi.get<AdminSpaceList>(MEMORIES_ADMIN_API_PATH));
	},
	qrUrl(eventId: string): string {
		return `${MEMORIES_ADMIN_API_PATH}/${encodeURIComponent(eventId)}/qr`;
	},
	async create(body: Record<string, unknown>): Promise<MemoriesSpaceRecord> {
		const payload = unwrap(
			await dashboardApi.post<{ item: MemoriesSpaceRecord }>(MEMORIES_ADMIN_API_PATH, body),
		);
		return payload.item;
	},
	async update(eventId: string, body: Record<string, unknown>): Promise<MemoriesSpaceRecord> {
		const payload = unwrap(
			await dashboardApi.patch<{ item: MemoriesSpaceRecord }>(
				`${MEMORIES_ADMIN_API_PATH}/${encodeURIComponent(eventId)}`,
				body,
			),
		);
		return payload.item;
	},
};
