import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';
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
import { mapFamilyFromDraft } from '@/lib/intake/mappers/draft-to-published-family';

type PublishCtx = {
	isDemo: boolean;
	priorPublishedContent?: Record<string, unknown>;
};

const demoStr = (ctx: PublishCtx, val: unknown): string | undefined =>
	ctx.isDemo ? str(val) : undefined;

const demoValue = (ctx: PublishCtx, value: unknown): unknown => (ctx.isDemo ? value : undefined);

function definedFields(
	prior: Record<string, unknown> | undefined,
	keys: readonly string[],
): Record<string, unknown> {
	if (!prior) return {};
	return Object.fromEntries(
		keys.filter((key) => prior[key] !== undefined).map((key) => [key, prior[key]]),
	);
}

function clientPriorFields(
	ctx: PublishCtx,
	prior: Record<string, unknown> | undefined,
	keys?: readonly string[],
): Record<string, unknown> {
	if (ctx.isDemo || !prior) return {};
	return keys ? definedFields(prior, keys) : { ...prior };
}

/**
 * Maps editable draft envelope fields onto the published envelope structure.
 *
 * For real (non-demo) publishes, seeds from the effective envelope (which
 * already merged published + draft content via `computeEffectiveContent`)
 * so that non-editable premium fields (`sealVariant`, `sealStyle`,
 * `microcopy`, `stampText`, `closedPalette`, etc.) survive the round-trip.
 * For demo publishes, seeds from the demo content, then applies draft
 * overrides on top.
 */
