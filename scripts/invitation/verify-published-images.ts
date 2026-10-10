#!/usr/bin/env tsx
/** Read-only published invitation media verification for Preview and Production. */
import { createHash } from 'node:crypto';
import { flagValue as option } from '../lib/cli-args.ts';
import sharp from 'sharp';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import {
	assertProductionDbUrl,
	getProdDbUrl,
	requirePreviewDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { buildNormalizedInvitationRelease } from '../provision/normalized-invitation-release.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';

export type MediaVerificationTarget = 'preview' | 'production';
/**
 * `PENDING_PUBLISH`: the target serves its published objects correctly, but the release package
 * being compared has images the target has not received yet. It is a content backlog, not a
 * delivery failure, so it never fails a check unless `--strict` is passed.
 */
export type MediaVerificationClassification =
	| 'HEALTHY'
	| 'PENDING_PUBLISH'
	| 'MISSING'
	| 'HASH_MISMATCH'
	| 'METADATA_DRIFT'
	| 'REFERENCE_DRIFT';

export interface PublishedAsset {
	id: string;
	key: string | null;
	sha256: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	url: string | null;
}

export interface PublishedInvitation {
	eventType?: string;
	slug?: string;
	content: Record<string, unknown>;
	assets: PublishedAsset[];
}

export interface ExpectedImage {
	key: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
}

export interface MediaVerificationRow {
	route: string;
	assetKey: string;
	classification: MediaVerificationClassification;
	status: number | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	expectedHash: string | null;
	observedHash: string | null;
	url: string | null;
	reasons: string[];
}

function redactedUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return `${url.hostname}${url.pathname}`;
	} catch {
		return '[URL inválida]';
	}
}

// Reasons produced by comparing the persisted row against the release package (not the delivery).
const PACKAGE_REASON = /from package|package image/u;

function classify(reasons: readonly string[]): MediaVerificationClassification {
	const activeReasons = reasons.filter((reason) => !reason.startsWith('published content URL:'));
	const deliveryReasons = activeReasons.filter((reason) => !PACKAGE_REASON.test(reason));
	if (
		deliveryReasons.some((reason) =>
			/HTTP 404|missing|not referenced|no active asset/i.test(reason),
		)
	)
		return 'MISSING';
	if (deliveryReasons.some((reason) => /SHA-256|hash/i.test(reason))) return 'HASH_MISMATCH';
	if (deliveryReasons.length > 0) return 'METADATA_DRIFT';
	if (activeReasons.length > 0) return 'PENDING_PUBLISH';
	return reasons.length === 0 ? 'HEALTHY' : 'REFERENCE_DRIFT';
}

/** `--strict` makes a pending package image count as a failure (post-apply verification). */
export function isMediaVerificationFailure(
	row: Pick<MediaVerificationRow, 'classification'>,
	args: readonly string[],
): boolean {
	if (row.classification === 'HEALTHY') return false;
	return row.classification !== 'PENDING_PUBLISH' || args.includes('--strict');
}

function validCloudinaryUrl(value: string | null): URL | null {
	try {
		const url = new URL(value ?? '');
		return url.protocol === 'https:' &&
			url.hostname === 'res.cloudinary.com' &&
			url.pathname.includes('/image/upload/')
			? url
			: null;
	} catch {
		return null;
	}
}

