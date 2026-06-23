import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionUrlMap,
	resolveSectionCssUrls,
	type SectionCssConfig,
} from '@/lib/invitation/section-css-resolver-map';

const sectionModules = import.meta.glob('/src/styles/invitation-sections/**/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionUrlMap = buildSectionUrlMap(sectionModules);

const sectionCssConfigs: SectionCssConfig[] = [
	{
		section: 'gallery',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'editorial',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'hero',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'rsvp',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'countdown',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'editorial',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'footer',
		presetToEntrypoint: {
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'enchanted-rose': 'enchanted-rose',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'itinerary',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'reveal',
		presetToEntrypoint: {
			'jewelry-box': 'shared-light',
			'jewelry-box-wedding': 'shared-light',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'shared-light',
			'enchanted-rose': 'shared-light',
		},
	},
	{
		section: 'thank-you',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'quote',
		presetToEntrypoint: {
			'enchanted-rose': 'enchanted-rose',
		},
	},
	{
		section: 'family',
		presetToEntrypoint: {
			'enchanted-rose': 'enchanted-rose',
		},
	},
	{
		section: 'gifts',
		presetToEntrypoint: {
			'jewelry-box': 'elegant',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'editorial-premium',
			editorial: 'editorial-premium',
			'celestial-blue': 'elegant',
			'enchanted-rose': 'enchanted-rose',
		},
	},
	{
		section: 'header',
		presetToEntrypoint: {
			'jewelry-box': 'jewelry-box',
			'jewelry-box-wedding': 'jewelry-box-wedding',
			'luxury-hacienda': 'luxury-hacienda',
			'premiere-floral': 'premiere-floral',
			editorial: 'editorial',
			'celestial-blue': 'celestial-blue',
			'enchanted-rose': 'enchanted-rose',
			'sacred-keepsake': 'sacred-keepsake',
			'angelic-presence': 'angelic-presence',
		},
	},
	{
		section: 'location',
		presetToEntrypoint: {
			'enchanted-rose': 'enchanted-rose',
			'celestial-blue': 'leah-lexa',
		},
	},
	{
		section: 'music-player',
		presetToEntrypoint: {
			'enchanted-rose': 'enchanted-rose',
		},
	},
	{
		section: 'personalized-access',
		presetToEntrypoint: {
			'enchanted-rose': 'enchanted-rose',
		},
	},
];

if (import.meta.env.DEV) {
	for (const preset of THEME_PRESETS) {
		for (const { section, presetToEntrypoint } of sectionCssConfigs) {
			if (!presetToEntrypoint[preset]) {
				console.warn(
					`[section-css-resolver] No ${section} entrypoint for preset "${preset}". ${section} will render with base styles only.`,
				);
			}
		}
	}
}

export function resolveInvitationSectionCssUrls(preset: string): string[] {
	return resolveSectionCssUrls(sectionUrlMap, sectionCssConfigs, preset);
}
