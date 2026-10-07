import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { venueLabel } from '@/lib/intake/utils';
import {
	str,
	trimmedStr,
	normalizeDate,
	toEditorDate,
	isNonEmptyObject,
	isRecord,
} from '@/lib/shared/data-utils';
import {
	COUNTDOWN_DEFAULTS,
	ENVELOPE_TEXT_FIELDS,
	PERSONALIZED_ACCESS_DRAFT_KEYS,
	VENUE_URL_FIELDS,
} from '@/lib/intake/constants';
import { DEFAULT_REMINDER_MESSAGE } from '@/lib/rsvp/services/shared/share-message-defaults';
import { buildPublishedEventTiming } from '@/lib/time/event-time';
import { normalizeTime } from '@/lib/time/time-format';
import { normalizeLegacyLocation } from '@/lib/invitation/location-normalizer';
import { mapFamilyFromDraft } from '@/lib/intake/mappers/draft-to-published-family';
import {
	PublishedContentContractError,
	requireCanonicalVariant as requireVariant,
} from '@/lib/intake/mappers/canonical-variant-source';

function priorFields(
	prior: Record<string, unknown> | undefined,
	keys?: readonly string[],
): Record<string, unknown> {
	if (!prior) return {};
	if (!keys) return { ...prior };
	return Object.fromEntries(
		keys.filter((key) => prior[key] !== undefined).map((key) => [key, prior[key]]),
	);
}

/**
 * Maps editable draft envelope fields onto the published envelope structure.
 *
 * Seeds from the effective envelope (which already merged published + draft
 * content via `computeEffectiveContent`) so that non-editable premium fields
 * (`sealVariant`, `sealStyle`, `microcopy`, `stampText`, `closedPalette`, etc.)
 * survive the round-trip.
 */
function buildEnvelopeFromDraft(
	draftEnvelope: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const result: Record<string, unknown> = { disabled: true };
	if (draftEnvelope) Object.assign(result, draftEnvelope);

	// Draft explicit overrides (only fields the editor exposes).
	if (typeof draftEnvelope?.disabled === 'boolean') result.disabled = draftEnvelope.disabled;
	if (draftEnvelope?.sealColor) result.sealColor = draftEnvelope.sealColor;

	for (const field of ENVELOPE_TEXT_FIELDS) {
		const trimmed = trimmedStr(draftEnvelope?.[field]);
		if (trimmed) result[field] = trimmed;
	}
	return result;
}

function mapCountdownFromDraft(
	draftCountdown: DraftContent['countdown'],
	sectionOrder: string[] | undefined,
	priorCountdown: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const isEnabled = sectionOrder
		? sectionOrder.includes('countdown')
		: draftCountdown !== undefined;

	if (!isEnabled) return undefined;

	const title = str(draftCountdown?.title);
	const footerText = str(draftCountdown?.footerText);

	const presentationOptions = isNonEmptyObject(draftCountdown?.presentationOptions)
		? draftCountdown.presentationOptions
		: undefined;

	return {
		variant: requireVariant('countdown', draftCountdown?.variant, priorCountdown?.variant),
		title: title || COUNTDOWN_DEFAULTS.title,
		footerText: footerText || COUNTDOWN_DEFAULTS.footerText,
		...(presentationOptions ? { presentationOptions } : {}),
	};
}

function mapEventTimingFromDraft(
	draftEventTiming: DraftContent['eventTiming'],
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftEventTiming)) return undefined;
	const rawTiming = {
		localDateTime: str(draftEventTiming.localDateTime) ?? undefined,
		timeZone: str(draftEventTiming.timeZone) ?? undefined,
	};
	const derived = buildPublishedEventTiming(rawTiming);
	if (!isNonEmptyObject(derived)) return undefined;
	return derived as Record<string, unknown>;
}

/**
 * The draft owns only the editable subset of `personalizedAccess`, so published-only
 * fields must be carried over from the prior revision instead of being replaced away.
 */
