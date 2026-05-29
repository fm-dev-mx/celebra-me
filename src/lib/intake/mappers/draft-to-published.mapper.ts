import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';

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

function mapFamilyFromDraft(
	draftFamily: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftFamily) return undefined;

	const result: Record<string, unknown> = {};
	const parents: Record<string, unknown> = {};

	if (str(draftFamily.fatherName)) parents.father = str(draftFamily.fatherName);
	if (bool(draftFamily.fatherDeceased) !== undefined)
		parents.fatherDeceased = bool(draftFamily.fatherDeceased);
	if (str(draftFamily.motherName)) parents.mother = str(draftFamily.motherName);
	if (bool(draftFamily.motherDeceased) !== undefined)
		parents.motherDeceased = bool(draftFamily.motherDeceased);

	if (Object.keys(parents).length > 0) result.parents = parents;
	if (str(draftFamily.spouseName)) result.spouse = str(draftFamily.spouseName);

	if (str(draftFamily.godparents)) {
		const lines = String(draftFamily.godparents)
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.godparents = lines.map((line: string) => {
				const parts = line.split(' — ').map((s) => s.trim());
				return parts.length > 1 ? { name: parts[0], role: parts[1] } : { name: parts[0] };
			});
		}
	}

	if (str(draftFamily.children)) {
		const lines = String(draftFamily.children)
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.children = lines.map((name: string) => ({ name }));
		}
	}

	if (str(draftFamily.sectionMessage)) result.sectionMessage = str(draftFamily.sectionMessage);

	return Object.keys(result).length > 0 ? result : undefined;
}

function mapVenue(
	draftVenue: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftVenue) return undefined;
	const result: Record<string, unknown> = {};
	if (str(draftVenue.venueName)) result.venueName = str(draftVenue.venueName);
	if (str(draftVenue.address)) result.address = str(draftVenue.address);
	if (str(draftVenue.city)) result.city = str(draftVenue.city);
	if (str(draftVenue.date)) result.date = str(draftVenue.date);
	if (str(draftVenue.time)) result.time = str(draftVenue.time);
	if (str(draftVenue.mapUrl)) result.mapUrl = str(draftVenue.mapUrl);
	return Object.keys(result).length > 0 ? result : undefined;
}

function mapLocationFromDraft(
	draftLocation: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftLocation) return undefined;
	const result: Record<string, unknown> = {};
	const ceremony = mapVenue(draftLocation.ceremony as Record<string, unknown> | undefined);
	if (ceremony) result.ceremony = ceremony;
	const reception = mapVenue(draftLocation.reception as Record<string, unknown> | undefined);
	if (reception) result.reception = reception;
	if (str(draftLocation.dressCode)) result.dressCode = str(draftLocation.dressCode);
	if (str(draftLocation.additionalIndications))
		result.additionalIndications = str(draftLocation.additionalIndications);
	return Object.keys(result).length > 0 ? result : undefined;
}

export interface PublishInput {
	project: {
		title: string;
		eventType: string;
		snapshot: DemoPreset;
	};
	draftContent: DraftContent;
}

function mapHero(
	draftContent: DraftContent,
	snapshot: DemoPreset,
	projectTitle: string,
): Record<string, unknown> | undefined {
	const draftHero = draftContent.hero as Record<string, unknown> | undefined;
	if (!draftHero || Object.keys(draftHero).length === 0) return undefined;
	return {
		name: str(draftHero.name) || projectTitle,
		secondaryName: str(draftHero.secondaryName),
		label: str(draftHero.label) || 'Invitacion Especial',
		nickname: str(draftHero.nickname),
		date: str(draftHero.date) || '',
		backgroundImage: { type: 'internal', key: 'hero' },
		variant: snapshot.themeId,
	};
}

function mapRsvp(draftContent: DraftContent): Record<string, unknown> | undefined {
	const draftRsvp = draftContent.rsvp as Record<string, unknown> | undefined;
	if (!draftRsvp || Object.keys(draftRsvp).length === 0) return undefined;
	return {
		title: str(draftRsvp.title),
		guestCap: num(draftRsvp.guestCap),
		confirmationMessage: str(draftRsvp.confirmationMessage),
		confirmationMode: str(draftRsvp.confirmationMode) || 'api',
		whatsappPhone: str(draftRsvp.whatsappPhone),
		subcopy: str(draftRsvp.subcopy),
	};
}

function mapMusic(draftContent: DraftContent): Record<string, unknown> | undefined {
	const draftMusic = draftContent.music as Record<string, unknown> | undefined;
	if (!draftMusic || !str(draftMusic.url)) return undefined;
	return {
		url: str(draftMusic.url),
		title: str(draftMusic.title),
	};
}

function mapGifts(draftContent: DraftContent): Record<string, unknown> | undefined {
	const draftGifts = draftContent.gifts as Record<string, unknown> | undefined;
	if (!draftGifts || (!str(draftGifts.title) && !str(draftGifts.subtitle) && !draftGifts.items))
		return undefined;
	return {
		title: str(draftGifts.title),
		subtitle: str(draftGifts.subtitle),
		items: draftGifts.items,
	};
}

function mapQuote(draftContent: DraftContent): Record<string, unknown> | undefined {
	const draftQuote = draftContent.quote as Record<string, unknown> | undefined;
	if (!draftQuote || !str(draftQuote.text)) return undefined;
	return {
		text: str(draftQuote.text),
		author: str(draftQuote.author),
	};
}

function mapThankYou(draftContent: DraftContent): Record<string, unknown> | undefined {
	const draftThankYou = draftContent.thankYou as Record<string, unknown> | undefined;
	if (!draftThankYou || !str(draftThankYou.message)) return undefined;
	return {
		message: str(draftThankYou.message),
		closingName: str(draftThankYou.closingName),
	};
}

export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, project } = input;
	const snapshot = project.snapshot;

	const result: Record<string, unknown> = {
		eventType: project.eventType,
		title: project.title,
		description: str(draftContent.description),
		theme: { preset: snapshot.themeId },
		isDemo: false,
	};

	const heroSection = mapHero(draftContent, snapshot, project.title);
	if (heroSection) result.hero = heroSection;

	const familySection = mapFamilyFromDraft(
		draftContent.family as Record<string, unknown> | undefined,
	);
	if (familySection) {
		familySection.celebrantName =
			str((draftContent.hero as Record<string, unknown> | undefined)?.name) || project.title;
		result.family = familySection;
	}

	const locationSection = mapLocationFromDraft(
		draftContent.location as Record<string, unknown> | undefined,
	);
	if (locationSection) result.location = locationSection;

	const rsvpSection = mapRsvp(draftContent);
	if (rsvpSection) result.rsvp = rsvpSection;

	const musicSection = mapMusic(draftContent);
	if (musicSection) result.music = musicSection;

	const giftsSection = mapGifts(draftContent);
	if (giftsSection) result.gifts = giftsSection;

	const quoteSection = mapQuote(draftContent);
	if (quoteSection) result.quote = quoteSection;

	const thankYouSection = mapThankYou(draftContent);
	if (thankYouSection) result.thankYou = thankYouSection;

	return result;
}
