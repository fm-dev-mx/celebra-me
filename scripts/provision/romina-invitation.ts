#!/usr/bin/env node
/**
 * romina-invitation.ts — Production-safe provisioner for the Romina Ríos Chaparro XV invitation.
 *
 * Orchestrates the full lifecycle: validate source photos → normalize → upload to
 * Supabase Storage → create invitation_assets rows → create draft → publish through the
 * canonical publish_invitation_atomic RPC → create event + membership.
 *
 * Modular sub-components live under scripts/provision/romina/.
 *
 * Usage:
 *   pnpm invitation:prod:provision -- --dry-run --owner-user-id <UUID> --source-dir <PATH>
 *   pnpm invitation:prod:provision -- --apply   --owner-user-id <UUID> --source-dir <PATH>
 *
 * Environment (gitignored files):
 *   SUPABASE_URL              — https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key for admin operations
 */

import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	buildRominaPublishedContent,
} from '../dev/romina-invitation-data';
import type { RominaAssetMap, UploadedAssetRef } from '../dev/romina-invitation-data';
import type {
	CliArgs,
	NormalizedOutput,
	AssetAction,
	PhaseAction,
	CreatedResources,
	ApplyContext,
} from './romina/types';
import {
	deterministicStoragePath,
	hashBytes,
	fetchStoredImageHash,
	redactSecrets,
} from './romina/helpers';
import {
	parseArgs,
	validateEnvironment,
	createSupabaseClient,
} from './romina/environment';
import {
	validateOwnerExists,
	validateSourcePhotos,
	normalizePhotos,
	findInvitation,
	ensureInvitation,
	findExistingAssets,
	buildAssetActions,
} from './romina/preflight';
import {
	uploadToStorage,
	upsertAssetRow,
	ensureDraft,
} from './romina/assets';
import {
	publishInvitation,
	ensureEventMembership,
} from './romina/publication';
import {
	rollbackStorage,
	rollbackAssetRows,
} from './romina/rollback';

export type { DbClient } from './romina/types';
export type { NormalizedOutput, AssetAction, StoredAsset } from './romina/types';

// ---------------------------------------------------------------------------
// Phase runner — one phase at a time, keeping main() under complexity limit
// ---------------------------------------------------------------------------

async function phaseValidateSourcePhotos(sourceDir: string): Promise<void> {
	console.log('\x1b[33m📷 Phase 1/8: Validating source photographs\x1b[0m');
	validateSourcePhotos(sourceDir);
	console.log(`  ✓ All ${ROMINA_ASSET_SPECS.length} source photographs found`);
}

async function phaseValidateOwner(
	args: CliArgs,
	supabaseUrl: string,
	serviceRoleKey: string,
	isDryRun: boolean,
): Promise<void> {
	console.log('\x1b[33m👤 Phase 2/8: Validating owner\x1b[0m');
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidPattern.test(args.ownerUserId)) {
		console.error(`  ✗ "${args.ownerUserId}" is not a valid UUID.`);
		process.exit(1);
	}
	if (!isDryRun) {
		await validateOwnerExists(supabaseUrl, serviceRoleKey, args.ownerUserId);
		console.log(`  ✓ Owner ${args.ownerUserId} exists in auth.users`);
	} else {
		console.log(`  ✓ Owner UUID format valid: ${args.ownerUserId}`);
		console.log('  ~ Will verify existence in auth.users during --apply');
	}
}

function phaseConnect(supabaseUrl: string): string {
	console.log('\x1b[33m🔌 Phase 3/8: Connecting to Supabase\x1b[0m');
	const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
	console.log(`  ✓ Connected: ${projectRef}`);
	return projectRef;
}

async function phaseResolveInvitation(
	supabase: import('./romina/types').DbClient,
	args: CliArgs,
	isDryRun: boolean,
): Promise<{ invitationId: string; invitationAction: PhaseAction }> {
	console.log('\x1b[33m📋 Phase 4/8: Resolving invitation\x1b[0m');

	const invitationResult = await ensureInvitation(supabase, args.ownerUserId, isDryRun);
	if (invitationResult.action.action === 'abort') {
		console.error(`  ✗ ${invitationResult.action.detail}`);
		process.exit(1);
	}
	console.log(`  ✓ ${invitationResult.action.detail}`);
	return { invitationId: invitationResult.id, invitationAction: invitationResult.action };
}

async function phaseNormalize(sourceDir: string): Promise<NormalizedOutput[]> {
	console.log('\x1b[33m🖼️  Phase 5/8: Normalizing photographs\x1b[0m');
	const normalized = await normalizePhotos(sourceDir);
	for (const n of normalized) {
		console.log(
			`  ✓ ${n.displayName}: ${n.width}×${n.height}, ${(n.fileSize / 1024).toFixed(1)} KB WebP [${n.imageHash.slice(0, 12)}…]`,
		);
	}
	return normalized;
}

