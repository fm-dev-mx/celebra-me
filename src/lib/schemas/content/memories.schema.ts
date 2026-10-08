import { z } from 'zod';
import { isMemoriesPublicSlug } from '@/lib/memories/contract/private-request';
import { MEMORIES_VARIANTS } from '@/lib/invitation/section-variants';

const memoriesCopySchema = z.string().trim().min(1).max(240);

/**
 * Invitation entry point to the event memory space (`/r/<publicSlug>`). Managed-only:
 * the slug must reference an existing space owned by the same event, which publication
 * tooling verifies against the target database.
 */
export const memoriesSchema = z
	.object({
		variant: z.enum(MEMORIES_VARIANTS),
		publicSlug: z.string().refine(isMemoriesPublicSlug, {
			message: 'memories.publicSlug must be a lowercase memory space slug',
		}),
		title: memoriesCopySchema.optional(),
		description: memoriesCopySchema.optional(),
		actionLabel: memoriesCopySchema.optional(),
		footerText: memoriesCopySchema.optional(),
		downloadLabel: memoriesCopySchema.optional(),
		qrAlt: memoriesCopySchema.optional(),
	})
	.strict();

export type MemoriesContent = z.infer<typeof memoriesSchema>;