function buildEnvelopeFromDraft(
	draftEnvelope: Record<string, unknown> | undefined,
	demoEnvelope: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> {
	const result: Record<string, unknown> = { disabled: true };

	const seed = !ctx.isDemo ? draftEnvelope : demoEnvelope;
	if (seed) Object.assign(result, seed);

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
	demoCountdown: Record<string, unknown> | undefined,
	ctx: PublishCtx,
	sectionOrder: string[] | undefined,
): Record<string, unknown> | undefined {
	if (ctx.isDemo && demoCountdown) return { ...demoCountdown };

	const isEnabled = sectionOrder
		? sectionOrder.includes('countdown')
		: draftCountdown !== undefined;

	if (!isEnabled) return undefined;

	const title = str(draftCountdown?.title);
	const footerText = str(draftCountdown?.footerText);

	return {
		title: title || COUNTDOWN_DEFAULTS.title,
		footerText: footerText || COUNTDOWN_DEFAULTS.footerText,
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
	ctx: PublishCtx,
	draftValue: unknown,
	priorRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const prior = clientPriorFields(ctx, priorRsvp, ['personalizedAccess']).personalizedAccess;
	if (!isNonEmptyObject(draftValue)) {
		return isNonEmptyObject(prior) ? { personalizedAccess: prior } : {};
	}
	const carried = isNonEmptyObject(prior)
		? Object.fromEntries(
				Object.entries(prior).filter(
					([key]) => !(PERSONALIZED_ACCESS_DRAFT_KEYS as readonly string[]).includes(key),
				),
			)
		: {};
	return { personalizedAccess: { ...carried, ...draftValue } };
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

function stripLegacyLocationFlourishes(
	sectionStyles: unknown,
): Record<string, unknown> | undefined {
	if (!isRecord(sectionStyles)) return undefined;
	const location = sectionStyles.location;
	if (!isRecord(location) || location.showFlourishes === undefined) {
		return sectionStyles;
	}
	const { showFlourishes: _legacy, ...locationRest } = location;
	return {
		...sectionStyles,
		location: locationRest,
	};
}

function mapVenue(
	draftVenue: Record<string, unknown> | undefined,
	demoVenue: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftVenue)) {
		return ctx.isDemo && isNonEmptyObject(demoVenue) ? { ...demoVenue } : undefined;
	}
	const result: Record<string, unknown> = {};
	if (str(draftVenue.venueName)) result.venueName = str(draftVenue.venueName);
	if (str(draftVenue.address)) result.address = str(draftVenue.address);
	if (str(draftVenue.city)) result.city = str(draftVenue.city);
	const date = publishVenueDate(draftVenue.date);
	if (date) result.date = date;
	const time = publishVenueTime(draftVenue.time);
	if (time) result.time = time;
	for (const field of VENUE_URL_FIELDS) {
		const val = str((draftVenue as Record<string, unknown>)[field]);
		if (val) result[field] = val;
	}
	if (draftVenue.image) {
		result.image = draftVenue.image;
	} else if (ctx.isDemo && demoVenue?.image) {
		result.image = demoVenue.image;
	}
	if (draftVenue.coordinates) result.coordinates = draftVenue.coordinates;
	return isNonEmptyObject(result) ? result : undefined;
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
	demoLocation: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	const introEyebrow =
		str(draftLocation.introEyebrow) || demoStr(ctx, demoLocation?.introEyebrow);
	if (introEyebrow) fields.introEyebrow = introEyebrow;
	const introHeading =
		str(draftLocation.introHeading) || demoStr(ctx, demoLocation?.introHeading);
	if (introHeading) fields.introHeading = introHeading;
	const introLede = str(draftLocation.introLede) || demoStr(ctx, demoLocation?.introLede);
	if (introLede) fields.introLede = introLede;
	const indicationsHeading =
		str(draftLocation.indicationsHeading) || demoStr(ctx, demoLocation?.indicationsHeading);
	if (indicationsHeading) fields.indicationsHeading = indicationsHeading;
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

// eslint-disable-next-line complexity -- Venue mapping covers ceremony, reception, and prior content fallbacks.
function mapLocationFromDraft(
	draftLocation: DraftContent['location'],
	demoContent: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftLocation)) {
		return undefined;
	}
	const result: Record<string, unknown> = {};
	const demoLocation = demoContent?.location as Record<string, unknown> | undefined;
	if (draftLocation.visibility) result.visibility = draftLocation.visibility;
	if (draftLocation.presentation) result.presentation = draftLocation.presentation;
	if (draftLocation.presentationOptions)
		result.presentationOptions = draftLocation.presentationOptions;

	const priorLocation = ctx.priorPublishedContent?.location as
		Record<string, unknown> | undefined;

	if (draftLocation.venues && Array.isArray(draftLocation.venues)) {
		const mappedVenues = draftLocation.venues
			.filter((v) => v.isVisible !== false)
			.map((v, index) => {
				const priorVenue = findPriorVenue(priorLocation, v, index);
				const label = str(v.label) || str(priorVenue?.label);
				return {
					id: v.id,
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
					...(v.image ? { image: v.image } : {}),
					...(v.coordinates ? { coordinates: v.coordinates } : {}),
					// Visible venues omit isVisible (default). Hidden ones are filtered above.
					venueEvent: str(priorVenue?.venueEvent) || venueLabel(v.type, label),
				};
			});
		if (mappedVenues.length === 0 && !isNonEmptyObject(result)) {
			return undefined;
		}
		result.venues = mappedVenues;
	} else {
		const ceremony = mapVenue(
			draftLocation.ceremony,
			demoLocation?.ceremony as Record<string, unknown> | undefined,
			ctx,
		);
		if (ceremony) {
			ceremony.venueEvent =
				str((priorLocation?.ceremony as Record<string, unknown> | undefined)?.venueEvent) ||
				str((demoLocation?.ceremony as Record<string, unknown> | undefined)?.venueEvent) ||
				'Ceremonia';
			result.ceremony = ceremony;
		}
		const reception = mapVenue(
			draftLocation.reception,
			demoLocation?.reception as Record<string, unknown> | undefined,
			ctx,
		);
		if (reception) {
			reception.venueEvent =
				str(
					(priorLocation?.reception as Record<string, unknown> | undefined)?.venueEvent,
				) ||
				str((demoLocation?.reception as Record<string, unknown> | undefined)?.venueEvent) ||
				'Recepción';
			result.reception = reception;
		}
	}

	const introFields = resolveIntroFields(draftLocation, demoLocation, ctx);
	Object.assign(result, introFields);

	const indications = mapIndicationsFromDraft(draftLocation.indications);
	if (indications) result.indications = indications;

	return isNonEmptyObject(result) ? result : undefined;
}