async function phasePlanAssets(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	normalized: NormalizedOutput[],
	supabaseUrl: string,
	serviceRoleKey: string,
): Promise<{
	assetActions: AssetAction[];
	assetMap: RominaAssetMap;
	existingAssets: Map<string, import('./romina/types').StoredAsset>;
	anyChangeNeeded: boolean;
}> {
	const existingAssets = invitationId
		? await findExistingAssets(supabase, invitationId)
		: new Map();
	let assetActions = buildAssetActions(normalized, existingAssets);

	// Hash verification: for assets where fileSize/width/height match,
	// fetch the stored bytes and verify SHA-256 hash definitively.
	for (const [i, action] of assetActions.entries()) {
		if (action.status !== 'identical') continue;
		const norm = normalized[i];
		const ex = existingAssets.get(norm.displayName);
		if (!ex) continue;
		const storedHash = await fetchStoredImageHash(supabaseUrl, serviceRoleKey, ex.storagePath);
		if (storedHash && storedHash !== norm.imageHash) {
			assetActions = assetActions.map((a, idx) =>
				idx === i
					? {
							...a,
							status: 'changed' as const,
							action: 'replace' as const,
							detail: `Image hash changed for ${norm.displayName}`,
						}
					: a,
			);
		}
	}

	for (const a of assetActions) {
		const icon = a.status === 'identical' ? '✓' : a.status === 'missing' ? '+' : '~';
		console.log(`  ${icon} ${a.detail}`);
	}

	if (!invitationId) {
		// Dry-run mode with no existing invitation
		const assetMap = {} as RominaAssetMap;
		for (const norm of normalized) {
			const storagePath = deterministicStoragePath('{invitationId}', norm.key);
			assetMap[norm.key] = {
				type: 'uploaded',
				assetId: `pending-${norm.key}`,
				src: `${supabaseUrl}/storage/v1/object/public/invitation-assets/${storagePath}`,
			};
		}
		const anyChange = assetActions.some((a) => a.status !== 'identical');
		return { assetActions, assetMap, existingAssets, anyChangeNeeded: anyChange };
	}

	const assetMap: RominaAssetMap = {} as RominaAssetMap;
	for (const norm of normalized) {
		const existing = existingAssets.get(norm.displayName);
		const storagePath =
			existing?.storagePath ?? deterministicStoragePath(invitationId, norm.key);
		assetMap[norm.key] = {
			type: 'uploaded',
			assetId: existing?.id ?? `pending-${norm.key}`,
			src: `${supabaseUrl}/storage/v1/object/public/invitation-assets/${storagePath}`,
		};
	}

	const anyChange = assetActions.some((a) => a.status !== 'identical');
	return { assetActions, assetMap, existingAssets, anyChangeNeeded: anyChange };
}

// ---------------------------------------------------------------------------
// Apply phases — execute writes with rollback support
// ---------------------------------------------------------------------------

async function applyUploads(
	ctx: ApplyContext,
	created: CreatedResources,
	mutationsPerformed: number,
): Promise<{ assetMap: RominaAssetMap; mutationsPerformed: number }> {
	console.log('\x1b[33m⬆️  Uploading to Storage\x1b[0m');
	const updatedMap = { ...ctx.assetMap };
	let count = mutationsPerformed;

	for (const [i, norm] of ctx.normalized.entries()) {
		if (ctx.assetActions[i].status === 'identical') {
			console.log(`  ✓ ${norm.displayName}: up to date`);
			continue;
		}
		const storagePath = deterministicStoragePath(ctx.invitationId, norm.key);
		await uploadToStorage(
			ctx.supabaseUrl,
			ctx.serviceRoleKey,
			storagePath,
			norm.bytes,
			norm.mimeType,
		);
		(updatedMap[norm.key] as UploadedAssetRef).src =
			`${ctx.supabaseUrl}/storage/v1/object/public/invitation-assets/${storagePath}`;
		created.storagePaths.push(storagePath);
		count++;
		console.log(`  + ${norm.displayName}: uploaded`);
	}
	return { assetMap: updatedMap, mutationsPerformed: count };
}

async function applyAssetRows(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	normalized: NormalizedOutput[],
	assetActions: AssetAction[],
	assetMap: RominaAssetMap,
	created: CreatedResources,
	mutationsPerformed: number,
): Promise<{ assetMap: RominaAssetMap; mutationsPerformed: number }> {
	console.log('\x1b[33m💾 Persisting asset metadata\x1b[0m');
	const updatedMap = { ...assetMap };
	let count = mutationsPerformed;

	for (const [i, norm] of normalized.entries()) {
		const storagePath = deterministicStoragePath(invitationId, norm.key);
		const rowId = await upsertAssetRow(supabase, invitationId, randomUUID(), norm, storagePath);
		(updatedMap[norm.key] as UploadedAssetRef).assetId = rowId;
		created.assetRowIds.push(rowId);
		if (assetActions[i].status !== 'identical') count++;
		console.log(
			`  ${assetActions[i].status === 'identical' ? '✓' : '+'} ${norm.displayName}: row persisted`,
		);
	}
	return { assetMap: updatedMap, mutationsPerformed: count };
}

