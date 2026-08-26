import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionUrlMap,
	buildSectionBundleUrlMap,
	buildInvitationProfileUrlMap,
	resolveInvitationCssLoadPlan as resolveInvitationCssLoadPlanFromMaps,
	type InvitationCssLoadItem,
	type InvitationCssResolverInput,
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

const sectionVariantModules = import.meta.glob(
	'/src/styles/themes/sections/*/_*.scss',
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
const sectionVariantUrlMap = buildSectionUrlMap(sectionVariantModules);
const sectionBundleUrlMap = buildSectionBundleUrlMap(sectionBundleModules);
const invitationProfileUrlMap = buildInvitationProfileUrlMap(invitationProfileModules);
const invitationSectionUrlMap = {
	...footerVariantUrlMap,
	...sectionVariantUrlMap,
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
