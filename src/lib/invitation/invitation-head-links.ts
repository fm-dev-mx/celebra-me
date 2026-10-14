import type { InvitationPageContext } from '@/lib/invitation/page-data';
import { resolvePresetCssUrl } from '@/lib/invitation/preset-css-resolver';
import { resolveInvitationCssLoadPlan } from '@/lib/invitation/section-css-resolver';
import { buildInvitationCssResolverInput } from '@/lib/invitation/invitation-css-input';
import {
	buildInvitationStylesheetHeadLinks,
	type InvitationStylesheetHeadLink,
} from '@/lib/invitation/invitation-css-head-links';

/** Stylesheet head links of one invitation page: preset, section plan and visual profile. */
export function buildInvitationHeadLinks(input: {
	page: InvitationPageContext;
	forceBlocking: boolean;
}): InvitationStylesheetHeadLink[] {
	const { page } = input;
	return buildInvitationStylesheetHeadLinks({
		presetUrl: resolvePresetCssUrl(page.viewModel.theme.preset),
		plan: resolveInvitationCssLoadPlan(
			buildInvitationCssResolverInput({ page, viewModel: page.viewModel }),
		),
		forceBlocking: input.forceBlocking,
	});
}
