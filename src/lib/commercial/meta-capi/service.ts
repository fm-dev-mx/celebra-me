import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { getEnv } from '@/lib/server/env';
import { createHash, randomUUID } from 'node:crypto';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

interface ProcessResult {
	processed: number;
	failed: number;
	skipped: number;
	ambiguous: number;
}

interface OutboxDetail {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	customers: { email?: string | null; phone_e164?: string | null } | null;
	sales_orders: {
		session_id?: string | null;
		deposit_paid_at?: string | null;
		created_at?: string | null;
	} | null;
	leads: {
		consent_marketing?: boolean | null;
		fbp?: string | null;
		fbc?: string | null;
		fbclid?: string | null;
	} | null;
}

interface ClaimedOutboxRow {
	id: string;
	attempt_count: number;
	claim_id: string;
}

interface ProviderResult {
	ok: boolean;
	errorCode?: string;
	errorMessage?: string;
	eventsReceived?: number;
	traceId?: string;
	message?: string;
}

interface FinalizedOutboxRow {
	id: string;
}

const PROVIDER_ERROR_MAX_LENGTH = 300;
const SAFE_PROVIDER_ERROR_FALLBACK = 'Meta CAPI delivery failed without a safe provider message.';

export function sanitizeProviderError(value: unknown): string {
	const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
	const sanitized = raw
		.replace(/https?:\/\/[^\s]+/gi, '[redacted URL]')
		.replace(/\b(?:access_)?token\s*[=:]\s*[^\s,;&]+/gi, '[redacted token]')
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
		.replace(/\+?\d[\d\s().-]{6,}\d/g, '[redacted phone]')
		.replace(/\s+/g, ' ')
		.trim();
	return (sanitized || SAFE_PROVIDER_ERROR_FALLBACK).slice(0, PROVIDER_ERROR_MAX_LENGTH);
}

interface SessionDetail {
	id: string;
	fbp: string | null;
	fbc: string | null;
	fbclid: string | null;
	landing_path: string | null;
}

export function hashSha256(val: string): string {
	return createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
}

export function normalizeAndHashEmail(email?: string | null): string | undefined {
	const trimmed = email?.trim().toLowerCase();
	if (!trimmed || !trimmed.includes('@')) return undefined;
	return hashSha256(trimmed);
}

export function normalizeAndHashPhone(phoneE164?: string | null): string | undefined {
	const trimmed = phoneE164?.trim();
	if (!trimmed) return undefined;
	const digits = trimmed.replace(/\D/g, '');
	if (!digits) return undefined;
	return createHash('sha256').update(digits).digest('hex');
}

export async function processPendingMetaConversionEvents(): Promise<ProcessResult> {
	const nowStr = new Date().toISOString();
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery: `meta_conversion_events?status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(nowStr)})&select=id&limit=20`,
		method: 'GET',
		useServiceRole: true,
	});

	const result: ProcessResult = { processed: 0, failed: 0, skipped: 0, ambiguous: 0 };

	for (const row of rows) {
		try {
			const status = await deliverMetaConversionEvent(row.id);
			// 'not_claimed' intentionally not counted — another worker already claimed the event.
			if (status === 'sent') {
				result.processed++;
			} else if (status === 'skipped') {
				result.skipped++;
			} else if (status === 'failed') {
				result.failed++;
			} else if (status === 'ambiguous') {
				result.ambiguous++;
			}
		} catch (error) {
			console.error(`[meta-capi] Error processing outbox event ${row.id}:`, error);
			result.failed++;
		}
	}

	return result;
}

