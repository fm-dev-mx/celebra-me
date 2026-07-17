import { buildRominaPublishedContent } from '../../dev/romina-invitation-data';
import type { RominaAssetMap } from '../../dev/romina-invitation-data';
import type { DbClient } from './types';
import type { NormalizedOutput, PhaseAction } from './types';
import { BUCKET } from './types';

// ---------------------------------------------------------------------------
// Storage upload
// ---------------------------------------------------------------------------

export async function uploadToStorage(
	supabaseUrl: string,
	serviceRoleKey: string,
	storagePath: string,
	bytes: Uint8Array,
	contentType: string,
): Promise<void> {
	const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;
	// Copy into a fresh ArrayBuffer to satisfy Node.js 24's stricter BlobPart type
	// (which requires ArrayBufferView<ArrayBuffer>, not ArrayBufferLike).
	const ab = new ArrayBuffer(bytes.length);
	new Uint8Array(ab).set(bytes);
	const blob = new Blob([ab], { type: contentType });
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: `${serviceRoleKey}`,
			'Content-Type': contentType,
			'x-upsert': 'true',
		},
		body: blob,
	});
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Storage upload failed (HTTP ${response.status}): ${body.slice(0, 300)}`);
	}
}

// ---------------------------------------------------------------------------
// Asset metadata persistence
// ---------------------------------------------------------------------------

/**
 * Read-classify-write pattern for invitation_assets.
 *
 * `invitation_assets` has no unique constraint on (invitation_id, display_name).
 * We explicitly check for an existing active row and either update or insert,
 * which avoids upsert ambiguity.
 */
export async function upsertAssetRow(
	supabase: DbClient,
	invitationId: string,
	assetId: string,
	normalized: NormalizedOutput,
	storagePath: string,
): Promise<string> {
	const { data: existingRow } = await supabase
		.from('invitation_assets')
		.select('id')
		.eq('invitation_id', invitationId)
		.eq('display_name', normalized.displayName)
		.is('deleted_at', null)
		.maybeSingle();

	const existingRowData = existingRow as Record<string, unknown> | null;
	const existingId = existingRowData?.id as string | undefined;
	const finalId = existingId ?? assetId;

	if (existingId) {
		const { error } = await supabase
			.from('invitation_assets')
			.update({
				default_alt_text: normalized.alt,
				storage_path: storagePath,
				mime_type: normalized.mimeType,
				width: normalized.width,
				height: normalized.height,
				file_size: normalized.fileSize,
				validation_version: 1,
				original_mime_type: normalized.originalMimeType,
				original_file_size: normalized.originalFileSize,
			} as Record<string, unknown>)
			.eq('id', existingId);
		if (error) throw new Error(`Failed to update asset row: ${error.message}`);
	} else {
		const { error } = await supabase.from('invitation_assets').insert({
			id: finalId,
			invitation_id: invitationId,
			display_name: normalized.displayName,
			default_alt_text: normalized.alt,
			bucket: BUCKET,
			storage_path: storagePath,
			mime_type: normalized.mimeType,
			width: normalized.width,
			height: normalized.height,
			file_size: normalized.fileSize,
			validation_version: 1,
			original_mime_type: normalized.originalMimeType,
			original_file_size: normalized.originalFileSize,
		} as Record<string, unknown>);
		if (error) throw new Error(`Failed to insert asset row: ${error.message}`);
	}

	return finalId;
}

// ---------------------------------------------------------------------------
// Draft creation
// ---------------------------------------------------------------------------

export async function ensureDraft(
	supabase: DbClient,
	invitationId: string,
	assets: RominaAssetMap,
): Promise<{ id: string; updatedAt: string; action: PhaseAction }> {
	const content = buildRominaPublishedContent(assets);

	const { data: existing } = await supabase
		.from('invitation_content_drafts')
		.select('id, updated_at')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.maybeSingle();

	const existingRow = existing as Record<string, unknown> | null;

	if (existingRow) {
		const { error } = await supabase
			.from('invitation_content_drafts')
			.update({ content, status: 'draft', submission_id: null } as Record<string, unknown>)
			.eq('id', existingRow.id as string);
		if (error) throw new Error(`Failed to update draft: ${error.message}`);
		return {
			id: existingRow.id as string,
			updatedAt: existingRow.updated_at as string,
			action: { resource: 'draft', action: 'reuse', detail: 'Replaced existing draft' },
		};
	}

	const { data: created, error } = await supabase
		.from('invitation_content_drafts')
		.insert({
			invitation_project_id: invitationId,
			submission_id: null,
			content,
			status: 'draft',
		} as Record<string, unknown>)
		.select('id, updated_at')
		.single();

	if (error) throw new Error(`Failed to create draft: ${error.message}`);
	const createdRow = created as Record<string, unknown>;
	return {
		id: createdRow.id as string,
		updatedAt: createdRow.updated_at as string,
		action: { resource: 'draft', action: 'create', detail: 'Created draft' },
	};
}
