import { z } from 'zod';
import { getEnv } from '@/lib/server/env';

export const WORK_STATUSES = ['in_progress', 'completed'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export interface InvitationWorkflow {
	workStatus: WorkStatus;
	ownerReviewedAt: string | null;
	ownerReviewedBy: string | null;
}

/** The owner is the first SUPER_ADMIN_EMAILS entry; without it nobody can record owner review. */
export function canRecordOwnerReview(email: string | null | undefined): boolean {
	const owner = getEnv('SUPER_ADMIN_EMAILS').split(',')[0]?.trim().toLowerCase();
	return Boolean(owner) && email?.trim().toLowerCase() === owner;
}

export const WorkflowCommandSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('set_work_status'),
			workStatus: z.enum(WORK_STATUSES),
			expectedUpdatedAt: z.iso.datetime({ offset: true }),
		})
		.strict(),
	z
		.object({
			action: z.literal('confirm_review'),
			expectedUpdatedAt: z.iso.datetime({ offset: true }),
		})
		.strict(),
	z
		.object({
			action: z.literal('clear_review'),
			expectedUpdatedAt: z.iso.datetime({ offset: true }),
		})
		.strict(),
]);

export type WorkflowCommand = z.infer<typeof WorkflowCommandSchema>;

export function workflowUpdate(
	command: WorkflowCommand,
	actorId: string,
	now: string,
): Record<string, string | null> {
	if (command.action === 'set_work_status') return { work_status: command.workStatus };
	if (command.action === 'clear_review')
		return { owner_reviewed_at: null, owner_reviewed_by: null };
	return { owner_reviewed_at: now, owner_reviewed_by: actorId };
}