function buildPersonalizedAccess(
	draftValue: unknown,
	priorRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const prior = isRecord(priorRsvp?.personalizedAccess)
		? priorRsvp.personalizedAccess
		: undefined;
	if (!isNonEmptyObject(draftValue)) {
		return isNonEmptyObject(prior)
			? {
					personalizedAccess: {
						...prior,
						variant: requireVariant('rsvp.personalizedAccess', prior.variant),
					},
				}
			: {};
	}
	const carried = isNonEmptyObject(prior)
		? Object.fromEntries(
				Object.entries(prior).filter(
					([key]) => !(PERSONALIZED_ACCESS_DRAFT_KEYS as readonly string[]).includes(key),
				),
			)
		: {};
	return {
		personalizedAccess: {
			...carried,
			...draftValue,
			variant: requireVariant(
				'rsvp.personalizedAccess',
				draftValue.variant,
				isNonEmptyObject(prior) ? prior.variant : undefined,
			),
		},
	};
}

/**
 * Canonical Published venue date/time are machine-readable.
 * Legacy Spanish prose is accepted on read (Draft mapping / display helpers);
 * writes always emit YYYY-MM-DD / HH:mm. Semantic equality in publication
 * canonicalize absorbs legacy↔machine representation during the transition.
 */
function publishVenueDate(draftDate: unknown): string | undefined {
	const draft = str(draftDate);
	if (!draft) return undefined;
	return toEditorDate(draft) ?? draft;
}

function publishVenueTime(draftTime: unknown): string | undefined {
	const draft = str(draftTime);
	if (!draft) return undefined;
	return normalizeTime(draft) ?? draft;
}

function findPriorVenue(
	priorLocation: Record<string, unknown> | undefined,
	venue: { id?: string; type?: string },
	index: number,
): Record<string, unknown> | undefined {
	const priorVenues = priorLocation?.venues;
	if (!Array.isArray(priorVenues)) return undefined;
	const byId = venue.id
		? priorVenues.find((entry) => isRecord(entry) && entry.id === venue.id)
		: undefined;
	if (isRecord(byId)) return byId;
	const byType = venue.type
		? priorVenues.find((entry) => isRecord(entry) && entry.type === venue.type)
		: undefined;
	if (isRecord(byType)) return byType;
	const byIndex = priorVenues[index];
	return isRecord(byIndex) ? byIndex : undefined;
}

function resolveIntroFields(
	draftLocation: NonNullable<DraftContent['location']>,
): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	for (const key of [
		'introEyebrow',
		'introHeading',
		'introLede',
		'indicationsHeading',
	] as const) {
		const value = str(draftLocation[key]);
		if (value) fields[key] = value;
	}
	return fields;
}

function mapIndicationsFromDraft(
	draftIndications:
		ReadonlyArray<{ iconName: string; text: string; styleVariant?: string }> | undefined,
): Array<Record<string, unknown>> | undefined {
	if (!draftIndications || draftIndications.length === 0) return undefined;
	const mapped = draftIndications
		.filter((ind) => str(ind.text))
		.map((ind) => ({
			iconName: ind.iconName,
			styleVariant: ind.styleVariant ?? 'default',
			text: str(ind.text),
		}));
	return mapped.length > 0 ? mapped : undefined;
}

