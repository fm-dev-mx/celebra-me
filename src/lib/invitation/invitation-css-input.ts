import type { InvitationViewModel } from '@/lib/adapters/types';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { InvitationCssResolverInput } from '@/lib/invitation/section-css-resolver-map';

/** Build the single CSS resolver input shared by Public and Preview routes. */
export function buildInvitationCssResolverInput(input: {
	page: InvitationPageContext;
	viewModel: InvitationViewModel;
	slug?: string;
}): InvitationCssResolverInput {
	const { page, viewModel } = input;
	return {
		themePreset: viewModel.theme.preset,
		footerVariant: page.footerVariant,
		sectionVariants: {
			hero: viewModel.hero.variant,
			thankYou: viewModel.sections.thankYou?.variant,
			gifts: viewModel.sections.gifts?.variant,
			rsvp: viewModel.sections.rsvp?.variant,
			personalizedAccess: viewModel.sections.rsvp?.personalizedAccess?.variant,
			family: viewModel.sections.family?.variant,
			location: viewModel.sections.location?.variant,
			itinerary: viewModel.sections.itinerary?.variant,
			gallery: viewModel.sections.gallery?.variant,
			countdown: viewModel.sections.countdown?.variant,
		},
		envelopeVariant: page.envelope?.variant,
		visualProfileId: viewModel.visualProfileId,
		slug: input.slug,
	};
}
