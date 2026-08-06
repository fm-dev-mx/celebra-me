import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migratePreviewApprovalArtifacts } from '../../scripts/provision/preview-approval-migrate.ts';
import {
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import { createMemoryPreviewApprovalStore } from '../../scripts/provision/preview-approval-store.ts';

const dirs: string[] = [];
const now = new Date('2026-08-06T12:00:00.000Z');

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function approvedArtifact(
	overrides: Partial<PreviewApprovalArtifact> = {},
): PreviewApprovalArtifact {
	return {
		approvalState: 'approved',
		schemaVersion: PREVIEW_APPROVAL_SCHEMA_VERSION,
		packageHash: 'a'.repeat(64),
		sourceHash: 'b'.repeat(64),
		metadataHash: 'c'.repeat(64),
		canonicalProjectionHash: 'd'.repeat(32),
		materializedProjectionHash: 'e'.repeat(32),
		assetManifestHash: 'f'.repeat(64),
		slug: 'demo',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		createdAt: '2026-08-01T00:00:00.000Z',
		approvedAt: '2026-08-05T00:00:00.000Z',
		approvedBy: 'owner@celebra-me.test',
		intendedProductionProjectRef: 'productionproject',
		route: '/boda/demo',
		expectedAssetHashes: {},
		hostedValidation: {
			packageHash: 'a'.repeat(64),
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/boda/demo',
			projectionHash: 'e'.repeat(32),
			planId: 'plan-1',
			reviewedAt: '2026-08-05T00:00:00.000Z',
			reviewedBy: 'owner@celebra-me.test',
			intendedProductionProjectRef: 'productionproject',
			checklistResults: { route: true, database: true, storage: true },
			storageHashVerification: {},
		},
		...overrides,
	};
}

describe('preview-approval-migrate', () => {
	it('imports fresh approved artifacts and skips pending/stale', () => {
		const dir = mkdtempSync(join(tmpdir(), 'approvals-migrate-'));
		dirs.push(dir);
		writeFileSync(
			join(dir, 'preview-approval-aaaaaaaaaaaaaaaa.json'),
			JSON.stringify(approvedArtifact()),
		);
		writeFileSync(
			join(dir, 'preview-approval-bbbbbbbbbbbbbbbb.json'),
			JSON.stringify(
				approvedArtifact({
					packageHash: 'b'.repeat(64),
					approvalState: 'pending_hosted_validation',
					approvedAt: undefined,
					approvedBy: undefined,
					hostedValidation: undefined,
					intendedProductionProjectRef: undefined,
				}),
			),
		);
		writeFileSync(
			join(dir, 'preview-approval-cccccccccccccccc.json'),
			JSON.stringify(
				approvedArtifact({
					packageHash: 'c'.repeat(64),
					approvedAt: '2026-07-01T00:00:00.000Z',
				}),
			),
		);

		const store = createMemoryPreviewApprovalStore();
		const result = migratePreviewApprovalArtifacts({ dir, now, store, dryRun: false });
		expect(result.migrated).toBe(1);
		expect(result.skipped).toBe(2);
		expect(store.get('a'.repeat(64))?.approvalState).toBe('approved');
		expect(store.get('b'.repeat(64))).toBeNull();
	});

	it('dry-run does not write', () => {
		const dir = mkdtempSync(join(tmpdir(), 'approvals-migrate-dry-'));
		dirs.push(dir);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, 'preview-approval-aaaaaaaaaaaaaaaa.json'),
			JSON.stringify(approvedArtifact()),
		);
		const store = createMemoryPreviewApprovalStore();
		const result = migratePreviewApprovalArtifacts({ dir, now, store, dryRun: true });
		expect(result.migrated).toBe(1);
		expect(store.get('a'.repeat(64))).toBeNull();
	});
});
