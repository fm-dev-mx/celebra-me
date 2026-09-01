/**
 * Canonical Location ingress normalization.
 *
 * Published canonical content uses venues[] only. Historical ceremony/reception
 * values are accepted at named ingress boundaries and converted once, in stable
 * ceremony-then-reception order. Mixed representations fail closed.
 *
 * Authorized Ingress/Intake Consumers:
 *   1. `src/lib/invitation/content-resolver.ts` (resolving published DB rows at route ingress)
 *   2. `src/lib/intake/mappers/draft-to-published.mapper.ts` (draft-to-published boundary)
 *   3. `src/lib/intake/services/draft-content-mapper.ts` (draft intake mapping)
 *   4. `src/lib/intake/services/draft-section-mappers.ts` (draft section conversion)
 *
 * Documented Retirement Condition:
 *   When all historical published rows in Preview and Production databases have been migrated
 *   to the canonical `venues[]` schema and no draft intake mappers receive legacy `ceremony`/`reception` objects.
 */

export type LocationRecord = Record<string, unknown>;

export class LocationNormalizationError extends Error {
	readonly code = 'LOCATION_NORMALIZATION_ERROR';

	constructor(message: string) {
		super(message);
		this.name = 'LocationNormalizationError';
	}
}

function isRecord(value: unknown): value is LocationRecord {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasValue(record: LocationRecord, key: string): boolean {
	return record[key] !== undefined && record[key] !== null;
}

type AccessPolicyParts = {
	presentationOptions?: LocationRecord;
	legacyVisibility?: 'public' | 'after-rsvp';
	legacyRevealPlacement?: 'section' | 'rsvp';
	suppliedPolicy?: LocationRecord;
	policyVisibility?: unknown;
	suppliedRevealPlacement?: unknown;
};

function readAccessPolicyParts(location: LocationRecord): AccessPolicyParts {
	const presentationOptions = isRecord(location.presentationOptions)
		? location.presentationOptions
		: undefined;
	const suppliedPolicy = hasValue(location, 'accessPolicy') ? location.accessPolicy : undefined;
	if (suppliedPolicy !== undefined && !isRecord(suppliedPolicy)) {
		throw new LocationNormalizationError(
			'location.accessPolicy must be an object when provided.',
		);
	}
	return {
		presentationOptions,
		legacyVisibility:
			location.visibility === 'after-rsvp' || location.visibility === 'public'
				? location.visibility
				: undefined,
		legacyRevealPlacement:
			presentationOptions?.revealSurface === 'rsvp' ||
			presentationOptions?.revealSurface === 'section'
				? presentationOptions.revealSurface
				: undefined,
		suppliedPolicy,
		policyVisibility: suppliedPolicy?.visibility,
		suppliedRevealPlacement: suppliedPolicy?.revealPlacement,
	};
}

function validateAccessPolicyParts(parts: AccessPolicyParts): void {
	const { suppliedPolicy, policyVisibility, suppliedRevealPlacement } = parts;
	if (
		suppliedPolicy !== undefined &&
		policyVisibility !== 'after-rsvp' &&
		policyVisibility !== 'public'
	) {
		throw new LocationNormalizationError(
			'location.accessPolicy.visibility must be public or after-rsvp.',
		);
	}
	if (
		suppliedRevealPlacement !== undefined &&
		suppliedRevealPlacement !== 'rsvp' &&
		suppliedRevealPlacement !== 'section'
	) {
		throw new LocationNormalizationError(
			'location.accessPolicy.revealPlacement must be section or rsvp.',
		);
	}
	if (
		parts.legacyVisibility !== undefined &&
		policyVisibility !== undefined &&
		parts.legacyVisibility !== policyVisibility
	) {
		throw new LocationNormalizationError(
			'location.visibility conflicts with location.accessPolicy.visibility.',
		);
	}
	if (
		parts.legacyRevealPlacement !== undefined &&
		suppliedRevealPlacement !== undefined &&
		parts.legacyRevealPlacement !== suppliedRevealPlacement
	) {
		throw new LocationNormalizationError(
			'location.presentationOptions.revealSurface conflicts with location.accessPolicy.revealPlacement.',
		);
	}
	const effectiveVisibility =
		policyVisibility === 'public' || policyVisibility === 'after-rsvp'
			? policyVisibility
			: parts.legacyVisibility;
	if (
		effectiveVisibility === 'public' &&
		(suppliedRevealPlacement !== undefined || parts.legacyRevealPlacement !== undefined)
	) {
		throw new LocationNormalizationError(
			'Public locations cannot declare an RSVP reveal placement.',
		);
	}
}

function normalizeLegacyAccessPolicy(location: LocationRecord): LocationRecord {
	const parts = readAccessPolicyParts(location);
	validateAccessPolicyParts(parts);
	if (
		parts.suppliedPolicy !== undefined &&
		parts.legacyVisibility === undefined &&
		parts.legacyRevealPlacement === undefined
	) {
		return location;
	}
	if (
		parts.suppliedPolicy === undefined &&
		parts.legacyVisibility === undefined &&
		parts.legacyRevealPlacement === undefined
	) {
		return location;
	}
	const visibility =
		parts.policyVisibility === 'after-rsvp' || parts.policyVisibility === 'public'
			? parts.policyVisibility
			: parts.legacyVisibility ?? (parts.legacyRevealPlacement ? 'after-rsvp' : 'public');
	const revealPlacement = parts.suppliedRevealPlacement ?? parts.legacyRevealPlacement;
	const {
		visibility: _visibility,
		accessPolicy: _accessPolicy,
		presentationOptions: _presentationOptions,
		...withoutLegacyPolicy
	} = location;
	const { revealSurface: _revealSurface, ...canonicalPresentationOptions } =
		parts.presentationOptions ?? {};
	return {
		...withoutLegacyPolicy,
		accessPolicy: {
			visibility,
			...(revealPlacement ? { revealPlacement } : {}),
		},
		...(Object.keys(canonicalPresentationOptions).length > 0
			? { presentationOptions: canonicalPresentationOptions }
			: {}),
	};
}

function normalizeLegacyVenue(
	value: unknown,
	type: 'ceremony' | 'reception',
): LocationRecord {
	if (!isRecord(value)) {
		throw new LocationNormalizationError(
			`location.${type} must be an object before it can be converted to location.venues[].`,
		);
	}

	return {
		...value,
		type: value.type ?? type,
		venueEvent: value.venueEvent ?? (type === 'ceremony' ? 'Ceremonia' : 'Recepción'),
		isVisible: value.isVisible ?? true,
	};
}

/**
 * Convert one Location object to the canonical venues[] representation.
 * The function is pure and idempotent: canonical input is returned unchanged
 * by value and legacy input is converted without mutating the source object.
 */
export function normalizeLegacyLocation(location: unknown): unknown {
	if (!isRecord(location)) return location;

	const hasVenues = hasValue(location, 'venues');
	if (hasVenues && !Array.isArray(location.venues)) {
		throw new LocationNormalizationError('location.venues must be an array when provided.');
	}

	const legacyKeys = (['ceremony', 'reception'] as const).filter((key) =>
		hasValue(location, key),
	);
	if (hasVenues && legacyKeys.length > 0) {
		throw new LocationNormalizationError(
			`location.venues cannot be combined with ${legacyKeys.map((key) => `location.${key}`).join(' and ')}.`,
		);
	}

	if (hasVenues) return normalizeLegacyAccessPolicy(location);

	const venues = [
		...(hasValue(location, 'ceremony')
			? [normalizeLegacyVenue(location.ceremony, 'ceremony')]
			: []),
		...(hasValue(location, 'reception')
			? [normalizeLegacyVenue(location.reception, 'reception')]
			: []),
	];
	const { ceremony: _ceremony, reception: _reception, ...canonicalLocation } = location;

	return normalizeLegacyAccessPolicy({
		...canonicalLocation,
		venues,
	});
}

/** Normalize a content document while preserving all unrelated top-level fields. */
export function normalizeLegacyLocationInContent(
	content: Record<string, unknown>,
): Record<string, unknown> {
	if (!isRecord(content.location)) return content;
	return {
		...content,
		location: normalizeLegacyLocation(content.location),
	};
}
