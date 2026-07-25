/**
 * reorganize-cloudinary-assets.ts — Managed Cloudinary Asset Reorganization Engine
 *
 * Two-phase safe migration script with preflight verification and reverse compensation.
 * Reorganizes Abril's 11 Cloudinary assets from `invitations/abril-michelle-becerra-rea/...`
 * to `xv/abril-michelle-becerra-rea/assets/<semantic-key>-<sha-prefix>` without binary replacement.
 */

import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveLocalEnv } from './local-provision-env.ts';
import {
	resolveCloudinaryConfig,
	initCloudinary,
} from './cloudinary-adapter.ts';
import { ABRIL_ASSET_SPECS } from './invitations/abril-michelle-becerra-rea.ts';
import { buildNormalizedInvitationRelease } from './normalized-invitation-release.ts';
import { applyLocalInvitation } from './apply-local-invitation.ts';

export interface MigrationMapping {
	key: string;
	displayName: string;
	stableAssetId: string;
	oldPublicId: string;
	newPublicId: string;
	assetFolder: string;
	sha256: string;
	bytes: number;
	format: string;
	width: number;
	height: number;
	oldSecureUrl: string;
	newSecureUrl: string;
	status: 'PENDING' | 'ALREADY_MIGRATED' | 'MIGRATED';
}

export interface MigrationJournal {
	startedAt: string;
	completedAt?: string;
	status: 'SUCCESS' | 'FAILED_COMPENSATED' | 'FAILED_UNRESOLVED';
	environment: string;
	targetFolder: string;
	mappings: MigrationMapping[];
	completedRemoteSteps: Array<{
		stableAssetId: string;
		oldPublicId: string;
		newPublicId: string;
		timestamp: string;
	}>;
	error?: string;
}

const TARGET_FOLDER = 'xv/abril-michelle-becerra-rea/assets';

export async function preflightReorganization(slug: string): Promise<MigrationMapping[]> {
	initCloudinary();
	const config = resolveCloudinaryConfig();

	if (!config.apiKey || !config.apiSecret) {
		throw new Error(
			'Preflight blocked: Cloudinary credentials missing in process.env or .env.local',
		);
	}

	const release = await buildNormalizedInvitationRelease({ slug });
	const specKeyMap = new Map(ABRIL_ASSET_SPECS.map((spec) => [spec.key, spec]));

	// Fetch current Cloudinary resources under both legacy and new folders
	const [legacyRes, newRes] = await Promise.all([
		cloudinary.api.resources({
			type: 'upload',
			prefix: `invitations/${slug}`,
			max_results: 100,
			context: true,
		}),
		cloudinary.api.resources({
			type: 'upload',
			prefix: TARGET_FOLDER,
			max_results: 100,
			context: true,
		}),
	]);

	const allResources = [...legacyRes.resources, ...newRes.resources];
	const resourceByPublicId = new Map<string, any>();

	for (const r of allResources) {
		resourceByPublicId.set(r.public_id, r);
	}

	const mappings: MigrationMapping[] = [];

	for (const asset of release.assets) {
		const spec = specKeyMap.get(asset.key as any);
		if (!spec) throw new Error(`Missing spec for asset key "${asset.key}"`);

		// Match existing resource by displayName, context sha256, or exact public ID
		const existingResource = allResources.find((r) => {
			const custom = r.context?.custom;
			if (custom?.displayName && decodeURIComponent(custom.displayName) === spec.displayName) return true;
			if (custom?.sha256 && custom.sha256 === asset.sha256) return true;
			if (r.public_id === `${TARGET_FOLDER}/${asset.key}-${asset.sha256.slice(0, 12)}`) return true;
			return false;
		});

		if (!existingResource) {
			throw new Error(
				`Preflight failed: Cloudinary resource for asset "${asset.key}" (${asset.displayName}) not found remote.`,
			);
		}

		const stableAssetId = existingResource.asset_id;
		const shaPrefix = asset.sha256.slice(0, 12);
		const newPublicId = `${TARGET_FOLDER}/${asset.key}-${shaPrefix}`;
		const newSecureUrl = `https://res.cloudinary.com/${config.cloudName}/image/upload/v1/${newPublicId}.webp`;

		const currentPublicId = existingResource.public_id;
		const isAlreadyMigrated = currentPublicId === newPublicId;

		// Check collision if destination public ID exists with a DIFFERENT asset_id
		const destCollision = resourceByPublicId.get(newPublicId);
		if (destCollision && destCollision.asset_id !== stableAssetId) {
			throw new Error(
				`Preflight collision error: Public ID "${newPublicId}" is occupied by resource asset_id "${destCollision.asset_id}" (expected "${stableAssetId}").`,
			);
		}

		mappings.push({
			key: asset.key,
			displayName: asset.displayName,
			stableAssetId,
			oldPublicId: currentPublicId,
			newPublicId,
			assetFolder: TARGET_FOLDER,
			sha256: asset.sha256,
			bytes: existingResource.bytes,
			format: existingResource.format,
			width: existingResource.width,
			height: existingResource.height,
			oldSecureUrl: existingResource.secure_url,
			newSecureUrl,
			status: isAlreadyMigrated ? 'ALREADY_MIGRATED' : 'PENDING',
		});
	}

	return mappings;
}

