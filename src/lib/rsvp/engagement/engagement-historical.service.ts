/**
 * Historical engagement estimate for the administrator ranking: legacy telemetry recorded before
 * the ledger, cleaned once per method version by the database. The figures are estimates, so they
 * are listed in their own view, never ranked and never mixed with measured or inferred figures.
 * Spec: docs/domains/rsvp/engagement-analytics.md ("Historical estimate").
 */
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	listEngagementHistoricalEstimatesRpc,
	type HistoricalEstimateRow,
} from '@/lib/rsvp/repositories/engagement.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import type {
	HistoricalEstimateInvitation,
	HistoricalEstimatesReport,
	HistoricalMethod,
} from '@/interfaces/dashboard/engagement-ranking.interface';

/** Mirrors compute_engagement_historical_estimates method version 1. */
const HISTORICAL_METHOD: HistoricalMethod = {
	version: 1,
	cutoff: '2026-10-12T16:25:00Z',
	previewWindowMinutes: 2,
	visitGapMinutes: 30,
};

const ALL_EVENT_TYPES = 'all';

function toNumber(value: string | number | null): number | null {
	if (value === null) return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function parseHistoricalEventType(value: string | null | undefined): string {
	const eventType = value?.trim() || ALL_EVENT_TYPES;
	if (eventType !== ALL_EVENT_TYPES && !(EVENT_TYPES as readonly string[]).includes(eventType)) {
		throw new ApiError(400, 'bad_request', 'Tipo de evento inválido.');
	}
	return eventType;
}

export function toHistoricalInvitation(row: HistoricalEstimateRow): HistoricalEstimateInvitation {
	return {
		invitationId: row.invitation_id,
		eventId: row.event_id,
		title: row.title,
		slug: row.slug,
		eventType: row.event_type,
		eventDate: row.event_date,
		computedAt: row.computed_at,
		guestsTotal: row.guests_total,
		guestsShared: row.guests_shared,
		guestsViewed: row.guests_viewed,
		guestsRespondedSelf: row.guests_responded_self,
		openedLower: row.opened_lower,
		openedUpper: row.opened_upper,
		visitsEstimate: row.visits_estimate,
		visitsPerViewer: toNumber(row.visits_per_viewer),
		conversionLower: toNumber(row.conversion_lower),
		viewsCounted: row.views_counted,
		viewsBeforeShare: row.views_before_share,
		viewsWithinPreviewWindow: row.views_within_preview_window,
		guestsUnshared: row.guests_unshared,
		guestsUnsharedViewed: row.guests_unshared_viewed,
		guestsUnsharedRespondedSelf: row.guests_unshared_responded_self,
	};
}

/** Validates the event type and lists the estimates; 503 until the routine exists. */
export async function getHistoricalEstimates(
	eventTypeParam: string | null | undefined,
): Promise<HistoricalEstimatesReport> {
	const eventType = parseHistoricalEventType(eventTypeParam);
	let rows: HistoricalEstimateRow[];
	try {
		rows = await listEngagementHistoricalEstimatesRpc(
			eventType === ALL_EVENT_TYPES ? null : eventType,
			HISTORICAL_METHOD.version,
		);
	} catch (error) {
		// Additive migration not applied yet in this environment: the routine is simply absent.
		if (
			error instanceof SupabaseHttpError &&
			(error.code === 'PGRST202' || error.status === 404)
		) {
			throw new ApiError(
				503,
				'service_unavailable',
				'La estimación histórica todavía no está disponible.',
			);
		}
		throw error;
	}
	return { eventType, method: HISTORICAL_METHOD, invitations: rows.map(toHistoricalInvitation) };
}
