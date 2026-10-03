import { z } from 'zod';
import { INVITATION_STATUSES } from '@/lib/intake/types';

export const UpdateInvitationSchema = z.object({
	title: z.string().min(1).max(200).trim().optional(),
	slug: z
		.string()
		.max(120)
		.regex(/^[a-z0-9-]+$/)
		.trim()
		.optional()
		.nullable(),
	status: z.enum(INVITATION_STATUSES).optional(),
	clientName: z.string().max(200).trim().optional(),
	clientEmail: z.string().max(320).trim().optional(),
	clientWhatsapp: z.string().max(50).trim().optional(),
	photosReceived: z.boolean().optional(),
});

export const UpdateInvitationCommandSchema = z.object({
	expectedUpdatedAt: z.string().min(1),
	value: UpdateInvitationSchema,
});

export type UpdateInvitationInput = z.infer<typeof UpdateInvitationSchema>;
export type UpdateInvitationCommandInput = z.infer<typeof UpdateInvitationCommandSchema>;
