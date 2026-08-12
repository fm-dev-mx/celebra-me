/**
 * Section-level Published → Draft mappers and legacy Draft canonicalizers.
 * Owned by the draft-content mapping boundary; keep transformations here rather
 * than growing generic blacklists in the orchestrator.
 */
import { PERSONALIZED_ACCESS_DRAFT_KEYS } from '@/lib/intake/constants';
import { str, toEditorDate, isRecord, isNonEmptyObject } from '@/lib/shared/data-utils';
import { normalizeTime } from '@/lib/time/time-format';
import type { DraftNormalizationIssue } from '@/lib/intake/services/draft-normalization-types';

/** Normalize a venue (or venue-like) object to editor-consumable date/time. */
export function mapVenueDateTimeToDraft(venue: Record<string, unknown>): {
	date?: string;
	time?: string;
} {
	// Draft venue date/time must be editor-consumable (`YYYY-MM-DD` / `HH:mm`).
	// Published invitations often store Spanish display prose; pass that through
	// only when it cannot be parsed so operators still see the raw value.
	const date = toEditorDate(venue.date) ?? str(venue.date);
	const time = normalizeTime(venue.time) ?? str(venue.time);
	return {
		...(date !== undefined ? { date } : {}),
		...(time !== undefined ? { time } : {}),
	};
}

function stripVenueEvent(value: unknown): unknown {
	if (!isRecord(value)) return value;
	const { venueEvent: _, ...rest } = value;
	return rest;
}

/** Normalize a venue (or venue-like) object to editor-consumable date/time. */
function canonicalizeVenueDraft(value: unknown): unknown {
	if (!isRecord(value)) return value;
	const withoutEvent = stripVenueEvent(value);
	if (!isRecord(withoutEvent)) return withoutEvent;
	const dateTime = mapVenueDateTimeToDraft(withoutEvent);
	return {
		...withoutEvent,
		...dateTime,
	};
}

/**
 * Strip obsolete legacy indication keys (`icon`) while keeping the Draft
 * indication contract (`iconName`, `text`, `styleVariant`).
 */
function canonicalizeIndicationDraft(
	indication: unknown,
	index: number,
	removedPublishedOnlyKeys: string[],
): unknown {
	if (!isRecord(indication)) return indication;
	if (indication.icon !== undefined) {
		removedPublishedOnlyKeys.push(`location.indications[${index}].icon`);
	}
	return {
		...(indication.iconName !== undefined ? { iconName: indication.iconName } : {}),
		...(indication.text !== undefined ? { text: indication.text } : {}),
		...(indication.styleVariant !== undefined ? { styleVariant: indication.styleVariant } : {}),
	};
}

export function canonicalizeLocationDraft(
	location: Record<string, unknown>,
	removedPublishedOnlyKeys: string[],
): Record<string, unknown> {
	const next: Record<string, unknown> = {
		...location,
		ceremony: canonicalizeVenueDraft(location.ceremony),
		reception: canonicalizeVenueDraft(location.reception),
	};
	if (Array.isArray(location.venues)) {
		next.venues = location.venues.map((venue) => canonicalizeVenueDraft(venue));
	}
	if (Array.isArray(location.indications)) {
		next.indications = location.indications.map((indication, index) =>
			canonicalizeIndicationDraft(indication, index, removedPublishedOnlyKeys),
		);
	}
	return next;
}

/**
 * Draft itinerary owns title/subtitle/presentation/items only.
 * Legacy `items[].icon` is obsolete; Draft requires `iconName`. When only the
 * legacy key is present, report rather than inventing a mapping.
 */
export function canonicalizeItineraryDraft(
	itinerary: Record<string, unknown>,
	issues: DraftNormalizationIssue[] = [],
	removedPublishedOnlyKeys: string[] = [],
): Record<string, unknown> {
	const items = Array.isArray(itinerary.items)
		? itinerary.items.map((item, index) => {
				if (!isRecord(item)) return item;
				if (item.icon !== undefined) {
					removedPublishedOnlyKeys.push(`itinerary.items[${index}].icon`);
					if (item.iconName === undefined) {
						issues.push({
							path: `itinerary.items[${index}].icon`,
							reason: 'unrepresentable_field',
							detail: 'legacy itinerary icon cannot be mapped to Draft iconName; resolve manually',
						});
					}
				}
				const time = normalizeTime(item.time) ?? item.time;
				return {
					...(item.iconName !== undefined ? { iconName: item.iconName } : {}),
					...(item.label !== undefined ? { label: item.label } : {}),
					...(item.description !== undefined ? { description: item.description } : {}),
					...(time !== undefined ? { time } : {}),
				};
			})
		: undefined;
	return {
		...(str(itinerary.title) ? { title: str(itinerary.title) } : {}),
		...(str(itinerary.subtitle) ? { subtitle: str(itinerary.subtitle) } : {}),
		...(itinerary.variant !== undefined ? { variant: itinerary.variant } : {}),
		...(items !== undefined ? { items } : {}),
	};
}

