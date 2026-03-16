import { z } from 'astro:content';
import { COMMON_KEYS, EVENT_KEYS } from '@/lib/assets/asset-registry';
import { EVENT_TYPES, THEME_PRESETS } from '@/lib/theme/theme-contract';

export const AssetSchema = z.union([
	z.enum([...EVENT_KEYS, ...COMMON_KEYS]),
	z.string().url(),
	z.string().startsWith('/'),
]);

export const themeSchema = z.object({
	primaryColor: z.string().regex(/^#/, 'Must be a hex color'),
	accentColor: z.string().regex(/^#/, 'Must be a hex color').optional(),
	fontFamily: z.enum(['serif', 'sans']).default('serif'),
	preset: z.enum(THEME_PRESETS).optional(),
});

export const quoteSchema = z
	.object({
		text: z.string(),
		author: z.string().optional(),
	})
	.optional();

export const thankYouSchema = z
	.object({
		message: z.string(),
		closingName: z.string(),
		image: AssetSchema.optional(),
	})
	.optional();

export const musicSchema = z
	.object({
		url: z.string(),
		autoPlay: z.boolean().default(false),
		title: z.string().optional(),
	})
	.optional();

export const sectionsSchema = z
	.object({
		countdown: z.boolean().default(true),
		rsvp: z.boolean().default(true),
		gifts: z.boolean().default(false),
		gallery: z.boolean().default(false),
	})
	.optional();

export const countdownSchema = z
	.object({
		title: z.string().default('¡Falta muy poco!'),
		subtitlePrefix: z.string().default('El'),
		footerText: z.string().default('Prepárate para una noche inolvidable'),
	})
	.optional();

export const navigationSchema = z
	.array(
		z.object({
			label: z.string(),
			href: z.string(),
		}),
	)
	.optional();

export const sharingSchema = z
	.object({
		whatsappTemplate: z.string().optional(),
	})
	.optional();

export const baseEventFieldsSchema = z.object({
	eventType: z.enum(EVENT_TYPES),
	isDemo: z.boolean().default(false),
	title: z.string(),
	description: z.string().optional(),
	theme: themeSchema,
});
