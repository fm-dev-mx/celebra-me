/** Immutable package serialization for a normalized invitation release. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildNormalizedInvitationRelease, canonicalize, RELEASE_SCHEMA_VERSION, STORAGE_URL_PLACEHOLDER, type NormalizedInvitationRelease } from './normalized-invitation-release.ts';

export { STORAGE_URL_PLACEHOLDER };
export const PACKAGE_SCHEMA_VERSION = RELEASE_SCHEMA_VERSION;
export interface InvitationPackageAsset {
	key: string; displayName: string; defaultAltText: string; focalPoint?: Record<string, string>;
	bucket: string; storagePath: string; mimeType: string; width: number | null; height: number | null; fileSize: number | null;
	validationVersion: number; originalMimeType: string | null; originalFileSize: number | null; sha256: string; dataBase64: string;
}
export interface InvitationPackageData {
	schemaVersion: string; packageHash: string; sourceHash: string; metadataHash: string; projectionHash: string; assetManifestHash: string;
	definitionCreatedAt: string; sourceSlug: string;
	invitation: { slug: string; title: string; eventType: string; baseDemoId: string; themeId: string; visualProfileId?: string; kind: string; clientName: string; clientEmail: string; clientWhatsapp: string; photosReceived: boolean; snapshot: Record<string, unknown> };
	draft: { status: string; content: Record<string, unknown> };
	publishedContent: { content: Record<string, unknown> };
	event: { title: string; eventType: string; status: string };
	assets: InvitationPackageAsset[];
}
export interface ExportPackageOptions { slug: string; sourceDir: string; dryRun?: boolean; outPath?: string; }
export interface ExportPackageResult { packageData: InvitationPackageData; packagePath: string | null; stats: { slug: string; assetCount: number; totalBytes: number; hasPublishedContent: true; packageHash: string; }; }

export function computePackageHash(payload: Omit<InvitationPackageData, 'packageHash'> | InvitationPackageData): string {
	const { packageHash: _packageHash, ...rest } = payload as InvitationPackageData;
	const sanitized = JSON.parse(JSON.stringify(rest)) as Omit<InvitationPackageData, 'packageHash'>;
	return createHash('sha256').update(canonicalize({ ...sanitized, assets: [...sanitized.assets].sort((a, b) => (a.key ?? a.storagePath).localeCompare(b.key ?? b.storagePath)) })).digest('hex');
}
export function serializeInvitationPackage(release: NormalizedInvitationRelease): InvitationPackageData {
	const rawPayload: Omit<InvitationPackageData, 'packageHash'> = {
		schemaVersion: release.schemaVersion, sourceHash: release.sourceHash, metadataHash: release.metadataHash, projectionHash: release.projectionHash, assetManifestHash: release.assetManifestHash, definitionCreatedAt: release.definitionCreatedAt, sourceSlug: release.slug,
		invitation: { slug: release.slug, title: release.metadata.title, eventType: release.metadata.eventType, baseDemoId: release.metadata.baseDemoId, themeId: release.metadata.themeId, visualProfileId: release.metadata.visualProfileId, kind: 'client', clientName: release.metadata.clientName, clientEmail: release.metadata.clientEmail, clientWhatsapp: release.metadata.clientWhatsapp, photosReceived: release.metadata.photosReceived, snapshot: release.metadata.snapshot },
		draft: { status: 'draft', content: release.draftContent }, publishedContent: { content: release.publishedProjection }, event: { title: release.metadata.title, eventType: release.metadata.eventType, status: 'published' },
		assets: release.assets.map((asset) => ({ key: asset.key, displayName: asset.displayName, defaultAltText: asset.alt, focalPoint: asset.focalPoint, bucket: 'invitation-assets', storagePath: `managed/${release.slug}/${asset.key}.webp`, mimeType: asset.mimeType, width: asset.width, height: asset.height, fileSize: asset.fileSize, validationVersion: asset.validationVersion, originalMimeType: asset.originalMimeType, originalFileSize: asset.originalFileSize, sha256: asset.sha256, dataBase64: asset.dataBase64 })),
	};
	const payload = JSON.parse(JSON.stringify(rawPayload)) as Omit<InvitationPackageData, 'packageHash'>;
	return { ...payload, packageHash: computePackageHash(payload) };
}
export async function exportInvitationPackage(options: ExportPackageOptions): Promise<ExportPackageResult> {
	const release = await buildNormalizedInvitationRelease({ slug: options.slug, sourceDir: options.sourceDir });
	const packageData = serializeInvitationPackage(release);
	const packagePath = options.dryRun ? null : resolve(options.outPath ?? `.agent/tmp/packages/invitation-${options.slug}-${packageData.packageHash.slice(0, 16)}.json`);
	if (packagePath) { mkdirSync(dirname(packagePath), { recursive: true }); writeFileSync(packagePath, JSON.stringify(packageData, null, 2), 'utf8'); }
	return { packageData, packagePath, stats: { slug: options.slug, assetCount: packageData.assets.length, totalBytes: packageData.assets.reduce((sum, asset) => sum + (asset.fileSize ?? 0), 0), hasPublishedContent: true, packageHash: packageData.packageHash } };
}
