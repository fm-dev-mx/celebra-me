import { z } from 'zod';
import { optionalText, editableAssetSchema } from '@/lib/intake/schemas/shared-content.schema';
import { focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { FAMILY_PRESENTATIONS } from '@/lib/invitation/presentation-options';
import { FAMILY_STRUCTURAL_VARIANTS } from '@/lib/invitation/structural-variants';

export const familyGroupDraftSchema = z.object({
	title: optionalText(200),
	names: optionalText(),
});

export const godparentGroupDraftSchema = z.object({
	honoreeName: optionalText(200),
	label: optionalText(200),
	names: optionalText(),
});

/**
 * Flat draft label fields that map to published `family.labels`.
 * Order is serialization-stable for the published nested object.
 * SSOT: these keys must remain members of `familyDraftSchema`.
 */
export const FAMILY_LABEL_KEYS = [
	'sectionSubtitle',
	'sectionTitle',
	'parentsTitle',
	'fatherRole',
	'motherRole',
	'godparentsTitle',
	'spouseTitle',
	'spouseRole',
	'childrenTitle',
	'sectionMessage',
] as const;

export type FamilyLabelKey = (typeof FAMILY_LABEL_KEYS)[number];

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
	presentation: z.enum(FAMILY_PRESENTATIONS).optional(),
	variant: z.enum(FAMILY_STRUCTURAL_VARIANTS).optional(),
	groups: z.array(familyGroupDraftSchema).optional(),
	godparentGroups: z.array(godparentGroupDraftSchema).optional(),
	featuredImage: editableAssetSchema.optional(),
	focalPoint: focalPointSchema.optional(),
});

export type FamilyDraft = z.infer<typeof familyDraftSchema>;
export type FamilyGroupDraft = z.infer<typeof familyGroupDraftSchema>;
export type GodparentGroupDraft = z.infer<typeof godparentGroupDraftSchema>;

/** Compile-time guard: every label key remains a draft family field. */
type _AssertFamilyLabelsInDraft = FamilyLabelKey extends keyof FamilyDraft ? true : never;
const _familyLabelsInDraft: _AssertFamilyLabelsInDraft = true;
void _familyLabelsInDraft;