export interface PublishInput {
	invitation: {
		title: string;
		eventType: string;
		snapshot: DemoPreset;
	};
	assetSlug?: string;
	draftContent: DraftContent;
	demoContent: Record<string, unknown>;
	priorPublishedContent?: Record<string, unknown>;
	isDemo?: boolean;
}

// eslint-disable-next-line complexity -- The hero resolution naturally has many fallback paths.
function buildHeroFromDraft(
	draftHero: NonNullable<DraftContent['hero']>,
	demoHero: Record<string, unknown> | undefined,
	priorHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	ctx: PublishCtx,
): Record<string, unknown> {
	const {
		name: demoName,
		secondaryName: demoSecondaryName,
		label: demoLabel,
		nickname: demoNickname,
		date: demoDate,
		backgroundImage: demoBackgroundImage,
		backgroundImageDesktop: demoBackgroundImageDesktop,
		backgroundImageMobile: demoBackgroundImageMobile,
		portrait: demoPortrait,
		variant: demoVariant,
	} = demoHero ?? {};

	const result: Record<string, unknown> = {
		...clientPriorFields(ctx, priorHero, ['variant']),
		name: str(draftHero.name) || demoStr(ctx, demoName as string) || invitationTitle,
		secondaryName:
			str(draftHero.secondaryName) || demoStr(ctx, demoSecondaryName as string) || '',
		label: str(draftHero.label) || demoStr(ctx, demoLabel as string) || 'Invitación Especial',
		nickname: str(draftHero.nickname) || demoStr(ctx, demoNickname as string) || '',
		date: normalizeDate(str(draftHero.date) || demoStr(ctx, demoDate as string) || ''),
		backgroundImage: draftHero.backgroundImage ??
			(ctx.isDemo ? demoBackgroundImage : undefined) ?? { type: 'internal', key: 'hero' },
		backgroundImageDesktop:
			draftHero.backgroundImageDesktop ??
			(ctx.isDemo ? demoBackgroundImageDesktop : undefined),
		backgroundImageMobile:
			draftHero.backgroundImageMobile ?? (ctx.isDemo ? demoBackgroundImageMobile : undefined),
		portrait: draftHero.portrait ?? (ctx.isDemo ? demoPortrait : undefined),
	};
	for (const field of [
		'focalPoint',
		'focalPointMobile',
		'focalPointTablet',
		'focalPointDesktop',
		'presentation',
	] as const) {
		if (draftHero[field] !== undefined) result[field] = draftHero[field];
		else if (!ctx.isDemo && priorHero?.[field] !== undefined) result[field] = priorHero[field];
	}

	if (ctx.isDemo && demoVariant) {
		result.variant = demoVariant as string;
	}

	return result;
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	demoHero: Record<string, unknown> | undefined,
	priorHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	ctx: PublishCtx,
): Record<string, unknown> {
	if (!isNonEmptyObject(draftHero)) {
		if (ctx.isDemo && isNonEmptyObject(demoHero)) return demoHero;
		return {
			name: invitationTitle,
			label: 'Invitación Especial',
			date: '',
			backgroundImage: { type: 'internal', key: 'hero' },
		};
	}
	return buildHeroFromDraft(draftHero, demoHero, priorHero, invitationTitle, ctx);
}

function resolveRsvpResponseMessages(
	draftRsvp: NonNullable<DraftContent['rsvp']>,
	demoRsvp: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const fromDemo = ctx.isDemo
		? (demoRsvp?.responseMessages as Record<string, unknown> | undefined)
		: undefined;
	return draftRsvp.responseMessages ?? fromDemo;
}

function resolveRsvpGuestCap(
	draftRsvp: NonNullable<DraftContent['rsvp']>,
	demo: Record<string, unknown>,
	ctx: PublishCtx,
): number | undefined {
	if (typeof draftRsvp.guestCap === 'number') return draftRsvp.guestCap;
	return ctx.isDemo ? (demo.guestCap as number | undefined) : undefined;
}

