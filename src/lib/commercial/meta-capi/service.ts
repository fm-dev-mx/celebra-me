import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { isProductionDeployment } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';
import { createHash, randomUUID } from 'node:crypto';
import { classifyTrackingRoute } from '@/lib/tracking/route-policy';
import { safeErr } from '@/lib/server/safe-error';

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
	customer_id?: string | null;
	session_id?: string | null;
	event_source_path?: string | null;
	created_at?: string | null;
	value: number | null;
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
// Current Graph API version (released 2026-07-29); see the Meta Graph API changelog before bumping.
const META_GRAPH_API_VERSION = 'v26.0';
// A deposit is agreed and registered after the WhatsApp conversation, not on the website.
const META_PURCHASE_ACTION_SOURCE = 'chat';
// PageView, ViewContent, Contact and Lead rows mirror browser Pixel events and share their
// event_id for deduplication.
const BROWSER_EVENT_NAMES = new Set(['PageView', 'ViewContent', 'Contact', 'Lead']);
const SITE_ORIGIN = 'https://www.celebra-me.com';
// Ten seconds stays well inside the 120-second claim lease while allowing normal Graph API latency.
const META_CAPI_REQUEST_TIMEOUT_MS = 10_000;

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
	visitor_id?: string | null;
	fbp: string | null;
	fbc: string | null;
	fbclid: string | null;
	landing_path: string | null;
	client_ip_address?: string | null;
	client_user_agent?: string | null;
	consent_snapshot?: { marketing?: boolean } | null;
}

function isBrowserEvent(detail: OutboxDetail): boolean {
	return BROWSER_EVENT_NAMES.has(detail.event_name);
}

/** The order's session for a Purchase; the row's own session for a browser event. */
function resolveSessionId(detail: OutboxDetail): string | null | undefined {
	return isBrowserEvent(detail) ? detail.session_id : detail.sales_orders?.session_id;
}

/**
 * A Purchase follows the lead's recorded marketing consent. A browser event follows the
 * session's latest consent, so a visitor who withdrew it after the click is not sent.
 */
function hasMarketingConsent(detail: OutboxDetail, session: SessionDetail | null): boolean {
	if (isBrowserEvent(detail)) return session?.consent_snapshot?.marketing === true;
	return detail.leads?.consent_marketing === true;
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

export type BrowserConversionEventName = 'PageView' | 'ViewContent' | 'Contact' | 'Lead';

/** First-party tracking events whose Pixel standard event the server also delivers. */
const BROWSER_CONVERSION_TRIGGERS = {
	page_viewed: 'PageView',
	demo_viewed: 'ViewContent',
	package_viewed: 'ViewContent',
	whatsapp_contact_clicked: 'Contact',
	form_submitted: 'Lead',
} as const satisfies Record<string, BrowserConversionEventName>;

export type BrowserConversionTrigger = keyof typeof BROWSER_CONVERSION_TRIGGERS;

export function isBrowserConversionTrigger(
	eventName: string,
): eventName is BrowserConversionTrigger {
	return Object.hasOwn(BROWSER_CONVERSION_TRIGGERS, eventName);
}

export interface BrowserConversionInput {
	/** The first-party event; it picks the Meta event and is stored as trigger_status. */
	trigger: BrowserConversionTrigger;
	/** The tracking event UUID, which the Meta Pixel also sends as eventID. */
	eventId: string;
	sessionId: string;
	eventSourcePath: string;
	/** A Lead from the capture form carries its customer, so delivery adds the hashed phone. */
	customerId?: string;
	leadId?: string;
}

/**
 * Queues a browser PageView, ViewContent, Contact or Lead for server delivery. A repeated event ID
 * keeps the first row, so a replayed ingestion never sends the event twice. Callers check marketing
 * consent first.
 */
export async function enqueueBrowserConversionEvent(input: BrowserConversionInput): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: 'meta_conversion_events?on_conflict=event_id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=minimal',
		body: {
			event_name: BROWSER_CONVERSION_TRIGGERS[input.trigger],
			event_id: input.eventId,
			trigger_status: input.trigger,
			session_id: input.sessionId,
			event_source_path: input.eventSourcePath.slice(0, 512),
			...(input.customerId ? { customer_id: input.customerId } : {}),
			...(input.leadId ? { lead_id: input.leadId } : {}),
			value: null,
			status: 'pending',
		},
	});
}