async function applyDraft(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	assetMap: RominaAssetMap,
	mutationsPerformed: number,
): Promise<{
	draft: { id: string; updatedAt: string; action: PhaseAction };
	mutationsPerformed: number;
}> {
	console.log('\x1b[33m📄 Creating draft\x1b[0m');
	const draft = await ensureDraft(supabase, invitationId, assetMap);
	console.log(`  ✓ ${draft.action.detail}`);
	return { draft, mutationsPerformed: mutationsPerformed + 1 };
}

async function applyPublish(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	draftId: string,
	draftUpdatedAt: string,
	assetMap: RominaAssetMap,
	mutationsPerformed: number,
): Promise<{ publication: { version: number; action: PhaseAction }; mutationsPerformed: number }> {
	console.log('\x1b[33m🚀 Publishing\x1b[0m');
	const content = buildRominaPublishedContent(assetMap);
	const publication = await publishInvitation(
		supabase,
		invitationId,
		draftId,
		draftUpdatedAt,
		content,
	);
	console.log(`  ✓ ${publication.action.detail}`);
	return { publication, mutationsPerformed: mutationsPerformed + 1 };
}

async function applyMembership(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	ownerUserId: string,
	mutationsPerformed: number,
): Promise<number> {
	console.log('\x1b[33m👥 Event membership\x1b[0m');
	const membershipAction = await ensureEventMembership(supabase, invitationId, ownerUserId);
	const count = membershipAction.action !== 'skip' ? mutationsPerformed + 1 : mutationsPerformed;
	console.log(`  ✓ ${membershipAction.detail}`);
	return count;
}

async function applyVerify(
	supabase: import('./romina/types').DbClient,
	invitationId: string,
	publicationVersion: number,
	mutationsPerformed: number,
): Promise<void> {
	console.log('\n\x1b[36m═══ Verification ═══\x1b[0m');
	const { data: published } = await supabase
		.from('published_invitation_content')
		.select('slug, event_type, version, published_at')
		.eq('slug', ROMINA_EVENT.slug)
		.eq('event_type', ROMINA_EVENT.eventType)
		.is('deleted_at', null)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();

	const pub = published as Record<string, unknown> | null;
	console.log(
		`  ✓ Published: /${ROMINA_EVENT.eventType}/${ROMINA_EVENT.slug} (v${pub?.version ?? '?'})`,
	);

	const finalAssets = await findExistingAssets(supabase, invitationId);
	console.log(`  ✓ ${finalAssets.size}/${ROMINA_ASSET_SPECS.length} assets confirmed`);

	console.log(`\n\x1b[32m✅ Provisioning complete!\x1b[0m`);
	console.log(`   Route: /${ROMINA_EVENT.eventType}/${ROMINA_EVENT.slug}`);
	console.log(`   Version: ${publicationVersion}`);
	console.log(`   mutationsPerformed: ${mutationsPerformed}\n`);
}

