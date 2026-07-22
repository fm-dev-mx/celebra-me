export type InvitationInventoryStatus = 'MANAGED' | 'UNAPPLIED_DEFINITION' | 'LEGACY_REVIEW_REQUIRED' | 'LEGACY_CONFLICTED' | 'LEGACY_ASSET_INCOMPLETE' | 'ARCHIVED' | 'DEMO' | 'NOT_PRESENT';

export interface InventoryRow { slug: string; archivedAt?: string | null; kind?: string | null; hasProvenance?: boolean; assetComplete?: boolean; }

/** Pure read-only inventory policy. Only MANAGED/UNAPPLIED_DEFINITION rows match a definition. */
export function classifyInvitationInventory(definitionSlugs: readonly string[], rows: readonly InventoryRow[]): Map<string, InvitationInventoryStatus> {
	const result = new Map<string, InvitationInventoryStatus>();
	for (const slug of definitionSlugs) {
		const matches = rows.filter((row) => row.slug === slug && !row.archivedAt);
		if (matches.length === 0) result.set(slug, 'NOT_PRESENT');
		else if (matches.length > 1) result.set(slug, 'LEGACY_CONFLICTED');
		else result.set(slug, matches[0]!.hasProvenance ? 'MANAGED' : 'UNAPPLIED_DEFINITION');
	}
	for (const row of rows) {
		if (definitionSlugs.includes(row.slug)) continue;
		result.set(row.slug, row.archivedAt ? 'ARCHIVED' : row.kind === 'demo' ? 'DEMO' : row.assetComplete === false ? 'LEGACY_ASSET_INCOMPLETE' : 'LEGACY_REVIEW_REQUIRED');
	}
	return result;
}
