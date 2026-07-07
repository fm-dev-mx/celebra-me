import type { InvitationPageContext } from '@/lib/invitation/page-data';

const AMERICA_BAUTISTA_PROFILE_ID = 'america-bautista';

interface AmericaBautistaHeroOverrideInput {
	routeSlug?: string;
}

export function applyAmericaBautistaHeroOverrides(
	pageContext: InvitationPageContext | null | undefined,
	input: AmericaBautistaHeroOverrideInput,
): void {
	if (!pageContext?.viewModel?.hero) return;

	const isAmericaBautista =
		input.routeSlug === AMERICA_BAUTISTA_PROFILE_ID ||
		pageContext.viewModel.visualProfileId === AMERICA_BAUTISTA_PROFILE_ID;

	if (!isAmericaBautista) return;

	pageContext.viewModel.hero.label = 'MIS XV AÑOS';
	pageContext.viewModel.hero.name = 'América';
	pageContext.heroTime = '8:00 P.M.';
	pageContext.heroVenueName = 'GRAN SALÓN DEL PRADO';
}
