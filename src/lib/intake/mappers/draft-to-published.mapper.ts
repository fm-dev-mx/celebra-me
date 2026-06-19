import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { FamilyDraft } from '@/lib/intake/schemas/family-draft.schema';
import type { DemoPreset } from '@/lib/intake/types';
import { venueLabel } from '@/lib/intake/utils';
import { str, trimmedStr, normalizeDate, isNonEmptyObject } from '@/lib/shared/data-utils';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';
import { DEFAULT_REMINDER_MESSAGE } from '@/lib/rsvp/services/shared/share-message-defaults';
import { buildPublishedEventTiming } from '@/lib/time/event-time';
import { venueSchema } from '@/lib/intake/schemas/shared-content.schema';
import type { z } from 'zod';

type PublishCtx = { isDemo: boolean };

const VENUE_URL_FIELDS = ['mapUrl', 'googleMapsUrl', 'appleMapsUrl', 'wazeUrl'] as const;

const demoStr = (ctx: PublishCtx, val: unknown): string | undefined =>
	ctx.isDemo ? str(val) : undefined;

const ENVELOPE_TEXT_FIELDS = [
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
] as const;

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
): Record<string, unknown> {
	if (ctx.isDemo && demoCountdown) return { ...demoCountdown };

	return {
		title: str(draftCountdown?.title) || COUNTDOWN_DEFAULTS.title,
		footerText: str(draftCountdown?.footerText) || COUNTDOWN_DEFAULTS.footerText,
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

const FAMILY_LABEL_KEYS: ReadonlyArray<keyof FamilyDraft> = [
	'sectionSubtitle',
	'sectionTitle',
	'parentsTitle',
	'fatherRole',
	'motherRole',
	'godparentsTitle',
	'spouseTitle',
	'spouseRole',
	'childrenTitle',
	'sectionMessage',
] as const;

function buildFamilyLabels(draftFamily: FamilyDraft): Record<string, unknown> | undefined {
	const labels: Record<string, unknown> = {};
	for (const key of FAMILY_LABEL_KEYS) {
		const val = str(draftFamily[key]);
		if (val) labels[key] = val;
	}
	return isNonEmptyObject(labels) ? labels : undefined;
}

function buildFamilyGroups(
	draftFamily: FamilyDraft,
): Array<{ title: string; items: Array<{ name: string; role?: string }> }> | undefined {
	const draftGroups = draftFamily.groups;
	if (!draftGroups || draftGroups.length === 0) return undefined;
	const mappedGroups = draftGroups
		.filter((g) => str(g.title) || str(g.names))
		.map((g) => {
			const namesText = str(g.names);
			const items = namesText ? parseFamilyLines(namesText) : [];
			if (items.length === 0) return null;
			return {
				title: str(g.title) || 'Grupo',
				items,
			};
		})
		.filter(
			(g): g is { title: string; items: Array<{ name: string; role?: string }> } =>
				g !== null,
		);
	return mappedGroups.length > 0 ? mappedGroups : undefined;
}

function parseFamilyLines(text: string): Array<{ name: string; role?: string }> {
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.map((line) => {
			const parts = line.split(' — ').map((s) => s.trim());
			return parts.length > 1 ? { name: parts[0], role: parts[1] } : { name: parts[0] };
		});
}

function buildGodparents(
	draftFamily: FamilyDraft,
): Array<{ name: string; role?: string }> | undefined {
	const godparentsText = str(draftFamily.godparents);
	if (!godparentsText) return undefined;
	const godparents = parseFamilyLines(godparentsText);
	return godparents.length > 0 ? godparents : undefined;
}

function buildGodparentGroups(draftFamily: FamilyDraft):
	| Array<{
			honoreeName: string;
			label?: string;
			godparents: Array<{ name: string; role?: string }>;
	  }>
	| undefined {
	const draftGroups = draftFamily.godparentGroups;
	if (!draftGroups || draftGroups.length === 0) return undefined;
	const mappedGroups = draftGroups
		.map((group) => {
			const honoreeName = str(group.honoreeName);
			const namesText = str(group.names);
			if (!honoreeName || !namesText) return null;
			const godparents = parseFamilyLines(namesText);
			if (godparents.length === 0) return null;
			return {
				honoreeName,
				...(str(group.label) ? { label: str(group.label) } : {}),
				godparents,
			};
		})
		.filter(
			(
				group,
			): group is {
				honoreeName: string;
				label?: string;
				godparents: Array<{ name: string; role?: string }>;
			} => group !== null,
		);
	return mappedGroups.length > 0 ? mappedGroups : undefined;
}

function mapFamilyFromDraft(
	draftFamily: DraftContent['family'],
	celebrantName: string,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftFamily)) return undefined;
	const family = draftFamily as FamilyDraft;

	const result: Record<string, unknown> = {};
	const parents: Record<string, unknown> = {};

	if (str(family.fatherName)) parents.father = str(family.fatherName);
	if (typeof family.fatherDeceased === 'boolean') parents.fatherDeceased = family.fatherDeceased;
	if (str(family.motherName)) parents.mother = str(family.motherName);
	if (typeof family.motherDeceased === 'boolean') parents.motherDeceased = family.motherDeceased;

	if (isNonEmptyObject(parents)) result.parents = parents;
	if (family.parentsOrder) result.parentsOrder = family.parentsOrder;
	if (str(family.spouseName)) result.spouse = str(family.spouseName);

	const mappedGodparentGroups = buildGodparentGroups(family);
	if (mappedGodparentGroups) {
		result.godparentGroups = mappedGodparentGroups;
	} else {
		const mappedGodparents = buildGodparents(family);
		if (mappedGodparents) result.godparents = mappedGodparents;
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

	return isNonEmptyObject(result) ? result : undefined;
}

function mapVenue(
	draftVenue: z.infer<typeof venueSchema> | undefined,
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
	if (str(draftVenue.date)) result.date = str(draftVenue.date);
	if (str(draftVenue.time)) result.time = str(draftVenue.time);
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
		| ReadonlyArray<{ iconName: string; text: string; styleVariant?: string }>
		| undefined,
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
	demoContent: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftLocation)) {
		return undefined;
	}
	const result: Record<string, unknown> = {};
	const demoLocation = demoContent?.location as Record<string, unknown> | undefined;
	if (draftLocation.visibility) result.visibility = draftLocation.visibility;

	if (draftLocation.venues && Array.isArray(draftLocation.venues)) {
		const mappedVenues = draftLocation.venues
			.filter((v) => v.isVisible !== false)
			.map((v) => ({
				id: v.id,
				type: v.type,
				label: venueLabel(v.type, v.label),
				venueName: v.venueName || '',
				address: v.address || '',
				city: v.city || '',
				date: v.date || '',
				time: v.time || '',
				...Object.fromEntries(
					VENUE_URL_FIELDS.map((f) => [
						f,
						(v as Record<string, unknown>)[f] || undefined,
					]).filter(([, val]) => val !== undefined),
				),
				...(v.image ? { image: v.image } : {}),
				...(v.coordinates ? { coordinates: v.coordinates } : {}),
				isVisible: true,
				venueEvent: venueLabel(v.type, v.label),
			}));
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
			ceremony.venueEvent = 'Ceremonia';
			result.ceremony = ceremony;
		}
		const reception = mapVenue(
			draftLocation.reception,
			demoLocation?.reception as Record<string, unknown> | undefined,
			ctx,
		);
		if (reception) {
			reception.venueEvent = 'Recepción';
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
	isDemo?: boolean;
}

