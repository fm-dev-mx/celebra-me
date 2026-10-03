/**
 * Read-only census of the shapes a persisted invitation document actually carries.
 *
 * Answers "does any stored document still use this value?" before a schema value, an asset
 * namespace or a compatibility reader is removed. Pure: it never reads or writes a database.
 */
import { isAssetRegistryKey } from '../../src/lib/assets/asset-keys.ts';
import { UUID_PATTERN } from '../../src/lib/intake/constants.ts';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';

type JsonRecord = Record<string, unknown>;

const VARIANT_SECTIONS = [
	'hero',
	'family',
	'location',
	'itinerary',
	'gallery',
	'gifts',
	'rsvp',
	'thankYou',
	'countdown',
] as const;

const ENVELOPE_SELECTORS = [
	'variant',
	'revealVariant',
	'sealStyle',
	'sealIcon',
	'sealVariant',
] as const;

/** Key names that only exist in superseded document shapes, wherever they appear. */
const SUPERSEDED_KEYS = new Set([
	'sectionStyles',
	'structuralVariant',
	'visualVariant',
	'whatsappWithPhone',
	'whatsappWithoutPhone',
	'subtitlePrefix',
	'tableNumber',
	'accountNumber',
]);

const ASSET_TYPES = new Set(['internal', 'external', 'uploaded']);
const ASSET_FIELD_PATTERN = /image|portrait|background|photo/iu;
const MAX_STRICT_PARSE_ISSUES = 12;

/** Mirrors the string forms the canonical asset schema still expands into a reference. */
function isAssetShorthand(value: string): boolean {
	return (
		isAssetRegistryKey(value) ||
		value.startsWith('https://') ||
		value.startsWith('/') ||
		UUID_PATTERN.test(value)
	);
}

export interface ContentAssetUsage {
	internal: number;
	external: number;
	uploaded: number;
	/** Bare strings in an asset field: the shorthand the schema preprocess still expands. */
	shorthand: number;
	internalKeys: string[];
	shorthandPaths: string[];
}

export interface ContentUsageSummary {
	themePreset: string | null;
	assetSlug: string | null;
	visualProfileId: string | null;
	isDemo: boolean | null;
	sectionOrder: string[];
	/** Section or envelope selector → stored value. */
	variants: Record<string, string>;
	assets: ContentAssetUsage;
	/** Superseded shape → JSON paths where the document still carries it. */
	supersededShapes: Record<string, string[]>;
	/** Stored presentation facts that later removals depend on. */
	facts: Record<string, string | number | boolean>;
	/** Canonical schema result with no compatibility normalizer applied. */
	strictParse: { ok: boolean; issues: string[] };
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function record(parent: JsonRecord, key: string): JsonRecord | null {
	const value = parent[key];
	return isRecord(value) ? value : null;
}

function addShape(shapes: Record<string, string[]>, shape: string, path: string): void {
	(shapes[shape] ??= []).push(path);
}

function isAssetReference(value: JsonRecord): boolean {
	return typeof value.type === 'string' && ASSET_TYPES.has(value.type);
}

function walk(
	value: unknown,
	path: string,
	assets: ContentAssetUsage,
	shapes: Record<string, string[]>,
): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, `${path}[${index}]`, assets, shapes));
		return;
	}
	if (!isRecord(value)) return;

	if (isAssetReference(value)) {
		const type = value.type as 'internal' | 'external' | 'uploaded';
		assets[type] += 1;
		if (type === 'internal' && typeof value.key === 'string') {
			assets.internalKeys.push(value.key);
		}
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		const childPath = path ? `${path}.${key}` : key;
		if (SUPERSEDED_KEYS.has(key)) addShape(shapes, key, childPath);
		if (typeof child === 'string' && ASSET_FIELD_PATTERN.test(key) && isAssetShorthand(child)) {
			assets.shorthand += 1;
			assets.shorthandPaths.push(childPath);
			continue;
		}
		walk(child, childPath, assets, shapes);
	}
}

function collectVariants(content: JsonRecord): Record<string, string> {
	const variants: Record<string, string> = {};
	for (const section of VARIANT_SECTIONS) {
		const variant = text(record(content, section)?.variant);
		if (variant) variants[section] = variant;
	}
	const rsvp = record(content, 'rsvp');
	const access = rsvp ? text(record(rsvp, 'personalizedAccess')?.variant) : null;
	if (access) variants.personalizedAccess = access;

	const envelope = record(content, 'envelope');
	for (const selector of ENVELOPE_SELECTORS) {
		const stored = envelope ? text(envelope[selector]) : null;
		if (stored) variants[`envelope.${selector}`] = stored;
	}
	return variants;
}

