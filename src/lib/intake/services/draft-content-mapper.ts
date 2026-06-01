import { z } from 'zod';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';
import { str, strFallback, bool, num } from '@/lib/intake/utils';

export function normalizeDate(date: unknown): string {
	const raw = strFallback(date);
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return `${raw}T00:00:00.000Z`;
	}
	return raw;
}

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

	return {
		location: {
			ceremony: ceremony
				? {
						venueName: str(ceremony.venueName),
						address: str(ceremony.address),
						city: str(ceremony.city),
						date: normalizeDate(ceremony.date),
						time: str(ceremony.time),
						mapUrl: str(ceremony.mapUrl),
					}
				: undefined,
			reception: reception
				? {
						venueName: str(reception.venueName),
						address: str(reception.address),
						city: str(reception.city),
						date: normalizeDate(reception.date),
						time: str(reception.time),
						mapUrl: str(reception.mapUrl),
					}
				: undefined,
			dressCode: str(data.dressCode),
			additionalIndications: str(data.additionalIndications),
		},
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

function mapVenueToDraft(venue: Record<string, unknown> | undefined):
	| {
			venueName?: string;
			address?: string;
			city?: string;
			date?: string;
			time?: string;
			mapUrl?: string;
	  }
	| undefined {
	if (!venue || Object.keys(venue).length === 0) return undefined;
	return {
		venueName: str(venue.venueName),
		address: str(venue.address),
		city: str(venue.city),
		date: normalizeDate(venue.date),
		time: str(venue.time),
		mapUrl: str(venue.mapUrl),
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
	}

	const family = nestedContent.family as Record<string, unknown> | undefined;
	if (family && Object.keys(family).length > 0) {
		const parents = family.parents as Record<string, unknown> | undefined;
		const godparentsArr = family.godparents as
			| Array<{ name: string; role?: string }>
			| undefined;
		const childrenArr = family.children as Array<{ name: string }> | undefined;
		result.family = {
			fatherName: str(parents?.father),
			motherName: str(parents?.mother),
			fatherDeceased: bool(parents?.fatherDeceased),
			motherDeceased: bool(parents?.motherDeceased),
			spouseName: str(family.spouse),
			godparents: godparentsArr
				?.map((g) => (g.role ? `${g.name} — ${g.role}` : g.name))
				.join('\n'),
			children: childrenArr?.map((c) => c.name).join('\n'),
			sectionMessage: str(family.sectionMessage),
		};
	}

	const location = nestedContent.location as Record<string, unknown> | undefined;
	if (location && Object.keys(location).length > 0) {
		result.location = {
			ceremony: mapVenueToDraft(location.ceremony as Record<string, unknown> | undefined),
			reception: mapVenueToDraft(location.reception as Record<string, unknown> | undefined),
			dressCode: str(location.dressCode),
			additionalIndications: str(location.additionalIndications),
		};
	}

	const rsvp = nestedContent.rsvp as Record<string, unknown> | undefined;
	if (rsvp && Object.keys(rsvp).length > 0) {
		const whatsappConfig = rsvp.whatsappConfig as Record<string, unknown> | undefined;
		result.rsvp = {
			title: str(rsvp.title),
			guestCap: typeof rsvp.guestCap === 'number' ? rsvp.guestCap : undefined,
			confirmationMessage: str(rsvp.confirmationMessage),
			confirmationMode: str(rsvp.confirmationMode) as 'api' | 'whatsapp' | 'both' | undefined,
			whatsappPhone: str(whatsappConfig?.phone),
			subcopy: str(rsvp.subcopy),
		};
	}

	const music = nestedContent.music as Record<string, unknown> | undefined;
	if (music && Object.keys(music).length > 0) {
		result.music = { url: str(music.url), title: str(music.title) };
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
		result.itinerary = itinerary as DraftContent['itinerary'];
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
	}

	result.sectionOrder = nestedContent.sectionOrder as DraftContent['sectionOrder'];

	return result;
}
