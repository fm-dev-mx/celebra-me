import { z } from 'zod';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';
import type { ParentsOrder } from '@/lib/intake/types';
import { str, bool, num, trimmedStr, normalizeDate, normalizeTime } from '@/lib/intake/utils';
import type { IconName } from '@/lib/icons/icon-catalog';

function mapEventDetails(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		title: str(data.eventTitle),
		description: str(data.description),
		hero: {
			name: str(data.celebrantName),
			secondaryName: str(data.secondaryName),
			label: str(data.eventLabel),
			nickname: str(data.nickname),
			date: normalizeDate(data.eventDate),
		},
	};
}

function mapMainPeople(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		family: {
			fatherName: str(data.fatherName),
			fatherDeceased: bool(data.fatherDeceased),
			motherName: str(data.motherName),
			motherDeceased: bool(data.motherDeceased),
			spouseName: str(data.spouseName),
			godparents: str(data.godparents),
			children: str(data.children),
			sectionMessage: str(data.sectionMessage),
		},
	};
}

function mapDateLocations(data: Record<string, unknown>): Partial<DraftContent> {
	const ceremony = data.ceremony as Record<string, unknown> | undefined;
	const reception = data.reception as Record<string, unknown> | undefined;
	const eventTiming = data.eventTiming as Record<string, unknown> | undefined;

	const indications: Array<{ iconName: IconName; text: string }> = [];
	const dressCodeText = str(data.dressCode);
	if (dressCodeText) {
		indications.push({ iconName: 'DressCode', text: dressCodeText });
	}
	const additionalText = str(data.additionalIndications);
	if (additionalText) {
		indications.push({ iconName: 'Calendar', text: additionalText });
	}

	return {
		location: {
			introEyebrow: str(data.introEyebrow),
			introHeading: str(data.introHeading),
			introLede: str(data.introLede),
			indicationsHeading: str(data.indicationsHeading),
			ceremony: mapVenueToDraft(ceremony),
			reception: mapVenueToDraft(reception),
			indications: indications.length > 0 ? indications : undefined,
		},
		eventTiming: eventTiming
			? {
					localDateTime: str(eventTiming.localDateTime),
					timeZone: str(eventTiming.timeZone),
					startsAtUtc: str(eventTiming.startsAtUtc),
				}
			: undefined,
	};
}

function mapPhotos(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		photoNotes: {
			whatsappSent: bool(data.whatsappSent),
			heroPhoto: str(data.heroPhoto),
			portraitPhoto: str(data.portraitPhoto),
			galleryPhotos: str(data.galleryPhotos),
			familyPhoto: str(data.familyPhoto),
			specialPhoto: str(data.specialPhoto),
			generalNotes: str(data.generalNotes),
			photoOrder: str(data.photoOrder),
			cropNotes: str(data.cropNotes),
			priorityNotes: str(data.priorityNotes),
		},
	};
}

function mapRsvpConfig(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		rsvp: {
			title: str(data.title),
			guestCap: num(data.guestCap),
			confirmationMessage: str(data.confirmationMessage),
			confirmationMode: str(data.confirmationMode),
			whatsappPhone: str(data.whatsappPhone),
			subcopy: str(data.subcopy),
		},
	};
}

function mapCountdown(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		countdown: {
			title: str(data.title),
			footerText: str(data.footerText),
		},
	};
}

function mapMusic(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		music: {
			url: str(data.url),
			title: str(data.title),
		},
	};
}

function mapGifts(data: Record<string, unknown>): Partial<DraftContent> {
	const items = data.items;
	return {
		gifts: {
			title: str(data.title),
			subtitle: str(data.subtitle),
			items: Array.isArray(items) ? (items as z.infer<typeof giftItemSchema>[]) : undefined,
		},
	};
}

function mapSpecialMessages(data: Record<string, unknown>): Partial<DraftContent> {
	return {
		quote: {
			text: str(data.quoteText),
			author: str(data.quoteAuthor),
		},
		thankYou: {
			message: str(data.thankYouMessage),
			closingName: str(data.thankYouClosingName),
		},
	};
}

type BlockMapper = (data: Record<string, unknown>) => Partial<DraftContent>;

const BLOCK_MAPPERS: Record<string, BlockMapper> = {
	'event-details': mapEventDetails,
	'main-people': mapMainPeople,
	'date-locations': mapDateLocations,
	countdown: mapCountdown,
	photos: mapPhotos,
	'rsvp-config': mapRsvpConfig,
	music: mapMusic,
	gifts: mapGifts,
	'special-messages': mapSpecialMessages,
};

