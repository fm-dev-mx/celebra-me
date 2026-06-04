import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';
import { str } from '@/lib/intake/utils';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';

function isBlankSection<T extends Record<string, unknown> | null | undefined>(
	value: T,
): value is Extract<T, null | undefined> {
	return !value || Object.keys(value).length === 0;
}

function normalizeHeroDate(value: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00.000Z`;
	return value;
}

type VenueDraft = {
	venueName?: string;
	address?: string;
	city?: string;
	date?: string;
	time?: string;
	mapUrl?: string;
	image?: unknown;
};

function mapFamilyFromDraft(
	draftFamily: DraftContent['family'],
	celebrantName: string,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftFamily)) return undefined;

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
	if (draftFamily.featuredImage) result.featuredImage = draftFamily.featuredImage;
	result.celebrantName = celebrantName;

	return Object.keys(result).length > 0 ? result : undefined;
}

function mapVenue(
	draftVenue: VenueDraft | undefined,
	demoVenue?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftVenue)) return undefined;
	const result: Record<string, unknown> = {};
	if (str(draftVenue.venueName)) result.venueName = str(draftVenue.venueName);
	if (str(draftVenue.address)) result.address = str(draftVenue.address);
	if (str(draftVenue.city)) result.city = str(draftVenue.city);
	if (str(draftVenue.date)) result.date = str(draftVenue.date);
	if (str(draftVenue.time)) result.time = str(draftVenue.time);
	if (str(draftVenue.mapUrl)) result.mapUrl = str(draftVenue.mapUrl);
	if (draftVenue.image) {
		result.image = draftVenue.image;
	} else if (demoVenue?.image) {
		result.image = demoVenue.image;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function mapLocationFromDraft(
	draftLocation: DraftContent['location'],
	demoContent?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftLocation)) return undefined;
	const result: Record<string, unknown> = {};

	const demoLocation = demoContent?.location as Record<string, unknown> | undefined;

	const ceremony = mapVenue(
		draftLocation.ceremony,
		demoLocation?.ceremony as Record<string, unknown> | undefined,
	);
	if (ceremony) result.ceremony = ceremony;
	const reception = mapVenue(
		draftLocation.reception,
		demoLocation?.reception as Record<string, unknown> | undefined,
	);
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
	assetSlug?: string;
	draftContent: DraftContent;
	demoContent: Record<string, unknown>;
	isDemo?: boolean;
}

function buildSafeHeroFallback(invitationTitle: string, themeId: string): Record<string, unknown> {
	return {
		name: invitationTitle,
		label: 'Invitación Especial',
		date: '',
		backgroundImage: { type: 'internal', key: 'hero' },
		variant: themeId,
	};
}

function buildHeroFromDraft(
	draftHero: NonNullable<DraftContent['hero']>,
	demoHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	themeId: string,
): Record<string, unknown> {
	const {
		name: demoName,
		secondaryName: demosecondaryName,
		label: demoLabel,
		nickname: demoNickname,
		date: demoDate,
		backgroundImage: demoBackgroundImage,
		backgroundImageDesktop: demoBackgroundImageDesktop,
		portrait: demoPortrait,
		variant: demoVariant,
	} = demoHero ?? {};

	return {
		name: str(draftHero.name) || (demoName as string) || invitationTitle,
		secondaryName: str(draftHero.secondaryName) || (demosecondaryName as string) || '',
		label: str(draftHero.label) || (demoLabel as string) || 'Invitacion Especial',
		nickname: str(draftHero.nickname) || (demoNickname as string) || '',
		date: normalizeHeroDate(str(draftHero.date) || (demoDate as string) || ''),
		backgroundImage: draftHero.backgroundImage ??
			demoBackgroundImage ?? { type: 'internal', key: 'hero' },
		backgroundImageDesktop: demoBackgroundImageDesktop,
		portrait: draftHero.portrait ?? demoPortrait,
		variant: (demoVariant as string) || themeId,
	};
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	demoHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	themeId: string,
): Record<string, unknown> {
	if (isBlankSection(draftHero)) {
		if (demoHero && Object.keys(demoHero).length > 0) return demoHero;
		return buildSafeHeroFallback(invitationTitle, themeId);
	}
	return buildHeroFromDraft(draftHero, demoHero, invitationTitle, themeId);
}

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftRsvp)) return undefined;
	const whatsappPhone = str(draftRsvp.whatsappPhone) || str(demoRsvp?.whatsappPhone);
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
		whatsappConfig: whatsappPhone ? { phone: whatsappPhone } : demoRsvp?.whatsappConfig,
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
	if (isBlankSection(draftGifts)) {
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
			image: draftThankYou?.image ?? demoThankYou?.image,
		};
	}
	if (draftThankYou?.image) {
		return { message: '', closingName: '', image: draftThankYou.image };
	}
	return demoThankYou ? { ...demoThankYou } : undefined;
}

export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, invitation, demoContent, isDemo = false } = input;
	const snapshot = invitation.snapshot;

	const celebName = str(draftContent.hero?.name) || invitation.title;

	const locationSection = mapLocationFromDraft(draftContent.location, demoContent);
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
		family: familySection ?? demoContent.family,
		location: locationSection ?? demoContent.location,
		gallery: draftContent.gallery ?? demoContent.gallery,
		itinerary: draftContent.itinerary ?? demoContent.itinerary,
		countdown: isDemo ? demoContent.countdown : { ...COUNTDOWN_DEFAULTS },
		rsvp: rsvpSection,
		music: musicSection,
		gifts: giftsSection,
		quote: quoteSection,
		thankYou: thankYouSection,

		interludes: demoContent.interludes,
		sectionStyles: demoContent.sectionStyles,
		navigation: demoContent.navigation,
		sharing: demoContent.sharing,

		_assetSlug: input.assetSlug ?? snapshot.previewSlug,
	};
}
