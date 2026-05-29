import { z } from 'zod';
import { INVITATION_PROJECT_STATUSES, INTAKE_BLOCK_TYPES } from '@/lib/intake/types';
import { EventTypeSchema } from '@/lib/intake/schemas/intake-block.schema';

export const CreateInvitationProjectSchema = z.object({
	title: z
		.string()
		.min(1, 'El título es obligatorio.')
		.max(200, 'El título no puede exceder 200 caracteres.')
		.trim(),

	slug: z
		.string()
		.max(120)
		.regex(/^[a-z0-9-]+$/, {
			message: 'El slug solo puede contener minúsculas, números y guiones.',
		})
		.trim()
		.optional()
		.nullable(),

	eventType: EventTypeSchema,

	baseDemoId: z.string().min(1, 'Selecciona un demo base.').max(120).trim(),

	clientName: z.string().max(200).trim().optional().default(''),

	clientEmail: z.string().max(320).trim().optional().default(''),

	clientWhatsapp: z.string().max(50).trim().optional().default(''),
});

export const UpdateInvitationProjectSchema = z.object({
	title: z.string().min(1).max(200).trim().optional(),
	slug: z
		.string()
		.max(120)
		.regex(/^[a-z0-9-]+$/)
		.trim()
		.optional()
		.nullable(),
	status: z.enum(INVITATION_PROJECT_STATUSES).optional(),
	clientName: z.string().max(200).trim().optional(),
	clientEmail: z.string().max(320).trim().optional(),
	clientWhatsapp: z.string().max(50).trim().optional(),
	photosReceived: z.boolean().optional(),
});

export type CreateInvitationProjectInput = z.infer<typeof CreateInvitationProjectSchema>;
export type UpdateInvitationProjectInput = z.infer<typeof UpdateInvitationProjectSchema>;

export const IntakeBlockTypeArraySchema = z.array(z.enum(INTAKE_BLOCK_TYPES));
