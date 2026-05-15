import { z } from 'zod';
import { ALL_ASSET_KEYS } from '@/lib/assets/asset-registry';
import { EVENT_TYPES, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { COLOR_TOKENS } from '@/lib/theme/color-tokens';

const secureUrlSchema = z
	.url()
	.refine((value) => value.startsWith('https://'), 'External asset URLs must use HTTPS.');

const publicPathSchema = z.string().startsWith('/', 'Public asset paths must start with "/".');

/**
 * Image focal point — CSS object-position compatible string.
 * Supports: "50% 40%" | "center top" | "left" | etc.
 * Used by hero images to keep subjects (e.g., baby's face) visible across viewports.
 *
 * Responsive focal points are handled by inline CSS custom properties
 * (--hero-focal-point-{default,mobile,tablet,desktop}) combined with
 * media-query-driven resolution in _hero.scss.
 */
export const focalPointSchema = z
	.string()
	.regex(
		/^(?:\d+(?:\.\d+)?%|left|center|right)(?:\s+(?:\d+(?:\.\d+)?%|top|center|bottom))?$/,
		'focalPoint must be a CSS position such as "50% 40%", "center top", or "left"',
	);

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

export type ContentAssetSource = ReturnType<(typeof AssetSchema)['parse']>;

export const ColorTokenSchema = z
	.enum(COLOR_TOKENS, {
		error: 'Must be a recognized semantic color role.',
	})
	.describe('A semantic color role such as "surfacePrimary" or "actionAccent".');

export const themeSchema = z
	.object({
		fontFamily: z.enum(['serif', 'sans']).default('serif'),
		preset: z.enum(THEME_PRESETS).optional(),
	})
	.strict();

export const quoteSchema = z.object({
	text: z.string(),
	author: z.string().optional(),
});

export const thankYouSchema = z
	.object({
		message: z.string(),
		closingName: z.string(),
		image: AssetSchema.optional(),
		focalPoint: focalPointSchema.optional(),
	})
	.optional();

export const musicSchema = z
	.object({
		url: z.string(),
		autoPlay: z.boolean().default(false),
		title: z.string().optional(),
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
		ogImage: AssetSchema.optional(),
	})
	.optional();

export const baseEventFieldsSchema = z.object({
	eventType: z.enum(EVENT_TYPES),
	isDemo: z.boolean().default(false),
	title: z.string(),
	description: z.string().optional(),
	theme: themeSchema,
});
