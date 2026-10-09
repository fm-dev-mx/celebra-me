/** Read-only access to the current draft and published invitation documents. */
import {
	getProdDbUrl,
	LOCAL_DB_URL,
	requirePreviewDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';

export type PersistedContentTarget = 'local' | 'preview' | 'production';
type JsonRecord = Record<string, unknown>;

export interface PersistedInvitationContent {
	draft: { content: JsonRecord | null; status: string | null; updatedAt: string | null };
	published: { content: JsonRecord | null; version: number | null };
}

export function resolveTargetDbUrl(target: PersistedContentTarget): string {
	if (target === 'production') return getProdDbUrl().url;
	if (target === 'preview') return requirePreviewDbUrl().url;
	return LOCAL_DB_URL;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePsqlJson(stdout: string): unknown {
	const text = stdout.trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	return start < 0 || end < start ? null : (JSON.parse(text.slice(start, end + 1)) as unknown);
}

function buildStateSql(slug: string): string {
	const literal = sqlLiteral(slug);
	return `SELECT jsonb_build_object(
  'draft', (SELECT jsonb_build_object('content', d.content, 'status', d.status, 'updatedAt', d.updated_at)
              FROM public.invitation_content_drafts d
              JOIN public.invitations i ON i.id = d.invitation_project_id
             WHERE i.slug = ${literal} AND i.archived_at IS NULL AND d.deleted_at IS NULL
             ORDER BY d.updated_at DESC LIMIT 1),
  'published', (SELECT jsonb_build_object('content', p.content, 'version', p.version)
                  FROM public.published_invitation_content p
                  JOIN public.invitations i ON i.id = p.invitation_project_id
                 WHERE i.slug = ${literal} AND i.archived_at IS NULL AND p.deleted_at IS NULL
                 ORDER BY p.version DESC, p.created_at DESC LIMIT 1))::text;`;
}

export function listDraftInvitationSlugs(dbUrl: string): string[] {
	const result = runPsql(
		`SELECT COALESCE(jsonb_agg(slug ORDER BY slug), '[]'::jsonb)::text
FROM (
  SELECT DISTINCT i.slug
    FROM public.invitation_content_drafts d
    JOIN public.invitations i ON i.id = d.invitation_project_id
   WHERE i.archived_at IS NULL AND d.deleted_at IS NULL AND i.slug IS NOT NULL
) q;`,
		dbUrl,
		{
			tuplesOnly: true,
			throwOnError: false,
			timeoutMs: 60_000,
			env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`DRAFT_SLUG_LIST_FAILED: ${result.stderr?.trim() || result.stdout?.trim() || 'psql failed'}`,
		);
	}
	const text = result.stdout.trim();
	const start = text.indexOf('[');
	const end = text.lastIndexOf(']');
	if (start < 0 || end < start) return [];
	const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
	return Array.isArray(parsed)
		? parsed.filter((value): value is string => typeof value === 'string')
		: [];
}

export interface PersistedInvitationRow {
	slug: string;
	kind: string | null;
	baseDemoId: string | null;
	themeId: string | null;
	snapshotPreviewSlug: string | null;
	hasSourceInvitation: boolean;
}

/** Active invitation rows with the identity columns the preset catalog still feeds. */
export function listPersistedInvitationRows(dbUrl: string): PersistedInvitationRow[] {
	const result = runPsql(
		`SELECT COALESCE(jsonb_agg(row ORDER BY row->>'slug'), '[]'::jsonb)::text
FROM (
  SELECT jsonb_build_object(
           'slug', i.slug,
           'kind', i.kind,
           'baseDemoId', i.base_demo_id,
           'themeId', i.theme_id,
           'snapshotPreviewSlug', i.snapshot->>'previewSlug',
           'hasSourceInvitation', i.source_invitation_id IS NOT NULL) AS row
    FROM public.invitations i
   WHERE i.archived_at IS NULL AND i.slug IS NOT NULL
) q;`,
		dbUrl,
		{
			tuplesOnly: true,
			throwOnError: false,
			timeoutMs: 60_000,
			env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`INVITATION_ROW_LIST_FAILED: ${result.stderr?.trim() || result.stdout?.trim() || 'psql failed'}`,
		);
	}
	const text = result.stdout.trim();
	const start = text.indexOf('[');
	const end = text.lastIndexOf(']');
	if (start < 0 || end < start) return [];
	const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
	if (!Array.isArray(parsed)) return [];
	return parsed.filter(isRecord).map((row) => ({
		slug: String(row.slug),
		kind: typeof row.kind === 'string' ? row.kind : null,
		baseDemoId: typeof row.baseDemoId === 'string' ? row.baseDemoId : null,
		themeId: typeof row.themeId === 'string' ? row.themeId : null,
		snapshotPreviewSlug:
			typeof row.snapshotPreviewSlug === 'string' ? row.snapshotPreviewSlug : null,
		hasSourceInvitation: row.hasSourceInvitation === true,
	}));
}

export function readPersistedInvitationContent(
	slug: string,
	dbUrl: string,
): PersistedInvitationContent | null {
	const result = runPsql(buildStateSql(slug), dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs: 30_000,
		env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
	});
	if (result.status !== 0) return null;
	const parsed = parsePsqlJson(result.stdout);
	if (!isRecord(parsed) || !isRecord(parsed.draft) || !isRecord(parsed.published)) return null;
	return {
		draft: {
			content: isRecord(parsed.draft.content) ? parsed.draft.content : null,
			status: typeof parsed.draft.status === 'string' ? parsed.draft.status : null,
			updatedAt: typeof parsed.draft.updatedAt === 'string' ? parsed.draft.updatedAt : null,
		},
		published: {
			content: isRecord(parsed.published.content) ? parsed.published.content : null,
			version: typeof parsed.published.version === 'number' ? parsed.published.version : null,
		},
	};
}
