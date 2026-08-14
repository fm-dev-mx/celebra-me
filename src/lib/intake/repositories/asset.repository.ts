import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationAsset } from '@/lib/intake/types';

interface AssetRow {
	id: string;
	invitation_id: string;
	display_name: string;
	default_alt_text: string | null;
	bucket: string;
	storage_path: string;
	mime_type: string;
	width: number | null;
	height: number | null;
	file_size: number | null;
	validation_version: number;
	original_mime_type: string | null;
	original_file_size: number | null;
	provider: string | null;
	provider_public_id: string | null;
	secure_url: string | null;
	sha256: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

function toInvitationAsset(row: AssetRow): InvitationAsset {
	const provider =
		row.provider === 'cloudinary' || row.provider === 'supabase' ? row.provider : 'supabase';
	return {
		id: row.id,
		invitationId: row.invitation_id,
		displayName: row.display_name,
		defaultAltText: row.default_alt_text ?? undefined,
		bucket: row.bucket,
		storagePath: row.storage_path,
		mimeType: row.mime_type,
		width: row.width ?? undefined,
		height: row.height ?? undefined,
		fileSize: row.file_size ?? undefined,
		validationVersion: row.validation_version,
		originalMimeType: row.original_mime_type ?? undefined,
		originalFileSize: row.original_file_size ?? undefined,
		provider,
		providerPublicId: row.provider_public_id ?? undefined,
		secureUrl: row.secure_url ?? undefined,
		sha256: row.sha256 ?? undefined,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at ?? undefined,
	};
}

const SELECT_COLUMNS =
	'id,invitation_id,display_name,default_alt_text,bucket,storage_path,mime_type,width,height,file_size,validation_version,original_mime_type,original_file_size,provider,provider_public_id,secure_url,sha256,created_at,updated_at,deleted_at';

export async function createAsset(input: {
	invitationId: string;
	displayName: string;
	defaultAltText?: string;
	bucket: string;
	storagePath: string;
	mimeType: string;
	width?: number;
	height?: number;
	fileSize?: number;
	validationVersion?: number;
	originalMimeType?: string;
	originalFileSize?: number;
	provider?: 'supabase' | 'cloudinary';
	providerPublicId?: string;
	secureUrl?: string;
	sha256?: string;
}): Promise<InvitationAsset> {
	const body: Record<string, unknown> = {
		invitation_id: input.invitationId,
		display_name: input.displayName,
		bucket: input.bucket,
		storage_path: input.storagePath,
		mime_type: input.mimeType,
	};

	if (input.defaultAltText !== undefined) body.default_alt_text = input.defaultAltText;
	if (input.width !== undefined) body.width = input.width;
	if (input.height !== undefined) body.height = input.height;
	if (input.fileSize !== undefined) body.file_size = input.fileSize;
	if (input.validationVersion !== undefined) body.validation_version = input.validationVersion;
	if (input.originalMimeType !== undefined) body.original_mime_type = input.originalMimeType;
	if (input.originalFileSize !== undefined) body.original_file_size = input.originalFileSize;
	if (input.provider !== undefined) body.provider = input.provider;
	if (input.providerPublicId !== undefined) body.provider_public_id = input.providerPublicId;
	if (input.secureUrl !== undefined) body.secure_url = input.secureUrl;
	if (input.sha256 !== undefined) body.sha256 = input.sha256;

	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Failed to create invitation asset.');
	return toInvitationAsset(rows[0]);
}

export async function findAssetsByInvitationId(invitationId: string): Promise<InvitationAsset[]> {
	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}&invitation_id=eq.${encodeURIComponent(invitationId)}&deleted_at=is.null&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toInvitationAsset);
}

export async function findAssetById(id: string): Promise<InvitationAsset | null> {
	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toInvitationAsset(rows[0]) : null;
}

export async function updateAsset(
	id: string,
	input: { displayName?: string; defaultAltText?: string },
): Promise<InvitationAsset> {
	const body: Record<string, unknown> = {};
	if (input.displayName !== undefined) body.display_name = input.displayName;
	if (input.defaultAltText !== undefined) body.default_alt_text = input.defaultAltText;

	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Failed to update invitation asset.');
	return toInvitationAsset(rows[0]);
}

export async function findArchivedAssetsByInvitationId(
	invitationId: string,
): Promise<InvitationAsset[]> {
	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}&invitation_id=eq.${encodeURIComponent(invitationId)}&deleted_at=not.is.null&order=deleted_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toInvitationAsset);
}

export async function restoreAsset(id: string): Promise<InvitationAsset> {
	const rows = await supabaseRestRequest<AssetRow[]>({
		pathWithQuery: `invitation_assets?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { deleted_at: null },
	});
	if (!rows[0]) throw new Error('Failed to restore invitation asset.');
	return toInvitationAsset(rows[0]);
}

export async function softDeleteAsset(id: string): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: `invitation_assets?id=eq.${encodeURIComponent(id)}`,
		method: 'PATCH',
		useServiceRole: true,
		body: { deleted_at: new Date().toISOString() },
	});
}
