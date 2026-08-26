import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import {
	FAMILY_LABEL_KEYS,
	formatFamilyMembersAsLines,
	type ParentsOrder,
} from '@/lib/invitation/family-contract';
import {
	str,
	bool,
	num,
	trimmedStr,
	normalizeDate,
	isRecord,
	isNonEmptyObject,
} from '@/lib/shared/data-utils';
import { VENUE_URL_FIELDS, ENVELOPE_TEXT_FIELDS } from '@/lib/intake/constants';
import type { IconName } from '@/lib/icons/icon-catalog';
import {
	normalizeLegacyLocation,
	type LocationRecord,
} from '@/lib/invitation/location-normalizer';
import {
	DraftNormalizationError,
	type DraftNormalizationIssue,
} from '@/lib/intake/services/draft-normalization-types';
import {
	canonicalizeCountdownDraft,
	canonicalizeGiftsDraft,
	canonicalizeItineraryDraft,
	canonicalizeLocationDraft,
	canonicalizeRsvpDraft,
	mapCountdownToDraft,
	mapGiftsToDraft,
	mapRsvpToDraft,
	mapVenueDateTimeToDraft,
} from '@/lib/intake/services/draft-section-mappers';

export type {
	DraftNormalizationIssue,
	DraftNormalizationIssueReason,
} from '@/lib/intake/services/draft-normalization-types';
export { DraftNormalizationError } from '@/lib/intake/services/draft-normalization-types';

