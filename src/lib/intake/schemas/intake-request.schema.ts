import { z } from 'zod';
import { INTAKE_BLOCK_TYPES, INTAKE_REQUEST_STATUSES } from '@/lib/intake/types';

const DEFAULT_EXPIRY_DAYS = 30;

export const CreateIntakeRequestSchema = z.object({
	enabledBlocks: z
		.array(z.enum(INTAKE_BLOCK_TYPES))
		.min(1, 'Selecciona al menos un bloque.')
		.max(INTAKE_BLOCK_TYPES.length),

	expiresInDays: z
		.number()
		.int()
		.min(1, 'Mínimo 1 día.')
		.max(365, 'Máximo 365 días.')
		.optional()
		.default(DEFAULT_EXPIRY_DAYS),
});

export const UpdateIntakeRequestSchema = z.object({
	status: z.enum(INTAKE_REQUEST_STATUSES).optional(),
	enabledBlocks: z
		.array(z.enum(INTAKE_BLOCK_TYPES))
		.min(1)
		.max(INTAKE_BLOCK_TYPES.length)
		.optional(),
	expiresAt: z.iso.datetime().nullable().optional(),
});

export type CreateIntakeRequestInput = z.infer<typeof CreateIntakeRequestSchema>;
export type UpdateIntakeRequestInput = z.infer<typeof UpdateIntakeRequestSchema>;
