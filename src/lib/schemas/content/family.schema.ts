import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { FAMILY_PRESENTATIONS } from '@/lib/invitation/presentation-options';

const familyMemberSchema = z.object({ name: z.string(), role: z.string().optional() });

export const familySchema = z
	.object({
		parents: z
			.object({
				father: z.string().optional(),
				mother: z.string().optional(),
				fatherDeceased: z.boolean().optional(),
				motherDeceased: z.boolean().optional(),
			})
			.strict()
			.optional(),
		parentsOrder: z.enum(['father-first', 'mother-first']).optional(),
		labels: z
			.object({
				sectionTitle: z.string().optional(),
				sectionSubtitle: z.string().optional(),
				spouseTitle: z.string().optional(),
				spouseRole: z.string().optional(),
				childrenTitle: z.string().optional(),
				parentsTitle: z.string().optional(),
				fatherRole: z.string().optional(),
				motherRole: z.string().optional(),
				godparentsTitle: z.string().optional(),
				sectionMessage: z.string().optional(),
			})
			.strict()
			.optional(),
		spouse: z.string().optional(),
		children: z.array(familyMemberSchema).min(1).optional(),
		godparents: z.array(familyMemberSchema).min(1).optional(),
		godparentGroups: z
			.array(
				z.object({
					honoreeName: z.string(),
					label: z.string().optional(),
					godparents: z.array(familyMemberSchema).min(1),
				}),
			)
			.min(1)
			.optional(),
		groups: z
			.array(
				z.object({
					title: z.string(),
					items: z
						.array(
							z.object({
								name: z.string(),
								role: z.string().optional(),
								deceased: z.boolean().optional(),
							}),
						)
						.min(1),
				}),
			)
			.min(1)
			.optional(),
		featuredImage: AssetSchema.optional(),
		presentation: z.enum(FAMILY_PRESENTATIONS).optional(),
		focalPoint: focalPointSchema.optional(),
		visible: z.boolean().optional(),
		sectionMessage: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.godparents && data.godparentGroups) {
			ctx.addIssue({
				code: 'custom',
				message: 'Use either godparents or godparentGroups, not both',
				path: ['godparentGroups'],
			});
		}
	})
	.optional();