// ---------------------------------------------------------------------------
// Main provisioner
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
	const args = parseArgs();
	const { supabaseUrl, serviceRoleKey } = validateEnvironment();
	const isDryRun = args.mode === 'dry-run';

	console.log(`\n\x1b[36m═══ Romina Ríos Chaparro — Invitation Provisioner ═══\x1b[0m`);
	console.log(`Mode: \x1b[1m${isDryRun ? 'DRY RUN (no writes)' : 'APPLY'}\x1b[0m\n`);

	// Phase 1-3: validation and connection (no writes)
	await phaseValidateSourcePhotos(args.sourceDir);
	await phaseValidateOwner(args, supabaseUrl, serviceRoleKey, isDryRun);

	const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey);
	const projectRef = phaseConnect(supabaseUrl);

	// Phase 4: Resolve invitation
	const { invitationId, invitationAction } = await phaseResolveInvitation(
		supabase,
		args,
		isDryRun,
	);

	// Phase 5: Normalize
	const normalized = await phaseNormalize(args.sourceDir);

	// Phase 6: Plan assets
	console.log('\x1b[33m📦 Phase 6/8: Planning asset operations\x1b[0m');
	const { assetActions, assetMap, anyChangeNeeded } = await phasePlanAssets(
		supabase,
		invitationId,
		normalized,
		supabaseUrl,
		serviceRoleKey,
	);

	// ── DRY RUN ─────────────────────────────────────────────────────────
	if (isDryRun) {
		console.log(`\n\x1b[36m═══ Dry-Run Summary ═══\x1b[0m`);
		console.log(`  Project:       ${projectRef}`);
		console.log(`  Owner:         ${args.ownerUserId}`);
		console.log(`  Photos:        ${ROMINA_ASSET_SPECS.length}/${ROMINA_ASSET_SPECS.length}`);
		console.log(`  Invitation:    ${invitationAction.action}`);
		const uploads = assetActions.filter(
			(a) => a.status === 'missing' || a.status === 'changed',
		).length;
		const reuses = assetActions.filter((a) => a.status === 'identical').length;
		console.log(`  Assets:        ${uploads} upload, ${reuses} reuse`);
		console.log(`  Draft:         ${anyChangeNeeded ? 'create/replace' : 'skip'}`);
		console.log(`  Publication:   ${anyChangeNeeded ? 'publish' : 'skip (no changes)'}`);
		console.log(`  \x1b[32mmutationsPerformed: 0\x1b[0m`);
		console.log(`\n\x1b[33mNo writes performed. Run with --apply to execute.\x1b[0m\n`);
		process.exit(0);
	}

	// ── APPLY ───────────────────────────────────────────────────────────
	const noop = !anyChangeNeeded;
	if (noop) {
		console.log(`\n\x1b[36m═══ No changes detected — nothing to apply ═══\x1b[0m`);
		console.log(`  Invitation ${invitationId} is already up to date.`);
		console.log(`  \x1b[32mmutationsPerformed: 0\x1b[0m`);
		console.log(
			`\n\x1b[33mUse --apply with different source images to trigger an update.\x1b[0m\n`,
		);
		process.exit(0);
	}

	console.log(`\n\x1b[36m═══ Executing Provisioning ═══\x1b[0m`);

	const created: CreatedResources = { storagePaths: [], assetRowIds: [] };
	let mutationsPerformed = 0;

	try {
		// Upload to Storage
		const uploadResult = await applyUploads(
			{
				supabase,
				supabaseUrl,
				serviceRoleKey,
				invitationId,
				normalized,
				assetActions,
				assetMap,
			},
			created,
			mutationsPerformed,
		);
		mutationsPerformed = uploadResult.mutationsPerformed;

		// Asset rows
		const rowResult = await applyAssetRows(
			supabase,
			invitationId,
			normalized,
			assetActions,
			uploadResult.assetMap,
			created,
			mutationsPerformed,
		);
		mutationsPerformed = rowResult.mutationsPerformed;

		// Draft
		const draftResult = await applyDraft(
			supabase,
			invitationId,
			rowResult.assetMap,
			mutationsPerformed,
		);
		mutationsPerformed = draftResult.mutationsPerformed;

		// Publish
		const publishResult = await applyPublish(
			supabase,
			invitationId,
			draftResult.draft.id,
			draftResult.draft.updatedAt,
			rowResult.assetMap,
			mutationsPerformed,
		);
		mutationsPerformed = publishResult.mutationsPerformed;

		// Event membership
		mutationsPerformed = await applyMembership(
			supabase,
			invitationId,
			args.ownerUserId,
			mutationsPerformed,
		);

		// Verification
		await applyVerify(
			supabase,
			invitationId,
			publishResult.publication.version,
			mutationsPerformed,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\n\x1b[31m═══ FAILURE ═══\x1b[0m`);
		console.error(`  ✗ ${redactSecrets(message)}`);
		if (created.storagePaths.length > 0) {
			console.log(
				`\n\x1b[33m[cleanup] Removing ${created.storagePaths.length} storage objects...\x1b[0m`,
			);
			await rollbackStorage(supabaseUrl, serviceRoleKey, created.storagePaths);
		}
		if (created.assetRowIds.length > 0) {
			console.log(
				`\x1b[33m[cleanup] Soft-deleting ${created.assetRowIds.length} asset rows...\x1b[0m`,
			);
			await rollbackAssetRows(supabase, created.assetRowIds);
		}
		console.log(`\n\x1b[33m[recovery] Safe to retry after fixing the issue.\x1b[0m`);
		console.log(`\x1b[33m[recovery] Pre-existing data was not deleted.\x1b[0m`);
		process.exit(1);
	}
}

// ── Re-export public symbols for the CLI and tests ─────────────────────

export {
	parseArgs,
	validateEnvironment,
	createSupabaseClient,
	validateOwnerExists,
	validateSourcePhotos,
	normalizePhotos,
	findInvitation,
	ensureInvitation,
	findExistingAssets,
	buildAssetActions,
	uploadToStorage,
	upsertAssetRow,
	ensureDraft,
	publishInvitation,
	ensureEventMembership,
	hashBytes,
	deterministicStoragePath,
	fetchStoredImageHash,
	redactSecrets,
	rollbackStorage,
	rollbackAssetRows,
};
