import { createHash, randomBytes } from 'node:crypto';
import { parseInvitationDataAnswers } from '@/lib/invitation-data/answers-schema';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { getUsableWhatsAppE164 } from '@/lib/commercial/phone';
import {
	buildInvitationDataWhatsAppMessage,
	findMissingRequiredFields,
	type InvitationDataAnswers,
	type InvitationDataIssues,
	type InvitationDataStatus,
} from '@/lib/invitation-data/form';
import {
	enqueueCompleteRegistration,
	findInvitationDataOrder,
	findInvitationDataRequestByOrderId,
	findInvitationDataRequestByTokenHash,
	listSubmittedInvitationData,
	markInvitationDataReviewed,
	saveInvitationDataAnswers,
	upsertInvitationDataToken,
	type InvitationDataOrder,
	type InvitationDataRequest,
} from '@/lib/invitation-data/repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { runAfterResponse, type AfterResponseContext } from '@/lib/server/platform-request';
import { safeErr } from '@/lib/server/safe-error';

/** The link stays open this long after it is issued; issuing a new one restarts it. */
export const INVITATION_DATA_LINK_TTL_DAYS = 60;
export const INVITATION_DATA_PATH_PREFIX = '/mi-invitacion/';

const LINKABLE_ORDER_STATUSES = new Set(['deposit_paid', 'paid']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function createInvitationDataToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashInvitationDataToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedInvitationDataToken(token: unknown): token is string {
	return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** Opening a link that does not exist and one that was replaced look the same to the client. */
function linkNotFound(): ApiError {
	return new ApiError(
		404,
		'not_found',
		'Este enlace ya no es válido. Pida uno nuevo por WhatsApp.',
	);
}

export interface IssuedInvitationDataLink {
	url: string;
	whatsappUrl: string | null;
	expiresAt: string;
	request: InvitationDataRequest;
}

/** Issues the order's private link, replacing any previous one. Only paid deposits qualify. */
export async function issueInvitationDataLink(input: {
	orderId: string;
	origin: string;
	actorId?: string;
	now?: Date;
	token?: string;
}): Promise<IssuedInvitationDataLink> {
	const order = await findInvitationDataOrder(input.orderId);
	if (!order) throw new ApiError(404, 'not_found', 'No se encontró la orden de venta.');
	if (!LINKABLE_ORDER_STATUSES.has(order.status)) {
		throw new ApiError(
			409,
			'conflict',
			'El enlace de datos se genera cuando el anticipo ya está pagado.',
		);
	}

	const now = input.now ?? new Date();
	const token = input.token ?? createInvitationDataToken();
	const expiresAt = new Date(now.getTime() + INVITATION_DATA_LINK_TTL_DAYS * 86_400_000);
	const request = await upsertInvitationDataToken({
		orderId: order.id,
		tokenHash: hashInvitationDataToken(token),
		issuedAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
		createdBy: input.actorId,
	});

	const url = new URL(`${INVITATION_DATA_PATH_PREFIX}${token}`, input.origin).href;
	const phone = getUsableWhatsAppE164(order.customerPhoneE164);
	const whatsappUrl = phone
		? `https://wa.me/${phone}?text=${encodeURIComponent(
				buildInvitationDataWhatsAppMessage({ customerName: order.customerName, link: url }),
			)}`
		: null;

	return { url, whatsappUrl, expiresAt: request.expiresAt, request };
}

/** What the client form shows: saved answers over the lead's prefill. */
export interface InvitationDataFormState {
	status: InvitationDataStatus;
	eventType: string | null;
	answers: InvitationDataAnswers;
	expiresAt: string;
	lastSavedAt: string | null;
	submittedAt: string | null;
}

export function buildInvitationDataPrefill(order: InvitationDataOrder): InvitationDataAnswers {
	const prefill: InvitationDataAnswers = {};
	const celebrantNames = order.lead?.celebrantNames?.trim();
	if (celebrantNames) prefill.celebrantNames = celebrantNames;
	const eventDate = order.lead?.eventDate?.trim();
	if (eventDate) prefill.eventDate = eventDate.slice(0, 10);
	return prefill;
}

async function resolveActiveRequest(
	token: unknown,
	now: Date,
): Promise<{ request: InvitationDataRequest; order: InvitationDataOrder; tokenHash: string }> {
	if (!isWellFormedInvitationDataToken(token)) throw linkNotFound();
	const tokenHash = hashInvitationDataToken(token);
	const found = await findInvitationDataRequestByTokenHash(tokenHash);
	if (!found) throw linkNotFound();
	if (new Date(found.request.expiresAt).getTime() <= now.getTime()) {
		throw new ApiError(
			410,
			'invitation_unavailable',
			'Este enlace ya venció. Pida uno nuevo por WhatsApp.',
		);
	}
	return { ...found, tokenHash };
}

function toFormState(
	request: InvitationDataRequest,
	order: InvitationDataOrder,
): InvitationDataFormState {
	return {
		status: request.status,
		eventType: order.eventType ?? order.lead?.eventType ?? null,
		answers: { ...buildInvitationDataPrefill(order), ...request.answers },
		expiresAt: request.expiresAt,
		lastSavedAt: request.lastSavedAt,
		submittedAt: request.submittedAt,
	};
}

export async function loadInvitationDataForm(input: {
	token: unknown;
	now?: Date;
}): Promise<InvitationDataFormState> {
	const { request, order } = await resolveActiveRequest(input.token, input.now ?? new Date());
	return toFormState(request, order);
}

function invalidAnswers(issues: InvitationDataIssues): ApiError {
	return new ApiError(400, 'validation_error', 'Revise los datos marcados.', { issues });
}

/**
 * Autosaves the client's answers; `submit` also checks the required fields, marks the form as
 * received the first time, and queues CompleteRegistration for Meta after the response.
 * Saving after a submission keeps it received, so the owner is notified of the changes.
 */
export async function saveInvitationDataForm(
	input: { token: unknown; answers: unknown; submit?: boolean; now?: Date },
	options: { after?: AfterResponseContext | null } = {},
): Promise<InvitationDataFormState> {
	const now = input.now ?? new Date();
	const { request, order, tokenHash } = await resolveActiveRequest(input.token, now);

	const parsed = parseInvitationDataAnswers(input.answers);
	if (!parsed.ok) throw invalidAnswers(parsed.issues);
	const answers = parsed.answers;

	if (input.submit) {
		const missing = findMissingRequiredFields(answers);
		if (Object.keys(missing).length > 0) throw invalidAnswers(missing);
	}

	// Status comes from a snapshot; while it says unsubmitted, the write is guarded so a concurrent
	// submission is never rolled back to in_progress.
	const unsubmitted = !request.submittedAt;
	const firstSubmission = Boolean(input.submit) && unsubmitted;
	const status: InvitationDataStatus = unsubmitted && !input.submit ? 'in_progress' : 'submitted';
	let saved = await saveInvitationDataAnswers({
		requestId: request.id,
		tokenHash,
		answers,
		status,
		savedAt: now.toISOString(),
		firstSubmission,
		onlyIfUnsubmitted: unsubmitted,
	});
	if (!saved && unsubmitted) {
		// Another request submitted meanwhile (or the link was replaced): save as a later edit.
		saved = await saveInvitationDataAnswers({
			requestId: request.id,
			tokenHash,
			answers,
			status: 'submitted',
			savedAt: now.toISOString(),
		});
	}
	if (!saved) throw linkNotFound();

	if (input.submit) {
		// Idempotent (one event id per order), so a submission whose queueing failed recovers on
		// the next «Enviar».
		runAfterResponse(options.after, () => queueCompleteRegistration(order), {
			label: `invitation-data:complete-registration:${order.id}`,
		});
	}

	return toFormState(saved, order);
}

async function queueCompleteRegistration(order: InvitationDataOrder): Promise<void> {
	try {
		const outboxId = await enqueueCompleteRegistration({
			orderId: order.id,
			customerId: order.customerId,
			leadId: order.leadId,
		});
		if (outboxId) await deliverMetaConversionEvent(outboxId);
	} catch (error) {
		// Measurement only: the client's data is already saved.
		console.error('[invitation-data] CompleteRegistration failed:', safeErr(error));
	}
}

/** Dashboard view of one order's form; null when no link was issued yet. */
export interface InvitationDataSummary {
	status: InvitationDataStatus;
	tokenIssuedAt: string;
	expiresAt: string;
	expired: boolean;
	lastSavedAt: string | null;
	submittedAt: string | null;
	ownerReviewedAt: string | null;
	needsReview: boolean;
	answers: InvitationDataAnswers;
}

export function needsOwnerReview(request: InvitationDataRequest): boolean {
	if (request.status !== 'submitted' || !request.lastSavedAt) return false;
	if (!request.ownerReviewedAt) return true;
	return new Date(request.lastSavedAt).getTime() > new Date(request.ownerReviewedAt).getTime();
}

function toSummary(request: InvitationDataRequest, now: Date): InvitationDataSummary {
	return {
		status: request.status,
		tokenIssuedAt: request.tokenIssuedAt,
		expiresAt: request.expiresAt,
		expired: new Date(request.expiresAt).getTime() <= now.getTime(),
		lastSavedAt: request.lastSavedAt,
		submittedAt: request.submittedAt,
		ownerReviewedAt: request.ownerReviewedAt,
		needsReview: needsOwnerReview(request),
		answers: request.answers,
	};
}

export async function getInvitationDataSummary(
	orderId: string,
	now = new Date(),
): Promise<InvitationDataSummary | null> {
	const request = await findInvitationDataRequestByOrderId(orderId);
	return request ? toSummary(request, now) : null;
}

export async function markInvitationDataAsReviewed(
	orderId: string,
	now = new Date(),
): Promise<InvitationDataSummary> {
	const request = await markInvitationDataReviewed({ orderId, reviewedAt: now.toISOString() });
	if (!request) {
		throw new ApiError(404, 'not_found', 'Esta orden aún no tiene enlace de datos.');
	}
	return toSummary(request, now);
}

export interface InvitationDataInboxItem {
	orderId: string;
	orderNumber: string;
	customerId: string;
	customerName: string | null;
	customerPhoneE164: string | null;
	celebrantNames: string | null;
	lastSavedAt: string | null;
	firstReview: boolean;
}

/** Received forms the owner has not reviewed since their latest save. */
export async function listInvitationDataInbox(): Promise<InvitationDataInboxItem[]> {
	const entries = await listSubmittedInvitationData();
	return entries
		.filter((entry) => needsOwnerReview(entry.request))
		.map(({ request, order }) => ({
			orderId: order.id,
			orderNumber: order.orderNumber,
			customerId: order.customerId,
			customerName: order.customerName,
			customerPhoneE164: order.customerPhoneE164,
			celebrantNames: request.answers.celebrantNames ?? null,
			lastSavedAt: request.lastSavedAt,
			firstReview: !request.ownerReviewedAt,
		}));
}