// One remote read intentionally produces the complete transport, binary, persisted, and package verdict.
// eslint-disable-next-line complexity
async function verifyAssetDelivery(
	row: PublishedAsset,
	expected: ExpectedImage | undefined,
	download: typeof fetch,
): Promise<Omit<MediaVerificationRow, 'route'>> {
	const reasons: string[] = [];
	const url = validCloudinaryUrl(row.url);
	let status: number | null = null;
	let observedHash: string | null = null;
	let observedMime: string | null = null;
	let observedWidth: number | null = null;
	let observedHeight: number | null = null;
	if (!url) {
		reasons.push('invalid Cloudinary delivery URL');
	} else {
		try {
			const response = await download(url, {
				redirect: 'follow',
				signal: AbortSignal.timeout(10_000),
			});
			status = response.status;
			if (response.url && validCloudinaryUrl(response.url) === null)
				reasons.push('delivery redirected outside Cloudinary image delivery');
			if (!response.ok) {
				reasons.push(`HTTP ${response.status}`);
			} else {
				observedMime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
				if (!observedMime?.startsWith('image/'))
					reasons.push('delivery MIME is not an image');
				if (row.mimeType && observedMime !== row.mimeType)
					reasons.push('delivery MIME mismatch');
				const bytes = Buffer.from(await response.arrayBuffer());
				observedHash = createHash('sha256').update(bytes).digest('hex');
				if (!row.sha256 || observedHash !== row.sha256)
					reasons.push('delivered SHA-256 mismatch');
				const metadata = await sharp(bytes).metadata();
				observedWidth = metadata.width ?? null;
				observedHeight = metadata.height ?? null;
				if (row.width !== observedWidth || row.height !== observedHeight)
					reasons.push('delivered dimensions mismatch');
			}
		} catch {
			reasons.push('delivery unreadable or timed out');
		}
	}
	if (expected) {
		if (row.sha256 !== expected.sha256) reasons.push('persisted SHA-256 differs from package');
		if (row.mimeType !== expected.mimeType) reasons.push('persisted MIME differs from package');
		if (row.width !== expected.width || row.height !== expected.height)
			reasons.push('persisted dimensions differ from package');
	}
	return {
		assetKey: row.key ?? row.id,
		classification: classify(reasons),
		status,
		mimeType: observedMime,
		width: observedWidth,
		height: observedHeight,
		expectedHash: expected?.sha256 ?? row.sha256,
		observedHash,
		url: redactedUrl(row.url),
		reasons,
	};
}

