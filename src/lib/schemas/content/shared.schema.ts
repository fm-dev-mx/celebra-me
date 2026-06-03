import { z } from 'zod';
import { ALL_ASSET_KEYS } from '@/lib/assets/asset-registry';
import {
	EVENT_TYPES,
	INVITATION_RENDER_SECTION_KEYS,
	THEME_PRESETS,
} from '@/lib/theme/theme-contract';
import { COLOR_TOKENS } from '@/lib/theme/color-tokens';
import { UUID_PATTERN } from '@/lib/intake/constants';

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

const normalizedImageCoordinateSchema = z.number().min(0).max(1);

export const overlayAnchorSchema = z.enum(['left', 'right', 'top', 'bottom']);

export const overlaySafeAreaSchema = z
	.object({
		x: normalizedImageCoordinateSchema,
		y: normalizedImageCoordinateSchema,
		width: normalizedImageCoordinateSchema.min(0.01),
		height: normalizedImageCoordinateSchema.min(0.01),
	})
	.refine((area) => area.x + area.width <= 1, {
		message: 'overlaySafeArea x + width must stay within the image bounds.',
		path: ['width'],
	})
	.refine((area) => area.y + area.height <= 1, {
		message: 'overlaySafeArea y + height must stay within the image bounds.',
		path: ['height'],
	});

const internalAssetSchema = z.object({
	type: z.literal('internal'),
	key: z.enum(ALL_ASSET_KEYS),
});

const externalAssetSchema = z.object({
	type: z.literal('external'),
	src: z.union([secureUrlSchema, publicPathSchema]),
});

const uploadedAssetSchema = z.object({
	type: z.literal('uploaded'),
	assetId: z.string().uuid(),
	src: z.string().optional(),
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
		if (UUID_PATTERN.test(value)) {
			return { type: 'uploaded', assetId: value };
		}
		return value;
	},
	z.discriminatedUnion('type', [internalAssetSchema, externalAssetSchema, uploadedAssetSchema]),
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
		overlayAnchor: overlayAnchorSchema.optional(),
		overlaySafeArea: overlaySafeAreaSchema.optional(),
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

const sectionOrderSchema = z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)).optional();

export const baseEventFieldsSchema = z.object({
	eventType: z.enum(EVENT_TYPES),
	isDemo: z.boolean().default(false),
	title: z.string(),
	description: z.string().optional(),
	theme: themeSchema,
	sectionOrder: sectionOrderSchema,
	_assetSlug: z
		.string()
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'_assetSlug must be a valid slug (lowercase, hyphens allowed)',
		)
		.optional(),
});