async function fetchEventDetails(outboxId: string): Promise<OutboxDetail | null> {
	const details = await supabaseRestRequest<OutboxDetail[]>({
		pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(outboxId)}&select=id,event_name,event_id,value,currency,customers(email,phone_e164),sales_orders(session_id,deposit_paid_at,created_at),leads(consent_marketing,fbp,fbc,fbclid)`,
		method: 'GET',
		useServiceRole: true,
	});
	return details[0] || null;
}

async function fetchSessionDetails(sessionId: string): Promise<SessionDetail | null> {
	const sessionRows = await supabaseRestRequest<SessionDetail[]>({
		pathWithQuery: `visitor_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,fbp,fbc,fbclid,landing_path`,
		method: 'GET',
		useServiceRole: true,
	});
	return sessionRows[0] || null;
}

function buildUserData(
	detail: OutboxDetail,
	session: SessionDetail | null,
): Record<string, string | string[]> {
	const userData: Record<string, string | string[]> = {};

	const emailHash = normalizeAndHashEmail(detail.customers?.email);
	if (emailHash) {
		userData.em = [emailHash];
	}

	const phoneHash = normalizeAndHashPhone(detail.customers?.phone_e164);
	if (phoneHash) {
		userData.ph = [phoneHash];
	}

	const fbp = session?.fbp || detail.leads?.fbp;
	if (fbp) {
		userData.fbp = fbp;
	}

	const fbc = session?.fbc || detail.leads?.fbc;
	if (fbc) {
		userData.fbc = fbc;
	}

	return userData;
}

function resolveEventSourceUrl(session: SessionDetail | null): string {
	const landingPath = session?.landing_path;
	if (!landingPath?.startsWith('/')) {
		return 'https://www.celebra-me.com/';
	}
	const testUrl = `https://www.celebra-me.com${landingPath}`;
	try {
		const classification = classifyTrackingRoute(testUrl);
		if (classification.metaAllowed) {
			return testUrl;
		}
	} catch {
		// Fallback
	}
	return 'https://www.celebra-me.com/';
}

function buildEventPayload(
	detail: OutboxDetail,
	session: SessionDetail | null,
): { eventData: Record<string, unknown>; payloadHash: string } {
	const userData = buildUserData(detail, session);
	const eventSourceUrl = resolveEventSourceUrl(session);

	const paymentTime =
		detail.sales_orders?.deposit_paid_at ||
		detail.sales_orders?.created_at ||
		new Date().toISOString();
	const eventTimeUnix = Math.floor(new Date(paymentTime).getTime() / 1000);

	const eventData = {
		event_name: detail.event_name || 'Purchase',
		event_time: eventTimeUnix,
		event_id: detail.event_id,
		action_source: 'website',
		event_source_url: eventSourceUrl,
		user_data: userData,
		custom_data: {
			value: Number(detail.value) || 0,
			currency: detail.currency || 'MXN',
		},
	};

	const payloadHash = createHash('sha256').update(JSON.stringify(eventData)).digest('hex');

	return { eventData, payloadHash };
}

async function dispatchCapiPayload(
	pixelId: string,
	accessToken: string,
	requestBody: Record<string, unknown>,
): Promise<ProviderResult> {
	const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
	const response = await fetch(metaUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	let responseJson: Record<string, unknown> = {};
	try {
		const parsed = await response.json();
		if (typeof parsed === 'object' && parsed !== null) {
			responseJson = parsed as Record<string, unknown>;
		}
	} catch {
		// Ignore
	}
	if (response.ok) {
		return {
			ok: true,
			eventsReceived:
				typeof responseJson.events_received === 'number'
					? responseJson.events_received
					: undefined,
			traceId:
				typeof responseJson.fbtrace_id === 'string'
					? responseJson.fbtrace_id.slice(0, 200)
					: undefined,
			message:
				typeof responseJson.message === 'string'
					? responseJson.message.slice(0, 500)
					: undefined,
		};
	}

	const errorInfo = (responseJson.error as Record<string, unknown>) || {};
	const errorCode = String(errorInfo.code || response.status);
	const errorMessage = sanitizeProviderError(
		typeof errorInfo.message === 'string' ? errorInfo.message : 'Meta CAPI request failed.',
	);
	return { ok: false, errorCode, errorMessage };
}

interface MetaCredentials {
	accessToken: string;
	pixelId: string;
}

function resolveMetaCredentials(): MetaCredentials | null {
	const accessToken = getEnv('META_CAPI_ACCESS_TOKEN')?.trim();
	const pixelId = getEnv('META_PIXEL_ID')?.trim() || getEnv('PUBLIC_META_PIXEL_ID')?.trim();
	if (!accessToken || !pixelId) {
		return null;
	}
	return { accessToken, pixelId };
}

function resolveDeliveryMode(): 'disabled' | 'test' | 'production' {
	const mode = getEnv('META_CAPI_DELIVERY_MODE')?.trim().toLowerCase();
	return mode === 'test' || mode === 'production' ? mode : 'disabled';
}

function resolveTestEventCode(mode: 'disabled' | 'test' | 'production'): string | null {
	const code = getEnv('META_TEST_EVENT_CODE')?.trim();
	return mode === 'test' && !code ? null : code || null;
}

export async function deliverMetaConversionEvent(
	outboxId: string,
): Promise<'sent' | 'failed' | 'skipped' | 'ambiguous' | 'not_claimed' | 'lost_claim'> {
	const now = new Date().toISOString();
	const claimId = randomUUID();
	const initialUpdate = await supabaseRestRequest<ClaimedOutboxRow[]>({
		pathWithQuery: 'rpc/claim_meta_conversion_event',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_event_id: outboxId,
			p_claim_id: claimId,
			p_now: now,
			p_lease_seconds: 120,
		},
	});

	const outboxRow = initialUpdate[0];
	if (!outboxRow) {
		return 'not_claimed';
	}

	const attemptCount = outboxRow.attempt_count;
	const deliveryMode = resolveDeliveryMode();

	if (deliveryMode === 'disabled') {
		return finalizeClaim(
			outboxId,
			'skipped',
			attemptCount,
			'DELIVERY_DISABLED',
			'La entrega CAPI está desactivada en la configuración del entorno (META_CAPI_DELIVERY_MODE).',
			undefined,
			claimId,
		);
	}

	const detail = await fetchEventDetails(outboxId);
	if (!detail) {
		return finalizeClaim(
			outboxId,
			'failed',
			attemptCount,
			'DATA_ERROR',
			'Failed to retrieve event details.',
			undefined,
			claimId,
		);
	}

	if (detail.leads?.consent_marketing !== true) {
		return finalizeClaim(
			outboxId,
			'skipped',
			attemptCount,
			'CONSENT_REQUIRED',
			'Marketing consent is required before preparing Meta user data.',
			undefined,
			claimId,
		);
	}

	const credentials = resolveMetaCredentials();
	if (!credentials) {
		return finalizeClaim(
			outboxId,
			'failed',
			attemptCount,
			'CONFIG_ERROR',
			'Missing environment configuration (META_CAPI_ACCESS_TOKEN or META_PIXEL_ID).',
			undefined,
			claimId,
		);
	}

	const sessionId = detail.sales_orders?.session_id;
	const session = sessionId ? await fetchSessionDetails(sessionId) : null;
	const { eventData, payloadHash } = buildEventPayload(detail, session);

	const testEventCode = resolveTestEventCode(deliveryMode);
	if (deliveryMode === 'test' && !testEventCode) {
		return finalizeClaim(
			outboxId,
			'failed',
			attemptCount,
			'CONFIG_ERROR',
			'Missing META_TEST_EVENT_CODE in test mode.',
			undefined,
			claimId,
		);
	}

	const requestBody: Record<string, unknown> = {
		data: [eventData],
	};

	if (deliveryMode === 'test' && testEventCode) {
		requestBody.test_event_code = testEventCode;
	}

	let providerAccepted = false;
	try {
		const result = await dispatchCapiPayload(
			credentials.pixelId,
			credentials.accessToken,
			requestBody,
		);
		if (result.ok) {
			providerAccepted = true;
			try {
				return await finalizeClaim(
					outboxId,
					'sent',
					attemptCount,
					undefined,
					undefined,
					payloadHash,
					claimId,
					result,
				);
			} catch (persistenceError) {
				return finalizeClaim(
					outboxId,
					'ambiguous',
					attemptCount,
					'PERSISTENCE_AFTER_ACCEPTANCE_FAILED',
					sanitizeProviderError(persistenceError),
					payloadHash,
					claimId,
					result,
				);
			}
		} else {
			return finalizeClaim(
				outboxId,
				'failed',
				attemptCount,
				result.errorCode,
				result.errorMessage,
				payloadHash,
				claimId,
			);
		}
	} catch (err) {
		if (providerAccepted) {
			return 'lost_claim';
		}
		const errMsg = sanitizeProviderError(err);
		return finalizeClaim(
			outboxId,
			'failed',
			attemptCount,
			'NETWORK_ERROR',
			errMsg,
			payloadHash,
			claimId,
		);
	}
}

async function finalizeClaim(
	id: string,
	status: 'sent' | 'failed' | 'skipped' | 'ambiguous',
	attemptCount: number,
	errorCode?: string,
	errorMessage?: string,
	payloadHash?: string,
	claimId?: string,
	providerResult: ProviderResult = { ok: false },
): Promise<'sent' | 'failed' | 'skipped' | 'ambiguous' | 'lost_claim'> {
	if (!claimId) throw new Error('CAPI completion requires an active claim id.');
	const nextAttemptAt =
		status === 'failed'
			? new Date(
					Date.now() + Math.min(240, Math.pow(2, attemptCount) * 5) * 60 * 1000,
				).toISOString()
			: null;
	const rows = await supabaseRestRequest<FinalizedOutboxRow[]>({
		pathWithQuery: 'rpc/finalize_meta_conversion_event',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_event_id: id,
			p_claim_id: claimId,
			p_status: status,
			p_now: new Date().toISOString(),
			p_payload_hash: payloadHash ?? null,
			p_error_code: errorCode?.slice(0, 120) ?? null,
			p_error_message: errorMessage ? sanitizeProviderError(errorMessage) : null,
			p_next_attempt_at: nextAttemptAt,
			p_provider_events_received: providerResult.eventsReceived ?? null,
			p_provider_trace_id: providerResult.traceId?.slice(0, 200) ?? null,
			p_provider_message: providerResult.message
				? sanitizeProviderError(providerResult.message)
				: null,
		},
	});
	if (!rows[0]) {
		console.warn(`[meta-capi] Lost claim while finalizing event ${id}.`);
		return 'lost_claim';
	}
	return status;
}
