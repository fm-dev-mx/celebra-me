import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	detectFileMimeType,
	normalizeInvitationImage,
} from '../../src/lib/intake/services/asset-policy.ts';
import { v2 as cloudinary } from 'cloudinary';
import {
	buildCloudinaryPublicId,
	hydrateCloudinaryEnvFromFiles,
} from '../provision/cloudinary-adapter.ts';
import {
	IMAGE_DELIVERY_BUDGETS,
	classifyImageSectionRole,
	type ImageBudgetViewport,
	type ImageSectionRole,
} from '../../src/lib/invitation-preparation/image-delivery-budget.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationAssetSpec,
} from '../provision/invitations/invitation-definition.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { buildSemanticAssetMap, ASSET_KEY_PREFIX } from '../provision/normalized-invitation-release.ts';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';

type TargetEnvironment = 'preview' | 'production';

interface AuditRow {
	slug: string;
	environment: TargetEnvironment;
	key: string;
	section: ImageSectionRole;
	source: string;
	deliveryUrl: string | null;
	format: string;
	width: number;
	height: number;
	bytes: number;
	loading: 'eager' | 'lazy';
	variant: ImageBudgetViewport;
	transformation: string;
	expectedHash: string;
	observedHash: string | null;
	compliant: boolean;
	reasons: string[];
	duplicateOf: string | null;
	estimatedBytesPerThousandOpens: number;
}

