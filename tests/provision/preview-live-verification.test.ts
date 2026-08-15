import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import {
	formatPreviewLiveVerificationFailures,
	verifyPreviewArtifactLive,
} from '../../scripts/provision/preview-live-verification.ts';

const DB_URL = 'postgresql://postgres:secret@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';
const PACKAGE_HASH = 'a'.repeat(64);
const publishedContent = { hero: { name: 'Prueba' }, sectionOrder: ['hero'] };
const projectionHash = hashPublicationProjection(publishedContent);

function artifact(expectedAssetHashes: Record<string, string> = {}): PreviewApprovalArtifact {
	return {
		approvalState: 'pending_hosted_validation',
		schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
		packageHash: PACKAGE_HASH,
		sourceHash: 'b'.repeat(64),
		metadataHash: 'c'.repeat(64),
		canonicalProjectionHash: 'd'.repeat(32),
		materializedProjectionHash: projectionHash,
		assetManifestHash: 'e'.repeat(64),
		planId: 'preview-plan',
		slug: 'prueba',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		createdAt: '2026-08-06T10:00:00.000Z',
		route: '/xv/prueba',
		expectedAssetHashes,
	};
}

function row(overrides: Record<string, unknown> = {}) {
	return {
		slug: 'prueba',
		eventType: 'xv',
		publishedSlug: 'prueba',
		publishedEventType: 'xv',
		publishedContent,
		provenancePackageHash: PACKAGE_HASH,
		provenanceDefinitionSlug: 'prueba',
		provenanceProjectionHash: projectionHash,
		assets: [],
		...overrides,
	};
}

function queryResult(rows: unknown[]) {
	return () => ({
		status: 0,
		stdout: JSON.stringify(rows),
		stderr: '',
	});
}

