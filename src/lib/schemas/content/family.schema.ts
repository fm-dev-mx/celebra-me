import { z } from 'astro:content';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const familySchema = z
	.object({
		parents: z
			.object({
				father: z.string().optional(),
				mother: z.string().optional(),
				fatherDeceased: z.boolean().optional(),
				motherDeceased: z.boolean().optional(),
			})
			.optional(),
		labels: z
			.object({
				sectionTitle: z.string().optional(),
				sectionSubtitle: z.string().optional(),
				spouseTitle: z.string().optional(),
				spouseRole: z.string().optional(),
				childrenTitle: z.string().optional(),
				parentsTitle: z.string().optional(),
			})
			.optional(),
		spouse: z.string().optional(),
		children: z.array(z.object({ name: z.string(), role: z.string().optional() })).optional(),
		godparents: z.array(z.object({ name: z.string(), role: z.string().optional() })).optional(),
		groups: z
			.array(
				z.object({
					title: z.string(),
					items: z.array(
						z.object({
							name: z.string(),
							role: z.string().optional(),
							deceased: z.boolean().optional(),
						}),
					),
				}),
			)
			.optional(),
		featuredImage: AssetSchema.optional(),
	})
	.optional();
