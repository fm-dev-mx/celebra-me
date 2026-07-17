#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
	classifyDbTarget,
	verifyLocalIdentity,
} from '../db/db-guard';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog';
import { normalizeInvitationImage } from '../../src/lib/intake/services/asset-policy';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	type RominaAssetKey,
	type RominaAssetMap,
} from './romina-invitation-data';

const BUCKET = 'invitation-assets';

// Minimal Database type so the Supabase client can infer table names.
// This file runs locally only (never in production) so full schema types
// are not required — only the tables and columns accessed here.
interface Database {
	public: {
		Tables: {
			invitations: {
				Row: Record<string, unknown>;
				Insert: Record<string, unknown>;
				Update: Record<string, unknown>;
				Relationships: [];
			};
			invitation_assets: {
				Row: Record<string, unknown>;
				Insert: Record<string, unknown>;
				Update: Record<string, unknown>;
				Relationships: [];
			};
			invitation_content_drafts: {
				Row: Record<string, unknown>;
				Insert: Record<string, unknown>;
				Update: Record<string, unknown>;
				Relationships: [];
			};
			app_user_roles: {
				Row: Record<string, unknown>;
				Insert: Record<string, unknown>;
				Update: Record<string, unknown>;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			publish_invitation_atomic: {
				Args: Record<string, unknown>;
				Returns: {
					draft: Record<string, unknown>;
					publishedContent: {
						id: string;
						slug: string;
						eventType: string;
						version: number;
						publishedAt: string;
					};
				};
			};
		};
	};
}

type DbClient = SupabaseClient<Database>;

interface LocalEnv {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

interface InvitationRow {
	id: string;
}

interface DraftRow {
	id: string;
	updated_at: string;
}

interface AssetRow {
	id: string;
	display_name: string;
	storage_path: string;
}

function loadLocalEnv(projectRoot: string): LocalEnv {
	let output: string;
	try {
		output = execFileSync('supabase', ['status', '-o', 'json'], {
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch {
		throw new Error(
			'Local Supabase is required. Refusing to read connection settings from environment variables or .env files.',
		);
	}

	const status = JSON.parse(output) as Record<string, unknown>;
	const apiUrl = status.API_URL;
	const dbUrl = status.DB_URL;
	const serviceRoleKey = status.SERVICE_ROLE_KEY;
	if (
		typeof apiUrl !== 'string' ||
		typeof dbUrl !== 'string' ||
		typeof serviceRoleKey !== 'string'
	) {
		throw new Error('Local Supabase status is incomplete. Refusing to run.');
	}

	const classification = classifyDbTarget(dbUrl, { apiUrl });
	const identity = verifyLocalIdentity({
		supabaseStatus: output,
		supabaseConfig: fs.readFileSync(path.join(projectRoot, 'supabase', 'config.toml'), 'utf8'),
	});
	if (classification.target !== 'persistent-local' || !identity.ok) {
		throw new Error(
			'Refusing to run: local identity verification failed (' +
				classification.reason +
				(identity.errors.length ? '; ' + identity.errors.join(' ') : '') +
				').',
		);
	}
	return { SUPABASE_URL: apiUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey };
}

function resolveSourceDirectory(): string {
	const sourceFlagIndex = process.argv.indexOf('--source-dir');
	const sourceArg = sourceFlagIndex >= 0 ? process.argv[sourceFlagIndex + 1] : undefined;
	const sourceDir = sourceArg || process.env.ROMINA_PHOTO_SOURCE_DIR;
	if (!sourceDir) {
		throw new Error(
			'Pass --source-dir <path> or set ROMINA_PHOTO_SOURCE_DIR. The source path is never persisted.',
		);
	}
	const resolved = path.resolve(sourceDir);
	if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
		throw new Error(`Photo source directory does not exist: ${resolved}`);
	}
	return resolved;
}

async function ensureInvitation(
	supabase: DbClient,
	ownerUserId: string,
): Promise<InvitationRow> {
	const preset = findDemoPreset(ROMINA_EVENT.baseDemoId);
	if (!preset || preset.themeId !== ROMINA_EVENT.themeId) {
		throw new Error('The Premiere Floral catalog entry is missing or internally inconsistent.');
	}

	const { data: existing, error: findError } = await supabase
		.from('invitations')
		.select('id')
		.eq('slug', ROMINA_EVENT.slug)
		.is('archived_at', null)
		.maybeSingle<InvitationRow>();
	if (findError) throw findError;

	const metadata = {
		title: ROMINA_EVENT.title,
		event_type: ROMINA_EVENT.eventType,
		status: 'draft',
		base_demo_id: ROMINA_EVENT.baseDemoId,
		theme_id: ROMINA_EVENT.themeId,
		snapshot: preset,
		client_name: 'Romina Ríos Chaparro',
		client_email: '',
		client_whatsapp: '',
		photos_received: true,
		created_by: ownerUserId,
		kind: 'client',
	};

	if (existing) {
		const { data, error } = await supabase
			.from('invitations')
			.update(metadata)
			.eq('id', existing.id)
			.select('id')
			.single<InvitationRow>();
		if (error) throw error;
		return data;
	}

	const { data, error } = await supabase
		.from('invitations')
		.insert({ ...metadata, slug: ROMINA_EVENT.slug })
		.select('id')
		.single<InvitationRow>();
	if (error) throw error;
	return data;
}

async function uploadAssets(
	supabase: DbClient,
	invitationId: string,
	sourceDir: string,
): Promise<RominaAssetMap> {
	const { data: existingRows, error: listError } = await supabase
		.from('invitation_assets')
		.select('id,display_name,storage_path')
		.eq('invitation_id', invitationId)
		.is('deleted_at', null);
	if (listError) throw listError;
	const existingByName = new Map(
		((existingRows ?? []) as AssetRow[]).map((asset) => [asset.display_name, asset]),
	);
	const refs = {} as RominaAssetMap;

	for (const spec of ROMINA_ASSET_SPECS) {
		const sourcePath = path.join(sourceDir, spec.fileName);
		if (!fs.existsSync(sourcePath)) {
			throw new Error(`Required source photograph is missing: ${spec.fileName}`);
		}
		const sourceBytes = fs.readFileSync(sourcePath);
		const normalized = await normalizeInvitationImage(
			new Blob([Uint8Array.from(sourceBytes)], { type: 'image/jpeg' }),
			'image/jpeg',
		);
		const existing = existingByName.get(spec.displayName);
		const assetId = existing?.id ?? randomUUID();
		const storagePath =
			existing?.storage_path ?? `invitations/${invitationId}/optimized/${assetId}.webp`;
		const uploadBytes = new Uint8Array(await normalized.blob.arrayBuffer());
		const { error: uploadError } = await supabase.storage
			.from(BUCKET)
			.upload(storagePath, uploadBytes, {
				contentType: normalized.mimeType,
				upsert: true,
			});
		if (uploadError) throw uploadError;

		const assetMetadata = {
			invitation_id: invitationId,
			display_name: spec.displayName,
			default_alt_text: spec.alt,
			bucket: BUCKET,
			storage_path: storagePath,
			mime_type: normalized.mimeType,
			width: normalized.width,
			height: normalized.height,
			file_size: normalized.fileSize,
			validation_version: normalized.validationVersion,
			original_mime_type: normalized.originalMimeType,
			original_file_size: normalized.originalFileSize,
		};

		if (existing) {
			const { error } = await supabase
				.from('invitation_assets')
				.update(assetMetadata)
				.eq('id', assetId);
			if (error) throw error;
		} else {
			const { error } = await supabase
				.from('invitation_assets')
				.insert({ id: assetId, ...assetMetadata });
			if (error) throw error;
		}

		const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
		refs[spec.key as RominaAssetKey] = {
			type: 'uploaded',
			assetId,
			src: publicUrlData.publicUrl,
		};
	}

	return refs;
}

async function upsertDraft(
	supabase: DbClient,
	invitationId: string,
	content: Record<string, unknown>,
): Promise<DraftRow> {
	const { data: existing, error: findError } = await supabase
		.from('invitation_content_drafts')
		.select('id,updated_at')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.maybeSingle<DraftRow>();
	if (findError) throw findError;

	if (existing) {
		const { data, error } = await supabase
			.from('invitation_content_drafts')
			.update({ content, status: 'draft', submission_id: null })
			.eq('id', existing.id)
			.select('id,updated_at')
			.single<DraftRow>();
		if (error) throw error;
		return data;
	}

	const { data, error } = await supabase
		.from('invitation_content_drafts')
		.insert({
			invitation_project_id: invitationId,
			submission_id: null,
			content,
			status: 'draft',
		})
		.select('id,updated_at')
		.single<DraftRow>();
	if (error) throw error;
	return data;
}

async function main(): Promise<void> {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const projectRoot = path.resolve(scriptDir, '..', '..');
	const sourceDir = resolveSourceDirectory();
	const env = loadLocalEnv(projectRoot);
	const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data: ownerRole, error: ownerError } = await supabase
		.from('app_user_roles')
		.select('user_id')
		.eq('role', 'super_admin')
		.order('created_at', { ascending: true })
		.limit(1)
		.single<{ user_id: string }>();
	if (ownerError) throw ownerError;

	const invitation = await ensureInvitation(supabase, ownerRole.user_id);
	const assets = await uploadAssets(supabase, invitation.id, sourceDir);
	const content = buildRominaPublishedContent(assets);
	const draft = await upsertDraft(supabase, invitation.id, content);

	const { data: publication, error: publicationError } = await supabase.rpc(
		'publish_invitation_atomic',
		{
			p_invitation_id: invitation.id,
			p_draft_id: draft.id,
			p_expected_draft_updated_at: draft.updated_at,
			p_slug: ROMINA_EVENT.slug,
			p_event_type: ROMINA_EVENT.eventType,
			p_is_demo: false,
			p_content: content,
		},
	);
	if (publicationError) throw publicationError;

	console.log(
		JSON.stringify(
			{
				target: 'persistent-local',
				route: `/${ROMINA_EVENT.eventType}/${ROMINA_EVENT.slug}`,
				invitationId: invitation.id,
				publishedVersion: publication?.publishedContent?.version,
				assetCount: ROMINA_ASSET_SPECS.length,
				guestRecordsCreated: 0,
			},
			null,
			2,
		),
	);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
