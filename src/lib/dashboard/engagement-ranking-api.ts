/**
 * Browser-side client for the administrator engagement ranking. The client only paints: it
 * receives aggregates per invitation and design, never guest data. The same query string is the
 * page URL state, so a filtered view can be shared and the back button restores it.
 */

import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import {
	RANKING_ACTIVITY_STATES,
	RANKING_CONFIRMATION_MODES,
	RANKING_EVENT_STATUSES,
	RANKING_GROUP_KEYS,
	RANKING_METRICS,
	type EngagementRankingReport,
	type RankingFilters,
	type RankingGroupKey,
	type RankingMetric,
} from '@/interfaces/dashboard/engagement-ranking.interface';

const ENGAGEMENT_RANKING_API_PATH = '/api/dashboard/admin/engagement/ranking';

export class EngagementRankingRequestError extends Error {
	readonly status: number | null;

	constructor(status: number | null) {
		super('engagement_ranking_request_failed');
		this.name = 'EngagementRankingRequestError';
		this.status = status;
	}
}

function unwrap<T>(result: ApiResult<T>): T {
	if (!result.ok) throw new EngagementRankingRequestError(result.status);
	return result.data;
}

export interface EngagementRankingRequest {
	eventType: string;
	groupBy: RankingGroupKey;
	metric: RankingMetric;
	filters: RankingFilters;
}

export const DEFAULT_RANKING_REQUEST: EngagementRankingRequest = {
	eventType: 'all',
	groupBy: 'themePreset',
	metric: 'responseRate',
	filters: {},
};

/** Query string for the API and the page URL; defaults are omitted to keep links short. */
export function toRankingSearch(request: EngagementRankingRequest): string {
	const params = new URLSearchParams();
	if (request.eventType !== DEFAULT_RANKING_REQUEST.eventType)
		params.set('eventType', request.eventType);
	if (request.groupBy !== DEFAULT_RANKING_REQUEST.groupBy) params.set('groupBy', request.groupBy);
	if (request.metric !== DEFAULT_RANKING_REQUEST.metric) params.set('metric', request.metric);
	const { filters } = request;
	if (filters.eventStatus) params.set('eventStatus', filters.eventStatus);
	if (filters.activity) params.set('activity', filters.activity);
	if (filters.fontFamily) params.set('font', filters.fontFamily);
	if (filters.music) params.set('music', filters.music);
	if (filters.confirmationMode) params.set('confirmation', filters.confirmationMode);
	if (filters.includeDisabled) params.set('includeDisabled', 'true');
	return params.toString();
}

function pick<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
	return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Reads a request from the page URL; unknown values fall back to defaults instead of failing. */
export function fromRankingSearch(search: string): EngagementRankingRequest {
	const params = new URLSearchParams(search);
	const music = params.get('music');
	return {
		eventType: params.get('eventType') || DEFAULT_RANKING_REQUEST.eventType,
		groupBy: pick(RANKING_GROUP_KEYS, params.get('groupBy')) ?? DEFAULT_RANKING_REQUEST.groupBy,
		metric: pick(RANKING_METRICS, params.get('metric')) ?? DEFAULT_RANKING_REQUEST.metric,
		filters: {
			eventStatus: pick(RANKING_EVENT_STATUSES, params.get('eventStatus')),
			activity: pick(RANKING_ACTIVITY_STATES, params.get('activity')),
			fontFamily: params.get('font') || undefined,
			music: music === 'with' || music === 'without' ? music : undefined,
			confirmationMode: pick(RANKING_CONFIRMATION_MODES, params.get('confirmation')),
			includeDisabled: params.get('includeDisabled') === 'true' || undefined,
		},
	};
}

export const engagementRankingApi = {
	async ranking(request: EngagementRankingRequest): Promise<EngagementRankingReport> {
		const search = toRankingSearch(request);
		const payload = unwrap(
			await dashboardApi.get<{ ranking: EngagementRankingReport }>(
				search ? `${ENGAGEMENT_RANKING_API_PATH}?${search}` : ENGAGEMENT_RANKING_API_PATH,
			),
		);
		return payload.ranking;
	},
};