export function mapBlockDataToDraftContent(
	blockData: Record<string, unknown>,
	enabledBlocks: string[],
): DraftContent {
	const result: DraftContent = {};

	for (const blockType of enabledBlocks) {
		const data = blockData[blockType] as Record<string, unknown> | undefined;
		if (!data) continue;

		const mapper = BLOCK_MAPPERS[blockType];
		if (!mapper) continue;

		const mapped = mapper(data);
		Object.assign(result, mapped);
	}

	return result;
}

function parseCoordinate(value: unknown, min: number, max: number): number | undefined {
	if (value == null || value === '') return undefined;
	const num = typeof value === 'string' ? parseFloat(value) : Number(value);
	if (isNaN(num) || num < min || num > max) return undefined;
	return num;
}

function buildCoordinates(
	venue: Record<string, unknown>,
): { lat: number; lng: number } | undefined {
	if (venue.coordinates === undefined) return undefined;
	const c = venue.coordinates as Record<string, unknown>;
	const lat = parseCoordinate(c.lat, -90, 90);
	const lng = parseCoordinate(c.lng, -180, 180);
	if (lat !== undefined && lng !== undefined) return { lat, lng };
	return undefined;
}

function mapVenueToDraft(
	venue: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!venue || Object.keys(venue).length === 0) return undefined;
	const coordinates = buildCoordinates(venue);
	return {
		venueName: str(venue.venueName),
		address: str(venue.address),
		city: str(venue.city),
		date: normalizeDate(venue.date),
		time: normalizeTime(venue.time) ?? str(venue.time),
		mapUrl: str(venue.mapUrl),
		...(venue.image !== undefined ? { image: venue.image } : {}),
		...(coordinates !== undefined ? { coordinates } : {}),
	};
}