function formatFamilyMemberLine(member: { name?: string; role?: string }): string {
	const name = str(member.name);
	if (!name) return '';
	const role = str(member.role);
	return role ? `${name} — ${role}` : name;
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
			sectionSubtitle: str(data.sectionSubtitle),
			sectionTitle: str(data.sectionTitle),
			parentsTitle: str(data.parentsTitle),
			godparentsTitle: str(data.godparentsTitle),
			spouseTitle: str(data.spouseTitle),
			spouseRole: str(data.spouseRole),
			childrenTitle: str(data.childrenTitle),
			fatherRole: str(data.fatherRole),
			motherRole: str(data.motherRole),
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

	const normalizedLocation = normalizeLegacyLocation({
		ceremony: mapVenueToDraft(ceremony),
		reception: mapVenueToDraft(reception),
	}) as LocationRecord;
	const venues = Array.isArray(normalizedLocation.venues)
		? normalizedLocation.venues.map((venue, index) => ({
			...venue,
			id: `venue_legacy_${index}`,
		}))
		: [];

	return {
		location: {
			introEyebrow: str(data.introEyebrow),
			introHeading: str(data.introHeading),
			introLede: str(data.introLede),
			indicationsHeading: str(data.indicationsHeading),
			venues,
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
	return {
		gifts: mapGiftsToDraft(data) as DraftContent['gifts'],
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
): { lat: number; lng: number; zoom?: number } | undefined {
	if (venue.coordinates === undefined) return undefined;
	const c = venue.coordinates as Record<string, unknown>;
	const lat = parseCoordinate(c.lat, -90, 90);
	const lng = parseCoordinate(c.lng, -180, 180);
	const zoom = typeof c.zoom === 'number' && c.zoom >= 1 && c.zoom <= 22 ? c.zoom : undefined;
	if (lat !== undefined && lng !== undefined) {
		return { lat, lng, ...(zoom !== undefined ? { zoom } : {}) };
	}
	return undefined;
}

function mapVenueToDraft(
	venue: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(venue)) return undefined;
	const coordinates = buildCoordinates(venue);
	return {
		venueName: str(venue.venueName),
		address: str(venue.address),
		city: str(venue.city),
		...mapVenueDateTimeToDraft(venue),
		...Object.fromEntries(
			VENUE_URL_FIELDS.map((f) => [f, str(venue[f])]).filter(([, v]) => v !== undefined),
		),
		...(venue.image !== undefined ? { image: venue.image } : {}),
		...(coordinates !== undefined ? { coordinates } : {}),
	};
}

// eslint-disable-next-line complexity -- Family field mapping covers many optional fields by design.
function mapFamilyToDraft(
	family: Record<string, unknown>,
): NonNullable<DraftContent['family']> | undefined {
	const parents = family.parents as Record<string, unknown> | undefined;
	const godparentGroupsArr = family.godparentGroups as
		| Array<{
				honoreeName?: string;
				label?: string;
				godparents?: Array<{ name: string; role?: string }>;
		  }>
		| undefined;
	const childrenArr = family.children as Array<{ name: string }> | undefined;
	const labels = family.labels as Record<string, unknown> | undefined;
	const publishedGroups = family.groups as
		Array<{ title: string; items: Array<{ name: string; role?: string }> }> | undefined;
	const result = {
		fatherName: str(parents?.father),
		motherName: str(parents?.mother),
		fatherDeceased: bool(parents?.fatherDeceased),
		motherDeceased: bool(parents?.motherDeceased),
		parentsOrder: (family.parentsOrder ?? parents?.parentsOrder) as ParentsOrder | undefined,
		spouseName: str(family.spouse),
		godparents: formatFamilyMembersAsLines(family.godparents),
		godparentGroups: godparentGroupsArr
			?.filter((g) => g.godparents && g.godparents.length > 0)
			.map((g) => ({
				honoreeName: str(g.honoreeName),
				label: str(g.label),
				names: g.godparents
					?.map((godparent) =>
						godparent.role ? `${godparent.name} — ${godparent.role}` : godparent.name,
					)
					.join('\n'),
			})),
		children: childrenArr?.map((c) => c.name).join('\n'),
		sectionMessage: str(labels?.sectionMessage) || str(family.sectionMessage),
		sectionSubtitle: str(labels?.sectionSubtitle),
		sectionTitle: str(labels?.sectionTitle),
		parentsTitle: str(labels?.parentsTitle),
		godparentsTitle: str(labels?.godparentsTitle),
		spouseTitle: str(labels?.spouseTitle),
		spouseRole: str(labels?.spouseRole),
		childrenTitle: str(labels?.childrenTitle),
		fatherRole: str(labels?.fatherRole),
		motherRole: str(labels?.motherRole),
		visible: typeof family.visible === 'boolean' ? family.visible : undefined,
		presentation: str(family.presentation) as
			NonNullable<DraftContent['family']>['presentation'] | undefined,
		variant: str(family.variant) as
			NonNullable<DraftContent['family']>['variant'] | undefined,
		groups: publishedGroups
			?.filter((g) => g.items && g.items.length > 0)
			.map((g) => ({
				title: str(g.title),
				names: g.items
					.map((item) => formatFamilyMemberLine(item))
					.filter(Boolean)
					.join('\n'),
			})),
	};
	if (family.featuredImage !== undefined)
		(result as Record<string, unknown>).featuredImage = family.featuredImage;
	return result;
}

/**
 * Content keys owned by the published projection. Publish rebuilds them from the
 * invitation record or the prior published revision, so a canonical draft never
 * carries them. Drafts seeded from raw published content before the draft
 * baseline fix still contain them.
 */
const PUBLISHED_ONLY_DRAFT_KEYS = [
	'_assetSlug',
	'isDemo',
	'navigation',
	'sectionStyles',
	'templateId',
	'theme',
	'visualProfileId',
] as const;

/**
 * Published-only fields nested inside otherwise editable draft objects. Publish
 * carries them over from the prior revision, so the draft must not hold them.
 * Prefer section canonicalizers when a field needs semantic remapping; keep this
 * list for genuinely discardable non-editable properties.
 */
const PUBLISHED_ONLY_NESTED_KEYS: ReadonlyArray<{
	section: string;
	object: string;
	keys: readonly string[];
}> = [{ section: 'rsvp', object: 'personalizedAccess', keys: ['noteText'] }];
const PUBLISHED_PARENTS_KEYS = new Set([
	'father',
	'mother',
	'fatherDeceased',
	'motherDeceased',
	'parentsOrder',
]);

export interface DraftCanonicalizationResult {
	content: DraftContent;
	issues: DraftNormalizationIssue[];
	removedPublishedOnlyKeys: string[];
	changed: boolean;
}

function sameValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/** Writes a flat value only when it is absent, and reports genuine conflicts. */
function adoptFlatValue(
	target: Record<string, unknown>,
	key: string,
	value: unknown,
	path: string,
	issues: DraftNormalizationIssue[],
): void {
	if (value === undefined) return;
	const current = target[key];
	if (current === undefined || current === '') {
		target[key] = value;
		return;
	}
	if (!sameValue(current, value)) {
		issues.push({
			path,
			reason: 'conflicting_values',
			detail: 'flat draft value and nested published value differ; resolve manually',
		});
	}
}

function reportUnknownKeys(
	source: Record<string, unknown>,
	known: ReadonlySet<string>,
	path: string,
	issues: DraftNormalizationIssue[],
): void {
	for (const key of Object.keys(source)) {
		if (known.has(key)) continue;
		issues.push({
			path: `${path}.${key}`,
			reason: 'unsupported_shape',
			detail: 'no equivalent field exists in the flat draft contract',
		});
	}
}

/** Flattens a published member list to draft lines, reporting unrepresentable flags. */
function membersToDraftLines(
	members: readonly unknown[],
	path: string,
	issues: DraftNormalizationIssue[],
): string | undefined {
	members.forEach((member, index) => {
		if (isRecord(member) && member.deceased === true) {
			issues.push({
				path: `${path}[${index}].deceased`,
				reason: 'unrepresentable_field',
				detail: 'the flat draft contract cannot express a deceased marker for list members',
			});
		}
	});
	return formatFamilyMembersAsLines(members);
}

function canonicalizeGroupList(
	groups: readonly unknown[],
	nestedKey: 'items' | 'godparents',
	path: string,
	issues: DraftNormalizationIssue[],
): unknown[] {
	return groups.map((group, index) => {
		if (!isRecord(group)) {
			issues.push({
				path: `${path}[${index}]`,
				reason: 'unsupported_shape',
				detail: 'group entry is not an object',
			});
			return group;
		}
		const nested = group[nestedKey];
		if (nested === undefined) return group;

		const next = { ...group };
		delete next[nestedKey];
		if (!Array.isArray(nested)) {
			issues.push({
				path: `${path}[${index}].${nestedKey}`,
				reason: 'unsupported_shape',
				detail: 'expected an array of members',
			});
			return next;
		}
		adoptFlatValue(
			next,
			'names',
			membersToDraftLines(nested, `${path}[${index}].${nestedKey}`, issues),
			`${path}[${index}].names`,
			issues,
		);
		return next;
	});
}

function canonicalizeFamilyDraft(
	family: Record<string, unknown>,
	issues: DraftNormalizationIssue[],
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...family };

	const parents = result.parents;
	if (parents !== undefined) {
		delete result.parents;
		if (isRecord(parents)) {
			adoptFlatValue(result, 'fatherName', str(parents.father), 'family.fatherName', issues);
			adoptFlatValue(result, 'motherName', str(parents.mother), 'family.motherName', issues);
			adoptFlatValue(
				result,
				'fatherDeceased',
				bool(parents.fatherDeceased),
				'family.fatherDeceased',
				issues,
			);
			adoptFlatValue(
				result,
				'motherDeceased',
				bool(parents.motherDeceased),
				'family.motherDeceased',
				issues,
			);
			adoptFlatValue(
				result,
				'parentsOrder',
				str(parents.parentsOrder),
				'family.parentsOrder',
				issues,
			);
			reportUnknownKeys(parents, PUBLISHED_PARENTS_KEYS, 'family.parents', issues);
		} else {
			issues.push({
				path: 'family.parents',
				reason: 'unsupported_shape',
				detail: 'expected an object with father/mother names',
			});
		}
	}

	const labels = result.labels;
	if (labels !== undefined) {
		delete result.labels;
		if (isRecord(labels)) {
			for (const key of FAMILY_LABEL_KEYS) {
				adoptFlatValue(result, key, str(labels[key]), `family.${key}`, issues);
			}
			reportUnknownKeys(labels, new Set(FAMILY_LABEL_KEYS), 'family.labels', issues);
		} else {
			issues.push({
				path: 'family.labels',
				reason: 'unsupported_shape',
				detail: 'expected an object of label strings',
			});
		}
	}

	const spouse = result.spouse;
	if (spouse !== undefined) {
		delete result.spouse;
		if (typeof spouse === 'string') {
			adoptFlatValue(result, 'spouseName', str(spouse), 'family.spouseName', issues);
		} else {
			issues.push({
				path: 'family.spouse',
				reason: 'unsupported_shape',
				detail: 'expected a spouse name string',
			});
		}
	}

	if (result.godparents !== undefined) {
		const lines = formatFamilyMembersAsLines(result.godparents);
		if (lines !== undefined) result.godparents = lines;
		else delete result.godparents;
	}

	if (Array.isArray(result.children)) {
		const names = result.children.map((child, index) => {
			if (typeof child === 'string') return child.trim();
			if (!isRecord(child)) {
				issues.push({
					path: `family.children[${index}]`,
					reason: 'unsupported_shape',
					detail: 'expected a child object with a name',
				});
				return '';
			}
			if (str(child.role)) {
				issues.push({
					path: `family.children[${index}].role`,
					reason: 'unrepresentable_field',
					detail: 'the flat draft contract stores children as names only',
				});
			}
			return typeof child.name === 'string' ? child.name.trim() : '';
		});
		const joined = names.filter(Boolean).join('\n');
		if (joined) result.children = joined;
		else delete result.children;
	}

	if (Array.isArray(result.groups)) {
		result.groups = canonicalizeGroupList(result.groups, 'items', 'family.groups', issues);
	}
	if (Array.isArray(result.godparentGroups)) {
		result.godparentGroups = canonicalizeGroupList(
			result.godparentGroups,
			'godparents',
			'family.godparentGroups',
			issues,
		);
	}

	return result;
}

/**
 * Single canonicalization boundary for persisted drafts.
 *
 * Converts legacy/hybrid drafts (raw published structures persisted as a draft
 * baseline before the seeding fix) into the flat `DraftContent` contract without
 * discarding data: already-flat values win, nested values fill the gaps, and
 * anything the flat contract cannot express is reported instead of dropped.
 * Deterministic and idempotent.
 */
export function canonicalizeDraftContent(
	content: DraftContent | Record<string, unknown>,
): DraftCanonicalizationResult {
	const before = JSON.stringify(content ?? {});
	const result = structuredClone(content) as Record<string, unknown>;
	const issues: DraftNormalizationIssue[] = [];

	const removedPublishedOnlyKeys: string[] = [];
	for (const key of PUBLISHED_ONLY_DRAFT_KEYS) {
		if (result[key] === undefined) continue;
		delete result[key];
		removedPublishedOnlyKeys.push(key);
	}
	for (const { section, object, keys } of PUBLISHED_ONLY_NESTED_KEYS) {
		const sectionValue = result[section];
		if (!isRecord(sectionValue) || !isRecord(sectionValue[object])) continue;
		const nested = { ...sectionValue[object] };
		const removed = keys.filter((key) => nested[key] !== undefined);
		if (removed.length === 0) continue;
		for (const key of removed) delete nested[key];
		result[section] = { ...sectionValue, [object]: nested };
		removedPublishedOnlyKeys.push(...removed.map((key) => `${section}.${object}.${key}`));
	}

	const family = result.family;
	if (isRecord(family)) {
		result.family = canonicalizeFamilyDraft(family, issues);
	}

	const location = result.location;
	if (isRecord(location)) {
		result.location = canonicalizeLocationDraft(location, removedPublishedOnlyKeys);
	}

	const itinerary = result.itinerary;
	if (isRecord(itinerary)) {
		result.itinerary = canonicalizeItineraryDraft(itinerary, issues, removedPublishedOnlyKeys);
	}

	const gifts = result.gifts;
	if (isRecord(gifts)) {
		result.gifts = canonicalizeGiftsDraft(gifts);
	}

	const countdown = result.countdown;
	if (isRecord(countdown)) {
		result.countdown = canonicalizeCountdownDraft(countdown, removedPublishedOnlyKeys);
	}

	const rsvp = result.rsvp;
	if (isRecord(rsvp)) {
		result.rsvp = canonicalizeRsvpDraft(rsvp, removedPublishedOnlyKeys);
	}

	return {
		content: result as DraftContent,
		issues,
		removedPublishedOnlyKeys,
		changed: JSON.stringify(result) !== before,
	};
}

/**
 * Canonical draft normalization used by editor hydration, draft writes, preview
 * and publish. Throws when the draft holds data the flat contract cannot express
 * rather than silently dropping it.
 */
export function normalizeDraftContent(
	content: DraftContent | Record<string, unknown>,
): DraftContent {
	const result = canonicalizeDraftContent(content);
	if (result.issues.length > 0) throw new DraftNormalizationError(result.issues);
	return result.content;
}

// eslint-disable-next-line complexity -- Nested-to-flat mapping covers many field transformations by design.
export function mapNestedToDraftContent(nestedContent: Record<string, unknown>): DraftContent {
	const result: DraftContent = {};

	result.title = str(nestedContent.title);
	result.description = str(nestedContent.description);

	const hero = nestedContent.hero as Record<string, unknown> | undefined;
	if (isNonEmptyObject(hero)) {
		result.hero = {
			name: str(hero.name),
			secondaryName: str(hero.secondaryName),
			label: str(hero.label),
			nickname: str(hero.nickname),
			date: normalizeDate(hero.date),
			variant: str(hero.variant) as NonNullable<DraftContent['hero']>['variant'],
		};
		for (const field of ['presentation', 'focalPoint', 'focalPointMobile', 'focalPointTablet', 'focalPointDesktop'] as const) {
			if (hero[field] !== undefined)
				(result.hero as Record<string, unknown>)[field] = hero[field];
		}
		const HERO_ASSET_FIELDS = [
			'backgroundImage',
			'backgroundImageMobile',
			'backgroundImageDesktop',
			'portrait',
		] as const;
		for (const field of HERO_ASSET_FIELDS) {
			if (hero[field] !== undefined)
				(result.hero as Record<string, unknown>)[field] = hero[field];
		}
	}

	const family = nestedContent.family as Record<string, unknown> | undefined;
	if (isNonEmptyObject(family)) {
		result.family = mapFamilyToDraft(family);
	}

	const location = nestedContent.location as Record<string, unknown> | undefined;
	if (isNonEmptyObject(location)) {
		const publishedIndications = Array.isArray(location.indications)
			? (location.indications as Array<Record<string, unknown>>)
			: [];
		const draftIndications = publishedIndications
			.filter((ind) => str(ind.text))
			.map((ind) => ({
				iconName: ind.iconName as IconName,
				text: str(ind.text) as string,
				...(str(ind.styleVariant) ? { styleVariant: str(ind.styleVariant) } : {}),
			}));

		const canonicalLocation = normalizeLegacyLocation(location) as LocationRecord;
		const draftLocation: Record<string, unknown> = {
			visibility: str(location.visibility),
			presentation: str(location.presentation),
			mapStyle: str(location.mapStyle),
			variant: str(location.variant),
			...(isRecord(location.presentationOptions)
				? { presentationOptions: location.presentationOptions }
				: {}),
			introEyebrow: str(location.introEyebrow),
			introHeading: str(location.introHeading),
			introLede: str(location.introLede),
			indicationsHeading: str(location.indicationsHeading),
			indications: draftIndications.length > 0 ? draftIndications : undefined,
		};

		// Flatten the canonical venues array. An explicit empty array remains empty.
		const publishedVenues = canonicalLocation.venues as Array<Record<string, unknown>>;
		if (Array.isArray(publishedVenues)) {
			draftLocation.venues = publishedVenues.map((v, idx) => ({
				id: str(v.id) || `venue_legacy_${idx}`,
				type: (v.type as string) || 'custom',
				label: str(v.label),
				venueName: str(v.venueName),
				address: str(v.address),
				city: str(v.city),
				...mapVenueDateTimeToDraft(v),
				...Object.fromEntries(
					VENUE_URL_FIELDS.map((f) => [f, str(v[f])]).filter(
						([, val]) => val !== undefined,
					),
				),
				...(v.image !== undefined ? { image: v.image } : {}),
				...(v.coordinates !== undefined
					? { coordinates: buildCoordinates(v as Record<string, unknown>) }
					: {}),
				isVisible: v.isVisible !== false,
			}));
		}

		result.location = draftLocation as DraftContent['location'];
	}

	const countdown = nestedContent.countdown as Record<string, unknown> | undefined;
	if (isNonEmptyObject(countdown)) {
		result.countdown = mapCountdownToDraft(countdown) as DraftContent['countdown'];
	}

	const eventTiming = nestedContent.eventTiming as Record<string, unknown> | undefined;
	if (isNonEmptyObject(eventTiming)) {
		result.eventTiming = {
			localDateTime: str(eventTiming.localDateTime),
			timeZone: str(eventTiming.timeZone),
			startsAtUtc: str(eventTiming.startsAtUtc),
		};
	}

	const rsvp = nestedContent.rsvp as Record<string, unknown> | undefined;
	if (isNonEmptyObject(rsvp)) {
		result.rsvp = mapRsvpToDraft(rsvp) as DraftContent['rsvp'];
	}

	const music = nestedContent.music as Record<string, unknown> | undefined;
	if (isNonEmptyObject(music)) {
		result.music = {
			url: str(music.url),
			title: str(music.title),
			...(typeof music.autoPlay === 'boolean' ? { autoPlay: music.autoPlay } : {}),
		};
	}

	const envelope = nestedContent.envelope as Record<string, unknown> | undefined;
	if (isNonEmptyObject(envelope)) {
		// Start from a copy of the full published envelope so non-editable
		// premium fields (sealVariant, sealStyle, microcopy, closedPalette, etc.)
		// survive the draft round-trip.
		result.envelope = { ...envelope };
		// Re-apply trimming/normalisation for draft-editable fields.
		if (typeof envelope.disabled !== 'boolean') delete result.envelope.disabled;
		for (const field of ENVELOPE_TEXT_FIELDS) {
			const trimmed = trimmedStr(envelope[field]);
			if (trimmed) result.envelope[field] = trimmed;
			else delete result.envelope[field];
		}
	}

	const gifts = nestedContent.gifts as Record<string, unknown> | undefined;
	if (isNonEmptyObject(gifts)) {
		result.gifts = mapGiftsToDraft(gifts) as DraftContent['gifts'];
	}

	const gallery = nestedContent.gallery as Record<string, unknown> | undefined;
	if (isNonEmptyObject(gallery)) {
		result.gallery = gallery as DraftContent['gallery'];
	}

	const itinerary = nestedContent.itinerary as Record<string, unknown> | undefined;
	if (isNonEmptyObject(itinerary)) {
		// Explicit Draft itinerary shape — never spread Published residue.
		result.itinerary = canonicalizeItineraryDraft(itinerary) as DraftContent['itinerary'];
	}

	const quote = nestedContent.quote as Record<string, unknown> | undefined;
	if (isNonEmptyObject(quote)) {
		result.quote = { text: str(quote.text), author: str(quote.author) };
	}

	const thankYou = nestedContent.thankYou as Record<string, unknown> | undefined;
	if (isNonEmptyObject(thankYou)) {
		result.thankYou = {
			variant: str(thankYou.variant) as NonNullable<DraftContent['thankYou']>['variant'],
			message: str(thankYou.message),
			closingName: str(thankYou.closingName),
			closingPhrase: str(thankYou.closingPhrase),
			date: str(thankYou.date),
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
	if (isNonEmptyObject(sharing)) {
		const shareMessages = sharing.shareMessages as Record<string, unknown> | undefined;
		const ogDescription = str(sharing.ogDescription);
		if (isNonEmptyObject(shareMessages)) {
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
			if (!isNonEmptyObject(result.sharing)) {
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
