import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { FamilyDraft } from '@/lib/intake/schemas/family-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';
import { str, normalizeDate } from '@/lib/intake/utils';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';

function isBlankSection<T extends Record<string, unknown> | null | undefined>(value: T): boolean {
	return !value || Object.keys(value).length === 0;
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

function buildEnvelopeFromDraft(
	draftEnvelope: Record<string, unknown> | undefined,
	demoEnvelope: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const base = demoEnvelope ?? { disabled: true };
	if (typeof draftEnvelope?.disabled === 'boolean') {
		return { ...base, disabled: draftEnvelope.disabled };
	}
	return base;
}

function mapCountdownFromDraft(
	draftCountdown: DraftContent['countdown'],
	demoCountdown: Record<string, unknown> | undefined,
	isDemo: boolean,
): Record<string, unknown> {
	if (isDemo && demoCountdown) return { ...demoCountdown };

	return {
		title: str(draftCountdown?.title) || COUNTDOWN_DEFAULTS.title,
		footerText: str(draftCountdown?.footerText) || COUNTDOWN_DEFAULTS.footerText,
	};
}

function buildFamilyLabels(draftFamily: FamilyDraft): Record<string, unknown> | undefined {
	const labels: Record<string, unknown> = {};
	if (str(draftFamily.sectionSubtitle)) labels.sectionSubtitle = str(draftFamily.sectionSubtitle);
	if (str(draftFamily.sectionTitle)) labels.sectionTitle = str(draftFamily.sectionTitle);
	if (str(draftFamily.parentsTitle)) labels.parentsTitle = str(draftFamily.parentsTitle);
	if (str(draftFamily.godparentsTitle)) labels.godparentsTitle = str(draftFamily.godparentsTitle);
	if (str(draftFamily.spouseTitle)) labels.spouseTitle = str(draftFamily.spouseTitle);
	if (str(draftFamily.spouseRole)) labels.spouseRole = str(draftFamily.spouseRole);
	if (str(draftFamily.childrenTitle)) labels.childrenTitle = str(draftFamily.childrenTitle);
	if (str(draftFamily.sectionMessage)) labels.sectionMessage = str(draftFamily.sectionMessage);
	return Object.keys(labels).length > 0 ? labels : undefined;
}

function buildFamilyGroups(
	draftFamily: FamilyDraft,
): Array<{ title: string; items: Array<{ name: string }> }> | undefined {
	const draftGroups = draftFamily.groups;
	if (!draftGroups || draftGroups.length === 0) return undefined;
	const mappedGroups = draftGroups
		.filter((g) => str(g.title) || str(g.names))
		.map((g) => {
			const namesText = str(g.names);
			const items = namesText
				? namesText
						.split('\n')
						.map((l) => l.trim())
						.filter(Boolean)
						.map((name) => ({ name }))
				: [];
			if (items.length === 0) return null;
			return {
				title: str(g.title) || 'Grupo',
				items,
			};
		})
		.filter(Boolean);
	return mappedGroups.length > 0
		? (mappedGroups as Array<{ title: string; items: Array<{ name: string }> }>)
		: undefined;
}

function mapFamilyFromDraft(
	draftFamily: DraftContent['family'],
	celebrantName: string,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftFamily)) return undefined;
	const family = draftFamily as FamilyDraft;

	const result: Record<string, unknown> = {};
	const parents: Record<string, unknown> = {};

	if (str(family.fatherName)) parents.father = str(family.fatherName);
	if (typeof family.fatherDeceased === 'boolean') parents.fatherDeceased = family.fatherDeceased;
	if (str(family.motherName)) parents.mother = str(family.motherName);
	if (typeof family.motherDeceased === 'boolean') parents.motherDeceased = family.motherDeceased;

	if (Object.keys(parents).length > 0) result.parents = parents;
	if (str(family.spouseName)) result.spouse = str(family.spouseName);

	const godparentsText = str(family.godparents);
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

	const childrenText = str(family.children);
	if (childrenText) {
		const lines = childrenText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.children = lines.map((name) => ({ name }));
		}
	}

	const labels = buildFamilyLabels(family);
	if (labels) result.labels = labels;

	if (str(family.sectionMessage)) result.sectionMessage = str(family.sectionMessage);

	const mappedGroups = buildFamilyGroups(family);
	if (mappedGroups) result.groups = mappedGroups;

	if (typeof family.visible === 'boolean') result.visible = family.visible;
	if (family.featuredImage) result.featuredImage = family.featuredImage;
	result.celebrantName = celebrantName;

	return Object.keys(result).length > 0 ? result : undefined;
}

