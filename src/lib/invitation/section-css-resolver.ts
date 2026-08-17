import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionUrlMap,
	buildSectionBundleUrlMap,
	buildInvitationProfileUrlMap,
	resolveInvitationCssLoadPlan as resolveInvitationCssLoadPlanFromMaps,
	type InvitationCssLoadItem,
} from '@/lib/invitation/section-css-resolver-map';

const footerVariantModules = import.meta.glob(
	[
		'/src/styles/themes/sections/footer/_angelic-presence.scss',
		'/src/styles/themes/sections/footer/_editorial.scss',
		'/src/styles/themes/sections/footer/_enchanted-rose.scss',
		'/src/styles/themes/sections/footer/_premiere-floral.scss',
	],
	{
		query: '?url',
		eager: true,
	},
) as Record<string, { default: string }>;

const galleryVariantModules = import.meta.glob('/src/styles/themes/sections/gallery/_*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const structuralVariantModules = import.meta.glob(
	[
		'/src/styles/themes/sections/hero/_editorial-cover.scss',
		'/src/styles/themes/sections/hero/_split-cover.scss',
		'/src/styles/themes/sections/thank-you/_full-bleed-photo.scss',
		'/src/styles/themes/sections/gifts/_editorial-catalog.scss',
		'/src/styles/themes/sections/rsvp/_editorial-press-pass.scss',
		'/src/styles/themes/sections/rsvp/_formal-register.scss',
		'/src/styles/themes/sections/personalized-access/_editorial-pass.scss',
		'/src/styles/themes/sections/personalized-access/_formal-pass.scss',
		'/src/styles/themes/sections/family/_split-groups.scss',
		'/src/styles/themes/sections/family/_asymmetric-groups.scss',
		'/src/styles/themes/sections/location/_split-map.scss',
		'/src/styles/themes/sections/location/_stacked-venue-plates.scss',
		'/src/styles/themes/sections/itinerary/_timeline-paper.scss',
		'/src/styles/themes/sections/itinerary/_editorial-ledger.scss',
		'/src/styles/themes/sections/itinerary/_editorial-program.scss',
		'/src/styles/themes/sections/reveal/_premiere-floral.scss',
		'/src/styles/themes/sections/reveal/_editorial.scss',
		'/src/styles/themes/sections/reveal/_luxury-hacienda.scss',
		'/src/styles/themes/sections/reveal/_shared-light.scss',
	],
	{ query: '?url', eager: true },
) as Record<string, { default: string }>;

const sectionBundleModules = import.meta.glob('/src/styles/invitation-sections-by-preset/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const invitationProfileModules = import.meta.glob('/src/styles/invitation-profiles/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const footerVariantUrlMap = buildSectionUrlMap(footerVariantModules);
const galleryVariantUrlMap = buildSectionUrlMap(galleryVariantModules);
const structuralVariantUrlMap = buildSectionUrlMap(structuralVariantModules);
const sectionBundleUrlMap = buildSectionBundleUrlMap(sectionBundleModules);
const invitationProfileUrlMap = buildInvitationProfileUrlMap(invitationProfileModules);
const invitationSectionUrlMap = {
	...footerVariantUrlMap,
	...galleryVariantUrlMap,
	...structuralVariantUrlMap,
};

if (import.meta.env.DEV) {
	const map = new Map(Object.entries(sectionBundleUrlMap));
	for (const preset of THEME_PRESETS) {
		if (!map.has(preset)) {
			console.warn(
				`[section-css-resolver] Missing section bundle for preset "${preset}". No file found at src/styles/invitation-sections-by-preset/${preset}.scss.`,
			);
		}
	}
}

type InvitationCssResolverInput = {
	themePreset: string;
	footerVariant?: string;
	galleryVariant?: string;
	structuralVariants?: {
		hero?: string;
		thankYou?: string;
		gifts?: string;
		rsvp?: string;
		personalizedAccess?: string;
		family?: string;
		location?: string;
		itinerary?: string;
	};
	envelopeVariant?: string;
	revealVariant?: string;
	visualProfileId?: string;
	slug?: string;
};

export function resolveInvitationCssLoadPlan(
	input: InvitationCssResolverInput,
): InvitationCssLoadItem[] {
	return resolveInvitationCssLoadPlanFromMaps(
		sectionBundleUrlMap,
		invitationSectionUrlMap,
		input,
		invitationProfileUrlMap,
	);
}
