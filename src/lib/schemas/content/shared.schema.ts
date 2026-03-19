import { z } from 'astro:content';
import { ALL_ASSET_KEYS } from '@/lib/assets/asset-registry';
import { EVENT_TYPES, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { VALID_COLOR_TOKENS } from '@/lib/theme/color-tokens';

const secureUrlSchema = z
	.string()
	.url()
	.refine((value) => value.startsWith('https://'), 'External asset URLs must use HTTPS.');

const publicPathSchema = z.string().startsWith('/', 'Public asset paths must start with "/".');

const internalAssetSchema = z.object({
	type: z.literal('internal'),
	key: z.enum(ALL_ASSET_KEYS),
});

const externalAssetSchema = z.object({
	type: z.literal('external'),
	src: z.union([secureUrlSchema, publicPathSchema]),
});

export const AssetSchema = z.preprocess(
	(value) => {
		if (typeof value !== 'string') return value;
		if ((ALL_ASSET_KEYS as readonly string[]).includes(value)) {
			return { type: 'internal', key: value };
		}
		if (value.startsWith('https://') || value.startsWith('/')) {
			return { type: 'external', src: value };
		}
		return value;
	},
	z.discriminatedUnion('type', [internalAssetSchema, externalAssetSchema]),
);

export type ContentAssetSource = z.infer<typeof AssetSchema>;

const hexRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

export const ColorTokenSchema = z
	.string()
	.refine((value) => hexRegex.test(value) || VALID_COLOR_TOKENS.includes(value), {
		message: 'Must be a valid hex color (#RGB or #RRGGBB) or a recognized semantic token.',
	})
	.describe(
		'A hex color (starting with #) or a semantic token like "primary", "accent", "background"',
	);

export const themeSchema = z.object({
	primaryColor: ColorTokenSchema.optional(),
	accentColor: ColorTokenSchema.optional(),
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