function mapVenue(
	draftVenue: VenueDraft | undefined,
	demoVenue?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftVenue)) {
		return demoVenue && Object.keys(demoVenue).length > 0 ? { ...demoVenue } : undefined;
	}
	const result: Record<string, unknown> = {};
	if (str(draftVenue!.venueName)) result.venueName = str(draftVenue!.venueName);
	if (str(draftVenue!.address)) result.address = str(draftVenue!.address);
	if (str(draftVenue!.city)) result.city = str(draftVenue!.city);
	if (str(draftVenue!.date)) result.date = str(draftVenue!.date);
	if (str(draftVenue!.time)) result.time = str(draftVenue!.time);
	if (str(draftVenue!.mapUrl)) result.mapUrl = str(draftVenue!.mapUrl);
	if (draftVenue!.image) {
		result.image = draftVenue!.image;
	} else if (demoVenue?.image) {
		result.image = demoVenue!.image;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function resolveIntroFields(
	draftLocation: DraftContent['location'],
	demoLocation: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	const introEyebrow = str(draftLocation!.introEyebrow) || str(demoLocation?.introEyebrow);
	if (introEyebrow) fields.introEyebrow = introEyebrow;
	const introHeading = str(draftLocation!.introHeading) || str(demoLocation?.introHeading);
	if (introHeading) fields.introHeading = introHeading;
	const introLede = str(draftLocation!.introLede) || str(demoLocation?.introLede);
	if (introLede) fields.introLede = introLede;
	const indicationsHeading =
		str(draftLocation!.indicationsHeading) || str(demoLocation?.indicationsHeading);
	if (indicationsHeading) fields.indicationsHeading = indicationsHeading;
	return fields;
}

function mapIndicationsFromDraft(
	draftIndications: ReadonlyArray<{ iconName: string; text: string }> | undefined,
): Array<Record<string, unknown>> | undefined {
	if (!draftIndications || draftIndications.length === 0) return undefined;
	const mapped = draftIndications
		.filter((ind) => str(ind.text))
		.map((ind) => ({
			iconName: ind.iconName,
			styleVariant: 'default',
			text: str(ind.text),
		}));
	return mapped.length > 0 ? mapped : undefined;
}

function mapLocationFromDraft(
	draftLocation: DraftContent['location'],
	demoContent?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftLocation)) return undefined;
	const result: Record<string, unknown> = {};
	const demoLocation = demoContent?.location as Record<string, unknown> | undefined;

	const ceremony = mapVenue(
		draftLocation!.ceremony,
		demoLocation?.ceremony as Record<string, unknown> | undefined,
	);
	if (ceremony) result.ceremony = ceremony;
	const reception = mapVenue(
		draftLocation!.reception,
		demoLocation?.reception as Record<string, unknown> | undefined,
	);
	if (reception) result.reception = reception;

	const introFields = resolveIntroFields(draftLocation!, demoLocation);
	Object.assign(result, introFields);

	const indications = mapIndicationsFromDraft(draftLocation!.indications);
	if (indications) result.indications = indications;

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
	isDemo: boolean,
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

	return {
		name: str(draftHero.name) || (demoName as string) || invitationTitle,
		secondaryName: str(draftHero.secondaryName) || (demoSecondaryName as string) || '',
		label: str(draftHero.label) || (demoLabel as string) || 'Invitacion Especial',
		nickname: str(draftHero.nickname) || (demoNickname as string) || '',
		date: normalizeDate(str(draftHero.date) || (demoDate as string) || ''),
		backgroundImage: draftHero.backgroundImage ??
			demoBackgroundImage ?? { type: 'internal', key: 'hero' },
		backgroundImageDesktop: demoBackgroundImageDesktop,
		backgroundImageMobile:
			draftHero.backgroundImageMobile ?? (isDemo ? demoBackgroundImageMobile : undefined),
		portrait: draftHero.portrait ?? demoPortrait,
		variant: (demoVariant as string) || themeId,
	};
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	demoHero: Record<string, unknown> | undefined,
	invitationTitle: string,
	themeId: string,
	isDemo: boolean,
): Record<string, unknown> {
	if (isBlankSection(draftHero)) {
		if (demoHero && Object.keys(demoHero).length > 0) return demoHero;
		return buildSafeHeroFallback(invitationTitle, themeId);
	}
	return buildHeroFromDraft(
		draftHero as NonNullable<DraftContent['hero']>,
		demoHero,
		invitationTitle,
		themeId,
		isDemo,
	);
}

