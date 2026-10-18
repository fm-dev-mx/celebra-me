#!/usr/bin/env tsx
/** Reviewed, content-addressed migration of Cloudinary invitation media to Cloudflare R2. */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
	R2_IMMUTABLE_CACHE_CONTROL,
	R2_INVITATION_MEDIA,
	buildR2ObjectKey,
	buildR2PublicUrl,
	buildR2SocialObjectKey,
	type R2MediaTargetEnvironment,
} from '../../src/lib/intake/services/r2-invitation-media.ts';
import {
	assertProductionDbUrl,
	getProdDbUrl,
	requirePreviewDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { redactCredentials } from '../db/db-target-config.ts';
import { hasValidProductionWritePermit } from '../db/production-write-permit.ts';
import { authorizePreviewWriteApply } from '../provision/preview-write-auth.ts';
import {
	buildNamespaceRemapSql,
	buildNamespaceRollbackSql,
	rewriteNamespaceRefs,
	type NamespaceAssetSwap,
	type NamespaceRemapOptions,
	type NamespaceSnapshot,
	type NamespaceUrlSwap,
} from './image-namespace-remap.ts';

type Target = R2MediaTargetEnvironment;

const CLOUDINARY_URL = /https:\/\/res\.cloudinary\.com\/[^"\s]+/gu;
const CLOUDINARY_AUDIO = /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/.+\.(mp3|m4a)$/iu;
const AUDIO_MIME: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4' };
const SOCIAL_CARD = { width: 1200, height: 630, quality: 82 } as const;

interface SourceAsset {
	id: string;
	key: string | null;
	publicId: string;
	secureUrl: string;
	sha256: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
}

export interface R2LiveSnapshot extends NamespaceSnapshot {
	assets: SourceAsset[];
}

/** One destination object; a social card has no source URL and derives from `socialOf`. */
export interface R2MediaObject {
	objectKey: string;
	mimeType: string;
	sourceUrl: string | null;
	sha256: string | null;
	socialOf?: string;
}

export interface R2MigrationPlan {
	schemaVersion: 1;
	kind: 'r2-media';
	planId: string;
	target: Target;
	slug: string;
	snapshotHash: string;
	before: NamespaceSnapshot;
	swaps: NamespaceAssetSwap[];
	urlSwaps: NamespaceUrlSwap[];
	objects: R2MediaObject[];
}

function safeFailure(error: unknown): string {
	return redactCredentials(error instanceof Error ? error.message : String(error));
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function r2RemapOptions(plan: Pick<R2MigrationPlan, 'urlSwaps'>): NamespaceRemapOptions {
	return { destination: 'r2', urlSwaps: plan.urlSwaps };
}

export function computeR2PlanId(plan: Omit<R2MigrationPlan, 'planId'>): string {
	const { schemaVersion, kind, target, slug, snapshotHash, before, swaps, urlSwaps, objects } =
		plan;
	return createHash('sha256')
		.update(
			JSON.stringify({
				schemaVersion,
				kind,
				target,
				slug,
				snapshotHash,
				before,
				swaps,
				urlSwaps,
				objects,
			}),
		)
		.digest('hex');
}

export function r2TargetUrl(target: Target): string {
	const url = target === 'preview' ? requirePreviewDbUrl().url : getProdDbUrl().url;
	if (target === 'production') assertProductionDbUrl(url);
	return url;
}

export function readR2Snapshot(target: Target, slug: string, dbUrl: string): R2LiveSnapshot {
	const sql = `select row_to_json(t) from (
		select i.id::text as "invitationId", i.slug, i.event_type as "eventType",
			${sqlLiteral(target)} as "targetEnvironment",
			(select json_build_object('id', d.id::text, 'content', d.content)
			 from public.invitation_content_drafts d where d.invitation_project_id = i.id
			 and d.deleted_at is null order by d.updated_at desc limit 1) as draft,
			(select json_build_object('id', p.id::text, 'version', p.version, 'content', p.content)
			 from public.published_invitation_content p where p.invitation_project_id = i.id
			 and p.deleted_at is null order by p.version desc limit 1) as published,
			coalesce((select json_agg(json_build_object(
				'id', a.id::text, 'key', a.managed_source_key, 'publicId', a.provider_public_id,
				'secureUrl', a.secure_url, 'sha256', a.sha256, 'mimeType', a.mime_type,
				'width', a.width, 'height', a.height) order by a.id)
			 from public.invitation_assets a where a.invitation_id = i.id and a.deleted_at is null
			 and a.provider = 'cloudinary' and a.mime_type like 'image/%'), '[]'::json) as assets
		from public.invitations i where i.slug = ${sqlLiteral(slug)}
		and i.kind = 'client' and i.archived_at is null
	) t;`;
	const output = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true }).stdout.trim();
	if (!output) throw new Error(`Active client invitation ${slug} was not found in ${target}.`);
	return JSON.parse(output) as R2LiveSnapshot;
}

export function fingerprintR2Snapshot(snapshot: R2LiveSnapshot): string {
	return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function cloudinaryUrlsIn(content: unknown): string[] {
	return JSON.stringify(content ?? null).match(CLOUDINARY_URL) ?? [];
}

async function download(url: string): Promise<{ bytes: Uint8Array; status: number }> {
	const response = await fetch(url, { redirect: 'error' });
	const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
	return { bytes, status: response.status };
}

async function verifiedImage(asset: SourceAsset): Promise<Uint8Array> {
	const { bytes, status } = await download(asset.secureUrl);
	if (status !== 200) throw new Error(`${asset.key ?? asset.id}: source HTTP ${status}.`);
	if (sha256(bytes) !== asset.sha256)
		throw new Error(`${asset.key ?? asset.id}: source bytes differ from the recorded sha256.`);
	const meta = await sharp(bytes).metadata();
	const format = meta.format === 'jpeg' ? 'image/jpeg' : `image/${meta.format}`;
	if (format !== asset.mimeType || meta.width !== asset.width || meta.height !== asset.height)
		throw new Error(`${asset.key ?? asset.id}: source format or dimensions changed.`);
	return bytes;
}

export async function buildSocialCard(original: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(
		await sharp(original)
			.rotate()
			.resize(SOCIAL_CARD.width, SOCIAL_CARD.height, { fit: 'cover', position: 'attention' })
			.jpeg({ quality: SOCIAL_CARD.quality, mozjpeg: true })
			.toBuffer(),
	);
}

/** Reads every source once, so a reviewed plan records verified digests only. */
export async function buildR2Plan(snapshot: R2LiveSnapshot): Promise<R2MigrationPlan> {
	if (!snapshot.draft) throw new Error('Migration requires an active invitation draft.');
	const target = snapshot.targetEnvironment;
	const swaps: NamespaceAssetSwap[] = [];
	const objects: R2MediaObject[] = [];
	for (const asset of snapshot.assets) {
		if (!asset.sha256 || !asset.mimeType || !asset.width || !asset.height || !asset.secureUrl)
			throw new Error(`${snapshot.slug}: asset ${asset.id} has incomplete metadata.`);
		await verifiedImage(asset);
		const key = asset.key ?? `asset-${asset.id.slice(0, 8)}`;
		const objectKey = buildR2ObjectKey({
			eventType: snapshot.eventType,
			slug: snapshot.slug,
			key,
			sha256: asset.sha256,
			mimeType: asset.mimeType,
		});
		const socialKey = buildR2SocialObjectKey(objectKey);
		swaps.push({
			oldId: asset.id,
			newId: randomUUID(),
			key,
			oldPublicId: asset.publicId,
			newPublicId: objectKey,
			newUrl: buildR2PublicUrl(target, objectKey),
			newOgUrl: buildR2PublicUrl(target, socialKey),
			sha256: asset.sha256,
			mimeType: asset.mimeType,
			width: asset.width,
			height: asset.height,
			providerVersion: asset.sha256,
			providerMetadata: {
				storage_provider: 'r2',
				source_provider: 'cloudinary',
				source_public_id: asset.publicId,
			},
		});
		objects.push(
			{
				objectKey,
				mimeType: asset.mimeType,
				sourceUrl: asset.secureUrl,
				sha256: asset.sha256,
			},
			{
				objectKey: socialKey,
				mimeType: 'image/jpeg',
				sourceUrl: null,
				sha256: null,
				socialOf: objectKey,
			},
		);
	}
	const activeUrls = new Set([
		...cloudinaryUrlsIn(snapshot.draft.content),
		...cloudinaryUrlsIn(snapshot.published?.content),
	]);
	const urlSwaps: NamespaceUrlSwap[] = [];
	for (const url of [...activeUrls].sort()) {
		const audio = url.match(CLOUDINARY_AUDIO);
		if (!audio) continue;
		const { bytes, status } = await download(url);
		if (status !== 200) throw new Error(`${snapshot.slug}: audio source HTTP ${status}.`);
		const digest = sha256(bytes);
		const mimeType = AUDIO_MIME[audio[1].toLowerCase()];
		const objectKey = buildR2ObjectKey({
			eventType: snapshot.eventType,
			slug: snapshot.slug,
			key: 'music',
			sha256: digest,
			mimeType,
		});
		urlSwaps.push({ oldUrl: url, newUrl: buildR2PublicUrl(target, objectKey) });
		objects.push({ objectKey, mimeType, sourceUrl: url, sha256: digest });
	}
	const plan: Omit<R2MigrationPlan, 'planId'> = {
		schemaVersion: 1,
		kind: 'r2-media',
		target,
		slug: snapshot.slug,
		snapshotHash: fingerprintR2Snapshot(snapshot),
		before: {
			targetEnvironment: target,
			invitationId: snapshot.invitationId,
			slug: snapshot.slug,
			eventType: snapshot.eventType,
			draft: snapshot.draft,
			published: snapshot.published,
		},
		swaps,
		urlSwaps,
		objects,
	};
	buildNamespaceRemapSql(snapshot, swaps, [], r2RemapOptions(plan));
	// Coverage: every Cloudinary URL in the active content must have a planned replacement.
	const uncovered = [snapshot.draft.content, snapshot.published?.content]
		.filter((content): content is Record<string, unknown> => Boolean(content))
		.flatMap((content) =>
			cloudinaryUrlsIn(rewriteNamespaceRefs(content, swaps, r2RemapOptions(plan))),
		);
	if (uncovered.length > 0)
		throw new Error(
			`${snapshot.slug}: ${uncovered.length} Cloudinary URLs have no R2 replacement.`,
		);
	return { ...plan, planId: computeR2PlanId(plan) };
}

export function readR2MigrationManifest(manifestPath: string): R2MigrationPlan {
	const plan = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as R2MigrationPlan;
	const { planId, ...rest } = plan;
	if (plan.schemaVersion !== 1 || plan.kind !== 'r2-media' || planId !== computeR2PlanId(rest))
		throw new Error('R2 migration manifest identity changed.');
	return plan;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The Windows shell joins arguments, so values with spaces need their own quotes there. */
function shellArg(value: string): string {
	return process.platform === 'win32' ? `"${value}"` : value;
}

function wranglerBinary(): string {
	const name = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
	return shellArg(resolve(REPO_ROOT, 'node_modules', '.bin', name));
}

/** Uncached read of the public object; the query keeps CDN entries out of verification. */
async function readPublished(target: Target, objectKey: string) {
	return download(`${buildR2PublicUrl(target, objectKey)}?verify=${randomUUID()}`);
}

async function assertSocialCard(bytes: Uint8Array, objectKey: string): Promise<void> {
	const meta = await sharp(bytes).metadata();
	if (
		meta.format !== 'jpeg' ||
		meta.width !== SOCIAL_CARD.width ||
		meta.height !== SOCIAL_CARD.height
	)
		throw new Error(`${objectKey}: published social card is not a 1200x630 JPEG.`);
}

async function putObject(target: Target, object: R2MediaObject, bytes: Uint8Array, dir: string) {
	// Wrangler runs inside `dir`, so the file goes by its key-derived name and needs no quoting.
	const file = basename(object.objectKey);
	writeFileSync(join(dir, file), bytes);
	execFileSync(
		wranglerBinary(),
		[
			'r2',
			'object',
			'put',
			`${R2_INVITATION_MEDIA[target].bucket}/${object.objectKey}`,
			'--file',
			file,
			'--content-type',
			object.mimeType,
			'--cache-control',
			shellArg(R2_IMMUTABLE_CACHE_CONTROL),
			'--remote',
		],
		{ cwd: dir, stdio: 'pipe', shell: process.platform === 'win32' },
	);
}

/** Copies every planned object; existing objects are reused only when their bytes match. */
export async function copyR2Objects(
	plan: R2MigrationPlan,
): Promise<{ copied: number; reused: number }> {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-r2-'));
	const originals = new Map<string, Uint8Array>();
	let copied = 0;
	let reused = 0;
	try {
		for (const object of plan.objects) {
			let bytes: Uint8Array;
			if (object.sourceUrl) {
				const source = await download(object.sourceUrl);
				if (source.status !== 200 || sha256(source.bytes) !== object.sha256)
					throw new Error(`${object.objectKey}: source no longer matches the plan.`);
				bytes = source.bytes;
				originals.set(object.objectKey, bytes);
			} else {
				const original = originals.get(object.socialOf ?? '');
				if (!original)
					throw new Error(`${object.objectKey}: social card source is missing.`);
				bytes = await buildSocialCard(original);
			}
			const existing = await readPublished(plan.target, object.objectKey);
			if (existing.status === 200) {
				if (object.sha256 && sha256(existing.bytes) !== object.sha256)
					throw new Error(`${object.objectKey}: R2 already holds different bytes.`);
				if (!object.sha256) await assertSocialCard(existing.bytes, object.objectKey);
				reused += 1;
				continue;
			}
			if (existing.status !== 404)
				throw new Error(`${object.objectKey}: R2 lookup HTTP ${existing.status}.`);
			putObject(plan.target, object, bytes, dir);
			const published = await readPublished(plan.target, object.objectKey);
			if (published.status !== 200 || sha256(published.bytes) !== sha256(bytes))
				throw new Error(
					`${object.objectKey}: R2 delivery does not match the uploaded bytes.`,
				);
			copied += 1;
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	return { copied, reused };
}

export async function applyR2Migration(
	plan: R2MigrationPlan,
	snapshot: R2LiveSnapshot,
	dbUrl: string,
): Promise<void> {
	if (
		plan.target === 'production' &&
		!hasValidProductionWritePermit(dbUrl, Date.now(), plan.planId, 'production_apply')
	)
		throw new Error('Production migration requires the owner-confirmed prod:apply permit.');
	if (plan.snapshotHash !== fingerprintR2Snapshot(snapshot))
		throw new Error('Migration source changed before copy.');
	buildNamespaceRemapSql(snapshot, plan.swaps, [], r2RemapOptions(plan));
	const { copied, reused } = await copyR2Objects(plan);
	process.stdout.write(`R2 objects: ${copied} copied, ${reused} reused.\n`);
	const current = readR2Snapshot(plan.target, plan.slug, dbUrl);
	if (fingerprintR2Snapshot(current) !== plan.snapshotHash)
		throw new Error('Target changed during the R2 copy; no database rows were changed.');
	runPsql(buildNamespaceRemapSql(current, plan.swaps, [], r2RemapOptions(plan)), dbUrl, {
		throwOnError: true,
	});
	const after = readR2Snapshot(plan.target, plan.slug, dbUrl);
	if (after.assets.length > 0)
		throw new Error('Database remap returned, but Cloudinary rows remain active; inspect.');
	const leftover = [
		...cloudinaryUrlsIn(after.draft?.content),
		...cloudinaryUrlsIn(after.published?.content),
	];
	if (leftover.length > 0)
		throw new Error(`Database remap returned, but ${leftover.length} Cloudinary URLs remain.`);
}

export function buildR2RollbackSql(plan: R2MigrationPlan): string {
	return buildNamespaceRollbackSql(plan.before, plan.swaps, [], r2RemapOptions(plan));
}

async function main(): Promise<void> {
	const [mode, target, slug, manifestPath] = process.argv.slice(2);
	if (mode !== 'plan' && mode !== 'apply-preview' && mode !== 'rollback-preview')
		throw new Error(
			'Usage: image-r2-migration-cli.ts <plan|apply-preview|rollback-preview> <preview|production> <slug> <manifest.json>',
		);
	if (target !== 'preview' && target !== 'production') throw new Error('Invalid target.');
	if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Invalid slug.');
	if (!manifestPath) throw new Error('A manifest path is required.');
	const dbUrl = r2TargetUrl(target);
	const snapshot = readR2Snapshot(target, slug, dbUrl);
	if (mode === 'plan') {
		const destination = resolve(manifestPath);
		if (existsSync(destination))
			throw new Error('Refusing to replace an existing reviewed migration manifest.');
		const plan = await buildR2Plan(snapshot);
		mkdirSync(dirname(destination), { recursive: true });
		writeFileSync(destination, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
		process.stdout.write(
			`${target}/${slug}: ${plan.swaps.length} verified images, ${plan.urlSwaps.length} audio files, ` +
				`${plan.objects.length} R2 objects; plan ${plan.planId.slice(0, 8)} saved as ${basename(destination)}.\n`,
		);
		return;
	}
	const plan = readR2MigrationManifest(manifestPath);
	if (
		plan.target !== target ||
		plan.slug !== slug ||
		plan.before.invitationId !== snapshot.invitationId
	)
		throw new Error('Manifest does not match the current target invitation.');
	if (target !== 'preview') throw new Error('Production migration requires pnpm prod:apply.');
	if (mode === 'rollback-preview') {
		await authorizePreviewWriteApply({
			slug,
			operation: 'image-r2-rollback',
			confirmPrompt: `Roll back R2 media migration ${plan.planId.slice(0, 8)} in Preview? Type YES: `,
		});
		runPsql(buildR2RollbackSql(plan), dbUrl, { throwOnError: true });
		process.stdout.write(
			`${target}/${slug}: R2 migration ${plan.planId.slice(0, 8)} rolled back.\n`,
		);
		return;
	}
	if (plan.snapshotHash !== fingerprintR2Snapshot(snapshot))
		throw new Error('Manifest does not match the current target snapshot.');
	await authorizePreviewWriteApply({
		slug,
		operation: 'image-r2-migrate',
		confirmPrompt: `Apply R2 media migration ${plan.planId.slice(0, 8)} to Preview? Type YES: `,
	});
	await applyR2Migration(plan, snapshot, dbUrl);
	process.stdout.write(
		`${target}/${slug}: ${plan.swaps.length} images and ${plan.urlSwaps.length} audio files moved to R2.\n`,
	);
}

if (process.argv[1]?.endsWith('image-r2-migration-cli.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(safeFailure(error) + '\n');
		process.exitCode = 1;
	});
}
