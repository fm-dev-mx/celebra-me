import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

function str(value: unknown): string | undefined {
	if (typeof value === 'string' && value.length > 0) return value;
	return undefined;
}

function bool(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	return undefined;
}

function num(value: unknown): number | undefined {
	if (typeof value === 'number') return value;
	return undefined;
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
			date: str(data.eventDate),
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
						date: str(ceremony.date),
						time: str(ceremony.time),
						mapUrl: str(ceremony.mapUrl),
					}
				: undefined,
			reception: reception
				? {
						venueName: str(reception.venueName),
						address: str(reception.address),
						city: str(reception.city),
						date: str(reception.date),
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
			items: Array.isArray(items) ? (items as Array<Record<string, unknown>>) : undefined,
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
