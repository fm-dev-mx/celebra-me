import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { getEnv } from '@/lib/server/env';
import { createHash } from 'node:crypto';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

interface ProcessResult {
	processed: number;
	failed: number;
	skipped: number;
}

interface OutboxDetail {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	customers: { email?: string | null; phone_e164?: string | null } | null;
	sales_orders: { session_id?: string | null; deposit_paid_at?: string | null; created_at?: string | null } | null;
	leads: {
		consent_marketing?: boolean | null;
		fbp?: string | null;
		fbc?: string | null;
		fbclid?: string | null;
	} | null;
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

	const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

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

function buildUserData(detail: OutboxDetail, session: SessionDetail | null): Record<string, string | string[]> {
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

	const paymentTime = detail.sales_orders?.deposit_paid_at || detail.sales_orders?.created_at || new Date().toISOString();
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
): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }> {
	const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
	const response = await fetch(metaUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	if (response.ok) {
		return { ok: true };
	}

	let responseJson: Record<string, unknown> = {};
	try {
		const parsed = await response.json();
		if (typeof parsed === 'object' && parsed !== null) {
			responseJson = parsed as Record<string, unknown>;
		}
	} catch {
		// Ignore
	}

	const errorInfo = (responseJson.error as Record<string, unknown>) || {};
	const errorCode = String(errorInfo.code || response.status);
	const errorMessage = String(errorInfo.message || 'Meta CAPI request failed.');
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
): Promise<'sent' | 'failed' | 'skipped' | 'not_claimed'> {
	const now = new Date().toISOString();
	const initialUpdate = await supabaseRestRequest<Array<{ id: string; attempt_count: number }>>({
		pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(outboxId)}&status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(now)})&select=id,attempt_count`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			status: 'sending',
			updated_at: now,
		},
	});

	const outboxRow = initialUpdate[0];
	if (!outboxRow) {
		return 'not_claimed';
	}

	const attemptCount = (outboxRow.attempt_count || 0) + 1;
	const deliveryMode = resolveDeliveryMode();

	if (deliveryMode === 'disabled') {
		await updateStatus(
			outboxId,
			'skipped',
			attemptCount,
			'DELIVERY_DISABLED',
			'La entrega CAPI está desactivada en la configuración del entorno (META_CAPI_DELIVERY_MODE).',
		);
		return 'skipped';
	}

	const detail = await fetchEventDetails(outboxId);
	if (!detail) {
		await updateStatus(outboxId, 'failed', attemptCount, 'DATA_ERROR', 'Failed to retrieve event details.');
		return 'failed';
	}

	if (detail.leads?.consent_marketing !== true) {
		await updateStatus(
			outboxId,
			'skipped',
			attemptCount,
			'CONSENT_REQUIRED',
			'Marketing consent is required before preparing Meta user data.',
		);
		return 'skipped';
	}

	const credentials = resolveMetaCredentials();
	if (!credentials) {
		await updateStatus(outboxId, 'failed', attemptCount, 'CONFIG_ERROR', 'Missing environment configuration (META_CAPI_ACCESS_TOKEN or META_PIXEL_ID).');
		return 'failed';
	}

	const sessionId = detail.sales_orders?.session_id;
	const session = sessionId ? await fetchSessionDetails(sessionId) : null;
	const { eventData, payloadHash } = buildEventPayload(detail, session);

	const testEventCode = resolveTestEventCode(deliveryMode);
	if (deliveryMode === 'test' && !testEventCode) {
		await updateStatus(outboxId, 'failed', attemptCount, 'CONFIG_ERROR', 'Missing META_TEST_EVENT_CODE in test mode.');
		return 'failed';
	}

	const requestBody: Record<string, unknown> = {
		data: [eventData],
	};

	if (deliveryMode === 'test' && testEventCode) {
		requestBody.test_event_code = testEventCode;
	}

	try {
		const result = await dispatchCapiPayload(credentials.pixelId, credentials.accessToken, requestBody);
		if (result.ok) {
			await supabaseRestRequest<unknown>({
				pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(outboxId)}`,
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=minimal',
				body: {
					status: 'sent',
					attempt_count: attemptCount,
					sent_at: new Date().toISOString(),
					payload_hash: payloadHash,
					last_error_code: null,
					last_error_message: null,
					next_attempt_at: null,
					updated_at: new Date().toISOString(),
				},
			});
			return 'sent';
		} else {
			await updateStatus(outboxId, 'failed', attemptCount, result.errorCode, result.errorMessage, payloadHash);
			return 'failed';
		}
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		await updateStatus(outboxId, 'failed', attemptCount, 'NETWORK_ERROR', errMsg, payloadHash);
		return 'failed';
	}
}

async function updateStatus(
	id: string,
	status: 'failed' | 'skipped',
	attemptCount: number,
	errorCode?: string,
	errorMessage?: string,
	payloadHash?: string,
): Promise<void> {
	const body: Record<string, unknown> = {
		status,
		attempt_count: attemptCount,
		updated_at: new Date().toISOString(),
	};

	if (payloadHash) {
		body.payload_hash = payloadHash;
	}

	if (status === 'failed') {
		body.last_error_code = errorCode || null;
		body.last_error_message = errorMessage || null;

		const backoffMinutes = Math.min(240, Math.pow(2, attemptCount) * 5);
		body.next_attempt_at = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
	} else if (status === 'skipped') {
		body.last_error_code = errorCode || null;
		body.last_error_message = errorMessage || null;
		body.next_attempt_at = null;
	} else {
		body.last_error_code = null;
		body.last_error_message = null;
		body.next_attempt_at = null;
	}

	await supabaseRestRequest<unknown>({
		pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(id)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=minimal',
		body,
	});
}
