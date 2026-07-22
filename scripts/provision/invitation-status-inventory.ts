import { runPsql } from '../db/db-workflow-lib.ts';
import { classifyInvitationInventory, type InventoryRow, type InvitationInventoryStatus } from './invitation-status-classification.ts';

export interface FastInventoryResult { verified: boolean; rows: Array<InventoryRow & { status: InvitationInventoryStatus }>; reason?: string; }

function parseRows(stdout: string): InventoryRow[] {
	const start = stdout.indexOf('['); const end = stdout.lastIndexOf(']');
	if (start < 0 || end < start) return [];
	return JSON.parse(stdout.slice(start, end + 1)) as InventoryRow[];
}

/** Read-only target inventory; query failures are intentionally not interpreted as absence. */
export function readFastInvitationInventory(dbUrl: string, definitionSlugs: readonly string[], requestedSlug?: string): FastInventoryResult {
	try {
		const schema = runPsql("select to_regclass('public.managed_invitation_release_provenance') is not null;", dbUrl, { tuplesOnly: true, throwOnError: false });
		if (schema.status !== 0) return { verified: false, rows: [], reason: 'TARGET_QUERY_FAILED' };
		if (schema.stdout.trim().split(/\s+/)[0] !== 't') return { verified: false, rows: [], reason: 'SCHEMA_BLOCKED' };
		const sql = `select coalesce(json_agg(t), '[]'::json) from (select i.slug, i.archived_at as "archivedAt", i.kind, p.invitation_id is not null as "hasProvenance", coalesce(a.asset_count, 0) > 0 as "assetComplete" from public.invitations i left join public.managed_invitation_release_provenance p on p.invitation_id = i.id left join lateral (select count(*) as asset_count from public.invitation_assets ia where ia.invitation_id = i.id and ia.deleted_at is null) a on true) t;`;
		const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
		if (result.status !== 0) return { verified: false, rows: [], reason: 'TARGET_QUERY_FAILED' };
		const allRows = parseRows(result.stdout);
		const filteredRows = requestedSlug ? allRows.filter((r) => r.slug === requestedSlug) : allRows;
		const statuses = classifyInvitationInventory(definitionSlugs, filteredRows);
		return { verified: true, rows: filteredRows.map((row) => ({ ...row, status: statuses.get(row.slug) ?? 'LEGACY_REVIEW_REQUIRED' })) };
	} catch {
		return { verified: false, rows: [], reason: 'TARGET_QUERY_FAILED' };
	}
}
