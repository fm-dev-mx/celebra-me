/** Read-only access to the current draft and published invitation documents. */
import {
	getPreviewDbUrl,
	getProdDbUrl,
	LOCAL_DB_URL,
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
	if (target === 'preview') return getPreviewDbUrl().url;
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