function resolveRsvpResponseMessages(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	return (
		draftRsvp!.responseMessages ??
		(demoRsvp?.responseMessages as Record<string, unknown> | undefined)
	);
}

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (isBlankSection(draftRsvp)) return undefined;
	const whatsappPhone = str(draftRsvp!.whatsappPhone) || str(demoRsvp?.whatsappPhone);
	const responseMessages = resolveRsvpResponseMessages(draftRsvp, demoRsvp);
	return {
		title: str(draftRsvp!.title) || str(demoRsvp?.title),
		guestCap:
			typeof draftRsvp!.guestCap === 'number'
				? draftRsvp!.guestCap
				: (demoRsvp?.guestCap as number | undefined),
		confirmationMessage:
			str(draftRsvp!.confirmationMessage) || str(demoRsvp?.confirmationMessage),
		confirmationMode:
			str(draftRsvp!.confirmationMode) || str(demoRsvp?.confirmationMode) || 'api',
		accessMode: str(demoRsvp?.accessMode) || 'personalized-only',
		whatsappConfig: whatsappPhone ? { phone: whatsappPhone } : demoRsvp?.whatsappConfig,
		subcopy: str(draftRsvp!.subcopy) || str(demoRsvp?.subcopy),
		...(responseMessages ? { responseMessages } : {}),
	};
}

function mapMusicSection(
	draftMusic: DraftContent['music'],
	demoMusic: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const url = str(draftMusic?.url);
	const title = str(draftMusic?.title);
	if (url) {
		const autoPlay = typeof draftMusic?.autoPlay === 'boolean' ? draftMusic.autoPlay : false;
		return { url, title: title || str(demoMusic?.title), autoPlay };
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
		title: str(draftGifts!.title) || str(demoGifts?.title),
		subtitle: str(draftGifts!.subtitle) || str(demoGifts?.subtitle),
		items:
			(draftGifts!.items as unknown as Array<Record<string, unknown>>) ||
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

function mapSharingFromDraft(
	draftSharing: Record<string, unknown> | undefined,
	demoSharing: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const draftMessages = draftSharing as Record<string, unknown> | undefined;
	const demoMessages = demoSharing?.shareMessages as Record<string, unknown> | undefined;

	const whatsappWithPhone =
		str(draftMessages?.whatsappWithPhone) || str(demoMessages?.whatsappWithPhone);
	const whatsappWithoutPhone =
		str(draftMessages?.whatsappWithoutPhone) || str(demoMessages?.whatsappWithoutPhone);

	const hasShareMessages = !!(whatsappWithPhone && whatsappWithoutPhone);
	const whatsappTemplate =
		typeof demoSharing?.whatsappTemplate === 'string'
			? demoSharing.whatsappTemplate
			: undefined;
	const ogImage = demoSharing?.ogImage;

	if (!hasShareMessages && !whatsappTemplate && !ogImage) return undefined;

	return {
		...(whatsappTemplate ? { whatsappTemplate } : {}),
		...(hasShareMessages
			? {
					shareMessages: {
						whatsappWithPhone,
						whatsappWithoutPhone,
					},
				}
			: {}),
		...(ogImage ? { ogImage } : {}),
	};
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
		isDemo,
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
		envelope: buildEnvelopeFromDraft(
			draftContent.envelope as Record<string, unknown> | undefined,
			demoContent.envelope as Record<string, unknown> | undefined,
		),
		family: familySection ?? demoContent.family,
		location: locationSection ?? demoContent.location,
		gallery: draftContent.gallery ?? demoContent.gallery,
		itinerary: draftContent.itinerary ?? demoContent.itinerary,
		countdown: mapCountdownFromDraft(
			draftContent.countdown,
			demoContent.countdown as Record<string, unknown> | undefined,
			isDemo,
		),
		rsvp: rsvpSection,
		music: musicSection,
		gifts: giftsSection,
		quote: quoteSection,
		thankYou: thankYouSection,

		interludes: demoContent.interludes,
		sectionStyles: demoContent.sectionStyles,
		sharing: mapSharingFromDraft(
			draftContent.sharing as Record<string, unknown> | undefined,
			demoContent.sharing as Record<string, unknown> | undefined,
		),

		_assetSlug: input.assetSlug ?? snapshot.previewSlug,
	};
}
