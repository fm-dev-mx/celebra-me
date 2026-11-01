import { findInvitationDataOrder, findInvitationDataRequestByOrderId } from './repository';
import { createOrderDraftAtomic, findOrderInvitationId } from './draft-repository';
import { buildOrderDraftContent } from './draft-content';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { isEventType, listThemePresetsForEventType } from '@/lib/theme/theme-contract';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';

function conflict(message: string): never {
	throw new ApiError(409, 'conflict', message);
}

function editorUrl(id: string) {
	return `/dashboard/invitaciones/${id}/editar`;
}

export async function getOrderDraftOptions(orderId: string) {
	const order = await findInvitationDataOrder(orderId);
	if (!order) throw new ApiError(404, 'not_found', 'No se encontró el pedido.');
	const invitationId = await findOrderInvitationId(orderId);
	if (invitationId) {
		const [invitation, draft] = await Promise.all([
			findInvitationById(invitationId),
			findDraftByInvitationId(invitationId),
		]);
		if (!invitation || !draft)
			conflict('El borrador vinculado no está disponible. Revise el pedido.');
		return { invitationId, editorUrl: editorUrl(invitationId), presets: [] };
	}
	if (!['paid', 'deposit_paid'].includes(order.status))
		conflict('El pedido requiere un pago registrado.');
	if (!order.eventType || !isEventType(order.eventType))
		conflict('Revise el tipo de evento del pedido.');
	return {
		invitationId: null,
		editorUrl: null,
		presets: listThemePresetsForEventType(order.eventType),
	};
}

export async function createOrderDraft(orderId: string, themeId: string) {
	const options = await getOrderDraftOptions(orderId);
	if (options.invitationId)
		return { invitationId: options.invitationId, editorUrl: options.editorUrl, created: false };
	if (!(options.presets as string[]).includes(themeId))
		throw new ApiError(400, 'bad_request', 'Seleccione un diseño compatible con el evento.');
	const [order, request] = await Promise.all([
		findInvitationDataOrder(orderId),
		findInvitationDataRequestByOrderId(orderId),
	]);
	if (!order?.eventType || !request || request.status !== 'submitted' || !request.submittedAt)
		conflict('El cliente debe enviar sus datos antes de crear el borrador.');
	const names = request.answers.celebrantNames;
	if (
		!isEventType(order.eventType) ||
		!(listThemePresetsForEventType(order.eventType) as string[]).includes(themeId)
	) {
		conflict('El tipo de evento cambió. Actualice el pedido antes de seleccionar el diseño.');
	}
	if (!names || !request.answers.eventDate)
		conflict('Revise los nombres y la fecha enviados por el cliente.');
	const base =
		names
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 60)
			.replace(/-$/, '') || 'invitacion';
	const content = buildOrderDraftContent(request.answers, order.eventType);
	for (let attempt = 0; attempt < 3; attempt++) {
		const suffix = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(7, '0');
		try {
			const result = await createOrderDraftAtomic({
				orderId,
				expectedUpdatedAt: request.updatedAt,
				slug: `${base}-${suffix}`,
				themeId,
				content,
			});
			if ('error' in result) break;
			return { ...result, editorUrl: editorUrl(result.invitationId) };
		} catch (error) {
			if (
				!(error instanceof SupabaseHttpError) ||
				error.code !== '23505' ||
				!error.body.includes('invitations_slug_key')
			) {
				throw error;
			}
		}
	}
	conflict(
		'No se pudo crear el borrador. Actualice el pedido y revise el pago y los datos enviados.',
	);
}