// eslint-disable-next-line complexity -- The hero resolution naturally has many fallback paths.
function buildHeroFromDraft(
	draftHero: NonNullable<DraftContent['hero']>,
	demoHero: Record<string, unknown> | undefined,
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
		name: str(draftHero.name) || demoStr(ctx, demoName as string) || invitationTitle,
		secondaryName:
			str(draftHero.secondaryName) || demoStr(ctx, demoSecondaryName as string) || '',
		label: str(draftHero.label) || demoStr(ctx, demoLabel as string) || 'Invitación Especial',
		nickname: str(draftHero.nickname) || demoStr(ctx, demoNickname as string) || '',
		date: normalizeDate(str(draftHero.date) || demoStr(ctx, demoDate as string) || ''),
		backgroundImage: draftHero.backgroundImage ??
			(ctx.isDemo ? demoBackgroundImage : undefined) ?? { type: 'internal', key: 'hero' },
		backgroundImageDesktop: ctx.isDemo ? demoBackgroundImageDesktop : undefined,
		backgroundImageMobile:
			draftHero.backgroundImageMobile ?? (ctx.isDemo ? demoBackgroundImageMobile : undefined),
		portrait: draftHero.portrait ?? (ctx.isDemo ? demoPortrait : undefined),
	};

	if (ctx.isDemo && demoVariant) {
		result.variant = demoVariant as string;
	}

	return result;
}