export async function processPendingMetaConversionEvents(): Promise<ProcessResult> {
	const nowStr = new Date().toISOString();
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery: `meta_conversion_events?status=in.(pending,failed)&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(nowStr)})&select=id&order=created_at.asc&limit=20`,
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
			console.error(`[meta-capi] Error processing outbox event ${row.id}:`, safeErr(error));
			result.failed++;
		}
	}

	return result;
}

async function fetchEventDetails(outboxId: string): Promise<OutboxDetail | null> {
	const details = await supabaseRestRequest<OutboxDetail[]>({
		pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(outboxId)}&select=id,event_name,event_id,customer_id,session_id,event_source_path,created_at,value,currency,customers(email,phone_e164),sales_orders(session_id,deposit_paid_at,created_at),leads(consent_marketing,fbp,fbc,fbclid)`,
		method: 'GET',
		useServiceRole: true,
	});
	return details[0] || null;
}

async function fetchSessionDetails(sessionId: string): Promise<SessionDetail | null> {
	const sessionRows = await supabaseRestRequest<SessionDetail[]>({
		pathWithQuery: `visitor_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,visitor_id,fbp,fbc,fbclid,landing_path,client_ip_address,client_user_agent,consent_snapshot`,
		method: 'GET',
		useServiceRole: true,
	});
	return sessionRows[0] || null;
}

type UserData = Record<string, string | string[]>;

/** Hashed customer keys: email, phone and the external ID. */
function buildIdentityKeys(detail: OutboxDetail, session: SessionDetail | null): UserData {
	const userData: UserData = {};

	const emailHash = normalizeAndHashEmail(detail.customers?.email);
	if (emailHash) {
		userData.em = [emailHash];
	}

	const phoneHash = normalizeAndHashPhone(detail.customers?.phone_e164);
	if (phoneHash) {
		userData.ph = [phoneHash];
	}

	// The first-party visitor ID is shared by every event of the same browser; the customer ID
	// is the fallback when the order has no session.
	const externalId = session?.visitor_id?.trim() || detail.customer_id?.trim();
	if (externalId) {
		userData.external_id = [hashSha256(externalId)];
	}

	return userData;
}

/** Browser keys: Meta cookies, IP address and user agent. Meta requires the last two unhashed. */
function buildBrowserKeys(detail: OutboxDetail, session: SessionDetail | null): UserData {
	const userData: UserData = {};

	const fbp = session?.fbp || detail.leads?.fbp;
	if (fbp) {
		userData.fbp = fbp;
	}

	const fbc = session?.fbc || detail.leads?.fbc;
	if (fbc) {
		userData.fbc = fbc;
	}

	const clientIpAddress = session?.client_ip_address?.trim();
	if (clientIpAddress) {
		userData.client_ip_address = clientIpAddress;
	}

	const clientUserAgent = session?.client_user_agent?.trim();
	if (clientUserAgent) {
		userData.client_user_agent = clientUserAgent;
	}

	return userData;
}

function buildUserData(detail: OutboxDetail, session: SessionDetail | null): UserData {
	return { ...buildIdentityKeys(detail, session), ...buildBrowserKeys(detail, session) };
}

function resolveEventSourceUrl(path: string | null | undefined): string {
	if (!path?.startsWith('/')) {
		return `${SITE_ORIGIN}/`;
	}
	const testUrl = `${SITE_ORIGIN}${path}`;
	try {
		const classification = classifyTrackingRoute(testUrl);
		if (classification.metaAllowed) {
			return testUrl;
		}
	} catch {
		// Fallback
	}
	return `${SITE_ORIGIN}/`;
}

function buildEventPayload(
	detail: OutboxDetail,
	session: SessionDetail | null,
): { eventData: Record<string, unknown>; payloadHash: string } {
	const userData = buildUserData(detail, session);
	const browserEvent = isBrowserEvent(detail);
	const eventSourceUrl = resolveEventSourceUrl(
		browserEvent ? detail.event_source_path : session?.landing_path,
	);

	// A browser row is enqueued while the click is ingested, so its creation time is the event time.
	const eventTime =
		(browserEvent
			? detail.created_at
			: detail.sales_orders?.deposit_paid_at || detail.sales_orders?.created_at) ||
		new Date().toISOString();
	const eventTimeUnix = Math.floor(new Date(eventTime).getTime() / 1000);

	const eventData: Record<string, unknown> = {
		event_name: detail.event_name || 'Purchase',
		event_time: eventTimeUnix,
		event_id: detail.event_id,
		action_source: browserEvent ? 'website' : META_PURCHASE_ACTION_SOURCE,
		event_source_url: eventSourceUrl,
		user_data: userData,
	};
	if (detail.value !== null && detail.value !== undefined) {
		eventData.custom_data = {
			value: Number(detail.value) || 0,
			currency: detail.currency || 'MXN',
		};
	}

	const payloadHash = createHash('sha256').update(JSON.stringify(eventData)).digest('hex');

	return { eventData, payloadHash };
}

async function dispatchCapiPayload(
	pixelId: string,
	accessToken: string,
	requestBody: Record<string, unknown>,
): Promise<ProviderResult> {
	// The token travels in the JSON body so it never reaches URL logs.
	const metaUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`;
	const response = await fetch(metaUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ ...requestBody, access_token: accessToken }),
		signal: AbortSignal.timeout(META_CAPI_REQUEST_TIMEOUT_MS),
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

interface MetaDeliveryConfiguration {
	mode: 'disabled' | 'test' | 'production';
	productionBlocked: boolean;
}

function resolveDeliveryConfiguration(): MetaDeliveryConfiguration {
	const mode = getEnv('META_CAPI_DELIVERY_MODE')?.trim().toLowerCase();
	if (mode === 'test') return { mode: 'test', productionBlocked: false };
	if (mode === 'production') {
		return isProductionDeployment()
			? { mode: 'production', productionBlocked: false }
			: { mode: 'disabled', productionBlocked: true };
	}
	return { mode: 'disabled', productionBlocked: false };
}

/** False when META_CAPI_DELIVERY_MODE would mark every claimed row as skipped. */
export function isMetaCapiDeliveryEnabled(): boolean {
	return resolveDeliveryConfiguration().mode !== 'disabled';
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
	const deliveryConfiguration = resolveDeliveryConfiguration();
	const deliveryMode = deliveryConfiguration.mode;

	if (deliveryMode === 'disabled') {
		const errorCode = 'DELIVERY_DISABLED';
		const errorMessage = deliveryConfiguration.productionBlocked
			? 'Meta CAPI production delivery requires CELEBRA_DEPLOY_ENV=production.'
			: 'La entrega CAPI está desactivada en la configuración del entorno (META_CAPI_DELIVERY_MODE).';
		return finalizeClaim(
			outboxId,
			'skipped',
			attemptCount,
			errorCode,
			errorMessage,
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

	const sessionId = resolveSessionId(detail);
	const session = sessionId ? await fetchSessionDetails(sessionId) : null;

	if (!hasMarketingConsent(detail, session)) {
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

	// Meta requires the user agent on website events; without it the request is rejected.
	if (isBrowserEvent(detail) && !session?.client_user_agent?.trim()) {
		return finalizeClaim(
			outboxId,
			'skipped',
			attemptCount,
			'MISSING_CLIENT_USER_AGENT',
			'Website events need the session user agent, which was not recorded.',
			undefined,
			claimId,
		);
	}

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
		return finalizeDispatchFailure(outboxId, attemptCount, err, payloadHash, claimId);
	}
}

async function finalizeDispatchFailure(
	outboxId: string,
	attemptCount: number,
	error: unknown,
	payloadHash: string,
	claimId: string,
): Promise<'sent' | 'failed' | 'skipped' | 'ambiguous' | 'lost_claim'> {
	const errorName =
		typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined;
	if (errorName === 'TimeoutError' || errorName === 'AbortError') {
		return finalizeClaim(
			outboxId,
			'ambiguous',
			attemptCount,
			'META_REQUEST_TIMEOUT',
			`Meta CAPI request timed out after ${META_CAPI_REQUEST_TIMEOUT_MS} ms; delivery outcome is unknown.`,
			payloadHash,
			claimId,
		);
	}
	return finalizeClaim(
		outboxId,
		'failed',
		attemptCount,
		'NETWORK_ERROR',
		sanitizeProviderError(error),
		payloadHash,
		claimId,
	);
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
