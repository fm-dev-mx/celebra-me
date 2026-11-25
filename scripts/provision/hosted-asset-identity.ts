import type { InvitationPackageAsset } from './invitation-package.ts';
import type { UploadedAssetMap } from './invitations/invitation-definition.ts';
import {
	buildR2SocialImageUrl,
	isR2InvitationMediaUrl,
} from '../../src/lib/intake/services/r2-invitation-media.ts';

export interface HostedAssetIdentityRow {
	id: string;
	display_name: string;
	storage_path: string;
	secure_url?: string | null;
	bucket?: string | null;
	deleted_at?: string | null;
	managed_by_definition_slug?: string | null;
	managed_source_key?: string | null;
}

export function uniqueHostedAssetIdentityRows(
	candidateRows: readonly HostedAssetIdentityRow[],
): HostedAssetIdentityRow[] {
	return [...new Map(candidateRows.map((row) => [row.id, row])).values()];
}

export function throwAmbiguousHostedAssetIdentity(displayName: string): never {
	throw new Error(
		`La identidad del archivo "${displayName}" no se puede resolver de forma unívoca en el destino; no se reutilizará una fila arbitraria.`,
	);
}

export function hasHostedAssetBucketParity(
	row: HostedAssetIdentityRow,
	asset: Pick<InvitationPackageAsset, 'bucket'>,
): boolean {
	return typeof row.bucket !== 'string' || row.bucket === asset.bucket;
}

/**
 * Reuse a live managed row by its canonical definition identity before falling
 * back to path or display name. Path matching requires bucket parity (a null
 * row bucket matches any bucket). If none, reuse a soft-deleted row with the
 * same (bucket, storage_path) so ON CONFLICT (id) can undelete it.
 * Display-name matching ignores deleted rows to avoid colliding with a live alias.
 */
export function selectHostedAssetIdentityRow(input: {
	asset: Pick<InvitationPackageAsset, 'key' | 'displayName' | 'storagePath' | 'bucket'>;
	rows: readonly HostedAssetIdentityRow[];
	definitionSlug: string;
	preferredAssetIds?: ReadonlySet<string>;
}): HostedAssetIdentityRow | null {
	const liveRows = input.rows.filter((row) => row.deleted_at == null);
	const managedMatches = liveRows.filter(
		(row) =>
			row.managed_by_definition_slug === input.definitionSlug &&
			row.managed_source_key === input.asset.key,
	);
	if (managedMatches.length > 1) {
		throwAmbiguousHostedAssetIdentity(input.asset.displayName);
	}
	if (managedMatches[0]) return managedMatches[0];

	const byPath = new Map<string, HostedAssetIdentityRow[]>();
	const byDisplayName = new Map<string, HostedAssetIdentityRow[]>();
	for (const row of liveRows) {
		const pathRows = byPath.get(row.storage_path) ?? [];
		pathRows.push(row);
		byPath.set(row.storage_path, pathRows);
		const displayRows = byDisplayName.get(row.display_name) ?? [];
		displayRows.push(row);
		byDisplayName.set(row.display_name, displayRows);
	}
	const candidates = uniqueHostedAssetIdentityRows([
		...(byPath.get(input.asset.storagePath) ?? []).filter((row) =>
			hasHostedAssetBucketParity(row, input.asset),
		),
		...(byDisplayName.get(input.asset.displayName) ?? []),
	]);
	const preferredAssetIds = input.preferredAssetIds ?? new Set<string>();
	const preferred = candidates.filter((row) => preferredAssetIds.has(row.id));
	if (preferred.length === 1) return preferred[0]!;
	if (preferred.length > 1 || candidates.length > 1) {
		throwAmbiguousHostedAssetIdentity(input.asset.displayName);
	}
	if (candidates[0]) return candidates[0];

	const deletedPathMatches = uniqueHostedAssetIdentityRows(
		input.rows.filter(
			(row) =>
				row.deleted_at != null &&
				row.storage_path === input.asset.storagePath &&
				hasHostedAssetBucketParity(row, input.asset),
		),
	);
	if (deletedPathMatches.length > 1) {
		throwAmbiguousHostedAssetIdentity(input.asset.displayName);
	}
	return deletedPathMatches[0] ?? null;
}

export function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

/**
 * Delivery src for a hosted uploaded ref. R2 package assets must never
 * rematerialize to a Supabase Storage URL.
 */
export function resolveHostedUploadedAssetSrc(
	asset: InvitationPackageAsset,
	existingRecord: HostedAssetIdentityRow | null,
	targetStorageUrl: string,
): string {
	if (asset.provider === 'r2') {
		const persisted = existingRecord?.secure_url?.trim();
		if (persisted && isHttpUrl(persisted)) return persisted;
		const packaged = asset.secureUrl?.trim();
		if (packaged && isHttpUrl(packaged)) return packaged;
		throw new Error(`R2 package asset "${asset.key}" is missing secureUrl.`);
	}
	const storagePath = existingRecord?.storage_path ?? asset.storagePath;
	return `${targetStorageUrl}/${storagePath}`;
}

export function rewriteUploadedDeliverySrcs(
	value: unknown,
	assetRefs: UploadedAssetMap,
	parentKey?: string,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => rewriteUploadedDeliverySrcs(item, assetRefs, parentKey));
	}
	if (value === null || typeof value !== 'object') return value;
	const record = value as Record<string, unknown>;
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		const ref = Object.values(assetRefs).find(
			(candidate) => candidate.assetId === record.assetId,
		);
		if (!ref) return record;
		const src =
			parentKey === 'ogImage' && isR2InvitationMediaUrl(ref.src)
				? buildR2SocialImageUrl(ref.src)
				: ref.src;
		return { ...record, src };
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, item]) => [
			key,
			rewriteUploadedDeliverySrcs(item, assetRefs, key),
		]),
	);
}

export function applyUploadedSecureUrlsToRefs(
	assetRefs: UploadedAssetMap,
	assets: InvitationPackageAsset[],
): void {
	for (const asset of assets) {
		const ref = assetRefs[asset.key];
		if (!ref || !asset.secureUrl || !isHttpUrl(asset.secureUrl)) continue;
		assetRefs[asset.key] = { ...ref, src: asset.secureUrl };
	}
}
