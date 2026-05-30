import { z } from 'zod';
import { INTAKE_SUBMISSION_STATUSES } from '@/lib/intake/types';
import {
	intakeBlockSchemas,
	IntakeBlockTypeSchema,
} from '@/lib/intake/schemas/intake-block.schema';

export const SaveIntakeStepSchema = z.object({
	blockType: IntakeBlockTypeSchema,
	blockData: z.record(z.string(), z.unknown()),
});

export const SubmitIntakeSchema = z.object({
	clientComments: z.string().max(5000).trim().optional().default(''),
});

export const ReviewIntakeSchema = z.object({
	action: z.enum(['approve', 'request_changes']),
	reviewNotes: z.string().max(5000).trim().optional().default(''),
});

export const UpdateAdminSubmissionSchema = z.object({
	blockData: z.record(z.string(), z.unknown()),
	clientComments: z.string().max(5000).trim().optional().default(''),
});

export const IntakeSubmissionStatusSchema = z.enum(INTAKE_SUBMISSION_STATUSES);

export function validateBlockData(blockType: keyof typeof intakeBlockSchemas, data: unknown) {
	const schema = intakeBlockSchemas[blockType];
	return schema.safeParse(data);
}

export type SaveIntakeStepInput = z.infer<typeof SaveIntakeStepSchema>;
export type SubmitIntakeInput = z.infer<typeof SubmitIntakeSchema>;
export type ReviewIntakeInput = z.infer<typeof ReviewIntakeSchema>;
export type UpdateAdminSubmissionInput = z.infer<typeof UpdateAdminSubmissionSchema>;