// eslint-disable-next-line complexity -- Nested-to-flat mapping covers many field transformations by design.
export function mapNestedToDraftContent(nestedContent: Record<string, unknown>): DraftContent {
	const result: DraftContent = {};

	result.title = str(nestedContent.title);
	result.description = str(nestedContent.description);

	const hero = nestedContent.hero as Record<string, unknown> | undefined;
	if (hero && Object.keys(hero).length > 0) {
		result.hero = {
			name: str(hero.name),
			secondaryName: str(hero.secondaryName),
			label: str(hero.label),
			nickname: str(hero.nickname),
			date: normalizeDate(hero.date),
		};
		if (hero.backgroundImage !== undefined)
			(result.hero as Record<string, unknown>).backgroundImage = hero.backgroundImage;
		if (hero.backgroundImageMobile !== undefined)
			(result.hero as Record<string, unknown>).backgroundImageMobile =
				hero.backgroundImageMobile;
		if (hero.portrait !== undefined)
			(result.hero as Record<string, unknown>).portrait = hero.portrait;
	}

	const family = nestedContent.family as Record<string, unknown> | undefined;
	if (family && Object.keys(family).length > 0) {
		const parents = family.parents as Record<string, unknown> | undefined;
		const godparentsArr = family.godparents as
			| Array<{ name: string; role?: string }>
			| undefined;
		const childrenArr = family.children as Array<{ name: string }> | undefined;
		const labels = family.labels as Record<string, unknown> | undefined;
		const publishedGroups = family.groups as
			| Array<{ title: string; items: Array<{ name: string; role?: string }> }>
			| undefined;
		result.family = {
			fatherName: str(parents?.father),
			motherName: str(parents?.mother),
			fatherDeceased: bool(parents?.fatherDeceased),
			motherDeceased: bool(parents?.motherDeceased),
			parentsOrder: parents?.parentsOrder as ParentsOrder | undefined,
			spouseName: str(family.spouse),
			godparents: godparentsArr
				?.map((g) => (g.role ? `${g.name} — ${g.role}` : g.name))
				.join('\n'),
			children: childrenArr?.map((c) => c.name).join('\n'),
			sectionMessage: str(labels?.sectionMessage) || str(family.sectionMessage),
			sectionSubtitle: str(labels?.sectionSubtitle),
			sectionTitle: str(labels?.sectionTitle),
			parentsTitle: str(labels?.parentsTitle),
			godparentsTitle: str(labels?.godparentsTitle),
			spouseTitle: str(labels?.spouseTitle),
			spouseRole: str(labels?.spouseRole),
			childrenTitle: str(labels?.childrenTitle),
			visible: typeof family.visible === 'boolean' ? family.visible : undefined,
			groups: publishedGroups
				?.filter((g) => g.items && g.items.length > 0)
				.map((g) => ({
					title: str(g.title),
					names: g.items.map((item) => item.name).join('\n'),
				})),
		};
		if (family.featuredImage !== undefined)
			(result.family as Record<string, unknown>).featuredImage = family.featuredImage;
	}

	const location = nestedContent.location as Record<string, unknown> | undefined;
	if (location && Object.keys(location).length > 0) {
		const publishedIndications = Array.isArray(location.indications)
			? (location.indications as Array<Record<string, unknown>>)
			: [];
		const draftIndications = publishedIndications
			.filter((ind) => str(ind.text))
			.map((ind) => ({
				iconName: ind.iconName as IconName,
				text: str(ind.text) as string,
			}));

		const draftLocation: Record<string, unknown> = {
			visibility: str(location.visibility),
			introEyebrow: str(location.introEyebrow),
			introHeading: str(location.introHeading),
			introLede: str(location.introLede),
			indicationsHeading: str(location.indicationsHeading),
			indications: draftIndications.length > 0 ? draftIndications : undefined,
		};

		// Flatten venues array if present (preferred source)
		const publishedVenues = location.venues as Array<Record<string, unknown>> | undefined;
		if (publishedVenues && Array.isArray(publishedVenues) && publishedVenues.length > 0) {
			draftLocation.venues = publishedVenues.map((v, idx) => ({
				id: str(v.id) || `venue_legacy_${idx}`,
				type: (v.type as string) || 'custom',
				label: str(v.label),
				venueName: str(v.venueName),
				address: str(v.address),
				city: str(v.city),
				date: str(v.date),
				time: str(v.time),
				mapUrl: str(v.mapUrl),
				...(v.image !== undefined ? { image: v.image } : {}),
				...(v.coordinates !== undefined
					? { coordinates: buildCoordinates(v as Record<string, unknown>) }
					: {}),
				isVisible: v.isVisible !== false,
			}));
		} else {
			// Legacy ceremony/reception fields
			draftLocation.ceremony = mapVenueToDraft(
				location.ceremony as Record<string, unknown> | undefined,
			);
			draftLocation.reception = mapVenueToDraft(
				location.reception as Record<string, unknown> | undefined,
			);
		}

		result.location = draftLocation as DraftContent['location'];
	}

	const countdown = nestedContent.countdown as Record<string, unknown> | undefined;
	if (countdown && Object.keys(countdown).length > 0) {
		result.countdown = {
			title: str(countdown.title),
			footerText: str(countdown.footerText),
		};
	}

	const eventTiming = nestedContent.eventTiming as Record<string, unknown> | undefined;
	if (eventTiming && Object.keys(eventTiming).length > 0) {
		result.eventTiming = {
			localDateTime: str(eventTiming.localDateTime),
			timeZone: str(eventTiming.timeZone),
			startsAtUtc: str(eventTiming.startsAtUtc),
		};
	}

	const rsvp = nestedContent.rsvp as Record<string, unknown> | undefined;
	if (rsvp && Object.keys(rsvp).length > 0) {
		const whatsappConfig = rsvp.whatsappConfig as Record<string, unknown> | undefined;
		const responseMessages = rsvp.responseMessages as
			| NonNullable<DraftContent['rsvp']>['responseMessages']
			| undefined;
		result.rsvp = {
			title: str(rsvp.title),
			guestCap: typeof rsvp.guestCap === 'number' ? rsvp.guestCap : undefined,
			confirmationMessage: str(rsvp.confirmationMessage),
			confirmationMode: str(rsvp.confirmationMode) as 'api' | 'whatsapp' | 'both' | undefined,
			whatsappPhone: str(whatsappConfig?.phone),
			subcopy: str(rsvp.subcopy),
			...(responseMessages ? { responseMessages } : {}),
		};
	}

	const music = nestedContent.music as Record<string, unknown> | undefined;
	if (music && Object.keys(music).length > 0) {
		result.music = {
			url: str(music.url),
			title: str(music.title),
			...(typeof music.autoPlay === 'boolean' ? { autoPlay: music.autoPlay } : {}),
		};
	}

	const envelope = nestedContent.envelope as Record<string, unknown> | undefined;
	if (envelope && Object.keys(envelope).length > 0) {
		// Start from a copy of the full published envelope so non-editable
		// premium fields (sealVariant, sealStyle, microcopy, closedPalette, etc.)
		// survive the draft round-trip.
		result.envelope = { ...envelope };
		// Re-apply trimming/normalisation for draft-editable fields.
		if (typeof envelope.disabled !== 'boolean') delete result.envelope.disabled;
		for (const field of [
			'envelopeName',
			'documentLabel',
			'stampText',
			'stampYear',
			'tooltipText',
			'microcopy',
			'cardLabel',
			'cardName',
			'cardSecondaryName',
			'cardTagline',
			'guestLabel',
			'guestNameFallback',
			'sealInitials',
		] as const) {
			const trimmed = trimmedStr(envelope[field]);
			if (trimmed) result.envelope[field] = trimmed;
			else delete result.envelope[field];
		}
	}

	const gifts = nestedContent.gifts as Record<string, unknown> | undefined;
	if (gifts && Object.keys(gifts).length > 0) {
		result.gifts = {
			title: str(gifts.title),
			subtitle: str(gifts.subtitle),
			items: Array.isArray(gifts.items)
				? (gifts.items as z.infer<typeof giftItemSchema>[])
				: undefined,
		};
	}

	const gallery = nestedContent.gallery as Record<string, unknown> | undefined;
	if (gallery && Object.keys(gallery).length > 0) {
		result.gallery = gallery as DraftContent['gallery'];
	}

	const itinerary = nestedContent.itinerary as Record<string, unknown> | undefined;
	if (itinerary && Object.keys(itinerary).length > 0) {
		const normalizedItems = (
			itinerary.items as Array<Record<string, unknown>> | undefined
		)?.map((item) => ({
			...item,
			time: normalizeTime(item.time) ?? item.time,
		}));
		result.itinerary = {
			...itinerary,
			...(normalizedItems ? { items: normalizedItems } : {}),
		} as DraftContent['itinerary'];
	}

	const quote = nestedContent.quote as Record<string, unknown> | undefined;
	if (quote && Object.keys(quote).length > 0) {
		result.quote = { text: str(quote.text), author: str(quote.author) };
	}

	const thankYou = nestedContent.thankYou as Record<string, unknown> | undefined;
	if (thankYou && Object.keys(thankYou).length > 0) {
		result.thankYou = {
			message: str(thankYou.message),
			closingName: str(thankYou.closingName),
		};
		if (thankYou.image !== undefined)
			(result.thankYou as Record<string, unknown>).image = thankYou.image;
		if (thankYou.focalPoint !== undefined)
			(result.thankYou as Record<string, unknown>).focalPoint = thankYou.focalPoint;
		if (thankYou.overlayAnchor !== undefined)
			(result.thankYou as Record<string, unknown>).overlayAnchor = thankYou.overlayAnchor;
		if (thankYou.overlaySafeArea !== undefined)
			(result.thankYou as Record<string, unknown>).overlaySafeArea = thankYou.overlaySafeArea;
	}

	const sharing = nestedContent.sharing as Record<string, unknown> | undefined;
	if (sharing && Object.keys(sharing).length > 0) {
		const shareMessages = sharing.shareMessages as Record<string, unknown> | undefined;
		const ogDescription = str(sharing.ogDescription);
		if (shareMessages && Object.keys(shareMessages).length > 0) {
			const invitation =
				str(shareMessages.invitation) ||
				str(shareMessages.whatsappWithPhone) ||
				str(shareMessages.whatsappWithoutPhone);
			const reminder = str(shareMessages.reminder);
			result.sharing = {
				...(invitation ? { invitation } : {}),
				...(reminder ? { reminder } : {}),
				...(ogDescription ? { ogDescription } : {}),
			};
			if (Object.keys(result.sharing).length === 0) {
				delete result.sharing;
			}
		} else if (ogDescription) {
			result.sharing = { ogDescription };
		}
	}

	result.sectionOrder = nestedContent.sectionOrder as DraftContent['sectionOrder'];

	if (nestedContent.interludes !== undefined) {
		result.interludes = nestedContent.interludes as DraftContent['interludes'];
	}

	return result;
}