function resolveRsvpAccessMode(
	draftRsvp: NonNullable<DraftContent['rsvp']>,
	demo: Record<string, unknown>,
	priorRsvp: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): string {
	return (
		str(draftRsvp.accessMode) ||
		(ctx.isDemo ? str(demo.accessMode) : str(priorRsvp?.accessMode)) ||
		'personalized-only'
	);
}

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
	priorRsvp: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftRsvp)) return undefined;
	const demo = demoRsvp || {};
	const whatsappPhone = str(draftRsvp.whatsappPhone) || demoStr(ctx, demo.whatsappPhone);
	const responseMessages = resolveRsvpResponseMessages(draftRsvp, demoRsvp, ctx);
	const confirmationDeadline =
		str(draftRsvp.confirmationDeadline) || demoStr(ctx, demo.confirmationDeadline);
	return {
		title: str(draftRsvp.title) || demoStr(ctx, demo.title),
		guestCap: resolveRsvpGuestCap(draftRsvp, demo, ctx),
		confirmationMessage:
			str(draftRsvp.confirmationMessage) || demoStr(ctx, demo.confirmationMessage),
		confirmationMode:
			str(draftRsvp.confirmationMode) || demoStr(ctx, demo.confirmationMode) || 'api',
		accessMode: resolveRsvpAccessMode(draftRsvp, demo, priorRsvp, ctx),
		whatsappConfig: whatsappPhone
			? { phone: whatsappPhone }
			: ctx.isDemo
				? demo.whatsappConfig
				: undefined,
		subcopy: str(draftRsvp.subcopy) || demoStr(ctx, demo.subcopy),
		...(confirmationDeadline ? { confirmationDeadline } : {}),
		...(responseMessages ? { responseMessages } : {}),
		...buildPersonalizedAccess(ctx, draftRsvp.personalizedAccess, priorRsvp),
		...(draftRsvp.calendar
			? { calendar: draftRsvp.calendar }
			: clientPriorFields(ctx, priorRsvp, ['calendar'])),
	};
}

function mapMusicSection(
	draftMusic: DraftContent['music'],
	demoMusic: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const url = str(draftMusic?.url);
	const title = str(draftMusic?.title);
	if (url) {
		const autoPlay = typeof draftMusic?.autoPlay === 'boolean' ? draftMusic.autoPlay : false;
		return { url, title: title || demoStr(ctx, demoMusic?.title), autoPlay };
	}
	return ctx.isDemo && demoMusic ? { ...demoMusic } : undefined;
}

function mapGiftsSection(
	draftGifts: DraftContent['gifts'],
	demoGifts: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftGifts)) {
		return ctx.isDemo && demoGifts ? { ...demoGifts } : undefined;
	}
	return {
		title: str(draftGifts.title) || demoStr(ctx, demoGifts?.title),
		subtitle: str(draftGifts.subtitle) || demoStr(ctx, demoGifts?.subtitle),
		items:
			(draftGifts.items as unknown as Array<Record<string, unknown>>) ||
			(ctx.isDemo ? (demoGifts?.items as Array<Record<string, unknown>>) : undefined) ||
			[],
	};
}

function mapQuoteSection(
	draftQuote: DraftContent['quote'],
	demoQuote: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const text = str(draftQuote?.text);
	if (text) {
		return {
			text,
			author: str(draftQuote?.author) || demoStr(ctx, demoQuote?.author),
		};
	}
	return ctx.isDemo && demoQuote ? { ...demoQuote } : undefined;
}

function mapThankYouSection(
	draftThankYou: DraftContent['thankYou'],
	demoThankYou: Record<string, unknown> | undefined,
	priorThankYou: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!draftThankYou) {
		return ctx.isDemo && demoThankYou ? { ...demoThankYou } : undefined;
	}
	const message = str(draftThankYou.message);
	const overlayFields: Record<string, unknown> = {};
	if (draftThankYou.focalPoint !== undefined) overlayFields.focalPoint = draftThankYou.focalPoint;
	if (draftThankYou.closingPhrase !== undefined)
		overlayFields.closingPhrase = draftThankYou.closingPhrase;
	if (draftThankYou.overlayAnchor !== undefined)
		overlayFields.overlayAnchor = draftThankYou.overlayAnchor;
	if (draftThankYou.overlaySafeArea !== undefined)
		overlayFields.overlaySafeArea = draftThankYou.overlaySafeArea;
	if (draftThankYou.date !== undefined) overlayFields.date = draftThankYou.date;
	if (message) {
		return {
			message,
			closingName: str(draftThankYou.closingName) || demoStr(ctx, demoThankYou?.closingName),
			image: draftThankYou.image ?? demoValue(ctx, demoThankYou?.image),
			...clientPriorFields(ctx, priorThankYou, ['date', 'closingPhrase']),
			...overlayFields,
		};
	}
	if (draftThankYou.image) {
		return {
			message: '',
			closingName: '',
			image: draftThankYou.image,
			...overlayFields,
		};
	}
	return ctx.isDemo && demoThankYou ? { ...demoThankYou } : undefined;
}

