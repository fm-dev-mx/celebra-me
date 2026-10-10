import { z } from 'zod';
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
export function validateBlockData(blockType: keyof typeof intakeBlockSchemas, data: unknown) {
	const schema = intakeBlockSchemas[blockType];
	return schema.safeParse(data);
}
