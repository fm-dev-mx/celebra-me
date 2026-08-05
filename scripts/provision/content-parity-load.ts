import { getProdDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles, LOCAL_DB_URL } from '../db/db-guard.ts';
import {
	buildSemanticInvitationSnapshot,
	type ContentParityEnvironment,
	type SemanticInvitationSnapshot,
} from './content-parity.ts';

export interface AssetInventoryRow {
	id: string;
	managedSourceKey: string | null;
	displayName: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}

export interface LoadedSnapshot {
	snapshot: SemanticInvitationSnapshot;
	assets: AssetInventoryRow[];
	referencedAssetPaths: ReadonlyMap<string, string[]>;
}

export function resolveDbUrl(env: ContentParityEnvironment): string | null {
	if (env === 'local') {
		return process.env.LOCAL_DB_URL?.trim() || LOCAL_DB_URL;
	}
	if (env === 'preview') {
		const url = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		return url.trim() || null;
	}
	try {
		return getProdDbUrl().url;
	} catch {
		return process.env.PROD_DB_URL?.trim() || null;
	}
}

function queryJson(dbUrl: string, sql: string): unknown {
	const result = runPsql(`select row_to_json(t) from (${sql}) t;`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const text = result.stdout.trim();
	if (!text) return null;
	return JSON.parse(text) as unknown;
}

function queryJsonArray(dbUrl: string, sql: string): unknown[] {
	const result = runPsql(`select coalesce(json_agg(t), '[]'::json) from (${sql}) t;`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const text = result.stdout.trim();
	if (!text) return [];
	const parsed = JSON.parse(text) as unknown;
	return Array.isArray(parsed) ? parsed : [];
}

export function collectAssetReferencePaths(...values: unknown[]): ReadonlyMap<string, string[]> {
	const references = new Map<string, string[]>();
	const walk = (current: unknown, currentPath: string): void => {
		if (Array.isArray(current)) {
			current.forEach((item, index) => walk(item, `${currentPath}[${index}]`));
			return;
		}
		if (!current || typeof current !== 'object') return;
		const record = current as Record<string, unknown>;
		if (record.type === 'uploaded' && typeof record.assetId === 'string') {
			const assetId = record.assetId;
			const path = currentPath || '$';
			const existing = references.get(assetId) ?? [];
			if (!existing.includes(path)) existing.push(path);
			references.set(assetId, existing);
			return;
		}
		for (const [key, child] of Object.entries(record)) {
			walk(child, currentPath ? `${currentPath}.${key}` : key);
		}
	};
	for (const value of values) walk(value, '');
	return references;
}

interface LoadSnapshotOptions {
	warnOnMissing?: boolean;
}

export function loadSemanticParitySnapshot(
	env: ContentParityEnvironment,
	slug: string,
	eventType: string,
	assetInventory: boolean,
	options: LoadSnapshotOptions = {},
): LoadedSnapshot | null {
	const { warnOnMissing = true } = options;
	const dbUrl = resolveDbUrl(env);
	if (!dbUrl) {
		if (warnOnMissing) {
			console.warn(`[${env}] skipped: database URL not configured`);
		}
		return null;
	}

	const matchingRows = queryJsonArray(
		dbUrl,
		`select id, slug, event_type, kind, base_demo_id, theme_id, snapshot
		 from public.invitations
		 where slug = ${sqlLiteral(slug)}
		   and event_type = ${sqlLiteral(eventType)}
		   and archived_at is null`,
	) as Array<{
		id: string;
		slug: string;
		event_type: string;
		kind: string;
		base_demo_id?: string | null;
		theme_id?: string | null;
		snapshot?: unknown;
	}>;

	if (matchingRows.length === 0) {
		if (warnOnMissing) {
			console.warn(`[${env}] NOT_PRESENT: no invitation found for ${eventType}/${slug}`);
		}
		return null;
	}

	if (matchingRows.length > 1) {
		const matchingIds = matchingRows.map((r) => r.id);
		console.error(
			`[${env}] IDENTITY_CONFLICT: ${matchingRows.length} active invitations found for ${eventType}/${slug}.`,
		);
		return {
			snapshot: {
				slug,
				eventType,
				kind: 'conflict',
				baseDemoId: null,
				themeId: null,
				snapshot: null,
				draftContent: null,
				publishedContent: null,
				isDemo: false,
				assets: [],
				eventProjection: null,
				identityConflict: true,
				matchingIds,
			},
			assets: [],
			referencedAssetPaths: new Map(),
		};
	}

	const invitation = matchingRows[0]!;

	const invitationIdSql = `${sqlLiteral(invitation.id)}::uuid`;

	const draft = queryJson(
		dbUrl,
		`select content
		 from public.invitation_content_drafts
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 order by updated_at desc
		 limit 1`,
	) as { content?: unknown } | null;

	const published = queryJson(
		dbUrl,
		`select content, is_demo
		 from public.published_invitation_content
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 order by version desc
		 limit 1`,
	) as {
		content?: unknown;
		is_demo?: boolean;
	} | null;

	const assets = queryJsonArray(
		dbUrl,
		`select id, managed_source_key, display_name, sha256, mime_type, width, height, file_size
		 from public.invitation_assets
		 where invitation_id = ${invitationIdSql}
		   and deleted_at is null`,
	) as Array<{
		id: string;
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
		mime_type?: string | null;
		width?: number | null;
		height?: number | null;
		file_size?: number | null;
	}>;

	const event = queryJson(
		dbUrl,
		`select slug, event_type
		 from public.events
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 limit 1`,
	) as { slug?: string; event_type?: string } | null;

	return {
		snapshot: buildSemanticInvitationSnapshot({
			invitation,
			draftContent: draft?.content ?? null,
			published,
			assets,
			event,
		}),
		assets: assetInventory
			? assets.map((asset) => ({
					id: asset.id,
					managedSourceKey: asset.managed_source_key ?? null,
					displayName: asset.display_name ?? null,
					mimeType: asset.mime_type ?? null,
					width: asset.width ?? null,
					height: asset.height ?? null,
					fileSize: asset.file_size ?? null,
				}))
			: [],
		referencedAssetPaths: assetInventory
			? collectAssetReferencePaths(draft?.content ?? null, published?.content ?? null)
			: new Map(),
	};
}

export function loadSemanticSnapshotsForParity(opts: {
	slug: string;
	eventType: string;
	envs: ContentParityEnvironment[];
}): Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>> {
	const snapshots: Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>> = {};
	for (const env of opts.envs) {
		const loaded = loadSemanticParitySnapshot(env, opts.slug, opts.eventType, false, {
			warnOnMissing: false,
		});
		if (loaded) {
			snapshots[env] = loaded.snapshot;
		}
	}
	return snapshots;
}
