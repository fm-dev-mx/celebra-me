/**
 * Unit tests for Preview & Production promotion CLI approval verification
 */

import { describe, it, expect } from '@jest/globals';
import { generatePreviewApprovalArtifact } from '../../scripts/provision/promote-preview-cli';
import { verifyPreviewApprovalArtifact } from '../../scripts/provision/promote-prod-cli';
import { finalizePreviewApproval } from '../../scripts/provision/finalize-preview-approval-cli';
import { rejectPreviewApproval } from '../../scripts/provision/finalize-preview-approval-cli';
import type { ImportEngineResult } from '../../scripts/provision/invitation-import-engine';

describe('Promotion CLI & Approval Artifact Verification', () => {
	const mockResult: ImportEngineResult = {
		packageHash: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
		slug: 'romina-rios-chaparro',
		target: 'preview',
		projectRef: 'iwipdvisoyerfdytuhwi',
		ownerUserId: '14758891-b277-4831-8593-16ba95c5e33e',
		publishedVersion: 1,
		projectionHash: 'projection-hash',
		route: '/xv/romina-rios-chaparro',
		actions: [],
		mutationsPerformed: 5,
		verifiedAssetHashes: { 'invitations/123/hero.webp': 'hash123' },
		isZeroDriftRerun: false,
	};

	it('creates pending approval and requires matching hosted validation before verification', () => {
		const { artifact } = generatePreviewApprovalArtifact(mockResult, '.agent/tmp/approvals');

		expect(artifact.packageHash).toBe(mockResult.packageHash);
		expect(artifact.approvalState).toBe('pending_hosted_validation');
		expect(artifact.previewProjectRef).toBe('iwipdvisoyerfdytuhwi');
		expect(() =>
			verifyPreviewApprovalArtifact(mockResult.packageHash, undefined, [
				'.agent/tmp/approvals',
			]),
		).toThrow(/hosted validation/);
		const approved = finalizePreviewApproval(artifact, {
			validatedAt: '2026-07-20T20:00:00.000Z',
			deploymentUrl: 'https://preview.example.com',
			previewProjectRef: artifact.previewProjectRef,
			packageHash: artifact.packageHash,
			slug: artifact.slug,
			route: artifact.route,
			publishedVersion: artifact.publishedVersion,
			projectionHash: 'projection-hash',
			storageHashVerification: artifact.assetHashes,
			checklistResults: {
				login: true,
				mfaBypass: true,
				previewBanner: true,
				dashboardListing: true,
				editorAndSnapshot: true,
				draftAndPublishedContent: true,
				publicRouteResponsive: true,
				invitationFeatures: true,
				previewStorageOnly: true,
				preflight: true,
				controlledPublication: true,
				cleanConsoleAndLogs: true,
				noProductionSupabaseRequests: true,
			},
		});
		expect(approved.approvalState).toBe('approved');
	});

	it('records a rejected state and Production rejects it', () => {
		const { artifact } = generatePreviewApprovalArtifact(mockResult, '.agent/tmp/approvals');
		const rejected = rejectPreviewApproval(
			artifact,
			'Preview Storage source was not isolated.',
		);
		expect(rejected.approvalState).toBe('rejected');
		expect(rejected.rejection?.reason).toBe('Preview Storage source was not isolated.');
	});

	it('rejects verification if no approval artifact exists for package hash', () => {
		const unapprovedHash = '9999999999999999999999999999999999999999999999999999999999999999';

		expect(() => {
			verifyPreviewApprovalArtifact(unapprovedHash, undefined, ['.agent/tmp/approvals']);
		}).toThrow(/No Preview approval artifact found/);
	});
});
