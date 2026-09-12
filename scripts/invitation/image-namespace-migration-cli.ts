#!/usr/bin/env tsx
/** Read-only plans and explicitly gated Preview migration of invitation images. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
	buildCloudinaryDeliveryUrl,
	buildCloudinaryPublicId,
	verifyCloudinaryAsset,
	uploadOrReconcileCloudinaryAsset,
	getCloudinaryErrorStatus,
	hydrateCloudinaryEnvFromFiles,
} from '../provision/cloudinary-adapter.ts';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import {
	assertPreviewDbUrl,
	assertProductionDbUrl,
	getPreviewDbUrl,
	getProdDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { authorizePreviewWriteApply } from '../provision/preview-write-auth.ts';
import { hasValidProductionWritePermit } from '../db/production-write-permit.ts';
import { redactCredentials } from '../db/db-target-config.ts';
import {
	buildNamespaceRemapSql,
	buildNamespaceRollbackSql,
	type NamespaceAssetSwap,
	type NamespaceAssetRetirement,
	type NamespaceSnapshot,
} from './image-namespace-remap.ts';

type Target = 'preview' | 'production';

function safeFailure(error: unknown): string {
	const status = getCloudinaryErrorStatus(error);
	if (status) return `Cloudinary HTTP ${status}`;
	if (error instanceof Error) return redactCredentials(error.message);
	return 'provider verification failed without a typed error';
}
interface SourceAsset {
	id: string;
	key: string | null;
	displayName: string;
	alt: string | null;
	publicId: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
}
export interface LiveSnapshot extends NamespaceSnapshot {
	assets: SourceAsset[];
	historicalContents: Record<string, unknown>[];
}
export interface MigrationPlan {
	schemaVersion: 1;
	planId: string;
	target: Target;
	slug: string;
	snapshotHash: string;
	cloudName: string;
	before: NamespaceSnapshot;
	swaps: NamespaceAssetSwap[];
	retirements: NamespaceAssetRetirement[];
}

export function computePlanId(
	plan: Omit<MigrationPlan, 'schemaVersion' | 'planId' | 'cloudName'>,
): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				target: plan.target,
				slug: plan.slug,
				snapshotHash: plan.snapshotHash,
				before: plan.before,
				swaps: plan.swaps,
				retirements: plan.retirements,
			}),
		)
		.digest('hex');
}

function targetUrl(target: Target): string {
	const url = target === 'preview' ? getPreviewDbUrl().url : getProdDbUrl().url;
	if (target === 'preview') assertPreviewDbUrl(url);
	else assertProductionDbUrl(url);
	return url;
}

export function readSnapshot(target: Target, slug: string, dbUrl: string): LiveSnapshot {
	const sql = `select row_to_json(t) from (
		select i.id::text as "invitationId", i.slug, i.event_type as "eventType",
			${sqlLiteral(target)} as "targetEnvironment",
			(select json_build_object('id', d.id::text, 'content', d.content)
			 from public.invitation_content_drafts d where d.invitation_project_id = i.id
			 and d.deleted_at is null order by d.updated_at desc limit 1) as draft,
			(select json_build_object('id', p.id::text, 'version', p.version, 'content', p.content)
			 from public.published_invitation_content p where p.invitation_project_id = i.id
			 and p.deleted_at is null order by p.version desc limit 1) as published,
			coalesce((select json_agg(p.content) from public.published_invitation_content p
			 where p.invitation_project_id = i.id and p.deleted_at is null), '[]'::json) as "historicalContents",
			coalesce((select json_agg(json_build_object(
				'id', a.id::text, 'key', a.managed_source_key, 'displayName', a.display_name,
				'alt', a.default_alt_text, 'publicId', a.provider_public_id,
				'sha256', a.sha256, 'mimeType', a.mime_type, 'width', a.width, 'height', a.height))
			 from public.invitation_assets a where a.invitation_id = i.id and a.deleted_at is null
			 and a.provider = 'cloudinary' and a.mime_type like 'image/%'
			 and a.provider_public_id not like 'preview/%'
			 and a.provider_public_id not like 'production/%'), '[]'::json) as assets
		from public.invitations i where i.slug = ${sqlLiteral(slug)}
		and i.kind = 'client' and i.archived_at is null
	) t;`;
	const output = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true }).stdout.trim();
	if (!output) throw new Error(`Active client invitation ${slug} was not found in ${target}.`);
	return JSON.parse(output) as LiveSnapshot;
}

function listLegacySlugs(dbUrl: string): string[] {
	const result = runPsql(
		`select coalesce(json_agg(slug order by slug), '[]'::json)::text
		from (select distinct i.slug from public.invitations i
		join public.invitation_assets a on a.invitation_id = i.id
		where i.kind = 'client' and i.archived_at is null and a.deleted_at is null
		and a.provider = 'cloudinary' and a.mime_type like 'image/%'
		and a.provider_public_id not like 'preview/%'
		and a.provider_public_id not like 'production/%') s;`,
		dbUrl,
		{
			tuplesOnly: true,
			throwOnError: true,
		},
	);
	return JSON.parse(result.stdout.trim()) as string[];
}

export function fingerprint(snapshot: LiveSnapshot): string {
	return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function previousFingerprint(snapshot: LiveSnapshot): string {
	const { historicalContents: _historicalContents, ...previousShape } = snapshot;
	return createHash('sha256').update(JSON.stringify(previousShape)).digest('hex');
}

export function canonicalCloudName(): string {
	const cloudName = hydrateCloudinaryEnvFromFiles({
		keys: ['CLOUDINARY_CLOUD_NAME'],
	}).CLOUDINARY_CLOUD_NAME?.trim();
	if (!cloudName || cloudName === 'unconfigured')
		throw new Error('Cloudinary cloud name is unavailable.');
	return cloudName;
}

export function readMigrationManifest(manifestPath: string): MigrationPlan {
	const plan = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as MigrationPlan;
	if (
		plan.schemaVersion !== 1 ||
		plan.planId !== computePlanId(plan) ||
		plan.cloudName !== canonicalCloudName() ||
		!plan.before?.draft
	)
		throw new Error('Migration manifest identity or Cloudinary environment changed.');
	return plan;
}

function buildPlan(snapshot: LiveSnapshot, cloudName: string): MigrationPlan {
	if (!snapshot.draft) throw new Error('Migration requires an active invitation draft.');
	const refs = new Set(
		[
			...collectUploadedContentRefs(snapshot.draft.content),
			...collectUploadedContentRefs(snapshot.published?.content),
		].map((ref) => ref.assetId),
	);
	const historicalRefs = new Set(
		snapshot.historicalContents.flatMap((content) =>
			collectUploadedContentRefs(content).map((ref) => ref.assetId),
		),
	);
	const swaps: NamespaceAssetSwap[] = [];
	const retirements: NamespaceAssetRetirement[] = [];
	for (const asset of snapshot.assets) {
		if (!asset.key || !asset.sha256 || !asset.mimeType || !asset.width || !asset.height)
			throw new Error(`${snapshot.slug}: legacy asset ${asset.id} has incomplete metadata.`);
		if (!refs.has(asset.id)) {
			if (historicalRefs.has(asset.id))
				throw new Error(
					`${snapshot.slug}: asset ${asset.key} is referenced by historical publication.`,
				);
			retirements.push({ id: asset.id, publicId: asset.publicId, sha256: asset.sha256 });
			continue;
		}
		const newPublicId = buildCloudinaryPublicId({
			targetEnvironment: snapshot.targetEnvironment,
			eventType: snapshot.eventType,
			slug: snapshot.slug,
			key: asset.key,
			sha256: asset.sha256,
		});
		swaps.push({
			oldId: asset.id,
			newId: randomUUID(),
			key: asset.key,
			oldPublicId: asset.publicId,
			newPublicId,
			newUrl: buildCloudinaryDeliveryUrl(cloudName, newPublicId, asset.mimeType),
			sha256: asset.sha256,
			mimeType: asset.mimeType,
			width: asset.width,
			height: asset.height,
			providerVersion: '',
			providerMetadata: {},
		});
	}
	const snapshotHash = fingerprint(snapshot);
	const before: NamespaceSnapshot = {
		targetEnvironment: snapshot.targetEnvironment,
		invitationId: snapshot.invitationId,
		slug: snapshot.slug,
		eventType: snapshot.eventType,
		draft: snapshot.draft,
		published: snapshot.published,
	};
	return {
		schemaVersion: 1,
		planId: computePlanId({
			target: snapshot.targetEnvironment,
			slug: snapshot.slug,
			snapshotHash,
			before,
			swaps,
			retirements,
		}),
		target: snapshot.targetEnvironment,
		slug: snapshot.slug,
		snapshotHash,
		cloudName,
		before,
		swaps,
		retirements,
	};
}

export async function verifySource(swap: NamespaceAssetSwap): Promise<void> {
	await verifyCloudinaryAsset({
		publicId: swap.oldPublicId,
		sha256: swap.sha256,
		mimeType: swap.mimeType,
		width: swap.width,
		height: swap.height,
	});
}

export async function applyRemoteMigration(
	plan: MigrationPlan,
	snapshot: LiveSnapshot,
	dbUrl: string,
): Promise<void> {
	if (
		plan.target === 'production' &&
		!hasValidProductionWritePermit(dbUrl, Date.now(), plan.planId, 'production_apply')
	)
		throw new Error('Production migration requires the owner-confirmed prod:apply permit.');
	if (plan.snapshotHash !== fingerprint(snapshot))
		throw new Error('Migration source changed before copy.');
	for (const swap of plan.swaps) {
		await verifySource(swap);
		const sourceUrl = buildCloudinaryDeliveryUrl(
			plan.cloudName,
			swap.oldPublicId,
			swap.mimeType,
		);
		const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) throw new Error(`${swap.key}: source delivery HTTP ${response.status}.`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (createHash('sha256').update(bytes).digest('hex') !== swap.sha256)
			throw new Error(`${swap.key}: source binary SHA-256 changed before copy.`);
		const source = snapshot.assets.find((asset) => asset.id === swap.oldId)!;
		const result = await uploadOrReconcileCloudinaryAsset({
			targetEnvironment: plan.target,
			eventType: snapshot.eventType,
			slug: snapshot.slug,
			key: swap.key,
			displayName: source.displayName,
			alt: source.alt ?? '',
			bytes,
			sha256: swap.sha256,
			mimeType: swap.mimeType,
			width: swap.width,
			height: swap.height,
		});
		if (result.publicId !== swap.newPublicId || result.secureUrl !== swap.newUrl)
			throw new Error(`${swap.key}: Cloudinary destination identity changed.`);
		swap.providerVersion = result.version;
		swap.providerMetadata = result.metadata;
		await verifyCloudinaryAsset({
			publicId: swap.newPublicId,
			sha256: swap.sha256,
			mimeType: swap.mimeType,
			width: swap.width,
			height: swap.height,
		});
	}
	const current = readSnapshot(plan.target, plan.slug, dbUrl);
	if (fingerprint(current) !== plan.snapshotHash)
		throw new Error('Target changed during Cloudinary copy; no database rows were changed.');
	runPsql(buildNamespaceRemapSql(current, plan.swaps, plan.retirements), dbUrl, {
		throwOnError: true,
	});
	const after = readSnapshot(plan.target, plan.slug, dbUrl);
	if (
		after.assets.some(
			(asset) =>
				plan.swaps.some((swap) => swap.oldId === asset.id) ||
				plan.retirements.some((retirement) => retirement.id === asset.id),
		)
	)
		throw new Error(
			'Database remap returned, but legacy rows remain active; inspect before retry.',
		);
}

async function rollbackPreview(plan: MigrationPlan, dbUrl: string): Promise<void> {
	if (plan.target !== 'preview')
		throw new Error('Production rollback requires the owner workflow.');
	await authorizePreviewWriteApply({
		slug: plan.slug,
		operation: 'image-namespace-rollback',
		confirmPrompt: `Roll back reviewed image migration ${plan.planId.slice(0, 8)} in Preview? Type YES: `,
	});
	runPsql(buildNamespaceRollbackSql(plan.before, plan.swaps, plan.retirements), dbUrl, {
		throwOnError: true,
	});
}

async function planAll(target: Target, outputDir: string, dbUrl: string): Promise<void> {
	const slugs = listLegacySlugs(dbUrl);
	const cloudName = canonicalCloudName();
	const targetDir = resolve(outputDir, target);
	mkdirSync(targetDir, { recursive: true });
	const failures: string[] = [];
	let images = 0;
	for (const slug of slugs) {
		try {
			const path = join(targetDir, `${slug}.json`);
			if (existsSync(path)) throw new Error('reviewed manifest already exists');
			const plan = buildPlan(readSnapshot(target, slug, dbUrl), cloudName);
			for (const swap of plan.swaps) await verifySource(swap);
			writeFileSync(path, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
			images += plan.swaps.length;
			process.stdout.write(`${target}/${slug}: ${plan.swaps.length} verified.\n`);
		} catch (error: unknown) {
			failures.push(`${slug}: ${safeFailure(error)}`);
		}
	}
	process.stdout.write(
		`${target}: ${slugs.length - failures.length}/${slugs.length} manifests, ${images} verified images.\n`,
	);
	if (failures.length > 0) throw new Error(failures.join('\n'));
}

function refreshVerifiedPlan(
	target: Target,
	slug: string,
	oldPath: string,
	newPath: string,
	dbUrl: string,
): void {
	const old = readMigrationManifest(oldPath);
	const snapshot = readSnapshot(target, slug, dbUrl);
	if (
		old.target !== target ||
		old.slug !== slug ||
		old.snapshotHash !== previousFingerprint(snapshot)
	)
		throw new Error(`${target}/${slug}: previously verified database snapshot changed.`);
	const historicalRefs = new Set(
		snapshot.historicalContents.flatMap((content) =>
			collectUploadedContentRefs(content).map((ref) => ref.assetId),
		),
	);
	if (old.retirements.some((item) => historicalRefs.has(item.id)))
		throw new Error(`${target}/${slug}: retirement is used by historical content.`);
	if (existsSync(resolve(newPath)))
		throw new Error('Refusing to replace an existing reviewed manifest.');
	const updated = { ...old, snapshotHash: fingerprint(snapshot) };
	updated.planId = computePlanId(updated);
	mkdirSync(dirname(resolve(newPath)), { recursive: true });
	writeFileSync(resolve(newPath), JSON.stringify(updated, null, 2) + '\n', { flag: 'wx' });
}

// eslint-disable-next-line complexity -- CLI entrypoint validates exact target, manifest, and apply authority.
async function main(): Promise<void> {
	const [mode, target, slug, manifestPath] = process.argv.slice(2);
	if (
		mode !== 'plan' &&
		mode !== 'plan-all' &&
		mode !== 'refresh-verified' &&
		mode !== 'apply-preview' &&
		mode !== 'rollback-preview'
	)
		throw new Error(
			'Usage: image-namespace-migration-cli.ts <plan|plan-all|refresh-verified|apply-preview|rollback-preview> <preview|production> <slug|output-dir> [manifest.json]',
		);
	if (target !== 'preview' && target !== 'production') throw new Error('Invalid target.');
	const dbUrl = targetUrl(target);
	if (mode === 'plan-all') {
		if (!slug) throw new Error('Plan-all requires an output directory.');
		await planAll(target, slug, dbUrl);
		return;
	}
	if (mode === 'refresh-verified') {
		if (!slug || !manifestPath)
			throw new Error('Refresh requires old and new manifest directories.');
		const slugs = listLegacySlugs(dbUrl);
		for (const item of slugs) {
			refreshVerifiedPlan(
				target,
				item,
				join(slug, target, `${item}.json`),
				join(manifestPath, target, `${item}.json`),
				dbUrl,
			);
		}
		process.stdout.write(
			`${target}: ${slugs.length} provider-verified manifests refreshed against current DB history.\n`,
		);
		return;
	}
	if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Invalid slug.');
	const snapshot = readSnapshot(target, slug, dbUrl);
	if (mode === 'plan') {
		const plan = buildPlan(snapshot, canonicalCloudName());
		for (const swap of plan.swaps) await verifySource(swap);
		if (manifestPath && existsSync(resolve(manifestPath)))
			throw new Error('Refusing to replace an existing reviewed migration manifest.');
		if (manifestPath) {
			const destination = resolve(manifestPath);
			mkdirSync(dirname(destination), { recursive: true });
			writeFileSync(destination, JSON.stringify(plan, null, 2) + '\n');
		}
		process.stdout.write(
			`${target}/${slug}: ${plan.swaps.length} verified images, ${plan.retirements.length} unused rows; plan ${plan.planId.slice(0, 8)}${manifestPath ? ` saved as ${basename(manifestPath)}` : ''}.\n`,
		);
		return;
	}
	if (!manifestPath) throw new Error('Apply requires the reviewed manifest path.');
	const plan = readMigrationManifest(manifestPath);
	if (
		plan.target !== target ||
		plan.slug !== slug ||
		plan.before.invitationId !== snapshot.invitationId
	)
		throw new Error('Manifest does not match the current target invitation.');
	if (target !== 'preview') throw new Error('Production migration requires the owner workflow.');
	if (mode === 'rollback-preview') {
		await rollbackPreview(plan, dbUrl);
		process.stdout.write(
			`${target}/${slug}: migration ${plan.planId.slice(0, 8)} rolled back.\n`,
		);
		return;
	}
	if (plan.snapshotHash !== fingerprint(snapshot))
		throw new Error('Manifest does not match the current target snapshot.');
	await authorizePreviewWriteApply({
		slug: plan.slug,
		operation: 'image-namespace-migrate',
		confirmPrompt: `Apply reviewed image migration ${plan.planId.slice(0, 8)} to Preview? Type YES: `,
	});
	await applyRemoteMigration(plan, snapshot, dbUrl);
	process.stdout.write(
		`${target}/${slug}: ${plan.swaps.length} images migrated; verify the public route before acceptance.\n`,
	);
}

if (process.argv[1]?.endsWith('image-namespace-migration-cli.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(safeFailure(error) + '\n');
		process.exitCode = 1;
	});
}
