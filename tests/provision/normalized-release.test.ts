import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	buildNormalizedInvitationRelease,
	buildSemanticAssetMap,
	materializeAssetReferences,
	type NormalizedInvitationRelease,
} from '../../scripts/provision/normalized-invitation-release.ts';
import { serializeInvitationPackage, computePackageHash } from '../../scripts/provision/invitation-package.ts';
import { validatePackageData } from '../../scripts/provision/invitation-import-engine.ts';
import { rominaInvitation, ROMINA_ASSET_SPECS } from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition.ts';

async function createProductionRelease(slug = 'romina-rios-chaparro'): Promise<{ release: NormalizedInvitationRelease; cleanup: () => void }> {
	const tempDir = mkdtempSync(join(tmpdir(), 'romina-release-test-'));
	const sampleJpeg = await sharp({
		create: { width: 1200, height: 1600, channels: 3, background: { r: 182, g: 139, b: 115 } },
	})
		.jpeg({ quality: 90 })
		.toBuffer();

	for (const spec of ROMINA_ASSET_SPECS) {
		writeFileSync(join(tempDir, spec.relativePath), sampleJpeg);
	}

	const release = await buildNormalizedInvitationRelease({ slug, sourceDir: tempDir });
	return {
		release,
		cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
	};
}

describe('normalized managed release semantics & roundtrip parity', () => {
	it('uses declared semantic keys rather than environment UUIDs', () => {
		const semantic = buildSemanticAssetMap(rominaInvitation);
		expect(semantic.hero.assetId).toContain('__INVITATION_ASSET_KEY__:hero');
		const materialized = materializeAssetReferences(
			{ image: semantic.hero },
			{ hero: { type: 'uploaded', assetId: '00000000-0000-4000-8000-000000000001', src: 'https://target.example/hero.webp' } },
		) as { image: { assetId: string; src: string } };
		expect(materialized.image).toEqual({
			type: 'uploaded',
			assetId: '00000000-0000-4000-8000-000000000001',
			src: 'https://target.example/hero.webp',
		});
	});

	it('proves end-to-end Local/Package materialization roundtrip parity for Romina invitation', async () => {
		const { release, cleanup } = await createProductionRelease();
		try {

		// 1. Local Materialization Path: Release -> Local Target Asset Map -> Content
		const localAssetUuidMap: UploadedAssetMap = Object.fromEntries(
			ROMINA_ASSET_SPECS.map((spec, index) => [
				spec.key,
				{
					type: 'uploaded' as const,
					assetId: `11111111-1111-4000-8000-${String(index + 1).padStart(12, '0')}`,
					src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/managed/local/${spec.key}.webp`,
				},
			]),
		);
		const localMaterializedDraft = materializeAssetReferences(release.draftContent, localAssetUuidMap) as Record<string, unknown>;

		// 2. Package Materialization Path: Release -> Serialize Package -> Validate Package -> Target Asset Map -> Content
		const serializedPkg = serializeInvitationPackage(release);
		expect(serializedPkg.packageHash).toBe(computePackageHash(serializedPkg));
		const validatedPkg = validatePackageData(serializedPkg);
		expect(validatedPkg.packageHash).toBe(serializedPkg.packageHash);

		const targetAssetUuidMap: UploadedAssetMap = Object.fromEntries(
			serializedPkg.assets.map((asset, index) => [
				asset.key,
				{
					type: 'uploaded' as const,
					assetId: `22222222-2222-4000-8000-${String(index + 1).padStart(12, '0')}`,
					src: `https://iwipdvisoyerfdytuhwi.supabase.co/storage/v1/object/public/invitation-assets/${asset.storagePath}`,
				},
			]),
		);
		const packageMaterializedDraft = materializeAssetReferences(serializedPkg.publishedContent.content, targetAssetUuidMap) as Record<string, unknown>;

		// 3. Normalize Environment Differences (UUIDs and Storage URLs)
		function normalizeEnv(obj: unknown): unknown {
			if (Array.isArray(obj)) return obj.map(normalizeEnv);
			if (obj !== null && typeof obj === 'object') {
				const rec = obj as Record<string, unknown>;
				if (rec.type === 'uploaded' && typeof rec.assetId === 'string' && typeof rec.src === 'string') {
					return {
						type: 'uploaded',
						assetId: '[NORMALIZED_ASSET_ID]',
						src: '[NORMALIZED_ASSET_SRC]',
					};
				}
				return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, normalizeEnv(v)]));
			}
			return obj;
		}

		// 4. Assert Exact Roundtrip Parity
		expect(normalizeEnv(localMaterializedDraft)).toEqual(normalizeEnv(packageMaterializedDraft));
		expect(release.metadata.title).toBe('XV años de Romina Ríos Chaparro');
		expect(serializedPkg.invitation.title).toBe('XV años de Romina Ríos Chaparro');

		// 5. Assert Semantic Key & Leakage Safety Invariants
		expect(serializedPkg.assets).toHaveLength(11);
		expect(serializedPkg.assets.map((a) => a.key).sort()).toEqual(ROMINA_ASSET_SPECS.map((s) => s.key).sort());

		const packageJsonStr = JSON.stringify(serializedPkg);
		expect(packageJsonStr).not.toContain('127.0.0.1');
		expect(packageJsonStr).not.toContain('localhost');
		expect(packageJsonStr).not.toContain('11111111-1111-4000-8000');
		} finally {
			cleanup();
		}
	});
});