async function verifyFrozenContentUrl(value: string, download: typeof fetch): Promise<string[]> {
	const url = validCloudinaryUrl(value);
	if (!url) return ['invalid Cloudinary delivery URL'];
	try {
		const response = await download(url, {
			redirect: 'follow',
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return [`HTTP ${response.status}`];
		const mime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
		return mime.startsWith('image/') ? [] : ['delivery MIME is not an image'];
	} catch {
		return ['delivery unreadable or timed out'];
	}
}

// eslint-disable-next-line complexity -- One pass correlates content refs, persisted rows, provider delivery, and package evidence.
export async function verifyPublishedInvitation(
	published: PublishedInvitation,
	expected: readonly ExpectedImage[] | null,
	download: typeof fetch = fetch,
	options: { verifyFrozenContentUrls?: boolean } = {},
): Promise<MediaVerificationRow[]> {
	const route = `${published.eventType ?? 'unknown'}/${published.slug ?? 'unknown'}`;
	const refs = collectUploadedContentRefs(published.content);
	const referencedIds = new Set(refs.map((ref) => ref.assetId));
	const expectedByKey = new Map(expected?.map((image) => [image.key, image]) ?? []);
	const rows: MediaVerificationRow[] = [];
	const ids = new Set<string>();
	const keys = new Set<string>();
	for (const asset of published.assets) {
		const expectedImage = asset.key ? expectedByKey.get(asset.key) : undefined;
		if (!referencedIds.has(asset.id) && !expectedImage) continue;
		const duplicate = ids.has(asset.id) || Boolean(asset.key && keys.has(asset.key));
		ids.add(asset.id);
		if (asset.key) keys.add(asset.key);
		const verified = await verifyAssetDelivery(asset, expectedImage, download);
		if (options.verifyFrozenContentUrls !== false) {
			const frozenSources = refs
				.filter((ref) => ref.assetId === asset.id && ref.src)
				.map((ref) => ref.src as string);
			for (const frozenSource of new Set(frozenSources.filter((src) => src !== asset.url))) {
				const frozenReasons = await verifyFrozenContentUrl(frozenSource, download);
				verified.reasons.push(
					...frozenReasons.map((reason) => `published content URL: ${reason}`),
				);
			}
		}
		if (duplicate) verified.reasons.push('duplicate active asset identity or key');
		verified.classification = classify(verified.reasons);
		rows.push({ route, ...verified });
	}
	const missingRefIds = new Set<string>();
	for (const ref of refs) {
		if (published.assets.some((asset) => asset.id === ref.assetId)) continue;
		if (missingRefIds.has(ref.assetId)) continue;
		missingRefIds.add(ref.assetId);
		rows.push({
			route,
			assetKey: ref.assetId,
			classification: 'MISSING',
			status: null,
			mimeType: null,
			width: null,
			height: null,
			expectedHash: null,
			observedHash: null,
			url: null,
			reasons: ['published content has no active asset row'],
		});
	}
	for (const image of expected ?? []) {
		if (published.assets.some((asset) => asset.key === image.key)) continue;
		rows.push({
			route,
			assetKey: image.key,
			classification: 'PENDING_PUBLISH',
			status: null,
			mimeType: null,
			width: null,
			height: null,
			expectedHash: image.sha256,
			observedHash: null,
			url: null,
			reasons: ['package image has no active asset row'],
		});
	}
	return rows.sort((left, right) => left.assetKey.localeCompare(right.assetKey));
}

function readPublishedInvitations(
	target: MediaVerificationTarget,
	slug?: string,
): PublishedInvitation[] {
	const dbUrl = target === 'preview' ? requirePreviewDbUrl().url : getProdDbUrl().url;
	if (target === 'production') assertProductionDbUrl(dbUrl);
	const slugFilter = slug ? `and i.slug = ${sqlLiteral(slug)}` : '';
	const sql = `select coalesce(json_agg(row_to_json(t) order by t."eventType", t.slug), '[]'::json)::text from (
		select i.event_type as "eventType", i.slug, pub.content,
		coalesce((select json_agg(json_build_object(
			'id', a.id::text, 'key', a.managed_source_key, 'sha256', a.sha256,
			'mimeType', a.mime_type, 'width', a.width, 'height', a.height, 'url', a.secure_url)
			order by a.managed_source_key, a.id) from public.invitation_assets a
			where a.invitation_id = i.id and a.deleted_at is null), '[]'::json) as assets
		from public.invitations i join lateral (
			select content from public.published_invitation_content
			where invitation_project_id = i.id and deleted_at is null order by version desc limit 1
		) pub on true where i.kind = 'client' and i.archived_at is null ${slugFilter}
	) t;`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return JSON.parse(result.stdout.trim()) as PublishedInvitation[];
}

async function verifyPublicRoute(
	originValue: string,
	published: PublishedInvitation,
): Promise<MediaVerificationRow | null> {
	const origin = new URL(originValue);
	if (origin.protocol !== 'https:' || origin.pathname !== '/')
		throw new Error('--origin must be an HTTPS origin without a path.');
	const eventType = published.eventType ?? '';
	const slug = published.slug ?? '';
	const route = `${eventType}/${slug}`;
	try {
		const response = await fetch(
			new URL(`/${route}?skipEnvelope=true&animations=off`, origin),
			{
				signal: AbortSignal.timeout(10_000),
			},
		);
		const html = await response.text();
		const reasons: string[] = [];
		if (!response.ok) reasons.push(`public route HTTP ${response.status}`);
		if (!html.includes('<html')) reasons.push('public route did not return an HTML document');
		if (reasons.length === 0) return null;
		return {
			route,
			assetKey: '__route__',
			classification: 'METADATA_DRIFT',
			status: response.status,
			mimeType: response.headers.get('content-type'),
			width: null,
			height: null,
			expectedHash: null,
			observedHash: null,
			url: origin.hostname,
			reasons,
		};
	} catch {
		return {
			route,
			assetKey: '__route__',
			classification: 'METADATA_DRIFT',
			status: null,
			mimeType: null,
			width: null,
			height: null,
			expectedHash: null,
			observedHash: null,
			url: origin.hostname,
			reasons: ['public route unreadable or timed out'],
		};
	}
}

function assertValidOrigin(origin?: string): void {
	if (!origin) return;
	const parsed = new URL(origin);
	if (parsed.protocol !== 'https:' || parsed.pathname !== '/')
		throw new Error('--origin must be an HTTPS origin without a path.');
}

/**
 * `--current-state` verifies only the objects the target already publishes. A pre-apply check uses
 * it: comparing against the release package would report every image the apply is about to add or
 * replace as a failure.
 */
export function comparesToReleasePackage(args: readonly string[]): boolean {
	return !args.includes('--current-state');
}

export async function runPublishedImageVerification(args: readonly string[]): Promise<{
	target: MediaVerificationTarget;
	rows: MediaVerificationRow[];
}> {
	const target = option(args, '--target');
	if (target !== 'preview' && target !== 'production')
		throw new Error('--target must be preview or production.');
	const slug = option(args, '--slug');
	const origin = option(args, '--origin');
	assertValidOrigin(origin);
	if (!args.includes('--all') && !slug) throw new Error('Specify --all or --slug <slug>.');
	if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Invalid slug.');
	const definitions = new Map(
		listInvitationDefinitions().map((definition) => [definition.slug, definition]),
	);
	const published = readPublishedInvitations(target, slug);
	if (published.length === 0) {
		if (args.includes('--allow-empty')) return { target, rows: [] };
		throw new Error('No published invitations matched the requested scope.');
	}
	const rows: MediaVerificationRow[] = [];
	const comparePackage = comparesToReleasePackage(args);
	for (const invitation of published) {
		if (!invitation.slug || !invitation.eventType)
			throw new Error('Published invitation route identity is incomplete.');
		const definition = comparePackage ? definitions.get(invitation.slug) : undefined;
		const release = definition
			? await buildNormalizedInvitationRelease({ slug: invitation.slug, purpose: 'package' })
			: null;
		const expected =
			release?.assets.map(({ key, sha256, mimeType, width, height }) => ({
				key,
				sha256,
				mimeType,
				width,
				height,
			})) ?? null;
		const invitationRows = await verifyPublishedInvitation(invitation, expected, fetch, {
			verifyFrozenContentUrls: !args.includes('--provider-only'),
		});
		rows.push(...invitationRows);
		if (origin) {
			const routeFailure = await verifyPublicRoute(origin, invitation);
			if (routeFailure) rows.push(routeFailure);
		}
	}
	return { target, rows };
}

export async function assertPublishedImageVerification(args: readonly string[]): Promise<void> {
	const result = await runPublishedImageVerification(args);
	const failures = result.rows.filter((row) => isMediaVerificationFailure(row, args));
	if (failures.length === 0) return;
	throw new Error(
		`PUBLISHED_IMAGE_VERIFICATION_FAILED:\n${failures.map((row) => `${row.route}/${row.assetKey}: ${row.reasons.join('; ')}`).join('\n')}`,
	);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const result = await runPublishedImageVerification(args);
	const failures = result.rows.filter((row) => isMediaVerificationFailure(row, args));
	const report = {
		generatedAt: new Date().toISOString(),
		target: result.target,
		summary: {
			invitations: new Set(result.rows.map((row) => row.route)).size,
			assets: result.rows.length,
			failures: failures.length,
			pendingPublish: result.rows.filter((row) => row.classification === 'PENDING_PUBLISH')
				.length,
		},
		rows: result.rows,
	};
	if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	else {
		console.table(
			result.rows.map(({ route, assetKey, classification, status, reasons }) => ({
				route,
				asset: assetKey,
				status: classification,
				activeHttp: status ?? '-',
				reason: reasons.join('; '),
			})),
		);
		process.stdout.write(`${JSON.stringify(report.summary)}\n`);
	}
	if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('verify-published-images.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : 'Media verification failed'}\n`,
		);
		process.exitCode = 1;
	});
}