/**
 * Draft gifts owns its canonical structural variant and editable presentation data.
 */
export function mapGiftsToDraft(gifts: Record<string, unknown>): Record<string, unknown> {
	return {
		...(str(gifts.variant) ? { variant: str(gifts.variant) } : {}),
		...(str(gifts.title) ? { title: str(gifts.title) } : {}),
		...(str(gifts.subtitle) ? { subtitle: str(gifts.subtitle) } : {}),
		...(str(gifts.presentation) ? { presentation: str(gifts.presentation) } : {}),
		...(Array.isArray(gifts.items) ? { items: gifts.items } : {}),
	};
}

export function canonicalizeGiftsDraft(gifts: Record<string, unknown>): Record<string, unknown> {
	return mapGiftsToDraft(gifts);
}

/**
 * Draft countdown owns title/footerText. `subtitlePrefix` is obsolete published
 * residue and is not part of the published countdown schema either.
 */
export function mapCountdownToDraft(countdown: Record<string, unknown>): Record<string, unknown> {
	return {
		...(str(countdown.title) ? { title: str(countdown.title) } : {}),
		...(str(countdown.footerText) ? { footerText: str(countdown.footerText) } : {}),
		...(isRecord(countdown.presentationOptions)
			? { presentationOptions: countdown.presentationOptions }
			: {}),
	};
}

export function canonicalizeCountdownDraft(
	countdown: Record<string, unknown>,
	removedPublishedOnlyKeys: string[],
): Record<string, unknown> {
	if (countdown.subtitlePrefix !== undefined) {
		removedPublishedOnlyKeys.push('countdown.subtitlePrefix');
	}
	return mapCountdownToDraft(countdown);
}

function mapPersonalizedAccessToDraft(value: unknown): Record<string, string> | undefined {
	if (!isRecord(value)) return undefined;
	const mapped = Object.fromEntries(
		PERSONALIZED_ACCESS_DRAFT_KEYS.map((key) => [key, str(value[key])]).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
	return isNonEmptyObject(mapped) ? mapped : undefined;
}

function mapRsvpCalendarToDraft(value: unknown): Record<string, string> | undefined {
	if (!isRecord(value)) return undefined;
	const calendar = {
		...(str(value.title) ? { title: str(value.title) } : {}),
		...(str(value.description) ? { description: str(value.description) } : {}),
		...(str(value.startsAt) ? { startsAt: str(value.startsAt) } : {}),
	};
	return isNonEmptyObject(calendar) ? calendar : undefined;
}

/**
 * Draft RSVP owns the editable fields only. Legacy `whatsappConfig` folds into
 * `whatsappPhone`; published-only nested keys (e.g. noteText) are omitted.
 */
export function mapRsvpToDraft(rsvp: Record<string, unknown>): Record<string, unknown> {
	const whatsappConfig = isRecord(rsvp.whatsappConfig) ? rsvp.whatsappConfig : undefined;
	const whatsappPhone = str(rsvp.whatsappPhone) ?? str(whatsappConfig?.phone);
	const personalizedAccess = mapPersonalizedAccessToDraft(rsvp.personalizedAccess);
	const calendar = mapRsvpCalendarToDraft(rsvp.calendar);
	const accessMode = str(rsvp.accessMode);
	const confirmationMode = str(rsvp.confirmationMode);

	return {
		...(str(rsvp.variant) ? { variant: str(rsvp.variant) } : {}),
		...(str(rsvp.title) ? { title: str(rsvp.title) } : {}),
		...(typeof rsvp.guestCap === 'number' ? { guestCap: rsvp.guestCap } : {}),
		...(str(rsvp.confirmationMessage)
			? { confirmationMessage: str(rsvp.confirmationMessage) }
			: {}),
		...(confirmationMode ? { confirmationMode } : {}),
		...(whatsappPhone ? { whatsappPhone } : {}),
		...(str(rsvp.subcopy) ? { subcopy: str(rsvp.subcopy) } : {}),
		...(str(rsvp.confirmationDeadline)
			? { confirmationDeadline: str(rsvp.confirmationDeadline) }
			: {}),
		...(accessMode === 'personalized-only' || accessMode === 'hybrid' ? { accessMode } : {}),
		...(personalizedAccess ? { personalizedAccess } : {}),
		...(calendar ? { calendar } : {}),
		...(rsvp.responseMessages !== undefined ? { responseMessages: rsvp.responseMessages } : {}),
	};
}

export function canonicalizeRsvpDraft(
	rsvp: Record<string, unknown>,
	removedPublishedOnlyKeys: string[],
): Record<string, unknown> {
	if (rsvp.whatsappConfig !== undefined) {
		removedPublishedOnlyKeys.push('rsvp.whatsappConfig');
	}
	if (isRecord(rsvp.personalizedAccess) && rsvp.personalizedAccess.noteText !== undefined) {
		removedPublishedOnlyKeys.push('rsvp.personalizedAccess.noteText');
	}
	return mapRsvpToDraft(rsvp);
}
