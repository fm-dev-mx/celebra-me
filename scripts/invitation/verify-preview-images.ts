import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import { assertPreviewDbUrl, getPreviewDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { buildNormalizedInvitationRelease } from '../provision/normalized-invitation-release.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';

interface PublishedAsset {
	id: string;
	key: string | null;
	sha256: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	url: string | null;
}

interface PublishedInvitation {
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

async function verifyDelivery(
	image: ExpectedImage,
	row: PublishedAsset,
	download: typeof fetch,
): Promise<string[]> {
	const failures: string[] = [];
	let url: URL;
	try {
		url = new URL(row.url ?? '');
		if (
			url.protocol !== 'https:' ||
			url.hostname !== 'res.cloudinary.com' ||
			!url.pathname.includes('/image/upload/')
		)
			throw new Error('invalid Cloudinary URL');
	} catch {
		return [`${image.key}: invalid Cloudinary delivery URL`];
	}
	try {
		const response = await download(url, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) return [`${image.key}: HTTP ${response.status}`];
		if (response.headers.get('content-type')?.split(';')[0] !== image.mimeType)
			failures.push(`${image.key}: delivery MIME mismatch`);
		const bytes = Buffer.from(await response.arrayBuffer());
		if (createHash('sha256').update(bytes).digest('hex') !== image.sha256)
			failures.push(`${image.key}: delivered SHA-256 mismatch`);
		const metadata = await sharp(bytes).metadata();
		if (metadata.width !== image.width || metadata.height !== image.height)
			failures.push(`${image.key}: delivered dimensions mismatch`);
	} catch {
		failures.push(`${image.key}: delivery unreadable or timed out`);
	}
	return failures;
}
export async function verifyPublishedImageManifest(
	expected: readonly ExpectedImage[],
	published: PublishedInvitation,
	download: typeof fetch = fetch,
): Promise<string[]> {
	const failures: string[] = [];
	const refs = new Set(collectUploadedContentRefs(published.content).map((ref) => ref.assetId));
	const keys = new Set<string>();
	for (const image of expected) {
		if (keys.has(image.key)) failures.push(`${image.key}: duplicate expected key`);
		keys.add(image.key);
		const rows = published.assets.filter((asset) => asset.key === image.key);
		if (rows.length !== 1) {
			failures.push(`${image.key}: expected one published asset, found ${rows.length}`);
			continue;
		}
		const row = rows[0]!;
		if (!refs.has(row.id))
			failures.push(`${image.key}: asset is not referenced by published content`);
		if (row.sha256 !== image.sha256) failures.push(`${image.key}: persisted SHA-256 mismatch`);
		if (row.mimeType !== image.mimeType) failures.push(`${image.key}: persisted MIME mismatch`);
		if (row.width !== image.width || row.height !== image.height)
			failures.push(`${image.key}: persisted dimensions mismatch`);
		failures.push(...(await verifyDelivery(image, row, download)));
	}
	for (const row of published.assets) {
		const keyOrId = row.key || row.id;
		if ((!row.key || !keys.has(row.key)) && refs.has(row.id))
			failures.push(`${keyOrId}: unexpected referenced image asset`);
	}
	return failures.sort();
}

function readPublishedInvitation(slug: string): PublishedInvitation {
	const dbUrl = getPreviewDbUrl().url;
	assertPreviewDbUrl(dbUrl);
	const sql = `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (
		select pub.content, coalesce((select json_agg(json_build_object(
			'id', a.id::text, 'key', a.managed_source_key, 'sha256', a.sha256,
			'mimeType', a.mime_type, 'width', a.width, 'height', a.height,
			'url', a.secure_url)) from public.invitation_assets a
			where a.invitation_id = i.id and a.deleted_at is null), '[]'::json) as assets
		from public.invitations i join lateral (
			select content from public.published_invitation_content
			where invitation_project_id = i.id and deleted_at is null
			order by version desc limit 1
		) pub on true
		where i.slug = ${sqlLiteral(slug)} and i.archived_at is null and i.kind = 'client'
	) t;`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	const rows = JSON.parse(result.stdout.trim()) as PublishedInvitation[];
	if (rows.length !== 1)
		throw new Error(
			`Expected one published Preview invitation for ${slug}; found ${rows.length}`,
		);
	return rows[0]!;
}

async function main(): Promise<void> {
	const requested = process.argv[2];
	const slugs =
		requested === '--all'
			? listInvitationDefinitions()
					.filter((definition) => definition.lifecycle === 'published')
					.map((definition) => definition.slug)
			: requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(requested)
				? [requested]
				: [];
	if (slugs.length === 0)
		throw new Error('Usage: tsx scripts/invitation/verify-preview-images.ts <slug|--all>');
	const errors: string[] = [];
	for (const slug of slugs) {
		try {
			const release = await buildNormalizedInvitationRelease({ slug, purpose: 'package' });
			const expected = release.assets.map(({ key, sha256, mimeType, width, height }) => ({
				key,
				sha256,
				mimeType,
				width,
				height,
			}));
			const failures = await verifyPublishedImageManifest(
				expected,
				readPublishedInvitation(slug),
			);
			if (failures.length) errors.push(`${slug}: ${failures.join('; ')}`);
			else process.stdout.write(`${slug}: ${expected.length} published assets verified.\n`);
		} catch (error: unknown) {
			errors.push(
				`${slug}: ${error instanceof Error ? error.message : 'verification failed'}`,
			);
		}
	}
	if (errors.length) throw new Error(`Preview image verification failed:\n${errors.join('\n')}`);
}
if (process.argv[1]?.endsWith('verify-preview-images.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : 'Preview image verification failed'}\n`,
		);
		process.exitCode = 1;
	});
}
