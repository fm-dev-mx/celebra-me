import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionUrlMap,
	buildSectionBundleUrlMap,
	resolveInvitationCssLoadPlan as resolveInvitationCssLoadPlanFromMaps,
	type InvitationCssLoadItem,
	type InvitationCssResolverInput,
} from '@/lib/invitation/section-css-resolver-map';

const sectionVariantModules = import.meta.glob('/src/styles/themes/sections/*/_*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionBundleModules = import.meta.glob('/src/styles/invitation-sections-by-preset/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const invitationProfileModules = import.meta.glob('/src/styles/invitation-profiles/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionVariantUrlMap = buildSectionUrlMap(sectionVariantModules);
const sectionBundleUrlMap = buildSectionBundleUrlMap(sectionBundleModules);
const invitationProfileUrlMap = buildSectionBundleUrlMap(invitationProfileModules);

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
		sectionVariantUrlMap,
		input,
		invitationProfileUrlMap,
	);
}