export async function executeReorganization(
	slug: string,
	apply: boolean = false,
): Promise<{ mappings: MigrationMapping[]; journal: MigrationJournal }> {
	const mappings = await preflightReorganization(slug);
	const journal: MigrationJournal = {
		startedAt: new Date().toISOString(),
		status: 'SUCCESS',
		environment: 'persistent-local',
		targetFolder: TARGET_FOLDER,
		mappings,
		completedRemoteSteps: [],
	};

	console.log('\n======================================================');
	console.log(' CLOUDINARY ASSET REORGANIZATION PREFLIGHT MATRIX');
	console.log('======================================================');
	for (const m of mappings) {
		console.log(`Asset Key: ${m.key.padEnd(26)} Status: ${m.status}`);
		console.log(`  Stable Asset ID : ${m.stableAssetId}`);
		console.log(`  Current Public ID: ${m.oldPublicId}`);
		console.log(`  Target Public ID : ${m.newPublicId}`);
		console.log(`  Target Folder    : ${m.assetFolder}`);
		console.log(`  SHA-256 (12-char): ${m.sha256.slice(0, 12)}`);
		console.log(`  Target Secure URL: ${m.newSecureUrl}`);
		console.log('------------------------------------------------------');
	}

	if (!apply) {
		console.log(
			'\n[DRY RUN COMPLETE] Preflight matrix verified zero mutations performed. Pass --apply to execute.',
		);
		return { mappings, journal };
	}

	// ── PHASE 2: REMOTE CLOUDINARY RENAME & FOLDER UPDATE ────────────────
	console.log('\nExecuting Phase 2: Remote Cloudinary Reorganization...');
	initCloudinary();

	for (const m of mappings) {
		if (m.status === 'ALREADY_MIGRATED') {
			console.log(`Skipping asset "${m.key}": already organized under ${m.newPublicId}`);
			continue;
		}

		try {
			console.log(`Renaming Cloudinary asset ${m.stableAssetId}: ${m.oldPublicId} -> ${m.newPublicId}`);
			const renameRes = await cloudinary.uploader.rename(m.oldPublicId, m.newPublicId, {
				overwrite: false,
			});

			if (renameRes.asset_id !== m.stableAssetId) {
				throw new Error(
					`Stable asset ID invariant violated during rename for "${m.key}". Expected ${m.stableAssetId}, got ${renameRes.asset_id}`,
				);
			}

			// Update asset_folder explicitly
			try {
				await cloudinary.api.update(m.newPublicId, { asset_folder: TARGET_FOLDER });
			} catch (folderErr) {
				console.warn(
					`Warning: asset_folder update for "${m.newPublicId}" returned advisory notice: ${folderErr}`,
				);
			}

			journal.completedRemoteSteps.push({
				stableAssetId: m.stableAssetId,
				oldPublicId: m.oldPublicId,
				newPublicId: m.newPublicId,
				timestamp: new Date().toISOString(),
			});

			m.status = 'MIGRATED';
		} catch (err) {
			console.error(
				`Remote rename failed for asset "${m.key}" (${m.oldPublicId} -> ${m.newPublicId}):`,
				err,
			);
			journal.status = 'FAILED_COMPENSATED';
			journal.error = String(err);

			// ── COMPENSATION: Reverse completed remote steps ─────────────────
			console.log('\nInitiating Compensation Phase: Reversing completed Cloudinary renames...');
			for (const step of [...journal.completedRemoteSteps].reverse()) {
				try {
					console.log(`Reversing rename for ${step.stableAssetId}: ${step.newPublicId} -> ${step.oldPublicId}`);
					await cloudinary.uploader.rename(step.newPublicId, step.oldPublicId, {
						overwrite: true,
					});
				} catch (compErr) {
					console.error(`Compensation error for asset ${step.stableAssetId}:`, compErr);
					journal.status = 'FAILED_UNRESOLVED';
				}
			}
			throw new Error(`Cloudinary reorganization failed and compensated: ${err}`);
		}
	}

	// ── PHASE 3: DATABASE & PUBLICATION UPDATE ───────────────────────────
	console.log('\nExecuting Phase 3: Database & Publication Update...');
	const env = resolveLocalEnv();
	const supabase = createClient(env.apiUrl, env.serviceRoleKey);

	const { data: inv } = await supabase
		.from('invitations')
		.select('id')
		.eq('slug', slug)
		.single();

	if (!inv?.id) {
		throw new Error(`Database update failed: Invitation "${slug}" not found.`);
	}

	for (const m of mappings) {
		const { error: dbErr } = await supabase
			.from('invitation_assets')
			.update({
				provider: 'cloudinary',
				provider_public_id: m.newPublicId,
				storage_path: m.newPublicId,
				secure_url: m.newSecureUrl,
				sha256: m.sha256,
				file_size: m.bytes,
				width: m.width,
				height: m.height,
				provider_metadata: {
					asset_id: m.stableAssetId,
					asset_folder: TARGET_FOLDER,
					format: m.format,
				},
			})
			.eq('invitation_id', inv.id)
			.eq('display_name', m.displayName);

		if (dbErr) {
			console.error(`DB asset update failed for "${m.displayName}":`, dbErr);
			throw dbErr;
		}
	}

	// Publish updated content with new Cloudinary URLs and swapped Family/Gallery 2 photos
	console.log('Publishing updated invitation release with new asset hierarchy (updateScope: assets-only)...');
	const applyResult = await applyLocalInvitation({ slug, apply: true, updateScope: 'assets-only' });
	console.log(`Release published successfully at version ${applyResult.publishedVersion}!`);

	journal.completedAt = new Date().toISOString();
	const logsDir = resolve(process.cwd(), 'logs');
	if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
	writeFileSync(
		resolve(logsDir, 'cloudinary-reorganization-journal.json'),
		JSON.stringify(journal, null, 2),
		'utf8',
	);

	return { mappings, journal };
}

if (process.argv[1]?.endsWith('reorganize-cloudinary-assets.ts')) {
	const isApply = process.argv.includes('--apply');
	executeReorganization('abril-michelle-becerra-rea', isApply).catch((err) => {
		console.error('Fatal error during reorganization:', err);
		process.exit(1);
	});
}
