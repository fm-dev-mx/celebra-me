import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';
import { str } from '@/lib/intake/utils';

function isPopulated(section: Record<string, unknown> | null | undefined): boolean {
	return !!section && Object.keys(section).length > 0;
}

type VenueDraft = {
	venueName?: string;
	address?: string;
	city?: string;
	date?: string;
	time?: string;
	mapUrl?: string;
};

function mapFamilyFromDraft(
	draftFamily: DraftContent['family'],
	celebrantName: string,
): Record<string, unknown> | undefined {
	if (!draftFamily) return undefined;

	const result: Record<string, unknown> = {};
	const parents: Record<string, unknown> = {};

	if (str(draftFamily.fatherName)) parents.father = str(draftFamily.fatherName);
	if (typeof draftFamily.fatherDeceased === 'boolean')
		parents.fatherDeceased = draftFamily.fatherDeceased;
	if (str(draftFamily.motherName)) parents.mother = str(draftFamily.motherName);
	if (typeof draftFamily.motherDeceased === 'boolean')
		parents.motherDeceased = draftFamily.motherDeceased;

	if (Object.keys(parents).length > 0) result.parents = parents;
	if (str(draftFamily.spouseName)) result.spouse = str(draftFamily.spouseName);

	const godparentsText = str(draftFamily.godparents);
	if (godparentsText) {
		const lines = godparentsText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.godparents = lines.map((line) => {
				const parts = line.split(' — ').map((s) => s.trim());
				return parts.length > 1 ? { name: parts[0], role: parts[1] } : { name: parts[0] };
			});
		}
	}

	const childrenText = str(draftFamily.children);
	if (childrenText) {
		const lines = childrenText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.children = lines.map((name) => ({ name }));
		}
	}

	if (str(draftFamily.sectionMessage)) result.sectionMessage = str(draftFamily.sectionMessage);
	result.celebrantName = celebrantName;

	return Object.keys(result).length > 0 ? result : undefined;
}

function mapVenue(draftVenue: VenueDraft | undefined): Record<string, unknown> | undefined {
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
	draftLocation: DraftContent['location'],
): Record<string, unknown> | undefined {
	if (!draftLocation) return undefined;
	const result: Record<string, unknown> = {};
	const ceremony = mapVenue(draftLocation.ceremony);
	if (ceremony) result.ceremony = ceremony;
	const reception = mapVenue(draftLocation.reception);
	if (reception) result.reception = reception;
	if (str(draftLocation.dressCode)) result.dressCode = str(draftLocation.dressCode);
	if (str(draftLocation.additionalIndications))
		result.additionalIndications = str(draftLocation.additionalIndications);
	return Object.keys(result).length > 0 ? result : undefined;
}

export interface PublishInput {
	invitation: {
		title: string;
		eventType: string;
		snapshot: DemoPreset;
	};
	draftContent: DraftContent;
	demoContent: Record<string, unknown>;
	isDemo?: boolean;
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	demoHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	themeId: string,
): Record<string, unknown> | undefined {
	if (!draftHero || !isPopulated(draftHero as Record<string, unknown>)) return demoHero;
	const fromDemo = (key: string) => (demoHero?.[key] as string) || '';
	return {
		name: str(draftHero.name) || (demoHero?.name as string) || invitationTitle,
		secondaryName: str(draftHero.secondaryName) || fromDemo('secondaryName'),
		label: str(draftHero.label) || (demoHero?.label as string) || 'Invitacion Especial',
		nickname: str(draftHero.nickname) || fromDemo('nickname'),
		date: str(draftHero.date) || (demoHero?.date as string) || '',
		backgroundImage: demoHero?.backgroundImage || { type: 'internal', key: 'hero' },
		backgroundImageDesktop: demoHero?.backgroundImageDesktop,
		portrait: demoHero?.portrait,
		variant: demoHero?.variant || themeId,
	};
}

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftRsvp || Object.keys(draftRsvp).length === 0) return undefined;
	return {
		title: str(draftRsvp.title) || str(demoRsvp?.title),
		guestCap:
			typeof draftRsvp.guestCap === 'number'
				? draftRsvp.guestCap
				: (demoRsvp?.guestCap as number | undefined),
		confirmationMessage:
			str(draftRsvp.confirmationMessage) || str(demoRsvp?.confirmationMessage),
		confirmationMode:
			str(draftRsvp.confirmationMode) || str(demoRsvp?.confirmationMode) || 'api',
		accessMode: str(demoRsvp?.accessMode) || 'personalized-only',
		whatsappPhone: str(draftRsvp.whatsappPhone) || str(demoRsvp?.whatsappPhone),
		subcopy: str(draftRsvp.subcopy) || str(demoRsvp?.subcopy),
	};
}