function mapLocationFromDraft(
	draftLocation: DraftContent['location'],
	priorPublished: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftLocation)) return undefined;
	const result: Record<string, unknown> = {};
	const priorLocation = normalizeLegacyLocation(priorPublished?.location) as
		Record<string, unknown> | undefined;
	if (draftLocation.visibility) result.visibility = draftLocation.visibility;
	if (draftLocation.accessPolicy) result.accessPolicy = draftLocation.accessPolicy;
	if (draftLocation.presentation) result.presentation = draftLocation.presentation;
	result.mapStyle = draftLocation.mapStyle ?? priorLocation?.mapStyle ?? 'dark';
	result.variant = requireVariant('location', draftLocation.variant, priorLocation?.variant);
	if (draftLocation.presentationOptions)
		result.presentationOptions = draftLocation.presentationOptions;

	const sourceVenues = Array.isArray(draftLocation.venues)
		? draftLocation.venues
		: Array.isArray(priorLocation?.venues)
			? priorLocation.venues
			: [];
	result.venues = sourceVenues
		.filter((v) => v.isVisible !== false)
		// eslint-disable-next-line complexity -- Venue mapping resolves draft and prior media fields.
		.map((v, index) => {
			const priorVenue = findPriorVenue(priorLocation, v, index);
			const label = str(v.label) || str(priorVenue?.label);
			const image = v.image ?? priorVenue?.image;
			const coordinates = v.coordinates ?? priorVenue?.coordinates;
			const venueEvent = str(priorVenue?.venueEvent) || venueLabel(v.type, label);
			const venueId = str(v.id);
			const persistVenueId =
				venueId && (!venueId.startsWith('venue_legacy_') || Boolean(str(priorVenue?.id)));
			return {
				...(persistVenueId ? { id: venueId } : {}),
				type: v.type,
				...(label ? { label } : {}),
				venueName: v.venueName || '',
				address: v.address || '',
				city: v.city || '',
				date: publishVenueDate(v.date) || '',
				time: publishVenueTime(v.time) || '',
				...Object.fromEntries(
					VENUE_URL_FIELDS.map((f) => [
						f,
						(v as Record<string, unknown>)[f] || undefined,
					]).filter(([, val]) => val !== undefined),
				),
				...(image ? { image } : {}),
				...(coordinates ? { coordinates } : {}),
				// Visible venues omit isVisible (default). Hidden ones are filtered above.
				venueEvent,
			};
		});

	Object.assign(result, resolveIntroFields(draftLocation));

	const indications = mapIndicationsFromDraft(draftLocation.indications);
	if (indications) result.indications = indications;

	return isNonEmptyObject(result) ? result : undefined;
}

export interface PublishInput {
	invitation: {
		title: string;
		eventType: string;
	};
	themePreset: string;
	/** The invitation's own versioned asset namespace; omitted when it only uses uploads. */
	assetSlug?: string;
	draftContent: DraftContent;
	priorPublishedContent?: Record<string, unknown>;
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	priorHero: Record<string, unknown> | undefined,
	invitationTitle: string,
): Record<string, unknown> {
	if (!isNonEmptyObject(draftHero)) {
		if (isNonEmptyObject(priorHero)) return priorHero;
		throw new PublishedContentContractError(
			'Published content requires an explicit hero.variant.',
		);
	}

	const result: Record<string, unknown> = {
		variant: requireVariant('hero', draftHero.variant, priorHero?.variant),
		name: str(draftHero.name) || invitationTitle,
		secondaryName: str(draftHero.secondaryName) || '',
		label: str(draftHero.label) || 'Invitación Especial',
		nickname: str(draftHero.nickname) || '',
		date: normalizeDate(str(draftHero.date) || ''),
		backgroundImage: draftHero.backgroundImage ?? { type: 'internal', key: 'hero' },
		backgroundImageDesktop: draftHero.backgroundImageDesktop,
		backgroundImageMobile: draftHero.backgroundImageMobile,
		portrait: draftHero.portrait,
	};
	for (const field of [
		'focalPoint',
		'focalPointMobile',
		'focalPointTablet',
		'focalPointDesktop',
		'presentation',
	] as const) {
		if (draftHero[field] !== undefined) result[field] = draftHero[field];
		else if (priorHero?.[field] !== undefined) result[field] = priorHero[field];
	}
	// Editorial-cover copy is not editable in the dashboard; carry it through publishes.
	for (const field of ['tagline', 'photoCredit'] as const) {
		const value = str(priorHero?.[field]);
		if (value) result[field] = value;
	}

	return result;
}

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	priorRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftRsvp)) return undefined;
	const whatsappPhone = str(draftRsvp.whatsappPhone);
	const confirmationDeadline = str(draftRsvp.confirmationDeadline);
	return {
		variant: requireVariant('rsvp', draftRsvp.variant, priorRsvp?.variant),
		title: str(draftRsvp.title),
		guestCap: typeof draftRsvp.guestCap === 'number' ? draftRsvp.guestCap : undefined,
		confirmationMessage: str(draftRsvp.confirmationMessage),
		confirmationMode: str(draftRsvp.confirmationMode) || 'api',
		accessMode: str(draftRsvp.accessMode) || str(priorRsvp?.accessMode) || 'personalized-only',
		whatsappConfig: whatsappPhone ? { phone: whatsappPhone } : undefined,
		subcopy: str(draftRsvp.subcopy),
		...(confirmationDeadline ? { confirmationDeadline } : {}),
		...(draftRsvp.responseMessages ? { responseMessages: draftRsvp.responseMessages } : {}),
		...buildPersonalizedAccess(draftRsvp.personalizedAccess, priorRsvp),
		...(draftRsvp.calendar
			? { calendar: draftRsvp.calendar }
			: priorFields(priorRsvp, ['calendar'])),
	};
}

