/**
 * Browser-side client for the administrator engagement ranking. The client only paints: it
 * receives aggregates per invitation and design, never guest data.
 */

import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type {
	EngagementRankingReport,
	RankingGroupKey,
	RankingMetric,
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
}

export const engagementRankingApi = {
	async ranking(request: EngagementRankingRequest): Promise<EngagementRankingReport> {
		const query = new URLSearchParams({
			eventType: request.eventType,
			groupBy: request.groupBy,
			metric: request.metric,
		});
		const payload = unwrap(
			await dashboardApi.get<{ ranking: EngagementRankingReport }>(
				`${ENGAGEMENT_RANKING_API_PATH}?${query.toString()}`,
			),
		);
		return payload.ranking;
	},
};
