import { z } from 'zod';
import { optionalText, editableAssetSchema } from '@/lib/intake/schemas/shared-content.schema';

export const familyGroupDraftSchema = z.object({
	title: optionalText(200),
	names: optionalText(),
});

export const familyDraftSchema = z.object({
	fatherName: optionalText(200),
	fatherDeceased: z.boolean().optional(),
	motherName: optionalText(200),
	motherDeceased: z.boolean().optional(),
	parentsOrder: z.enum(['father-first', 'mother-first']).optional(),
	spouseName: optionalText(200),
	godparents: optionalText(),
	children: optionalText(),
	sectionMessage: optionalText(),
	sectionSubtitle: optionalText(200),
	sectionTitle: optionalText(200),
	parentsTitle: optionalText(200),
	godparentsTitle: optionalText(200),
	spouseTitle: optionalText(200),
	spouseRole: optionalText(200),
	childrenTitle: optionalText(200),
	fatherRole: optionalText(200),
	motherRole: optionalText(200),
	visible: z.boolean().optional(),
	groups: z.array(familyGroupDraftSchema).optional(),
	featuredImage: editableAssetSchema.optional(),
});

export type FamilyDraft = z.infer<typeof familyDraftSchema>;
export type FamilyGroupDraft = z.infer<typeof familyGroupDraftSchema>;
