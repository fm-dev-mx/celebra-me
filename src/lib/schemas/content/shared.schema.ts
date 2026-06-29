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
	.refine((area) => area.x + area.width <= 1 + Number.EPSILON, {
		message: 'overlaySafeArea x + width must stay within the image bounds.',
		path: ['width'],
	})
	.refine((area) => area.y + area.height <= 1 + Number.EPSILON, {
		message: 'overlaySafeArea y + height must stay within the image bounds.',
		path: ['height'],
	})
	.strict();

const internalAssetSchema = z
	.object({
		type: z.literal('internal'),
		key: z.enum(ALL_ASSET_KEYS),
	})
	.strict();

const externalAssetSchema = z
	.object({
		type: z.literal('external'),
		src: z.union([secureUrlSchema, publicPathSchema]),
	})
	.strict();

const uploadedAssetSchema = z
	.object({
		type: z.literal('uploaded'),
		assetId: z.uuid(),
		src: z.string().optional(),
	})
	.strict();

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

export const quoteSchema = z
	.object({
		text: z.string(),
		author: z.string().optional(),
	})
	.strict();

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
		footerText: z.string().default('Prepárate para una noche inolvidable'),
	})
	.optional();

export const eventTimingSchema = z
	.object({
		localDateTime: z
			.string()
			.regex(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
				'eventTiming.localDateTime must be an event-local datetime like 2026-08-01T20:00',
			)
			.optional(),
		timeZone: z.string().min(1).optional(),
		startsAtUtc: z.iso.datetime().optional(),
	})
	.strict()
	.optional();

export const navigationSchema = z
	.array(
		z.object({
			label: z.string(),
			href: z.string(),
		}),
	)
	.optional();

export const shareMessagesSchema = z
	.object({
		invitation: z.string().min(1).max(500),
		reminder: z.string().min(1).max(500),
	})
	.strict();

export const reminderSettingsSchema = z
	.object({
		enabled: z.boolean(),
		showWhenDaysBeforeEvent: z.number().int().min(0).max(365),
		audience: z.enum(['unconfirmed', 'all-shared']),
	})
	.strict();

export const sharingSchema = z
	.object({
		whatsappTemplate: z.string().optional(),
		shareMessages: shareMessagesSchema.optional(),
		reminderSettings: reminderSettingsSchema.optional(),
		ogImage: AssetSchema.optional(),
		ogDescription: z.string().min(1).max(200).optional(),
	})
	.optional();

const sectionOrderSchema = z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)).optional();

export const baseEventFieldsSchema = z.object({
	eventType: z.enum(EVENT_TYPES),
	isDemo: z.boolean().default(false),
	templateId: z
		.string()
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'templateId must be a valid slug (lowercase, hyphens allowed)',
		)
		.describe(
			'Identifies the visual template SKU this content implements. ' +
				'Both real invitations and demos sharing the same templateId ' +
				'must also share the same theme.preset for visual consistency. ' +
				'Template SKU format: {eventType}-{themePreset} (e.g. xv-celestial-blue).',
		)
		.optional(),
	visualProfileId: z
		.string()
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'visualProfileId must be a valid slug (lowercase, hyphens allowed)',
		)
		.describe(
			'Identifies the visual profile (CSS scope class) for custom ' +
				'SCSS overrides. Real invitations and their demo counterparts ' +
				'sharing the same visualProfileId will use the same CSS scope ' +
				'class, enabling shared custom styling. ' +
				'Typically matches the route slug of the real invitation ' +
				'(e.g. "valentina-hernandez" for xv-valentina-hernandez).',
		)
		.optional(),
	title: z.string(),
	description: z.string().optional(),
	theme: themeSchema,
	eventTiming: eventTimingSchema,
	sectionOrder: sectionOrderSchema,
	_assetSlug: z
		.string()
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'_assetSlug must be a valid slug (lowercase, hyphens allowed)',
		)
		.optional(),
});
