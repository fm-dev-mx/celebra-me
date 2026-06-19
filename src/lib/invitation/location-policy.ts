import type { InvitationViewModel } from '@/lib/adapters/types';

export const LOCATION_VISIBILITY_AFTER_RSVP = 'after-rsvp';

const LUNA_ESTRELLA_ROUTE_SLUG = 'luna-y-estrella';

type LocationSection = NonNullable<InvitationViewModel['sections']['location']>;

export function isLunaEstrellaRoute(slug: string, eventType: string): boolean {
	return slug === LUNA_ESTRELLA_ROUTE_SLUG && eventType === 'primera-comunion';
}

export function isLocationLocked(
	location: InvitationViewModel['sections']['location'] | undefined,
	isConfirmed: boolean,
): boolean {
	if (!location || isConfirmed) return false;
	return location.visibility === LOCATION_VISIBILITY_AFTER_RSVP;
}

function redactTeaserDetails(teaser: string): string {
	return teaser.split('•')[0]?.trim() ?? teaser;
}

export function redactEnvelopeTeaserWhenLocationLocked<T extends { teaserDetails?: string }>(
	envelope: T | undefined,
	shouldRedact: boolean,
): T | undefined {
	if (!envelope || !shouldRedact || !envelope.teaserDetails) return envelope;

	return {
		...envelope,
		teaserDetails: redactTeaserDetails(envelope.teaserDetails),
	};
}

export function shouldRedactEnvelopeTeaser(input: {
	originalLocation: InvitationViewModel['sections']['location'] | undefined;
	postPolicyLocation: InvitationViewModel['sections']['location'] | undefined;
	isConfirmed: boolean;
	slug: string;
	eventType: string;
}): boolean {
	return (
		isLocationLocked(input.postPolicyLocation, input.isConfirmed) ||
		(isLunaEstrellaRoute(input.slug, input.eventType) &&
			input.originalLocation?.visibility === LOCATION_VISIBILITY_AFTER_RSVP)
	);
}

function removeLocationNavigation(
	navigation: InvitationViewModel['navigation'],
): InvitationViewModel['navigation'] {
	return navigation?.filter(
		(item) => item.href !== '#event-location' && item.href !== '#location',
	);
}

function removeLocationFromSectionOrder(
	sectionOrder: InvitationViewModel['sectionOrder'],
): InvitationViewModel['sectionOrder'] {
	return sectionOrder?.filter((section) => section !== 'location');
}

function applyLunaEstrellaRsvpOnlyLocation(
	viewModel: InvitationViewModel,
	isConfirmedGuest: boolean,
): InvitationViewModel {
	const protectedLocation = viewModel.sections.location;
	const revealedLocation =
		protectedLocation?.visibility === LOCATION_VISIBILITY_AFTER_RSVP && isConfirmedGuest
			? protectedLocation
			: undefined;

	const teaserDetails = viewModel.envelope.data?.teaserDetails;
	const redactedTeaser = teaserDetails?.includes('•')
		? redactTeaserDetails(teaserDetails)
		: undefined;

	return {
		...viewModel,
		hero: { ...viewModel.hero, venueName: undefined },
		envelope: redactedTeaser
			? {
					...viewModel.envelope,
					data: {
						...viewModel.envelope.data!,
						teaserDetails: redactedTeaser,
					},
				}
			: viewModel.envelope,
		sectionOrder: removeLocationFromSectionOrder(viewModel.sectionOrder),
		navigation: removeLocationNavigation(viewModel.navigation),
		sections: {
			...viewModel.sections,
			location: undefined,
			rsvp: viewModel.sections.rsvp
				? {
						...viewModel.sections.rsvp,
						revealedLocation,
					}
				: undefined,
		},
	};
}

function redactProtectedLocation(location: LocationSection): LocationSection {
	return {
		visibility: LOCATION_VISIBILITY_AFTER_RSVP,
		isLocked: true,
		variant: location.variant,
		showFlourishes: location.showFlourishes,
		introEyebrow: location.introEyebrow,
		introHeading: location.introHeading ?? 'Ubicación',
		introLede: location.introLede,
		indicationsHeading: '',
		lockedTitle: 'Ubicación reservada',
		lockedMessage:
			'Por cuidado de la familia, los detalles del lugar se mostrarán después de confirmar asistencia.',
		lockedCtaLabel: 'Confirmar asistencia',
	};
}

export function applyLocationPolicy(input: {
	viewModel: InvitationViewModel;
	isConfirmedGuest: boolean;
	routeSlug: string;
	eventType: string;
}): InvitationViewModel {
	const { viewModel, isConfirmedGuest: confirmed, routeSlug, eventType } = input;

	if (isLunaEstrellaRoute(routeSlug, eventType)) {
		return applyLunaEstrellaRsvpOnlyLocation(viewModel, confirmed);
	}

	const location = viewModel.sections.location;
	if (!location || !isLocationLocked(location, confirmed)) {
		return viewModel;
	}

	return {
		...viewModel,
		hero: {
			...viewModel.hero,
			venueName: undefined,
		},
		sections: {
			...viewModel.sections,
			location: redactProtectedLocation(location),
		},
	};
}
