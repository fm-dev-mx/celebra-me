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
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

function toInvitationAsset(row: AssetRow): InvitationAsset {
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
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,invitation_id,display_name,default_alt_text,bucket,storage_path,mime_type,width,height,file_size,created_at,updated_at,deleted_at';

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
