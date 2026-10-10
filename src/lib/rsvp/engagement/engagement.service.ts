import { randomUUID } from 'node:crypto';
import { getSupabaseUserByAccessToken, resolveAccessTokenFromRequest } from '@/lib/rsvp/auth/auth';
import {
	recordGuestEngagementEventsRpc,
	type EngagementEventRow,
	type EngagementRecordResult,
} from '@/lib/rsvp/repositories/engagement.repository';
import { getEnv } from '@/lib/server/env';
import type { ClientEngagementBatch } from './event-contract';
import { ENGAGEMENT_SCHEMA_VERSION, type ServerEngagementEvent } from './taxonomy';
import {
	classifyServerTraffic,
	deviceClassFromRequest,
	type TrafficEnvironment,
} from './traffic-classifier';

function trafficEnvironment(): TrafficEnvironment {
	return { vercelEnv: getEnv('VERCEL_ENV') };
}

function toSnakeProperties(properties: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(properties).map(([key, value]) => [
			key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
			value,
		]),
	);
}

/**
 * Signed-in viewer, resolved only when the request carries an auth token so ordinary guests pay
 * no auth round trip. Failures degrade to an anonymous viewer.
 */
async function resolveViewerUserId(request: Request): Promise<string | null> {
	const accessToken = resolveAccessTokenFromRequest(request);
	if (!accessToken) return null;
	try {
		const user = await getSupabaseUserByAccessToken(accessToken);
		return user?.id ?? null;
	} catch {
		return null;
	}
}

function requestTraits(request: Request) {
	const userAgent = request.headers.get('user-agent') ?? '';
	return {
		trafficClass: classifyServerTraffic(userAgent, trafficEnvironment()),
		deviceClass: deviceClassFromRequest(userAgent, request.headers.get('sec-ch-ua-mobile')),
	};
}

export async function ingestClientEngagementBatch(
	inviteId: string,
	batch: ClientEngagementBatch,
	request: Request,
): Promise<EngagementRecordResult> {
	const { trafficClass, deviceClass } = requestTraits(request);
	const viewerUserId = await resolveViewerUserId(request);
	const rows: EngagementEventRow[] = batch.events.map((event) => ({
		client_event_id: event.clientEventId,
		schema_version: event.schemaVersion,
		event_name: event.eventName,
		occurred_at: event.occurredAt,
		page_view_id: event.pageViewId,
		traffic_class: trafficClass,
		device_class: deviceClass,
		properties: toSnakeProperties(event.properties),
	}));
	const result = await recordGuestEngagementEventsRpc(inviteId, rows, viewerUserId);
	if (result.status === 'ok' && result.rejected > 0) {
		console.warn('[engagement] Events rejected by the ledger:', { rejected: result.rejected });
	}
	return result;
}

/**
 * Records a server-side event (link preview, RSVP submission). Never throws: engagement must not
 * affect the request that triggered it.
 */
export async function recordServerEngagementEvent(
	inviteId: string,
	event: ServerEngagementEvent,
	request: Request,
	options: { clientEventId?: string; forceTrafficClass?: 'bot' } = {},
): Promise<void> {
	try {
		const traits = requestTraits(request);
		const trafficClass =
			traits.trafficClass === 'non_production'
				? 'non_production'
				: (options.forceTrafficClass ?? traits.trafficClass);
		const viewerUserId = trafficClass === 'guest' ? await resolveViewerUserId(request) : null;
		await recordGuestEngagementEventsRpc(
			inviteId,
			[
				{
					client_event_id: options.clientEventId ?? randomUUID(),
					schema_version: ENGAGEMENT_SCHEMA_VERSION,
					event_name: event.eventName,
					occurred_at: new Date().toISOString(),
					page_view_id: null,
					traffic_class: trafficClass,
					device_class: traits.deviceClass,
					properties: toSnakeProperties(event.properties),
				},
			],
			viewerUserId,
		);
	} catch (error) {
		console.warn('[engagement] Non-critical server event failed:', {
			eventName: event.eventName,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