function collectLocationShapes(content: JsonRecord, shapes: Record<string, string[]>): void {
	const location = record(content, 'location');
	if (!location) return;
	for (const key of ['ceremony', 'reception', 'visibility'] as const) {
		if (location[key] !== undefined) addShape(shapes, `location.${key}`, `location.${key}`);
	}
	if (record(location, 'presentationOptions')?.revealSurface !== undefined) {
		addShape(
			shapes,
			'location.presentationOptions.revealSurface',
			'location.presentationOptions.revealSurface',
		);
	}
	const venues = Array.isArray(location.venues) ? location.venues : [];
	venues.forEach((venue, index) => {
		if (!isRecord(venue)) return;
		if (venue.eventType !== undefined) {
			addShape(shapes, 'location.venues[].eventType', `location.venues[${index}].eventType`);
		}
		if (typeof venue.id === 'string' && venue.id.startsWith('venue_legacy_')) {
			addShape(shapes, 'location.venues[].id=venue_legacy_*', `location.venues[${index}].id`);
		}
	});
}

function collectTopLevelShapes(content: JsonRecord, shapes: Record<string, string[]>): void {
	for (const key of ['templateId', '_mediaFallback', '_mediaFallbackNote'] as const) {
		if (content[key] !== undefined) addShape(shapes, key, key);
	}
	if (record(content, 'theme')?.fontFamily !== undefined) {
		addShape(shapes, 'theme.fontFamily', 'theme.fontFamily');
	}
	if (record(content, 'rsvp')?.confirmationDeadline !== undefined) {
		addShape(shapes, 'rsvp.confirmationDeadline', 'rsvp.confirmationDeadline');
	}
	const quote = record(content, 'quote');
	if (quote && quote.text === '') addShape(shapes, 'quote.text=""', 'quote.text');

	const items = record(content, 'gifts')?.items;
	if (Array.isArray(items)) {
		items.forEach((item, index) => {
			if (isRecord(item) && typeof item.url === 'string' && !Array.isArray(item.links)) {
				addShape(shapes, 'gifts.items[].url', `gifts.items[${index}].url`);
			}
		});
	}
}

function collectFacts(content: JsonRecord): Record<string, string | number | boolean> {
	const facts: Record<string, string | number | boolean> = {};
	const hero = record(content, 'hero');
	const presentation = hero ? record(hero, 'presentation') : null;
	if (hero) {
		facts['hero.portrait'] = hero.portrait !== undefined;
		if (typeof hero.date === 'string') facts['hero.date'] = hero.date;
	}
	if (presentation) {
		if (typeof presentation.venueIndex === 'number') {
			facts['hero.presentation.venueIndex'] = presentation.venueIndex;
		}
		if (typeof presentation.portraitEnabled === 'boolean') {
			facts['hero.presentation.portraitEnabled'] = presentation.portraitEnabled;
		}
	}
	facts.eventTiming = content.eventTiming !== undefined;
	const accessPolicy = record(content, 'location')
		? record(record(content, 'location') as JsonRecord, 'accessPolicy')
		: null;
	facts['location.accessPolicy'] = accessPolicy !== null;
	return facts;
}

function strictParse(content: JsonRecord): ContentUsageSummary['strictParse'] {
	const parsed = eventContentSchema.safeParse(content);
	if (parsed.success) return { ok: true, issues: [] };
	return {
		ok: false,
		issues: parsed.error.issues
			.slice(0, MAX_STRICT_PARSE_ISSUES)
			.map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`),
	};
}

export function summarizeContentUsage(content: JsonRecord): ContentUsageSummary {
	const assets: ContentAssetUsage = {
		internal: 0,
		external: 0,
		uploaded: 0,
		shorthand: 0,
		internalKeys: [],
		shorthandPaths: [],
	};
	const supersededShapes: Record<string, string[]> = {};
	walk(content, '', assets, supersededShapes);
	collectTopLevelShapes(content, supersededShapes);
	collectLocationShapes(content, supersededShapes);
	assets.internalKeys = [...new Set(assets.internalKeys)].sort();

	return {
		themePreset: text(record(content, 'theme')?.preset),
		assetSlug: text(content._assetSlug),
		visualProfileId: text(content.visualProfileId),
		isDemo: typeof content.isDemo === 'boolean' ? content.isDemo : null,
		sectionOrder: Array.isArray(content.sectionOrder)
			? content.sectionOrder.filter((item): item is string => typeof item === 'string')
			: [],
		variants: collectVariants(content),
		assets,
		supersededShapes,
		facts: collectFacts(content),
		strictParse: strictParse(content),
	};
}
