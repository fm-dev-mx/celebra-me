import type {
	InvitationAccessCommand,
	InvitationAccessRecord,
} from '@/lib/invitation/access/invitation-access-command';

/** One administrator action on payment status or public access. */
export type InvitationAccessAction = 'mark_paid' | 'mark_unpaid' | 'disable' | 'enable';

interface AccessActionCopy {
	menuLabel: string;
	title: string;
	message: string;
	confirmLabel: string;
	destructive?: true;
	success: string;
}

export const INVITATION_ACCESS_ACTION_COPY: Record<InvitationAccessAction, AccessActionCopy> = {
	mark_paid: {
		menuLabel: 'Marcar como pagada',
		title: 'Marcar como pagada',
		message: 'La marca de vista previa desaparece de inmediato para todos los invitados.',
		confirmLabel: 'Marcar como pagada',
		success: 'Invitación marcada como pagada.',
	},
	mark_unpaid: {
		menuLabel: 'Marcar como no pagada',
		title: 'Marcar como no pagada',
		message:
			'Los invitados verán de inmediato la invitación con la marca «Vista previa · Celebra-me».',
		confirmLabel: 'Marcar como no pagada',
		destructive: true,
		success: 'Invitación marcada como no pagada.',
	},
	disable: {
		menuLabel: 'Deshabilitar invitación',
		title: 'Deshabilitar invitación',
		message:
			'Los invitados verán una página neutral sin datos del evento. Se conservan los datos, la dirección y el contenido; puede reactivarla después.',
		confirmLabel: 'Deshabilitar',
		destructive: true,
		success: 'Invitación deshabilitada.',
	},
	enable: {
		menuLabel: 'Reactivar invitación',
		title: 'Reactivar invitación',
		message: 'La invitación vuelve a mostrarse como antes de deshabilitarla.',
		confirmLabel: 'Reactivar',
		success: 'Invitación reactivada.',
	},
};

/** The two actions available for the current state: payment first, public access second. */
export function availableAccessActions(
	access: Pick<InvitationAccessRecord, 'paymentStatus' | 'publicAccess'>,
): [InvitationAccessAction, InvitationAccessAction] {
	return [
		access.paymentStatus === 'paid' ? 'mark_unpaid' : 'mark_paid',
		access.publicAccess === 'enabled' ? 'disable' : 'enable',
	];
}

export function buildAccessCommand(
	action: InvitationAccessAction,
	expectedVersion: number,
	internalNote?: string | null,
): InvitationAccessCommand {
	switch (action) {
		case 'mark_paid':
			return { action: 'set_payment_status', paymentStatus: 'paid', expectedVersion };
		case 'mark_unpaid':
			return { action: 'set_payment_status', paymentStatus: 'unpaid', expectedVersion };
		case 'disable':
			return {
				action: 'set_public_access',
				publicAccess: 'disabled',
				internalNote: internalNote?.trim() ? internalNote.trim() : null,
				expectedVersion,
			};
		case 'enable':
			return { action: 'set_public_access', publicAccess: 'enabled', expectedVersion };
	}
}
