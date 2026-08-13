/**
 * Hosted post-apply verification must compare live rows to planned content.
 * It must not re-run pre-apply merge-baseline revision checks.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import {
	APPLIED_HOSTED_TARGET_IDENTITY_FAILURE,
	assertAppliedHostedTargetIdentity,
	evaluateAppliedHostedTargetIdentity,
	type AppliedHostedTargetIdentityInput,
} from '../../scripts/provision/promotion-comparison.ts';

const TARGET_STORAGE_URL = 'https://preview.example/storage/v1/object/public/invitation-assets';
const INVITATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTENT = { hero: { title: 'Romina' }, gallery: { variant: 'editorial-mosaic' } };

function pkg(): InvitationPackageData {
	return {
		invitation: {
			slug: 'romina-rios-chaparro',
			managedIdentityId: INVITATION_ID,
			eventType: 'xv',
			baseDemoId: 'demo',
			themeId: 'theme',
			kind: 'client',
			snapshot: { title: 'Romina' },
		},
	} as unknown as InvitationPackageData;
}

function matchingRows(): AppliedHostedTargetIdentityInput {
	return {
		pkg: pkg(),
		ownerUserId: OWNER_ID,
		targetInvitationId: INVITATION_ID,
		targetStorageUrl: TARGET_STORAGE_URL,
		expectedDraftContent: CONTENT,
		expectedPublishedContent: CONTENT,
		existingInv: {
			id: INVITATION_ID,
			managed_identity_id: INVITATION_ID,
			event_type: 'xv',
			base_demo_id: 'demo',
			theme_id: 'theme',
			kind: 'client',
			snapshot: { title: 'Romina' },
		},
		existingDraft: {
			id: 'draft-1',
			status: 'approved',
			updated_at: '2026-08-13T05:10:00.000Z',
			content: CONTENT,
		},
		existingPub: {
			version: 18,
			content: CONTENT,
		},
		existingEvent: {
			owner_user_id: OWNER_ID,
			event_type: 'xv',
			invitation_project_id: INVITATION_ID,
		},
		existingMember: {
			user_id: OWNER_ID,
			membership_role: 'owner',
		},
	};
}

describe('evaluateAppliedHostedTargetIdentity', () => {
	it('accepts matching content when draft updated_at differs from the previous provenance token', () => {
		const identity = evaluateAppliedHostedTargetIdentity(matchingRows());
		expect(identity).toEqual({
			isInvMetadataIdentical: true,
			isDraftIdentical: true,
			isPubIdentical: true,
			isEventAndMemberIdentical: true,
		});
	});

	it('does not consult provenance revision tokens', () => {
		const rows = matchingRows();
		expect(() =>
			assertAppliedHostedTargetIdentity({
				...rows,
				existingDraft: {
					...(rows.existingDraft as Record<string, unknown>),
					updated_at: '2026-08-13T05:10:00.000Z',
					applied_draft_updated_at: '2026-08-12T20:00:00.000Z',
				},
			}),
		).not.toThrow();
	});

	it('rejects draft content that does not match the planned write', () => {
		const rows = matchingRows();
		expect(() =>
			assertAppliedHostedTargetIdentity({
				...rows,
				existingDraft: {
					...(rows.existingDraft as Record<string, unknown>),
					content: { hero: { title: 'Other' } },
				},
			}),
		).toThrow(APPLIED_HOSTED_TARGET_IDENTITY_FAILURE);
	});

	it('rejects published content mismatch', () => {
		expect(() =>
			assertAppliedHostedTargetIdentity({
				...matchingRows(),
				existingPub: {
					version: 18,
					content: { hero: { title: 'Stale' } },
				},
			}),
		).toThrow(APPLIED_HOSTED_TARGET_IDENTITY_FAILURE);
	});
});

describe('hosted post-apply verification contract', () => {
	const source = readFileSync(
		resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
		'utf8',
	);

	it('plans with analyzeTargetDrift before mutations', () => {
		const planCall = source.indexOf('const drift = analyzeTargetDrift(');
		const mutations = source.indexOf('const dbMutations = executeDatabaseUpserts(');
		expect(planCall).toBeGreaterThan(-1);
		expect(mutations).toBeGreaterThan(planCall);
	});

	it('does not re-run analyzeTargetDrift after database mutations', () => {
		const applyBlock = source.slice(
			source.indexOf('const dbMutations = executeDatabaseUpserts('),
			source.indexOf("completedSteps.push('provenance_recorded')"),
		);
		expect(applyBlock).not.toMatch(/analyzeTargetDrift\(/);
		expect(applyBlock).toMatch(/assertAppliedHostedTargetIdentity\(/);
		expect(applyBlock).toMatch(/scanTargetState\(/);
		expect(applyBlock.indexOf('assertAppliedHostedTargetIdentity')).toBeLessThan(
			applyBlock.indexOf('scanAssetStatus'),
		);
	});
});
