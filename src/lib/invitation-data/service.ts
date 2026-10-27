import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { parseInvitationDataAnswers } from '@/lib/invitation-data/answers-schema';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { getUsableWhatsAppE164 } from '@/lib/commercial/phone';
import {
	buildInvitationDataWhatsAppMessage,
	findMissingRequiredFields,
	INVITATION_DATA_ALLOWED_MIME_TYPES,
	INVITATION_DATA_MAX_PHOTO_BYTES,
	INVITATION_DATA_MAX_PHOTOS,
	type InvitationDataAnswers,
	type InvitationDataIssues,
	type InvitationDataPhoto,
	type InvitationDataStatus,
} from '@/lib/invitation-data/form';
import { deleteFromStorage, getPublicUrl, uploadToStorage } from '@/lib/intake/storage';
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

/** Retry rejected compare-and-swap writes using the latest answers and submission state. */
async function updateAnswers(
	token: unknown,
	now: Date,
	initial: InvitationDataRequest,
	change: (answers: InvitationDataAnswers) => InvitationDataAnswers,
	submit = false,
): Promise<InvitationDataRequest> {
	let current = initial;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const unsubmitted = !current.submittedAt;
		const saved = await saveInvitationDataAnswers({
			requestId: current.id,
			tokenHash: hashInvitationDataToken(token as string),
			expectedUpdatedAt: current.updatedAt,
			answers: change(current.answers),
			status: unsubmitted && !submit ? 'in_progress' : 'submitted',
			savedAt: now.toISOString(),
			firstSubmission: submit && unsubmitted,
			onlyIfUnsubmitted: unsubmitted,
		});
		if (saved) return saved;
		current = (await resolveActiveRequest(token, now)).request;
	}
	throw new ApiError(
		409,
		'conflict',
		'Sus datos cambiaron mientras se guardaban. Intente de nuevo.',
	);
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
	const { request, order } = await resolveActiveRequest(input.token, now);

	const parsed = parseInvitationDataAnswers(input.answers);
	if (!parsed.ok) throw invalidAnswers(parsed.issues);
	const answers = parsed.answers;

	if (input.submit) {
		const missing = findMissingRequiredFields(answers);
		if (Object.keys(missing).length > 0) throw invalidAnswers(missing);
	}

	const saved = await updateAnswers(
		input.token,
		now,
		request,
		(current) => {
			// Photo membership belongs exclusively to the upload/delete endpoints.
			const updated = { ...answers };
			if (current.photos) updated.photos = current.photos;
			else delete updated.photos;
			return updated;
		},
		Boolean(input.submit),
	);

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

export interface UploadedInvitationDataPhotoResult {
	photo: InvitationDataPhoto;
	answers: InvitationDataAnswers;
}

export async function uploadInvitationDataPhoto(input: {
	token: unknown;
	file: Blob;
	fileName: string;
	mimeType: string;
	now?: Date;
}): Promise<UploadedInvitationDataPhotoResult> {
	const now = input.now ?? new Date();
	const { request, order } = await resolveActiveRequest(input.token, now);

	if (!input.file || typeof input.file.size !== 'number' || input.file.size === 0) {
		throw new ApiError(400, 'bad_request', 'No se envió ningún archivo.');
	}

	if (input.file.size > INVITATION_DATA_MAX_PHOTO_BYTES) {
		throw new ApiError(400, 'bad_request', 'La imagen no debe superar los 10 MB.');
	}

	const mimeType = input.mimeType || input.file.type;
	if (!(INVITATION_DATA_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
		throw new ApiError(
			400,
			'bad_request',
			'Tipo de archivo no admitido. Suba fotos en formato JPG, PNG o WebP.',
		);
	}

	const currentPhotos = Array.isArray(request.answers.photos) ? request.answers.photos : [];
	if (currentPhotos.length >= INVITATION_DATA_MAX_PHOTOS) {
		throw new ApiError(
			400,
			'bad_request',
			`Solo puede subir un máximo de ${INVITATION_DATA_MAX_PHOTOS} fotos.`,
		);
	}

	const photoId = randomUUID();
	const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
	const storagePath = `invitation-data/${order.id}/${photoId}.${ext}`;

	await uploadToStorage('invitation-assets', storagePath, input.file, mimeType);
	const url = getPublicUrl('invitation-assets', storagePath);

	const sanitizedName = (input.fileName || 'foto').slice(0, 120);
	const photo: InvitationDataPhoto = {
		id: photoId,
		url,
		name: sanitizedName,
		size: input.file.size,
		type: mimeType,
		uploadedAt: now.toISOString(),
	};

	let saved: InvitationDataRequest;
	try {
		saved = await updateAnswers(input.token, now, request, (current) => {
			const photos = current.photos ?? [];
			if (photos.length >= INVITATION_DATA_MAX_PHOTOS) {
				throw new ApiError(400, 'bad_request', 'Solo puede subir un máximo de 10 fotos.');
			}
			return { ...current, photos: [...photos, photo] };
		});
	} catch (error) {
		// A transport failure may follow a committed PATCH; never delete its referenced object.
		if (error instanceof ApiError && [400, 404, 409, 410].includes(error.status)) {
			await deleteFromStorage('invitation-assets', storagePath);
		}
		throw error;
	}

	return { photo, answers: saved.answers };
}

export async function deleteInvitationDataPhoto(input: {
	token: unknown;
	photoId: string;
	now?: Date;
}): Promise<{ success: true; answers: InvitationDataAnswers }> {
	const now = input.now ?? new Date();
	const { request, order } = await resolveActiveRequest(input.token, now);
	const photo = request.answers.photos?.find((item) => item.id === input.photoId);
	if (photo) {
		// Derive the key from the authorized order, never from a supplied public URL.
		if (
			!/^[a-f0-9-]{36}$/iu.test(photo.id) ||
			!(INVITATION_DATA_ALLOWED_MIME_TYPES as readonly string[]).includes(photo.type)
		) {
			throw new ApiError(400, 'bad_request', 'No se pudo identificar la foto.');
		}
		const ext =
			photo.type === 'image/jpeg' ? 'jpg' : photo.type === 'image/png' ? 'png' : 'webp';
		await deleteFromStorage(
			'invitation-assets',
			`invitation-data/${order.id}/${photo.id}.${ext}`,
		);
	}
	const saved = await updateAnswers(input.token, now, request, (current) => ({
		...current,
		photos: (current.photos ?? []).filter((item) => item.id !== input.photoId),
	}));

	return { success: true, answers: saved.answers };
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