function mapMusicSection(
	draftMusic: DraftContent['music'],
	demoMusic: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const url = str(draftMusic?.url);
	const title = str(draftMusic?.title);
	if (url) {
		return { url, title: title || str(demoMusic?.title), autoPlay: false };
	}
	return demoMusic ? { ...demoMusic } : undefined;
}

function mapGiftsSection(
	draftGifts: DraftContent['gifts'],
	demoGifts: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!draftGifts || Object.keys(draftGifts).length === 0) {
		return demoGifts ? { ...demoGifts } : undefined;
	}
	return {
		title: str(draftGifts.title) || str(demoGifts?.title),
		subtitle: str(draftGifts.subtitle) || str(demoGifts?.subtitle),
		items:
			(draftGifts.items as unknown as Array<Record<string, unknown>>) ||
			(demoGifts?.items as Array<Record<string, unknown>>) ||
			[],
	};
}

function mapQuoteSection(
	draftQuote: DraftContent['quote'],
	demoQuote: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const text = str(draftQuote?.text);
	if (text) {
		return {
			text,
			author: str(draftQuote?.author) || str(demoQuote?.author),
		};
	}
	return demoQuote ? { ...demoQuote } : undefined;
}

function mapThankYouSection(
	draftThankYou: DraftContent['thankYou'],
	demoThankYou: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const message = str(draftThankYou?.message);
	if (message) {
		return {
			message,
			closingName: str(draftThankYou?.closingName) || str(demoThankYou?.closingName),
		};
	}
	return demoThankYou ? { ...demoThankYou } : undefined;
}

export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, invitation, demoContent, isDemo = false } = input;
	const snapshot = invitation.snapshot;

	const celebName = str(draftContent.hero?.name) || invitation.title;

	const locationSection = mapLocationFromDraft(draftContent.location);
	const rsvpSection = mapRsvpSection(
		draftContent.rsvp,
		demoContent.rsvp as Record<string, unknown> | undefined,
	);
	const musicSection = mapMusicSection(
		draftContent.music,
		demoContent.music as Record<string, unknown> | undefined,
	);
	const giftsSection = mapGiftsSection(
		draftContent.gifts,
		demoContent.gifts as Record<string, unknown> | undefined,
	);
	const quoteSection = mapQuoteSection(
		draftContent.quote,
		demoContent.quote as Record<string, unknown> | undefined,
	);
	const thankYouSection = mapThankYouSection(
		draftContent.thankYou,
		demoContent.thankYou as Record<string, unknown> | undefined,
	);
	const heroSection = mapHeroSection(
		draftContent.hero,
		demoContent.hero as Record<string, unknown> | undefined,
		invitation.title,
		snapshot.themeId,
	);
	const familySection = mapFamilyFromDraft(draftContent.family, celebName);

	const demoTheme = demoContent.theme as Record<string, unknown> | undefined;

	return {
		eventType: invitation.eventType,
		title: invitation.title,
		description: str(draftContent.description) || str(demoContent.description),
		isDemo,

		theme: {
			fontFamily: str(demoTheme?.fontFamily),
			preset: snapshot.themeId,
		},

		sectionOrder: draftContent.sectionOrder ?? demoContent.sectionOrder,

		hero: heroSection,
		envelope: demoContent.envelope ?? { disabled: true },
		family: familySection,
		location: locationSection,
		gallery: demoContent.gallery,
		itinerary: demoContent.itinerary,
		countdown: demoContent.countdown,
		rsvp: rsvpSection,
		music: musicSection,
		gifts: giftsSection,
		quote: quoteSection,
		thankYou: thankYouSection,

		interludes: demoContent.interludes,
		sectionStyles: demoContent.sectionStyles,
		navigation: demoContent.navigation,
		sharing: demoContent.sharing,

		_assetSlug: snapshot.previewSlug,
	};
}