function mapHeroSection(
	draftHero: DraftContent['hero'],
	demoHero: Record<string, unknown> | undefined,
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
	return buildHeroFromDraft(
		draftHero as NonNullable<DraftContent['hero']>,
		demoHero,
		invitationTitle,
		ctx,
	);
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

function mapRsvpSection(
	draftRsvp: DraftContent['rsvp'],
	demoRsvp: Record<string, unknown> | undefined,
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftRsvp)) return undefined;
	const demo = demoRsvp || {};
	const responseMessages = resolveRsvpResponseMessages(draftRsvp, demoRsvp, ctx);
	const whatsappPhone = str(draftRsvp.whatsappPhone) || demoStr(ctx, demo.whatsappPhone);
	const guestCap =
		typeof draftRsvp.guestCap === 'number'
			? draftRsvp.guestCap
			: ctx.isDemo
				? (demo.guestCap as number | undefined)
				: undefined;
	const confirmationMode =
		str(draftRsvp.confirmationMode) || demoStr(ctx, demo.confirmationMode) || 'api';
	const title = str(draftRsvp.title) || demoStr(ctx, demo.title);
	const confirmationMessage =
		str(draftRsvp.confirmationMessage) || demoStr(ctx, demo.confirmationMessage);
	const accessMode = (ctx.isDemo ? str(demo.accessMode) : undefined) || 'personalized-only';
	const whatsappConfig = whatsappPhone
		? { phone: whatsappPhone }
		: ctx.isDemo
			? demo.whatsappConfig
			: undefined;
	const subcopy = str(draftRsvp.subcopy) || demoStr(ctx, demo.subcopy);
	const confirmationDeadline =
		str(draftRsvp.confirmationDeadline) || demoStr(ctx, demo.confirmationDeadline);
	return {
		title,
		guestCap,
		confirmationMessage,
		confirmationMode,
		accessMode,
		whatsappConfig,
		subcopy,
		...(confirmationDeadline ? { confirmationDeadline } : {}),
		...(responseMessages ? { responseMessages } : {}),
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
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const message = str(draftThankYou?.message);
	const overlayFields: Record<string, unknown> = {};
	if (draftThankYou?.focalPoint !== undefined)
		overlayFields.focalPoint = draftThankYou.focalPoint;
	if (draftThankYou?.overlayAnchor !== undefined)
		overlayFields.overlayAnchor = draftThankYou.overlayAnchor;
	if (draftThankYou?.overlaySafeArea !== undefined)
		overlayFields.overlaySafeArea = draftThankYou.overlaySafeArea;
	if (message) {
		return {
			message,
			closingName: str(draftThankYou?.closingName) || demoStr(ctx, demoThankYou?.closingName),
			image: draftThankYou?.image ?? (ctx.isDemo ? demoThankYou?.image : undefined),
			...overlayFields,
		};
	}
	if (draftThankYou?.image) {
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
	ctx: PublishCtx,
): Record<string, unknown> | undefined {
	const draftMessages = (draftSharing || {}) as Record<string, unknown>;
	const demoMessages = (ctx.isDemo ? demoSharing && demoSharing.shareMessages : undefined) as
		| Record<string, unknown>
		| undefined;

	const invitation = resolveInvitationTemplate(draftMessages, demoMessages ?? {}, ctx);
	const reminder = resolveReminderTemplate(draftMessages, demoMessages ?? {}, ctx);

	const shareMessages = invitation ? { invitation, reminder } : undefined;

	const whatsappTemplate =
		ctx.isDemo && typeof demoSharing?.whatsappTemplate === 'string'
			? demoSharing.whatsappTemplate
			: undefined;
	const ogImage = ctx.isDemo ? demoSharing?.ogImage : undefined;
	const ogDescription = str(draftMessages.ogDescription);

	const hasAnyContent = shareMessages || whatsappTemplate || ogImage || ogDescription;
	if (!hasAnyContent) return undefined;

	const result: Record<string, unknown> = {};
	if (whatsappTemplate) result.whatsappTemplate = whatsappTemplate;
	if (shareMessages) result.shareMessages = shareMessages;
	if (ogImage) result.ogImage = ogImage;
	if (ogDescription) result.ogDescription = ogDescription;
	return result;
}

// eslint-disable-next-line complexity -- The publish mapping covers many sections with optional demo fallback.
export function mapDraftToPublished(input: PublishInput): Record<string, unknown> {
	const { draftContent, invitation, demoContent, isDemo = false } = input;
	const ctx: PublishCtx = { isDemo };
	const snapshot = invitation.snapshot;

	const celebName = str(draftContent.hero?.name) || invitation.title;

	const locationSection = mapLocationFromDraft(draftContent.location, demoContent, ctx);
	const rsvpSection = mapRsvpSection(
		draftContent.rsvp,
		demoContent.rsvp as Record<string, unknown> | undefined,
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
		ctx,
	);
	const heroSection = mapHeroSection(
		draftContent.hero,
		demoContent.hero as Record<string, unknown> | undefined,
		invitation.title,
		ctx,
	);
	const familySection = mapFamilyFromDraft(draftContent.family, celebName);

	const demoTheme = demoContent.theme as Record<string, unknown> | undefined;

	return {
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
		gallery: draftContent.gallery ?? (ctx.isDemo ? demoContent.gallery : { items: [] }),
		itinerary: draftContent.itinerary ?? (ctx.isDemo ? demoContent.itinerary : { items: [] }),
		countdown: mapCountdownFromDraft(
			draftContent.countdown,
			demoContent.countdown as Record<string, unknown> | undefined,
			ctx,
		),
		rsvp: rsvpSection,
		music: musicSection,
		gifts: giftsSection,
		quote: quoteSection ?? (ctx.isDemo ? undefined : { text: '' }),
		thankYou: thankYouSection,

		interludes: draftContent.interludes ?? (ctx.isDemo ? demoContent.interludes : undefined),
		sectionStyles: ctx.isDemo ? demoContent.sectionStyles : undefined,
		sharing: mapSharingFromDraft(
			draftContent.sharing as Record<string, unknown> | undefined,
			demoContent.sharing as Record<string, unknown> | undefined,
			ctx,
		),

		_assetSlug: input.assetSlug ?? snapshot.previewSlug,
	};
}