function mapMusicSection(draftMusic: DraftContent['music']): Record<string, unknown> | undefined {
	const url = str(draftMusic?.url);
	if (!url) return undefined;
	const autoPlay = typeof draftMusic?.autoPlay === 'boolean' ? draftMusic.autoPlay : false;
	return { url, title: str(draftMusic?.title), autoPlay };
}

function mapGallerySection(
	draftGallery: DraftContent['gallery'],
	priorGallery: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftGallery)) return undefined;
	return {
		...draftGallery,
		variant: requireVariant('gallery', draftGallery.variant, priorGallery?.variant),
	};
}

function mapGiftsSection(
	draftGifts: DraftContent['gifts'],
	priorGifts: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftGifts)) return undefined;
	const presentation =
		typeof draftGifts.presentation === 'string' ? draftGifts.presentation : undefined;
	// Folio mark is not editable in the dashboard; keep the prior value.
	const folioMark = str(draftGifts.folioMark) || str(priorGifts?.folioMark);
	const items =
		presentation === 'legend-only'
			? []
			: (draftGifts.items as unknown as Array<Record<string, unknown>>) || [];

	return {
		variant: requireVariant('gifts', draftGifts.variant, priorGifts?.variant),
		title: str(draftGifts.title),
		subtitle: str(draftGifts.subtitle),
		...(folioMark ? { folioMark } : {}),
		...(presentation ? { presentation } : {}),
		items,
	};
}

function mapQuoteSection(draftQuote: DraftContent['quote']): Record<string, unknown> {
	const text = str(draftQuote?.text);
	return text ? { text, author: str(draftQuote?.author) } : { text: '' };
}

const THANK_YOU_OVERLAY_FIELDS = [
	'focalPoint',
	'closingPhrase',
	'closingNameLeadWords',
	'overlayAnchor',
	'overlaySafeArea',
	'date',
] as const;

function mapThankYouSection(
	draftThankYou: DraftContent['thankYou'],
	priorThankYou: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftThankYou) return undefined;
	const message = str(draftThankYou.message);
	const overlayFields: Record<string, unknown> = {};
	for (const field of THANK_YOU_OVERLAY_FIELDS) {
		if (draftThankYou[field] !== undefined) overlayFields[field] = draftThankYou[field];
	}
	const variant = requireVariant('thankYou', draftThankYou.variant, priorThankYou?.variant);
	if (message) {
		return {
			variant,
			message,
			closingName: str(draftThankYou.closingName),
			image: draftThankYou.image,
			...priorFields(priorThankYou, ['date', 'closingPhrase']),
			...overlayFields,
		};
	}
	if (draftThankYou.image) {
		return {
			variant,
			message: '',
			closingName: '',
			image: draftThankYou.image,
			...overlayFields,
		};
	}
	return undefined;
}