function resolveInvitationTemplate(
	draftMessages: Record<string, unknown>,
	demoMessages: Record<string, unknown>,
	ctx: PublishCtx,
): string {
	const result =
		str(draftMessages.invitation) ||
		str(draftMessages.whatsappWithPhone) ||
		demoStr(ctx, demoMessages.invitation) ||
		demoStr(ctx, demoMessages.whatsappWithPhone);
	return result ?? '';
}

function resolveReminderTemplate(
	draftMessages: Record<string, unknown>,
	demoMessages: Record<string, unknown>,
	ctx: PublishCtx,
): string {
	const result =
		str(draftMessages.reminder) ||
		demoStr(ctx, demoMessages.reminder) ||
		demoStr(ctx, demoMessages.whatsappWithoutPhone);
	return result ?? DEFAULT_REMINDER_MESSAGE;
}

function mapSharingFromDraft(
	draftSharing: Record<string, unknown> | undefined,
	demoSharing: Record<string, unknown> | undefined,
	priorSharing: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const draftMessages = (draftSharing || {}) as Record<string, unknown>;
	const demoMessages = (ctx.isDemo ? demoSharing && demoSharing.shareMessages : undefined) as
		Record<string, unknown> | undefined;

	const invitation = resolveInvitationTemplate(draftMessages, demoMessages ?? {}, ctx);
	const reminder = resolveReminderTemplate(draftMessages, demoMessages ?? {}, ctx);

	const shareMessages = invitation ? { invitation, reminder } : undefined;

	const whatsappTemplate = demoValue(ctx, demoSharing?.whatsappTemplate);
	const ogImage = draftMessages.ogImage ?? demoValue(ctx, demoSharing?.ogImage);
	const ogDescription = str(draftMessages.ogDescription);
	const result: Record<string, unknown> = clientPriorFields(ctx, priorSharing);

	const hasAnyContent =
		shareMessages ||
		whatsappTemplate ||
		ogImage ||
		ogDescription ||
		Object.keys(result).length > 0;
	if (!hasAnyContent) return undefined;

	if (whatsappTemplate) result.whatsappTemplate = whatsappTemplate;
	if (shareMessages) result.shareMessages = shareMessages;
	if (ogImage) result.ogImage = ogImage;
	if (ogDescription) result.ogDescription = ogDescription;
	return result;
}

function mapItineraryFromDraft(
	draftItinerary: DraftContent['itinerary'],
	_priorItinerary: Record<string, unknown> | undefined,
	demoItinerary: unknown,
	ctx: PublishCtx,
): DraftContent['itinerary'] | unknown {
	if (!draftItinerary) {
		return ctx.isDemo ? demoItinerary : undefined;
	}
	const items = draftItinerary.items?.map((item) => {
		const time = publishVenueTime(item.time) ?? item.time;
		return { ...item, time };
	});
	return items ? { ...draftItinerary, items } : draftItinerary;
}

