/** Bounded, read-only evidence for retiring the legacy Preview wedding. */
import { resolveDbUrlForEnv } from './dbs-status.ts';
import { classifyDbTarget } from '../db/db-target-config.ts';
import { runPsqlAsync } from '../status-core/probe-runner.ts';
import { z } from 'zod';

export const PREVIEW_LEGACY_STORAGE_SQL = `select jsonb_build_object(
  'invitations', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'archivedAt', archived_at) order by id), '[]'::jsonb)
    from public.invitations where slug in ('daniela-y-martin', 'boda-daniela-y-martin')),
  'published', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'invitationId', p.invitation_project_id, 'deletedAt', p.deleted_at)
    order by p.id), '[]'::jsonb)
    from public.published_invitation_content p where p.slug in ('daniela-y-martin', 'boda-daniela-y-martin')),
  'assets', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'invitationId', a.invitation_id, 'invitationSlug', i.slug,
    'invitationArchivedAt', i.archived_at,
    'liveDraftReferences', (select count(*) from public.invitation_content_drafts d
      where d.deleted_at is null and strpos(d.content::text, a.id::text) > 0),
    'livePublishedReferences', (select count(*) from public.published_invitation_content p
      where p.deleted_at is null and strpos(p.content::text, a.id::text) > 0)) order by a.id), '[]'::jsonb)
    from (select id, invitation_id from public.invitation_assets
      where provider = 'supabase' and deleted_at is null order by id limit 100) a
    left join public.invitations i on i.id = a.invitation_id),
  'liveSupabaseAssets', (select count(*) from public.invitation_assets
    where provider = 'supabase' and deleted_at is null))::text;`;

const identity = z.object({ id: z.uuid() }).passthrough();
export const previewLegacyStorageSchema = z.object({
	invitations: z.array(identity),
	published: z.array(identity),
	assets: z.array(identity).max(100),
	liveSupabaseAssets: z.number().int().nonnegative().max(100),
});
export const productionLegacyStorageSchema = z.object({
	liveSupabaseAssets: z.number().int().nonnegative(),
	previewInvitationIdMatches: z.number().int().nonnegative(),
	previewPublishedIdMatches: z.number().int().nonnegative(),
	previewAssetIdMatches: z.number().int().nonnegative(),
});
export type PreviewLegacyStorageEvidence = z.infer<typeof previewLegacyStorageSchema>;

function uuidList(rows: readonly { id: string }[]): string {
	if (!rows.length) return 'NULL';
	return rows
		.map(({ id }) => {
			if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
				throw new Error('INVALID_PREVIEW_ID');
			}
			return `'${id}'::uuid`;
		})
		.join(', ');
}

/** Count all live Production Supabase assets and all collisions, including retired rows. */
export function buildProductionLegacyStorageSql(preview: PreviewLegacyStorageEvidence): string {
	return `select jsonb_build_object(
    'liveSupabaseAssets', (select count(*) from public.invitation_assets
      where provider = 'supabase' and deleted_at is null),
    'previewInvitationIdMatches', (select count(*) from public.invitations
      where id in (${uuidList(preview.invitations)})),
    'previewPublishedIdMatches', (select count(*) from public.published_invitation_content
      where id in (${uuidList(preview.published)})),
    'previewAssetIdMatches', (select count(*) from public.invitation_assets
      where id in (${uuidList(preview.assets)})))::text;`;
}

export async function readLegacyStorageEvidence(
	target: 'preview' | 'production',
	sql: string,
): Promise<unknown> {
	const { dbUrl } = resolveDbUrlForEnv(target);
	if (!dbUrl || classifyDbTarget(dbUrl).target !== target)
		throw new Error(`${target}: IDENTITY_OR_CREDENTIALS_REQUIRED`);
	const result = await runPsqlAsync(`begin read only;\n${sql}\nrollback;`, dbUrl, {
		readOnly: true,
		timeoutMs: 15_000,
		tuplesOnly: true,
	});
	if (result.status !== 0) throw new Error(`${target}: LEGACY_STORAGE_AUDIT_UNAVAILABLE`);
	const json = result.stdout.split(/\r?\n/).find((line) => line.trim().startsWith('{'));
	if (!json) throw new Error(`${target}: LEGACY_STORAGE_AUDIT_INVALID`);
	return JSON.parse(json) as unknown;
}