function mapSharingFromDraft(
	draftSharing: Record<string, unknown> | undefined,
	priorSharing: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const draftMessages = draftSharing ?? {};
	const invitation = str(draftMessages.invitation) || str(draftMessages.whatsappWithPhone) || '';
	const reminder = str(draftMessages.reminder) ?? DEFAULT_REMINDER_MESSAGE;
	const shareMessages = invitation ? { invitation, reminder } : undefined;
	const ogImage = draftMessages.ogImage;
	const ogDescription = str(draftMessages.ogDescription);
	const result = priorFields(priorSharing);

	if (!shareMessages && !ogImage && !ogDescription && Object.keys(result).length === 0) {
		return undefined;
	}

	if (shareMessages) result.shareMessages = shareMessages;
	if (ogImage) result.ogImage = ogImage;
	if (ogDescription) result.ogDescription = ogDescription;
	return result;
}

function mapItineraryFromDraft(
	draftItinerary: DraftContent['itinerary'],
	priorItinerary: Record<string, unknown> | undefined,
): DraftContent['itinerary'] | undefined {
	if (!draftItinerary) return undefined;
	const items = draftItinerary.items?.map((item) => {
		const time = publishVenueTime(item.time) ?? item.time;
		return { ...item, time };
	});
	return {
		...draftItinerary,
		variant: requireVariant('itinerary', draftItinerary.variant, priorItinerary?.variant),
		...(items ? { items } : {}),
	};
}

/**
 * Maps the effective draft onto published content. The invitation is
 * self-sufficient: every value comes from the draft or from its own prior
 * published revision, never from a demo or catalog entry.
 */
export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, invitation } = input;
	const priorPublished = input.priorPublishedContent;
	const prior = (key: string) => priorPublished?.[key] as Record<string, unknown> | undefined;

	const sectionOrder =
		draftContent.sectionOrder ?? (priorPublished?.sectionOrder as string[] | undefined);
	const composition = priorPublished?.composition;
	if (!Array.isArray(sectionOrder) || sectionOrder.length === 0) {
		throw new PublishedContentContractError(
			'Published content requires an explicit sectionOrder.',
		);
	}
	if (!isNonEmptyObject(composition)) {
		throw new PublishedContentContractError(
			'Published content requires an explicit composition.',
		);
	}

	return {
		...(priorPublished?.templateId !== undefined
			? { templateId: priorPublished.templateId }
			: {}),
		...(priorPublished?.visualProfileId !== undefined
			? { visualProfileId: priorPublished.visualProfileId }
			: {}),
		eventType: invitation.eventType,
		title: invitation.title,
		description: str(draftContent.description),
		isDemo: false,

		theme: { preset: input.themePreset },

		sectionOrder,
		eventTiming: mapEventTimingFromDraft(draftContent.eventTiming),

		hero: mapHeroSection(draftContent.hero, prior('hero'), invitation.title),
		envelope: buildEnvelopeFromDraft(
			draftContent.envelope as Record<string, unknown> | undefined,
		),
		family: mapFamilyFromDraft(draftContent.family, prior('family')),
		location: mapLocationFromDraft(draftContent.location, priorPublished),
		// Omit empty optional collections so publish does not invent sections the
		// editor never edited (preflight noise / false drift).
		gallery: mapGallerySection(draftContent.gallery, prior('gallery')),
		itinerary: mapItineraryFromDraft(draftContent.itinerary, prior('itinerary')),
		countdown: mapCountdownFromDraft(draftContent.countdown, sectionOrder, prior('countdown')),
		rsvp: mapRsvpSection(draftContent.rsvp, prior('rsvp')),
		music: mapMusicSection(draftContent.music),
		gifts: mapGiftsSection(draftContent.gifts, prior('gifts')),
		quote: mapQuoteSection(draftContent.quote),
		thankYou: mapThankYouSection(draftContent.thankYou, prior('thankYou')),

		interludes: draftContent.interludes,
		composition,
		navigation: priorPublished?.navigation,
		sharing: mapSharingFromDraft(
			draftContent.sharing as Record<string, unknown> | undefined,
			prior('sharing'),
		),

		...(input.assetSlug ? { _assetSlug: input.assetSlug } : {}),
	};
}
