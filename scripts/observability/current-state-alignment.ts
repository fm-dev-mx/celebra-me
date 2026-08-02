/** Direct current-state evidence for legacy rows without durable baseline provenance. */
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import {
	ASSET_KEY_PREFIX,
	canonicalize,
	RELEASE_SCHEMA_VERSION,
	semanticAssetRef,
} from '../provision/normalized-invitation-release.ts';
import type {
	InvitationDatabaseProjection,
	ManagedAssetProjection,
} from './database-projection.ts';

export interface CurrentSemanticAssetSlot {
	key: string;
	displayName: string;
	mimeType: string;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}

export interface CurrentStateCanonical {
	slug: string;
	managedContent: Record<string, unknown>;
	metadata: {
		eventType: string;
		kind: string;
		baseDemoId: string;
		themeId: string;
		snapshot: Record<string, unknown>;
		clientName: string;
	};
	assets: CurrentSemanticAssetSlot[];
}

export interface CurrentAssetSlotResolution {
	keyById: Map<string, string>;
	missingKeys: string[];
	ambiguousKeys: string[];
}

function signature(asset: {
	displayName: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}): string {
	return canonicalize({
		displayName: asset.displayName,
		mimeType: asset.mimeType,
		width: asset.width,
		height: asset.height,
		fileSize: asset.fileSize,
	});
}

/**
 * Resolves the current asset row for each managed semantic slot. Row IDs are used only locally
 * to rewrite the current draft; the resulting identity is always the semantic slot key.
 */
export function resolveCurrentAssetSlots(
	assets: readonly CurrentSemanticAssetSlot[],
	rows: readonly ManagedAssetProjection[],
): CurrentAssetSlotResolution {
	const available = [...rows];
	const keyById = new Map<string, string>();
	const missingKeys: string[] = [];
	const ambiguousKeys: string[] = [];
	for (const asset of [...assets].sort((left, right) => left.key.localeCompare(right.key))) {
		const keyed = available.filter((row) => row.key === asset.key);
		const matches =
			keyed.length > 0
				? keyed
				: available.filter(
						(row) =>
							row.displayName !== null &&
							row.mimeType !== null &&
							signature(row) === signature(asset),
					);
		if (matches.length === 0) {
			missingKeys.push(asset.key);
			continue;
		}
		if (matches.length !== 1) {
			ambiguousKeys.push(asset.key);
			continue;
		}
		const match = matches[0]!;
		keyById.set(match.id, asset.key);
		available.splice(available.indexOf(match), 1);
	}
	return { keyById, missingKeys, ambiguousKeys };
}

function normalizeCurrentAssetReferences(
	value: unknown,
	keyById: ReadonlyMap<string, string>,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeCurrentAssetReferences(item, keyById));
	}
	if (!value || typeof value !== 'object') return value;
	const record = value as Record<string, unknown>;
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		const directKey = keyById.get(record.assetId);
		const storedKey = record.assetId.startsWith(ASSET_KEY_PREFIX)
			? record.assetId.slice(ASSET_KEY_PREFIX.length)
			: null;
		const key = directKey ?? storedKey;
		if (key && [...keyById.values()].includes(key)) return semanticAssetRef(key);
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, item]) => [
			key,
			normalizeCurrentAssetReferences(item, keyById),
		]),
	);
}

const SEMANTIC_EMPTY_LEGACY_PATHS = new Set([
	'hero.nickname',
	'hero.secondaryName',
	'location.indicationsHeading',
	'thankYou.closingPhrase',
]);

/** Treat omitted optional legacy copy and an explicit empty string as the same semantic value. */
export function normalizeCurrentSemanticContent(value: unknown, path = ''): unknown {
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			normalizeCurrentSemanticContent(item, `${path}[${index}]`),
		);
	}
	if (!value || typeof value !== 'object') return value;
	const record = value as Record<string, unknown>;
	return Object.fromEntries(
		Object.entries(record)
			.filter(([key, item]) => {
				const childPath = path ? `${path}.${key}` : key;
				return !(SEMANTIC_EMPTY_LEGACY_PATHS.has(childPath) && item === '');
			})
			.map(([key, item]) => [
				key,
				normalizeCurrentSemanticContent(item, path ? `${path}.${key}` : key),
			]),
	);
}

function allUploadedReferencesMap(value: unknown, keyById: ReadonlyMap<string, string>): boolean {
	if (Array.isArray(value)) return value.every((item) => allUploadedReferencesMap(item, keyById));
	if (!value || typeof value !== 'object') return true;
	const record = value as Record<string, unknown>;
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		if (keyById.has(record.assetId)) return true;
		const storedKey = record.assetId.startsWith(ASSET_KEY_PREFIX)
			? record.assetId.slice(ASSET_KEY_PREFIX.length)
			: null;
		return Boolean(storedKey && [...keyById.values()].includes(storedKey));
	}
	return Object.values(record).every((item) => allUploadedReferencesMap(item, keyById));
}

function comparisonContent(row: InvitationDatabaseProjection): Record<string, unknown> | null {
	return row.publishedContent ?? row.draftContent;
}

function rowIsCompatible(
	canonical: CurrentStateCanonical,
	row: InvitationDatabaseProjection,
): boolean {
	return Boolean(
		row.slug === canonical.slug &&
		row.metadata.eventType === canonical.metadata.eventType &&
		row.metadata.kind === canonical.metadata.kind &&
		row.metadata.baseDemoId === canonical.metadata.baseDemoId &&
		row.metadata.themeId === canonical.metadata.themeId &&
		row.metadata.clientName === canonical.metadata.clientName &&
		canonicalize(row.metadata.snapshot) === canonicalize(canonical.metadata.snapshot) &&
		row.event.slug === canonical.slug &&
		row.event.eventType === canonical.metadata.eventType &&
		row.metadata.createdBy !== null &&
		row.event.ownerUserId === row.metadata.createdBy &&
		// Current semantic equality can cover missing legacy provenance, never a known incompatible version.
		(row.provenance.releaseSchemaVersion === null ||
			row.provenance.releaseSchemaVersion === RELEASE_SCHEMA_VERSION),
	);
}

/**
 * Proves present-state equality without treating a missing historical checkpoint as a defect.
 * The caller supplies exactly one row from each available environment.
 */
export function proveDirectCurrentAlignment(input: {
	canonical: CurrentStateCanonical;
	rows: readonly InvitationDatabaseProjection[];
}): boolean {
	for (const row of input.rows) {
		if (!row.draftContent || !eventContentSchema.safeParse(row.draftContent).success) {
			return false;
		}
		const targetContent = comparisonContent(row);
		if (!targetContent || !eventContentSchema.safeParse(targetContent).success) {
			return false;
		}
		if (!rowIsCompatible(input.canonical, row)) {
			return false;
		}
		const slots = resolveCurrentAssetSlots(input.canonical.assets, row.managedAssets);
		if (
			slots.ambiguousKeys.length > 0 ||
			slots.missingKeys.length > 0 ||
			!allUploadedReferencesMap(targetContent, slots.keyById)
		) {
			return false;
		}
		const normalized = normalizeCurrentSemanticContent(
			normalizeCurrentAssetReferences(targetContent, slots.keyById),
		);
		const normalizedCanonical = normalizeCurrentSemanticContent(input.canonical.managedContent);
		if (canonicalize(normalized) !== canonicalize(normalizedCanonical)) {
			return false;
		}
	}
	return input.rows.length === 3;
}
