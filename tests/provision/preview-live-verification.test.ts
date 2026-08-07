import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import { verifyPreviewArtifactLive } from '../../scripts/provision/preview-live-verification.ts';

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
