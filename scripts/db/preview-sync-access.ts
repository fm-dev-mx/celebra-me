/**
 * Production → Preview mirror: invitation access state is environment-owned and never
 * copied. After the invitations are mirrored, every mirrored invitation is reset to paid
 * and enabled in Preview, a clean baseline for smoke and visual checks; unpaid and
 * disabled states are exercised with synthetic fixtures instead.
 */
import { runPsql } from './db-workflow-lib.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Upsert paid/enabled rows for the given invitation ids (non-UUID values are dropped). */
export function buildPreviewAccessResetSql(invitationIds: readonly string[]): string | null {
	const ids = [...new Set(invitationIds.filter((id) => UUID_PATTERN.test(id)))];
	if (ids.length === 0) return null;
	const list = ids.map((id) => `'${id.toLowerCase()}'`).join(', ');
	return `insert into public.invitation_access_controls (invitation_id, payment_status, public_access, internal_note)
select i.id, 'paid', 'enabled', null from public.invitations i where i.id = any(array[${list}]::uuid[])
on conflict (invitation_id) do update set
  payment_status = 'paid',
  public_access = 'enabled',
  internal_note = null,
  version = public.invitation_access_controls.version + 1,
  updated_at = now(),
  updated_by = null;`;
}

export interface PreviewAccessResetResult {
	status: 'reset' | 'dry-run' | 'skipped-no-table' | 'nothing-to-reset';
	invitations: number;
}

export function resetPreviewInvitationAccess(input: {
	previewDbUrl: string;
	invitationIds: readonly string[];
	dryRun: boolean;
}): PreviewAccessResetResult {
	const sql = buildPreviewAccessResetSql(input.invitationIds);
	if (!sql) return { status: 'nothing-to-reset', invitations: 0 };
	const invitations = new Set(input.invitationIds).size;
	if (input.dryRun) return { status: 'dry-run', invitations };

	const exists = runPsql(
		"select to_regclass('public.invitation_access_controls') is not null;",
		input.previewDbUrl,
		{ tuplesOnly: true },
	);
	if (exists.stdout.trim() !== 't') return { status: 'skipped-no-table', invitations };

	runPsql(sql, input.previewDbUrl, { tuplesOnly: true });
	return { status: 'reset', invitations };
}
