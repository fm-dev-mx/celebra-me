import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	createMemoryPreviewApprovalStore,
	rowToArtifact,
} from '../../scripts/provision/preview-approval-store.ts';
import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';

const sample: PreviewApprovalArtifact = {
	approvalState: 'pending_hosted_validation',
	schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
	packageHash: 'a'.repeat(64),
	sourceHash: 'b'.repeat(64),
	metadataHash: 'c'.repeat(64),
	canonicalProjectionHash: 'd'.repeat(32),
	materializedProjectionHash: 'e'.repeat(32),
	assetManifestHash: 'f'.repeat(64),
	slug: 'demo',
	previewProjectRef: 'iwipdvisoyerfdytuhwi',
	createdAt: '2026-08-06T00:00:00.000Z',
	route: '/boda/demo',
	expectedAssetHashes: {},
};

describe('preview approval store', () => {
	it('memory store round-trips artifacts', () => {
		const store = createMemoryPreviewApprovalStore();
		expect(store.get(sample.packageHash)).toBeNull();
		store.upsert(sample);
		expect(store.get(sample.packageHash)?.slug).toBe('demo');
	});

	it('rowToArtifact maps DB snake_case columns', () => {
		const artifact = rowToArtifact({
			package_hash: sample.packageHash,
			slug: sample.slug,
			route: sample.route,
			approval_state: 'pending_hosted_validation',
			schema_version: PREVIEW_APPROVAL_SCHEMA_VERSION,
			source_hash: sample.sourceHash,
			metadata_hash: sample.metadataHash,
			canonical_projection_hash: sample.canonicalProjectionHash,
			materialized_projection_hash: sample.materializedProjectionHash,
			asset_manifest_hash: sample.assetManifestHash,
			plan_id: null,
			preview_project_ref: sample.previewProjectRef,
			intended_production_project_ref: null,
			expected_asset_hashes: {},
			hosted_validation: null,
			created_at: sample.createdAt,
			approved_at: null,
			approved_by: null,
		});
		expect(artifact.packageHash).toBe(sample.packageHash);
		expect(artifact.approvalState).toBe('pending_hosted_validation');
	});

	it('migration SQL defines RLS and service_role-only grants', () => {
		const sql = readFileSync(
			resolve(
				process.cwd(),
				'supabase/migrations/20260806120000_preview_approval_artifacts.sql',
			),
			'utf8',
		);
		expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.preview_approval_artifacts');
		expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
		expect(sql).toContain('REVOKE ALL ON TABLE public.preview_approval_artifacts FROM PUBLIC');
		expect(sql).toContain(
			'GRANT ALL ON TABLE public.preview_approval_artifacts TO service_role',
		);
		expect(sql).toContain('expires_at timestamptz GENERATED ALWAYS AS');
	});
});
