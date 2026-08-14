import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	evaluatePreviewReceiptState,
	type PreviewReceiptState,
} from '../../scripts/provision/preview-provenance-receipt-service.ts';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';

const invitationId = '11111111-1111-4111-8111-111111111111';
const oldOperation = '22222222-2222-4222-8222-222222222222';
const latestOperation = '33333333-3333-4333-8333-333333333333';
const content = { title: 'Abril' };
const packageData = {
	schemaVersion: '2.0.0',
	packageHash: 'a'.repeat(64),
	sourceHash: 'b'.repeat(64),
	metadataHash: 'c'.repeat(64),
	projectionHash: hashPublicationProjection(content),
	assetManifestHash: 'd'.repeat(64),
	definitionCreatedAt: '2026-08-01T00:00:00.000Z',
	sourceSlug: 'abril-michelle-becerra-rea',
	invitation: {
		slug: 'abril-michelle-becerra-rea',
		managedIdentityId: invitationId,
		previousSlugs: [],
		title: 'Abril',
		eventType: 'boda',
		baseDemoId: 'demo',
		themeId: 'theme',
		kind: 'client',
		clientName: 'Abril',
		hostLoginAlias: 'abril',
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: true,
		snapshot: {},
	},
	draft: { status: 'draft', content },
	publishedContent: { content },
	event: { title: 'Abril', eventType: 'boda', status: 'published' },
	assets: [],
} as InvitationPackageData;

function receipt(
	operationId: string,
	status: 'applied' | 'partial' = 'applied',
	pkg: InvitationPackageData = packageData,
): PreviewReceiptState['latestReceipt'] {
	return {
		operationId,
		status,
		commandKind: 'managed_invitation_apply',
		origin: 'managed_cli_hosted',
		completedSteps: ['target_verified', 'published'],
		inputHashes: { sourceHash: pkg.sourceHash, packageHash: pkg.packageHash },
	};
}

function state(
	latest: PreviewReceiptState['latestReceipt'],
	pkg: InvitationPackageData = packageData,
): PreviewReceiptState {
	return {
		invitation: {
			id: invitationId,
			slug: pkg.invitation.slug,
			managed_identity_id: invitationId,
			updated_at: null,
			status: 'published',
			archived_at: null,
		},
		draft: { updated_at: '2026-08-14T00:00:00.000Z', content },
		published: { version: 2, content },
		provenance: {
			definition_slug: pkg.sourceSlug,
			managed_identity_id: invitationId,
			previous_slugs: [],
			release_schema_version: pkg.schemaVersion,
			source_hash: pkg.sourceHash,
			package_hash: pkg.packageHash,
			metadata_hash: pkg.metadataHash,
			projection_hash: createHash('sha256')
				.update(JSON.stringify(pkg.projectionHash))
				.digest('hex'),
			asset_manifest_hash: pkg.assetManifestHash,
			managed_projection: content,
			applied_draft_updated_at: '2026-08-13T00:00:00.000Z',
			applied_operation_id: oldOperation,
			applied_published_version: 2,
			applied_published_projection_hash: hashPublicationProjection(
				pkg.publishedContent.content,
			),
		},
		appliedReceipt: {
			...receipt(oldOperation, 'applied', pkg)!,
			completedSteps: ['target_verified', 'published', 'provenance_recorded'],
		},
		latestReceipt: latest,
		assets: [],
	};
}

describe('Preview receipt stale provenance evaluator', () => {
	it('marks a complete newer managed receipt recoverable with metadata-only writes', () => {
		const result = evaluatePreviewReceiptState(packageData, state(receipt(latestOperation)));
		expect(result.blockers).toEqual([]);
		expect(result).toMatchObject({
			status: 'RECOVERABLE',
			classification: 'stale_provenance',
			recoveryEligible: true,
			writes: { content: 0, storage: 0, metadata: 2 },
		});
		expect(result.linkedOperationId).toBe(oldOperation);
		expect(result.latestOperationId).toBe(latestOperation);
	});

	it('allows recovery when the linked provenance still has an older package hash', () => {
		const staleState = state(receipt(latestOperation));
		staleState.provenance = {
			...staleState.provenance!,
			source_hash: 'e'.repeat(64),
			package_hash: 'f'.repeat(64),
			projection_hash: createHash('sha256').update(JSON.stringify('old')).digest('hex'),
			asset_manifest_hash: '1'.repeat(64),
		};

		const result = evaluatePreviewReceiptState(packageData, staleState);

		expect(result).toMatchObject({
			status: 'RECOVERABLE',
			recoveryEligible: true,
			writes: { content: 0, storage: 0, metadata: 2 },
		});
		expect(result.blockers).toEqual([]);
	});

	it('uses the latest package receipt when normalized and published projection hashes differ', () => {
		const packageWithNormalizedProjection = {
			...packageData,
			packageHash: '8'.repeat(64),
			projectionHash: '9'.repeat(32),
		} as InvitationPackageData;
		const staleState = state(
			receipt(latestOperation, 'applied', packageWithNormalizedProjection),
			packageWithNormalizedProjection,
		);
		staleState.provenance = {
			...staleState.provenance!,
			source_hash: 'e'.repeat(64),
			package_hash: 'f'.repeat(64),
			projection_hash: createHash('sha256').update(JSON.stringify('old')).digest('hex'),
			asset_manifest_hash: '1'.repeat(64),
		};

		const result = evaluatePreviewReceiptState(packageWithNormalizedProjection, staleState);

		expect(result.status).toBe('RECOVERABLE');
		expect(result.blockers).toEqual([]);
	});

	it('recognizes a completed recovery receipt as the current managed baseline', () => {
		const recoveredState = state(receipt(latestOperation));
		const recoveryReceipt = {
			...receipt(latestOperation)!,
			commandKind: 'managed_baseline_adoption',
			origin: 'recovery',
			completedSteps: ['target_verified', 'provenance_recorded'],
		};
		recoveredState.provenance = {
			...recoveredState.provenance!,
			applied_operation_id: latestOperation,
			applied_draft_updated_at: recoveredState.draft!.updated_at,
		};
		recoveredState.appliedReceipt = recoveryReceipt;
		recoveredState.latestReceipt = recoveryReceipt;

		const result = evaluatePreviewReceiptState(packageData, recoveredState);

		expect(result).toMatchObject({
			status: 'IN_SYNC',
			classification: 'verified_current',
			recoveryEligible: false,
			writes: { content: 0, storage: 0, metadata: 0 },
		});
		expect(result.blockers).toEqual([]);
	});

	it('blocks partial receipts and never plans metadata writes', () => {
		const result = evaluatePreviewReceiptState(
			packageData,
			state(receipt(latestOperation, 'partial')),
		);
		expect(result.status).toBe('BLOCKED');
		expect(result.recoveryEligible).toBe(false);
		expect(result.writes).toEqual({ content: 0, storage: 0, metadata: 0 });
		expect(result.blockers).toContain('latest_receipt_not_final');
	});
});
