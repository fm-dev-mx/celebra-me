/**
 * invitation-package.ts — Canonical Invitation Package Exporter
 *
 * Exports an approved invitation project from persistent Local Supabase (127.0.0.1:54322)
 * into an immutable, versioned, self-contained package JSON file.
 *
 * Excludes Auth users, owner UUIDs, guests, RSVPs, intake submissions, tracking,
 * commercial data, credentials, and environment-specific Supabase URLs.
 *
 * Usage:
 *   import { exportInvitationPackage } from './invitation-package.ts';
 *   const result = await exportInvitationPackage({ slug: 'romina-rios-chaparro', dryRun: false });
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runPsql, LOCAL_DB_URL, LOCAL_SUPABASE_URL, sqlLiteral } from '../db/db-workflow-lib.ts';
import { classifyDbTarget } from '../db/db-target-config.ts';

export const PACKAGE_SCHEMA_VERSION = '1.0.0';
export const STORAGE_URL_PLACEHOLDER = '__STORAGE_URL__';

export interface InvitationPackageAsset {
	displayName: string;
	defaultAltText: string | null;
	bucket: string;
	storagePath: string;
	mimeType: string;
	width: number | null;
	height: number | null;
	fileSize: number | null;
	validationVersion: number;
	originalMimeType: string | null;
	originalFileSize: number | null;
	sha256: string;
	dataBase64: string;
}

export interface InvitationPackageData {
	schemaVersion: string;
	packageHash: string;
	createdAt: string;
	sourceSlug: string;
	invitation: {
		slug: string;
		title: string;
		eventType: string;
		baseDemoId: string;
		themeId: string;
		kind: string;
		clientName: string;
		clientEmail: string;
		clientWhatsapp: string;
		photosReceived: boolean;
		snapshot: Record<string, unknown>;
	};
	draft: {
		status: string;
		content: Record<string, unknown>;
	};
	publishedContent: {
		version: number;
		publishedAt: string;
		content: Record<string, unknown>;
	} | null;
	event: {
		title: string;
		eventType: string;
		status: string;
	} | null;
	assets: InvitationPackageAsset[];
}

export interface ExportPackageOptions {
	slug: string;
	dryRun?: boolean;
	outPath?: string;
	sourceDbUrl?: string;
	supabaseUrl?: string;
}

export interface ExportPackageResult {
	packageData: InvitationPackageData;
	packagePath: string | null;
	stats: {
		slug: string;
		assetCount: number;
		totalBytes: number;
		hasPublishedContent: boolean;
		packageHash: string;
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Bytes(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function sha256String(str: string): string {
	return createHash('sha256').update(str, 'utf8').digest('hex');
}

function canonicalizeJson(val: unknown): string {
	if (val === null || typeof val !== 'object') {
		return JSON.stringify(val);
	}
	if (Array.isArray(val)) {
		return `[${val.map((item) => canonicalizeJson(item)).join(',')}]`;
	}
	const obj = val as Record<string, unknown>;
	const sortedKeys = Object.keys(obj).sort();
	const keyValuePairs = sortedKeys.map(
		(key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`,
	);
	return `{${keyValuePairs.join(',')}}`;
}

export function computePackageHash(
	payload: Omit<InvitationPackageData, 'packageHash'> | InvitationPackageData,
): string {
	const { packageHash: _, createdAt: __, ...unhashed } = payload as InvitationPackageData;
	const copy = {
		...unhashed,
		assets: [...unhashed.assets].sort((a, b) => a.storagePath.localeCompare(b.storagePath)),
	};
	return sha256String(canonicalizeJson(copy));
}

export function sanitizeStorageUrls(val: unknown): unknown {
	if (typeof val === 'string') {
		return val.replace(
			/(https?:\/\/[^\s"',\]]+\/storage\/v1\/object\/public\/invitation-assets\/)/g,
			`${STORAGE_URL_PLACEHOLDER}/`,
		);
	}
	if (Array.isArray(val)) {
		return val.map(sanitizeStorageUrls);
	}
	if (val !== null && typeof val === 'object') {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(val as Record<string, unknown>)) {
			result[key] = sanitizeStorageUrls((val as Record<string, unknown>)[key]);
		}
		return result;
	}
	return val;
}

// ---------------------------------------------------------------------------
// Query & Asset Extraction Helpers
// ---------------------------------------------------------------------------

interface RawInvitationRows {
	invRow: Record<string, unknown>;
	draftRow: Record<string, unknown>;
	pubRow: Record<string, unknown> | null;
	eventRow: Record<string, unknown> | null;
	rawAssetRows: Record<string, unknown>[];
}

function fetchRawInvitationRecords(slug: string, sourceDbUrl: string): RawInvitationRows {
	const invQuery = `
		select id, slug, title, event_type, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received
		from public.invitations
		where slug = ${sqlLiteral(slug)}
		  and archived_at is null
		limit 1
	`;
	const invResult = runPsql(`select row_to_json(t) from (${invQuery}) t;`, sourceDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	if (!invResult.stdout.trim()) {
		throw new Error(`Invitation with slug "${slug}" not found in persistent-local database.`);
	}
	const invRow = JSON.parse(invResult.stdout.trim()) as Record<string, unknown>;
	const invitationId = invRow.id as string;

	const draftQuery = `
		select content, status
		from public.invitation_content_drafts
		where invitation_project_id = '${invitationId}'::uuid
		  and deleted_at is null
		order by updated_at desc
		limit 1
	`;
	const draftResult = runPsql(`select row_to_json(t) from (${draftQuery}) t;`, sourceDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	if (!draftResult.stdout.trim()) {
		throw new Error(`No active content draft found for invitation "${slug}".`);
	}
	const draftRow = JSON.parse(draftResult.stdout.trim()) as Record<string, unknown>;

	const pubQuery = `
		select version, published_at, content
		from public.published_invitation_content
		where invitation_project_id = '${invitationId}'::uuid
		  and deleted_at is null
		order by version desc
		limit 1
	`;
	const pubResult = runPsql(`select row_to_json(t) from (${pubQuery}) t;`, sourceDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const pubRow = pubResult.stdout.trim()
		? (JSON.parse(pubResult.stdout.trim()) as Record<string, unknown>)
		: null;

	const eventQuery = `
		select title, event_type, status
		from public.events
		where invitation_project_id = '${invitationId}'::uuid
		  and deleted_at is null
		limit 1
	`;
	const eventResult = runPsql(`select row_to_json(t) from (${eventQuery}) t;`, sourceDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const eventRow = eventResult.stdout.trim()
		? (JSON.parse(eventResult.stdout.trim()) as Record<string, unknown>)
		: null;

	const assetsQuery = `
		select display_name, default_alt_text, bucket, storage_path, mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size
		from public.invitation_assets
		where invitation_id = '${invitationId}'::uuid
		  and deleted_at is null
		order by storage_path
	`;
	const assetsResult = runPsql(`select json_agg(t) from (${assetsQuery}) t;`, sourceDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const rawAssetRows = assetsResult.stdout.trim()
		? (JSON.parse(assetsResult.stdout.trim()) as Record<string, unknown>[])
		: [];

	return { invRow, draftRow, pubRow, eventRow, rawAssetRows };
}

async function downloadPackageAssets(
	rawAssetRows: Record<string, unknown>[],
	supabaseUrl: string,
): Promise<{ packageAssets: InvitationPackageAsset[]; totalBytes: number }> {
	const packageAssets: InvitationPackageAsset[] = [];
	let totalBytes = 0;

	for (const aRow of rawAssetRows) {
		const storagePath = aRow.storage_path as string;
		const bucket = (aRow.bucket as string) || 'invitation-assets';
		const assetUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;

		const response = await fetch(assetUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch asset binary from local Storage for path "${storagePath}" (HTTP ${response.status}).`,
			);
		}

		const ab = await response.arrayBuffer();
		const bytes = new Uint8Array(ab);
		if (bytes.length === 0) {
			throw new Error(`Asset binary at "${storagePath}" is empty (0 bytes).`);
		}

		const fileSize = (aRow.file_size as number) ?? bytes.length;
		if (fileSize > 2_500_000) {
			throw new Error(
				`Asset "${storagePath}" exceeds size limit (${fileSize} bytes > 2.5MB).`,
			);
		}

		const sha256 = sha256Bytes(bytes);
		const dataBase64 = Buffer.from(bytes).toString('base64');
		totalBytes += bytes.length;

		packageAssets.push({
			displayName: aRow.display_name as string,
			defaultAltText: (aRow.default_alt_text as string) ?? null,
			bucket,
			storagePath,
			mimeType: (aRow.mime_type as string) || 'image/webp',
			width: (aRow.width as number) ?? null,
			height: (aRow.height as number) ?? null,
			fileSize,
			validationVersion: (aRow.validation_version as number) ?? 1,
			originalMimeType: (aRow.original_mime_type as string) ?? null,
			originalFileSize: (aRow.original_file_size as number) ?? null,
			sha256,
			dataBase64,
		});
	}

	return { packageAssets, totalBytes };
}

function buildUnhashedPayload(
	slug: string,
	rows: RawInvitationRows,
	packageAssets: InvitationPackageAsset[],
): Omit<InvitationPackageData, 'packageHash'> {
	const { invRow, draftRow, pubRow, eventRow } = rows;

	const sanitizedSnapshot = sanitizeStorageUrls(
		typeof invRow.snapshot === 'string'
			? JSON.parse(invRow.snapshot as string)
			: (invRow.snapshot ?? {}),
	) as Record<string, unknown>;

	const sanitizedDraftContent = sanitizeStorageUrls(
		typeof draftRow.content === 'string'
			? JSON.parse(draftRow.content as string)
			: (draftRow.content ?? {}),
	) as Record<string, unknown>;

	const sanitizedPublishedContent = pubRow
		? (sanitizeStorageUrls(
				typeof pubRow.content === 'string'
					? JSON.parse(pubRow.content as string)
					: (pubRow.content ?? {}),
			) as Record<string, unknown>)
		: null;

	return {
		schemaVersion: PACKAGE_SCHEMA_VERSION,
		createdAt: new Date().toISOString(),
		sourceSlug: slug,
		invitation: {
			slug: invRow.slug as string,
			title: invRow.title as string,
			eventType: invRow.event_type as string,
			baseDemoId: invRow.base_demo_id as string,
			themeId: invRow.theme_id as string,
			kind: (invRow.kind as string) || 'client',
			clientName: (invRow.client_name as string) || '',
			clientEmail: (invRow.client_email as string) || '',
			clientWhatsapp: (invRow.client_whatsapp as string) || '',
			photosReceived: (invRow.photos_received as boolean) ?? false,
			snapshot: sanitizedSnapshot,
		},
		draft: {
			status: (draftRow.status as string) || 'draft',
			content: sanitizedDraftContent,
		},
		publishedContent: pubRow
			? {
					version: (pubRow.version as number) || 1,
					publishedAt: (pubRow.published_at as string) || new Date().toISOString(),
					content: sanitizedPublishedContent!,
				}
			: null,
		event: eventRow
			? {
					title: eventRow.title as string,
					eventType: eventRow.event_type as string,
					status: eventRow.status as string,
				}
			: null,
		assets: packageAssets,
	};
}

// ---------------------------------------------------------------------------
// Main Exporter
// ---------------------------------------------------------------------------

export async function exportInvitationPackage(
	options: ExportPackageOptions,
): Promise<ExportPackageResult> {
	const { slug, dryRun = false, outPath, sourceDbUrl = LOCAL_DB_URL } = options;
	const supabaseUrl = options.supabaseUrl ?? LOCAL_SUPABASE_URL;

	const targetClassification = classifyDbTarget(sourceDbUrl, { apiUrl: supabaseUrl });
	if (targetClassification.target !== 'persistent-local') {
		throw new Error(
			`Refusing export: source database must be persistent-local (127.0.0.1:54322), got ${targetClassification.target}.`,
		);
	}

	const rows = fetchRawInvitationRecords(slug, sourceDbUrl);
	const { packageAssets, totalBytes } = await downloadPackageAssets(
		rows.rawAssetRows,
		supabaseUrl,
	);
	const unhashedPayload = buildUnhashedPayload(slug, rows, packageAssets);

	const packageHash = computePackageHash(unhashedPayload);
	const packageData: InvitationPackageData = { ...unhashedPayload, packageHash };

	let finalPath: string | null = null;
	if (!dryRun) {
		const targetPath =
			outPath ??
			resolve(
				process.cwd(),
				'.tmp',
				'packages',
				`invitation-${slug}-${packageHash.slice(0, 12)}.json`,
			);
		mkdirSync(dirname(targetPath), { recursive: true });
		writeFileSync(targetPath, JSON.stringify(packageData, null, 2), 'utf8');
		finalPath = targetPath;
	}

	return {
		packageData,
		packagePath: finalPath,
		stats: {
			slug,
			assetCount: packageAssets.length,
			totalBytes,
			hasPublishedContent: Boolean(rows.pubRow),
			packageHash,
		},
	};
}