// eslint-disable-next-line complexity -- The publish mapping covers many sections with optional demo fallback.
export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, invitation, demoContent, isDemo = false } = input;
	const ctx: PublishCtx = { isDemo, priorPublishedContent: input.priorPublishedContent };
	const snapshot = invitation.snapshot;
	const priorPublished = input.priorPublishedContent;

	const locationSection = mapLocationFromDraft(draftContent.location, demoContent, ctx);
	const rsvpSection = mapRsvpSection(
		draftContent.rsvp,
		demoContent.rsvp as Record<string, unknown> | undefined,
		priorPublished?.rsvp as Record<string, unknown> | undefined,
		ctx,
	);
	const musicSection = mapMusicSection(
		draftContent.music,
		demoContent.music as Record<string, unknown> | undefined,
		ctx,
	);
	const giftsSection = mapGiftsSection(
		draftContent.gifts,
		demoContent.gifts as Record<string, unknown> | undefined,
		ctx,
	);
	const quoteSection = mapQuoteSection(
		draftContent.quote,
		demoContent.quote as Record<string, unknown> | undefined,
		ctx,
	);
	const thankYouSection = mapThankYouSection(
		draftContent.thankYou,
		demoContent.thankYou as Record<string, unknown> | undefined,
		priorPublished?.thankYou as Record<string, unknown> | undefined,
		ctx,
	);
	const heroSection = mapHeroSection(
		draftContent.hero,
		demoContent.hero as Record<string, unknown> | undefined,
		priorPublished?.hero as Record<string, unknown> | undefined,
		invitation.title,
		ctx,
	);
	const familySection = mapFamilyFromDraft(
		draftContent.family,
		priorPublished?.family as Record<string, unknown> | undefined,
	);

	const demoTheme = demoContent.theme as Record<string, unknown> | undefined;

	return {
		...(!ctx.isDemo && priorPublished?.templateId !== undefined
			? { templateId: priorPublished.templateId }
			: {}),
		...(!ctx.isDemo && priorPublished?.visualProfileId !== undefined
			? { visualProfileId: priorPublished.visualProfileId }
			: {}),
		eventType: invitation.eventType,
		title: invitation.title,
		description: str(draftContent.description) || demoStr(ctx, demoContent.description),
		isDemo,

		theme: Object.assign(
			{ preset: snapshot.themeId },
			ctx.isDemo && str(demoTheme?.fontFamily)
				? { fontFamily: str(demoTheme?.fontFamily) }
				: {},
		) as Record<string, unknown>,

		sectionOrder:
			draftContent.sectionOrder ?? (ctx.isDemo ? demoContent.sectionOrder : undefined),
		eventTiming: mapEventTimingFromDraft(draftContent.eventTiming),

		hero: heroSection,
		envelope: buildEnvelopeFromDraft(
			draftContent.envelope as Record<string, unknown> | undefined,
			demoContent.envelope as Record<string, unknown> | undefined,
			ctx,
		),
		family: familySection ?? (ctx.isDemo ? demoContent.family : undefined),
		location: locationSection ?? (ctx.isDemo ? demoContent.location : undefined),
		// Omit empty optional collections for client invites so publish does not
		// invent sections the editor never edited (preflight noise / false drift).
		gallery: draftContent.gallery ?? (ctx.isDemo ? demoContent.gallery : undefined),
		itinerary: mapItineraryFromDraft(
			draftContent.itinerary,
			priorPublished?.itinerary as Record<string, unknown> | undefined,
			demoContent.itinerary,
			ctx,
		),
		countdown: mapCountdownFromDraft(
			draftContent.countdown,
			demoContent.countdown as Record<string, unknown> | undefined,
			ctx,
			draftContent.sectionOrder ?? (priorPublished?.sectionOrder as string[] | undefined),
		),
		rsvp: rsvpSection,
		music: musicSection,
		gifts: giftsSection,
		quote: quoteSection ?? (ctx.isDemo ? undefined : { text: '' }),
		thankYou: thankYouSection,

		interludes: draftContent.interludes ?? (ctx.isDemo ? demoContent.interludes : undefined),
		sectionStyles: stripLegacyLocationFlourishes(
			ctx.isDemo ? demoContent.sectionStyles : priorPublished?.sectionStyles,
		),
		navigation: ctx.isDemo ? demoContent.navigation : priorPublished?.navigation,
		sharing: mapSharingFromDraft(
			draftContent.sharing as Record<string, unknown> | undefined,
			demoContent.sharing as Record<string, unknown> | undefined,
			priorPublished?.sharing as Record<string, unknown> | undefined,
			ctx,
		),

		_assetSlug: input.assetSlug ?? snapshot.previewSlug,
	};
}
