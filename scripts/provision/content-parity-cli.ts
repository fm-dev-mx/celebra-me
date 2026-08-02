/**
 * content-parity-cli.ts — Read-only cross-environment semantic content parity.
 *
 * Usage:
 *   pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production]
 *
 * This command never mutates any database. Credential presence and runtime target do not
 * authorize Preview/Production writes.
 */

import { getProdDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles, LOCAL_DB_URL } from '../db/db-guard.ts';
import {
	buildSemanticInvitationSnapshot,
	compareAcrossEnvironments,
	listSemanticDifferencePaths,
	type ContentParityEnvironment,
	type SemanticInvitationSnapshot,
} from './content-parity.ts';

interface CliOptions {
	slug: string;
	eventType: string;
	envs: ContentParityEnvironment[];
	paths: boolean;
	assetInventory: boolean;
}

interface AssetInventoryRow {
	id: string;
	managedSourceKey: string | null;
	displayName: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}

interface LoadedSnapshot {
	snapshot: SemanticInvitationSnapshot;
	assets: AssetInventoryRow[];
	referencedAssetPaths: ReadonlyMap<string, string[]>;
}

function parseArgs(argv: string[]): CliOptions {
	let slug = '';
	let eventType = '';
	let envs: ContentParityEnvironment[] = ['local', 'preview', 'production'];
	let paths = false;
	let assetInventory = false;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--slug') slug = String(argv[++i] || '').trim();
		else if (arg === '--event-type') eventType = String(argv[++i] || '').trim();
		else if (arg === '--envs' || arg.startsWith('--envs=')) {
			const envArgument =
				arg === '--envs' ? String(argv[++i] || '') : arg.slice('--envs='.length);
			envs = envArgument
				.split(/[\s,]+/)
				.map((part) => part.trim())
				.filter(Boolean) as ContentParityEnvironment[];
		} else if (arg === '--paths') {
			paths = true;
		} else if (arg === '--asset-inventory') {
			assetInventory = true;
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
	}

	if (!slug || !eventType) {
		printHelp();
		process.exit(1);
	}

	const allowed: ContentParityEnvironment[] = ['local', 'preview', 'production'];
	for (const env of envs) {
		if (!allowed.includes(env)) {
			console.error(`Unknown environment "${env}". Allowed: ${allowed.join(', ')}`);
			process.exit(1);
		}
	}
	if (envs.length < 2) {
		console.error('Provide at least two environments via --envs.');
		process.exit(1);
	}

	return { slug, eventType, envs, paths, assetInventory };
}

function printHelp(): void {
	console.info(`Read-only semantic invitation content parity.

Usage:
  pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production] [--paths] [--asset-inventory]

Compares invitation-facing semantic state only. Never reads or compares guests, claims,
Auth, intake, analytics, or commercial tables. Never mutates any target.
Use --paths to list normalized semantic locations only; it never prints field values, IDs, URLs, or hashes.
Use --asset-inventory to list current asset candidates with normalized metadata and content-reference paths only.

See docs/core/content-parity-rsvp-isolation.md.`);
}

function resolveDbUrl(env: ContentParityEnvironment): string | null {
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

function collectAssetReferencePaths(...values: unknown[]): ReadonlyMap<string, string[]> {
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

function loadSnapshot(
	env: ContentParityEnvironment,
	slug: string,
	eventType: string,
	assetInventory: boolean,
): LoadedSnapshot | null {
	const dbUrl = resolveDbUrl(env);
	if (!dbUrl) {
		console.warn(`[${env}] skipped: database URL not configured`);
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
		console.warn(`[${env}] NOT_PRESENT: no invitation found for ${eventType}/${slug}`);
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

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	console.info('Content parity check (read-only; no mutations authorized by this command)');
	console.info(`Slug: ${options.slug}  Event type: ${options.eventType}`);
	console.info(`Environments: ${options.envs.join(', ')}`);

	const snapshots: Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>> = {};
	const inventories: Partial<Record<ContentParityEnvironment, LoadedSnapshot>> = {};
	for (const env of options.envs) {
		const loadedSnapshot = loadSnapshot(
			env,
			options.slug,
			options.eventType,
			options.assetInventory,
		);
		if (loadedSnapshot) {
			snapshots[env] = loadedSnapshot.snapshot;
			inventories[env] = loadedSnapshot;
		}
	}

	const loaded = Object.keys(snapshots);
	if (loaded.length < 2) {
		console.error(
			`Need at least two loaded environments to compare; loaded: ${loaded.join(', ') || '(none)'}`,
		);
		process.exit(1);
	}

	if (options.assetInventory) {
		for (const environment of options.envs) {
			const inventory = inventories[environment];
			if (!inventory) continue;
			const safeRows = inventory.assets.map((asset) => ({
				semanticKey: asset.managedSourceKey,
				displayName: asset.displayName,
				mimeType: asset.mimeType,
				width: asset.width,
				height: asset.height,
				fileSize: asset.fileSize,
				referencedBy: inventory.referencedAssetPaths.get(asset.id) ?? [],
			}));
			console.info(`[${environment}] asset inventory: ${JSON.stringify(safeRows)}`);
		}
	}

	const result = compareAcrossEnvironments(options.slug, options.eventType, snapshots);
	if (result.ok) {
		console.info(`PASS: semantic parity across ${result.environments.join(', ')}`);
		process.exit(0);
	}

	console.error(`FAIL: ${result.drifts.length} semantic drift(s)`);
	for (const drift of result.drifts) {
		const paths =
			options.paths &&
			(drift.entity === 'invitation_content_drafts' ||
				drift.entity === 'published_invitation_content') &&
			drift.field === 'content'
				? listSemanticDifferencePaths(drift.left, drift.right)
				: [];
		console.error(
			`- [${drift.environments.join(' vs ')}] ${drift.entity}.${drift.field}: ${drift.detail}${
				paths.length > 0 ? ` (paths: ${paths.join(', ')})` : ''
			}`,
		);
	}
	process.exit(1);
}

main();