describe('Preview live verification', () => {
	it('passes project, route, publication, provenance, projection, and empty storage checks', async () => {
		const result = await verifyPreviewArtifactLive(artifact(), {
			dbUrl: DB_URL,
			now: new Date('2026-08-06T12:00:00.000Z'),
			runQuery: queryResult([row()]),
		});

		expect(result.details.assetFailures).toEqual({});
		expect(result.checklistResults).toEqual({
			project: true,
			route: true,
			publication: true,
			provenance: true,
			projection: true,
			storage: true,
		});
		expect(result.ok).toBe(true);
		expect(result.storageHashVerification).toEqual({});
		expect(result.projectionHash).toBe(projectionHash);
	});

	it('downloads expected assets and records observed SHA-256 hashes', async () => {
		const bytes = new TextEncoder().encode('verified preview asset');
		const expectedHash = createHash('sha256').update(bytes).digest('hex');
		const path = 'managed/prueba/hero.webp';
		const result = await verifyPreviewArtifactLive(artifact({ [path]: expectedHash }), {
			dbUrl: DB_URL,
			runQuery: queryResult([
				row({
					assets: [
						{
							storagePath: path,
							providerPublicId: path,
							secureUrl: null,
						},
					],
				}),
			]),
			fetch: async () =>
				({
					ok: true,
					status: 200,
					arrayBuffer: async () => bytes.buffer,
				}) as Response,
		});

		expect(result.details.assetFailures).toEqual({});
		expect(result.checklistResults.storage).toBe(true);
		expect(result.ok).toBe(true);
		expect(result.storageHashVerification).toEqual({ [path]: expectedHash });
	});

	it('ignores leftover Cloudinary public IDs when managed storage paths verify', async () => {
		const bytes = new TextEncoder().encode('current hero');
		const expectedHash = createHash('sha256').update(bytes).digest('hex');
		const managedPath = 'managed/prueba/hero-desktop.webp';
		const stalePublicId = 'xv/prueba/assets/hero-desktop-34522c50d513';
		const result = await verifyPreviewArtifactLive(
			artifact({
				[managedPath]: expectedHash,
				[stalePublicId]: '0'.repeat(64),
			}),
			{
				dbUrl: DB_URL,
				runQuery: queryResult([
					row({
						assets: [
							{
								storagePath: managedPath,
								providerPublicId: stalePublicId,
								secureUrl: `https://example.test/${managedPath}`,
							},
						],
					}),
				]),
				fetch: async (input) => {
					const url = String(input);
					if (url.includes(stalePublicId)) {
						return {
							ok: false,
							status: 400,
							arrayBuffer: async () => new ArrayBuffer(0),
						} as Response;
					}
					return {
						ok: true,
						status: 200,
						arrayBuffer: async () => bytes.buffer,
					} as Response;
				},
			},
		);

		expect(result.details.assetFailures).toEqual({});
		expect(result.checklistResults.storage).toBe(true);
		expect(result.ok).toBe(true);
		expect(result.storageHashVerification).toEqual({ [managedPath]: expectedHash });
	});

	it('ignores leftover live managed paths that are not in the approval artifact', async () => {
		const bytes = new TextEncoder().encode('current hero');
		const expectedHash = createHash('sha256').update(bytes).digest('hex');
		const managedPath = 'managed/prueba/hero-desktop.webp';
		const leftoverGallery = 'managed/prueba/gallery-02.webp';
		const result = await verifyPreviewArtifactLive(artifact({ [managedPath]: expectedHash }), {
			dbUrl: DB_URL,
			runQuery: queryResult([
				row({
					assets: [
						{
							storagePath: managedPath,
							providerPublicId: null,
							secureUrl: `https://example.test/${managedPath}`,
						},
						{
							storagePath: leftoverGallery,
							providerPublicId: null,
							secureUrl: `https://example.test/${leftoverGallery}`,
						},
					],
				}),
			]),
			fetch: async () =>
				({
					ok: true,
					status: 200,
					arrayBuffer: async () => bytes.buffer,
				}) as Response,
		});

		expect(result.details.assetFailures).toEqual({});
		expect(result.checklistResults.storage).toBe(true);
		expect(result.ok).toBe(true);
		expect(result.storageHashVerification).toEqual({ [managedPath]: expectedHash });
	});

	it('fails when an artifact managed path is missing from hosted Preview', async () => {
		const result = await verifyPreviewArtifactLive(
			artifact({ 'managed/prueba/hero.webp': 'a'.repeat(64) }),
			{
				dbUrl: DB_URL,
				runQuery: queryResult([row({ assets: [] })]),
			},
		);

		expect(result.ok).toBe(false);
		expect(result.checklistResults.storage).toBe(false);
		expect(result.details.assetFailures['managed/prueba/hero.webp']).toBe(
			'Missing from hosted Preview',
		);
	});

	it('does not pass storage when the artifact has hashes but Preview has no required paths', async () => {
		const result = await verifyPreviewArtifactLive(
			artifact({ 'xv/prueba/assets/hero-stale': '0'.repeat(64) }),
			{
				dbUrl: DB_URL,
				runQuery: queryResult([row({ assets: [] })]),
			},
		);

		expect(result.ok).toBe(false);
		expect(result.checklistResults.storage).toBe(false);
		expect(result.details.errors).toContain(
			'Approval artifact lists asset hashes but Preview has no required package storage paths.',
		);
	});

	it('still verifies publicId-only legacy rows', async () => {
		const bytes = new TextEncoder().encode('legacy cloudinary asset');
		const expectedHash = createHash('sha256').update(bytes).digest('hex');
		const publicId = 'xv/prueba/assets/hero-legacy';
		const result = await verifyPreviewArtifactLive(artifact({ [publicId]: expectedHash }), {
			dbUrl: DB_URL,
			runQuery: queryResult([
				row({
					assets: [
						{
							storagePath: null,
							providerPublicId: publicId,
							secureUrl: `https://res.cloudinary.com/${publicId}`,
						},
					],
				}),
			]),
			fetch: async () =>
				({
					ok: true,
					status: 200,
					arrayBuffer: async () => bytes.buffer,
				}) as Response,
		});

		expect(result.details.assetFailures).toEqual({});
		expect(result.checklistResults.storage).toBe(true);
		expect(result.ok).toBe(true);
		expect(result.storageHashVerification).toEqual({ [publicId]: expectedHash });
	});

	it('lists failed asset paths and live errors for the approve CLI', () => {
		const lines = formatPreviewLiveVerificationFailures({
			ok: false,
			checklistResults: {
				project: true,
				route: true,
				publication: true,
				provenance: true,
				projection: true,
				storage: false,
			},
			storageHashVerification: {},
			details: {
				packageHash: PACKAGE_HASH,
				slug: 'prueba',
				route: '/xv/prueba',
				previewProjectRef: 'iwipdvisoyerfdytuhwi',
				expectedPreviewProjectRef: 'iwipdvisoyerfdytuhwi',
				publicationPresent: true,
				provenancePackageHash: PACKAGE_HASH,
				provenanceProjectionHash: projectionHash,
				assetFailures: {
					'xv/renata/assets/hero-mobile-34522c50d513': 'HTTP 400',
					'xv/renata/assets/hero-desktop-34522c50d513': 'HTTP 400',
				},
				errors: ['Preview project identity does not match the pending approval.'],
			},
			projectionHash,
			reviewedAt: '2026-08-15T12:00:00.000Z',
		});

		expect(lines).toEqual([
			'  xv/renata/assets/hero-mobile-34522c50d513: HTTP 400',
			'  xv/renata/assets/hero-desktop-34522c50d513: HTTP 400',
			'  Preview project identity does not match the pending approval.',
		]);
	});

	it('leaves failed checks false instead of pre-marking the checklist', async () => {
		const result = await verifyPreviewArtifactLive(artifact(), {
			dbUrl: DB_URL,
			runQuery: queryResult([
				row({
					publishedEventType: 'boda',
					provenancePackageHash: 'f'.repeat(64),
				}),
			]),
		});

		expect(result.ok).toBe(false);
		expect(result.checklistResults.route).toBe(false);
		expect(result.checklistResults.provenance).toBe(false);
		expect(result.checklistResults.publication).toBe(true);
	});
});
