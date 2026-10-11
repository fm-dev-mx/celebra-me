/**
 * Administrator commands on an invitation's access state, and the record the dashboard
 * shows. Shared by the admin API route and the dashboard client (no I/O).
 */
import { z } from 'zod';
import {
	INVITATION_PAYMENT_STATUSES,
	INVITATION_PUBLIC_ACCESS_VALUES,
	type InvitationPaymentStatus,
	type InvitationPublicAccess,
} from '@/lib/invitation/access/invitation-access';

export const INVITATION_ACCESS_NOTE_MAX_LENGTH = 280;

export const InvitationAccessCommandSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('set_payment_status'),
			paymentStatus: z.enum(INVITATION_PAYMENT_STATUSES),
			expectedVersion: z.number().int().min(1),
		})
		.strict(),
	z
		.object({
			action: z.literal('set_public_access'),
			publicAccess: z.enum(INVITATION_PUBLIC_ACCESS_VALUES),
			internalNote: z
				.string()
				.trim()
				.max(INVITATION_ACCESS_NOTE_MAX_LENGTH)
				.nullable()
				.optional(),
			expectedVersion: z.number().int().min(1),
		})
		.strict(),
]);

export type InvitationAccessCommand = z.infer<typeof InvitationAccessCommandSchema>;

/** Access state as the administrator sees it (never sent to public pages). */
export interface InvitationAccessRecord {
	invitationId: string;
	paymentStatus: InvitationPaymentStatus;
	publicAccess: InvitationPublicAccess;
	internalNote: string | null;
	version: number;
	updatedAt: string;
	updatedBy: string | null;
}

export const INVITATION_PAYMENT_STATUS_LABELS: Record<InvitationPaymentStatus, string> = {
	paid: 'Pagada',
	unpaid: 'Pago pendiente',
};

export const INVITATION_PUBLIC_ACCESS_LABELS: Record<InvitationPublicAccess, string> = {
	enabled: 'Visible',
	disabled: 'Deshabilitada',
};