function option(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function environment(): TargetEnvironment {
	const value = option('--environment') ?? 'preview';
	if (value !== 'preview' && value !== 'production') {
		throw new Error('--environment must be preview or production.');
	}
	return value;
}

function roleForSpec(spec: InvitationAssetSpec): ImageSectionRole {
	if (spec.optimizationRole?.startsWith('hero')) return 'hero';
	if (spec.optimizationRole === 'gallery') return 'gallery-visible';
	return classifyImageSectionRole(spec.key);
}

function redactDeliveryUrl(value: string | undefined): string | null {
	if (!value) return null;
	const url = new URL(value);
	return url.hostname + url.pathname;
}

async function remoteResource(publicId: string): Promise<Record<string, unknown> | null> {
	try {
		return (await cloudinary.api.resource(publicId, { context: true })) as Record<
			string,
			unknown
		>;
	} catch (error: unknown) {
		const status =
			typeof error === 'object' && error !== null && 'http_code' in error
				? Number(error.http_code)
				: undefined;
		if (status === 404) return null;
		throw error;
	}
}

// Audit orchestration intentionally keeps local and provider observations in one deterministic pass.
// eslint-disable-next-line complexity
async function main(): Promise<void> {
	const target = environment();
	const viewport = (option('--viewport') ?? 'mobile') as ImageBudgetViewport;
	if (viewport !== 'mobile' && viewport !== 'desktop') {
		throw new Error('--viewport must be mobile or desktop.');
	}
	const remote = process.argv.includes('--remote');
	const json = process.argv.includes('--json');
	const slug = option('--slug');
	const definitions = listInvitationDefinitions().filter(
		(definition) => !slug || definition.slug === slug,
	);
	if (definitions.length === 0) throw new Error('No matching invitation definitions.');

	if (remote) {
		hydrateCloudinaryEnvFromFiles();
		const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
		const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
		const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
		if (!cloudName || !apiKey || !apiSecret) {
			throw new Error('Authenticated remote audit requires Cloudinary server credentials.');
		}
		cloudinary.config({
			cloud_name: cloudName,
			api_key: apiKey,
			api_secret: apiSecret,
			secure: true,
		});
	}

	const rows: AuditRow[] = [];
	const unusedAssets: string[] = [];
	const missingReferences: string[] = [];
	const firstKeyByHash = new Map<string, string>();
	for (const definition of definitions) {
		const content = definition.buildPublishedContent(buildSemanticAssetMap(definition));
		const contentRoles = new Map<string, ImageSectionRole>();
		const referencedKeys = new Set<string>();
		const declaredKeys = new Set(definition.assets.map((asset) => asset.key));
		for (const ref of collectUploadedContentRefs(content)) {
			if (!ref.assetId.startsWith(ASSET_KEY_PREFIX)) continue;
			const key = ref.assetId.slice(ASSET_KEY_PREFIX.length);
			referencedKeys.add(key);
			if (!declaredKeys.has(key)) missingReferences.push(definition.slug + ':' + key);
			if (ref.path !== 'sharing.ogImage') {
				contentRoles.set(key, classifyImageSectionRole(ref.path));
			}
		}
		const assetDir = join(process.cwd(), getInvitationAssetSourceDir(definition));
		for (const spec of definition.assets) {
			if (!referencedKeys.has(spec.key)) unusedAssets.push(definition.slug + ':' + spec.key);
			const source = join(assetDir, spec.relativePath);
			if (!existsSync(source)) {
				rows.push({
					slug: definition.slug,
					environment: target,
					key: spec.key,
					section: contentRoles.get(spec.key) ?? roleForSpec(spec),
					source: spec.relativePath,
					deliveryUrl: null,
					format: 'missing',
					width: 0,
					height: 0,
					bytes: 0,
					loading: 'lazy',
					variant: viewport,
					transformation: 'none',
					expectedHash: '',
					observedHash: null,
					compliant: false,
					reasons: ['source file is missing'],
					duplicateOf: null,
					estimatedBytesPerThousandOpens: 0,
				});
				continue;
			}
			const sourceBytes = readFileSync(source);
			const sourceMime = detectFileMimeType(spec.relativePath, sourceBytes);
			const normalized = await normalizeInvitationImage(
				new Blob([sourceBytes], { type: sourceMime }),
				sourceMime,
				spec.optimizationRole,
			);
			const preparedBytes = Buffer.from(await normalized.blob.arrayBuffer());
			const expectedHash = createHash('sha256').update(preparedBytes).digest('hex');
			const role = contentRoles.get(spec.key) ?? roleForSpec(spec);
			const budget = IMAGE_DELIVERY_BUDGETS[role];
			const publicId = buildCloudinaryPublicId({
				targetEnvironment: target,
				eventType: definition.eventType,
				slug: definition.slug,
				key: spec.key,
				sha256: expectedHash,
			});
			const observed = remote ? await remoteResource(publicId) : null;
			const metadata = await sharp(preparedBytes).metadata();
			const bytes =
				observed && typeof observed.bytes === 'number'
					? observed.bytes
					: preparedBytes.byteLength;
			const width =
				observed && typeof observed.width === 'number'
					? observed.width
					: (metadata.width ?? 0);
			const height =
				observed && typeof observed.height === 'number'
					? observed.height
					: (metadata.height ?? 0);
			const format =
				observed && typeof observed.format === 'string'
					? observed.format
					: (metadata.format ?? 'unknown');
			const secureUrl =
				observed && typeof observed.secure_url === 'string'
					? observed.secure_url
					: undefined;
			const context = observed?.context as { custom?: { sha256?: string } } | undefined;
			const observedHash = context?.custom?.sha256 ?? null;
			const reasons: string[] = [];
			if (remote && !observed) reasons.push('remote resource is missing');
			if (bytes > budget.maxBytes[viewport])
				reasons.push('asset bytes exceed section budget; viewport delivery remains unverified');
			if (Math.max(width, height) > budget.maxPreparedEdgePx)
				reasons.push('prepared edge exceeds role maximum');
			if (!['webp', 'avif'].includes(format))
				reasons.push('delivery format is not WebP or AVIF');
			if (remote && observedHash !== expectedHash)
				reasons.push('remote SHA-256 context differs');
			const duplicateOf = firstKeyByHash.get(expectedHash) ?? null;
			if (!duplicateOf) firstKeyByHash.set(expectedHash, definition.slug + ':' + spec.key);
			rows.push({
				slug: definition.slug,
				environment: target,
				key: spec.key,
				section: role,
				source: spec.relativePath,
				deliveryUrl: redactDeliveryUrl(secureUrl),
				format,
				width,
				height,
				bytes,
				loading: budget.loading,
				variant: viewport,
				transformation: remote ? 'provider-original' : 'prepared-estimate',
				expectedHash,
				observedHash,
				compliant: reasons.length === 0,
				reasons,
				duplicateOf,
				estimatedBytesPerThousandOpens: bytes * 1000,
			});
		}
	}
	const usage = remote ? await cloudinary.api.usage() : null;
	const report = {
		generatedAt: new Date().toISOString(),
		environment: target,
		viewport,
		mode: remote ? 'provider-original-read-only' : 'local-prepared-estimate',
		summary: {
			invitations: definitions.length,
			assets: rows.length,
			failures: rows.filter((row) => !row.compliant).length,
			duplicates: rows.filter((row) => row.duplicateOf).length,
			bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
			unusedAssets: unusedAssets.length,
			missingReferences: missingReferences.length,
		},
		unusedAssets,
		missingReferences,
		usage: usage
			? {
					plan: usage.plan,
					credits: usage.credits,
					bandwidth: usage.bandwidth,
					storage: usage.storage,
					transformations: usage.transformations,
				}
			: null,
		rows,
	};
	if (json) {
		process.stdout.write(JSON.stringify(report, null, 2) + '\n');
	} else {
		console.log('Invitation media audit: ' + report.mode + ' / ' + target + ' / ' + viewport);
		console.table(
			rows.map(
				({
					slug: itemSlug,
					key,
					section,
					bytes: itemBytes,
					format: itemFormat,
					compliant,
					reasons,
				}) => ({
					slug: itemSlug,
					key,
					section,
					bytes: itemBytes,
					format: itemFormat,
					status: compliant ? 'PASS' : 'FAIL',
					reason: reasons.join('; '),
				}),
			),
		);
		console.log(JSON.stringify(report.summary));
	}
	if (report.summary.failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
