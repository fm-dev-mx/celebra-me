import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeInvitationImage } from '../../../src/lib/intake/services/asset-policy';
import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
} from '../../dev/romina-invitation-data';
import type { DbClient } from './types';
import type {
	StoredAsset,
	NormalizedOutput,
	AssetAction,
	PhaseAction,
} from './types';
import { hashBytes } from './helpers';

// ---------------------------------------------------------------------------
// Owner validation via Admin API
// ---------------------------------------------------------------------------

export async function validateOwnerExists(
	supabaseUrl: string,
	serviceRoleKey: string,
	ownerUserId: string,
): Promise<void> {
	const url = `${supabaseUrl}/auth/v1/admin/users/${ownerUserId}`;
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: `${serviceRoleKey}`,
		},
	});

	if (response.status === 404) {
		console.error(
			`Owner user ${ownerUserId} does not exist in auth.users. Create the customer user first.`,
		);
		process.exit(1);
	}
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error(
			`Failed to verify owner existence: HTTP ${response.status} ${body.slice(0, 200)}`.trim(),
		);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Source photo validation
// ---------------------------------------------------------------------------

export function validateSourcePhotos(sourceDir: string): void {
	const missing = ROMINA_ASSET_SPECS.filter(
		(spec) => !existsSync(resolve(sourceDir, spec.fileName)),
	);
	if (missing.length > 0) {
		console.error(
			`Missing source photographs (${missing.length}/${ROMINA_ASSET_SPECS.length}):`,
		);
		for (const spec of missing) {
			console.error(`  - ${spec.fileName} (${spec.key})`);
		}
		console.error(`Expected in: ${sourceDir}`);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Photo normalization
// ---------------------------------------------------------------------------

export async function normalizePhotos(sourceDir: string): Promise<NormalizedOutput[]> {
	const results: NormalizedOutput[] = [];
	for (const spec of ROMINA_ASSET_SPECS) {
		const sourcePath = resolve(sourceDir, spec.fileName);
		const sourceBytes = readFileSync(sourcePath);
		const sourceBlob = new Blob([sourceBytes], { type: 'image/jpeg' });
		const normalized = await normalizeInvitationImage(sourceBlob, 'image/jpeg');
		const normalizedBytes = new Uint8Array(await normalized.blob.arrayBuffer());
		results.push({
			key: spec.key,
			bytes: normalizedBytes,
			fileName: spec.fileName,
			displayName: spec.displayName,
			alt: spec.alt,
			width: normalized.width,
			height: normalized.height,
			fileSize: normalized.fileSize,
			mimeType: normalized.mimeType,
			originalMimeType: normalized.originalMimeType,
			originalFileSize: normalized.originalFileSize,
			imageHash: hashBytes(normalizedBytes),
		});
	}
	return results;
}

// ---------------------------------------------------------------------------
// Invitation lookup / creation
// ---------------------------------------------------------------------------

/**
 * Find a non-archived invitation by slug.
 * Exits on multiple active rows (invitations.slug is unique, but archived
 * invitations may share the slug; archived_at = null singles out the active one).
 */
export async function findInvitation(
	supabase: DbClient,
	slug: string,
	eventType: string,
): Promise<Record<string, unknown> | null> {
	const { data: allRows, error } = await supabase
		.from('invitations')
		.select('id, created_by, status')
		.eq('slug', slug)
		.eq('event_type', eventType)
		.is('archived_at', null);

	if (error) {
		console.error(`Failed to query invitations: ${error.message}`);
		process.exit(1);
	}

	const rows = allRows as Record<string, unknown>[] | undefined;
	if (!rows || rows.length === 0) return null;
	if (rows.length > 1) {
		console.error(
			`✗ Found ${rows.length} active invitations with slug "${slug}". Expected at most 1.`,
		);
		console.error('  Manual DB cleanup required before this invitation can be provisioned.');
		process.exit(1);
	}

	return rows[0];
}

export async function ensureInvitation(
	supabase: DbClient,
	ownerUserId: string,
	dryRun: boolean,
): Promise<{ id: string; action: PhaseAction }> {
	const slug = ROMINA_EVENT.slug;
	const eventType = ROMINA_EVENT.eventType;

	const existing = await findInvitation(supabase, slug, eventType);

	if (existing) {
		const existingOwner = existing.created_by as string | undefined;
		if (existingOwner && existingOwner !== ownerUserId) {
			return {
				id: existing.id as string,
				action: {
					resource: `invitation "${slug}"`,
					action: 'abort',
					detail: `Owned by different user (${existingOwner}). Aborting.`,
				},
			};
		}
		if (dryRun) {
			return {
				id: existing.id as string,
				action: {
					resource: `invitation "${slug}"`,
					action: 'reuse',
					detail: 'Found existing invitation',
				},
			};
		}

		const { error: updateError } = await supabase
			.from('invitations')
			.update({
				title: ROMINA_EVENT.title,
				event_type: eventType,
				status: 'draft',
				base_demo_id: ROMINA_EVENT.baseDemoId,
				theme_id: ROMINA_EVENT.themeId,
				kind: 'client',
				photos_received: true,
				created_by: ownerUserId,
			} as Record<string, unknown>)
			.eq('id', existing.id as string);

		if (updateError) {
			console.error(`Failed to update invitation: ${updateError.message}`);
			process.exit(1);
		}

		return {
			id: existing.id as string,
			action: {
				resource: `invitation "${slug}"`,
				action: 'reuse',
				detail: 'Updated existing invitation',
			},
		};
	}

	if (dryRun) {
		return {
			id: '',
			action: {
				resource: `invitation "${slug}"`,
				action: 'create',
				detail: 'No existing invitation — will create',
			},
		};
	}

	const { data: created, error: createError } = await supabase
		.from('invitations')
		.insert({
			slug,
			event_type: eventType,
			title: ROMINA_EVENT.title,
			status: 'draft',
			base_demo_id: ROMINA_EVENT.baseDemoId,
			theme_id: ROMINA_EVENT.themeId,
			kind: 'client',
			photos_received: true,
			created_by: ownerUserId,
		} as Record<string, unknown>)
		.select('id')
		.single();

	if (createError) {
		console.error(`Failed to create invitation: ${createError.message}`);
		process.exit(1);
	}

	return {
		id: (created as Record<string, unknown>).id as string,
		action: {
			resource: `invitation "${slug}"`,
			action: 'create',
			detail: 'Created new invitation',
		},
	};
}

// ---------------------------------------------------------------------------
// Existing asset lookup with duplicate detection
// ---------------------------------------------------------------------------

export async function findExistingAssets(
	supabase: DbClient,
	invitationId: string,
): Promise<Map<string, StoredAsset>> {
	const { data: rows, error } = await supabase
		.from('invitation_assets')
		.select('id, display_name, storage_path, file_size, width, height')
		.eq('invitation_id', invitationId)
		.is('deleted_at', null);

	if (error) {
		console.error(`Failed to query existing assets: ${error.message}`);
		process.exit(1);
	}

	const items = (rows ?? []) as Record<string, unknown>[];

	// Check for duplicate active rows with same display_name
	const displayNameCount = new Map<string, number>();
	for (const item of items) {
		const dn = item.display_name as string;
		displayNameCount.set(dn, (displayNameCount.get(dn) ?? 0) + 1);
	}
	const duplicates = [...displayNameCount.entries()].filter(([, count]) => count > 1);
	if (duplicates.length > 0) {
		console.error(
			`✗ Duplicate active invitation_assets rows found for invitation ${invitationId}:`,
		);
		for (const [dn, count] of duplicates) {
			console.error(`   "${dn}" appears ${count} times`);
		}
		console.error('  Manual DB cleanup required before provisioning can proceed.');
		process.exit(1);
	}

	const map = new Map<string, StoredAsset>();
	for (const item of items) {
		map.set(item.display_name as string, {
			id: item.id as string,
			displayName: item.display_name as string,
			storagePath: item.storage_path as string,
			fileSize: (item.file_size as number) ?? 0,
			width: (item.width as number) ?? 0,
			height: (item.height as number) ?? 0,
			imageHash: null,
		});
	}
	return map;
}

// ---------------------------------------------------------------------------
// Asset action plan — classify each normalized asset against existing rows
// ---------------------------------------------------------------------------

export function buildAssetActions(
	normalized: NormalizedOutput[],
	existingAssets: Map<string, StoredAsset>,
): AssetAction[] {
	return normalized.map((norm) => {
		const existing = existingAssets.get(norm.displayName);
		if (!existing) {
			return {
				resource: `asset "${norm.displayName}"`,
				action: 'create',
				status: 'missing',
				detail: `Will upload ${norm.fileName} → ${norm.fileSize}b`,
			};
		}
		if (
			existing.fileSize === norm.fileSize &&
			existing.width === norm.width &&
			existing.height === norm.height
		) {
			return {
				resource: `asset "${norm.displayName}"`,
				action: 'reuse',
				status: 'identical',
				detail: `Matches existing ${norm.fileSize}b`,
			};
		}
		return {
			resource: `asset "${norm.displayName}"`,
			action: 'replace',
			status: 'changed',
			detail: `Changed: was ${existing.fileSize}b, now ${norm.fileSize}b`,
		};
	});
}
