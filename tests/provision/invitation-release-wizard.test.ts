/**
 * Destination-driven invitation:release wizard contracts (source + readiness helpers).
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	defaultDestinationFromPromotionAction,
	describeDestination,
	isStaleProvenanceBlockReason,
	resolveDestinationReadiness,
} from '../../scripts/provision/invitation-release-destination.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';

describe('invitation-release destination readiness', () => {
	beforeEach(() => {
		setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore());
	});

	afterEach(() => {
		setDefaultPreviewApprovalStoreForTests(null);
	});

	it('labels operator outcomes in Spanish destination language', () => {
		expect(describeDestination('local')).toMatch(/Local/i);
		expect(describeDestination('prepare_preview')).toMatch(/Preview/i);
		expect(describeDestination('production')).toMatch(/Production/i);
	});

	it('defaults the wizard destination from the same publication action as dbs', () => {
		expect(defaultDestinationFromPromotionAction('PROMOTE_PREVIEW')).toBe('prepare_preview');
		expect(defaultDestinationFromPromotionAction('PROMOTE_PRODUCTION')).toBe('production');
		expect(defaultDestinationFromPromotionAction('NONE')).toBe('cancel');
		expect(defaultDestinationFromPromotionAction('BLOCKED')).toBe('cancel');
		expect(defaultDestinationFromPromotionAction('UNKNOWN')).toBe('cancel');
	});

	it('detects stale_provenance block reasons for wizard recovery', () => {
		expect(
			isStaleProvenanceBlockReason(
				'stale_provenance: A newer managed operation is not represented by provenance.',
			),
		).toBe(true);
		expect(isStaleProvenanceBlockReason('merge conflict')).toBe(false);
		expect(isStaleProvenanceBlockReason(undefined)).toBe(false);
	});

	it('marks Production not ready without exact Preview approval for a known slug', async () => {
		const readiness = await resolveDestinationReadiness({
			slug: 'daniela-y-martin',
		});
		expect(readiness.slug).toBe('daniela-y-martin');
		expect(readiness.packageHash.length).toBeGreaterThan(16);
		expect(readiness.sourceHash.length).toBeGreaterThan(16);
		expect(readiness.productionReady).toBe(false);
		expect(readiness.productionBlockReason).toBeTruthy();
	}, 15_000);
});

describe('invitation-release wizard package binding', () => {
	it('binds Local apply to session sourceHash/packageHash and keeps Production separate', () => {
		const wizard = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-wizard.ts'),
			'utf8',
		);
		expect(wizard).toContain('persistSessionPackage');
		expect(wizard).toContain('expectedSourceHash: session.sourceHash');
		expect(wizard).toContain('expectedPackageHash: session.packageHash');
		expect(wizard).toContain("targets: ['local', 'preview']");
		expect(wizard).toContain('runLiveApproval');
		expect(wizard).toContain('applyProductionOutcome');
		expect(wizard).toContain('maybeRecoverConflicts');
		expect(wizard).toContain('maybeRecoverUnpublishedDraftDivergence');
		expect(wizard).toContain('maybeRecoverStaleProvenance');
		expect(wizard).toContain('reconcileStalePreviewProvenance');
		expect(wizard).toContain('defaultDestinationFromPromotionAction');
		expect(wizard).toContain('ensurePreviewApprovalForProduction');
		expect(wizard).toContain('maybeCompletePreviewApproval');
		expect(wizard).toContain('acknowledgeDiscardUnpublishedDraft');
		// Exact valid approval skips live verify / re-approve (productionReady authority).
		expect(wizard).toContain('Preview ya tiene aprobación exacta');
		expect(wizard).toMatch(
			/if \(readiness\.productionReady\)[\s\S]*?return;[\s\S]*?await runLiveApproval\(session\)/,
		);
		// Review preflight defers backup; orchestrator classifies recovery risk.
		expect(wizard).toContain('requireBackup: false');
		// Production must not auto-run after Preview approve.
		const approveIdx = wizard.indexOf('await maybeCompletePreviewApproval(session)');
		const prodIdx = wizard.indexOf('applyProductionOutcome');
		expect(approveIdx).toBeGreaterThan(0);
		expect(prodIdx).toBeGreaterThan(0);
		const afterApprove = wizard.slice(approveIdx, approveIdx + 400);
		expect(afterApprove).not.toContain('orchestrateInvitationPromotion');
	});

	it('skips second live verification when destination readiness is already productionReady', () => {
		const wizard = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-wizard.ts'),
			'utf8',
		);
		const helper = wizard.slice(
			wizard.indexOf('async function maybeCompletePreviewApproval'),
			wizard.indexOf('async function applyLocalOutcome'),
		);
		expect(helper).toContain('resolveDestinationReadiness');
		expect(helper).toContain('productionReady');
		expect(helper).toContain('await runLiveApproval(session)');
		expect(helper.indexOf('if (readiness.productionReady)')).toBeLessThan(
			helper.indexOf('await runLiveApproval(session)'),
		);
		expect(helper).toContain('pnpm prod:apply');
		expect(helper).not.toContain('verifyPreviewArtifactLive');
	});

	it('inherits deliveryScope through resolvePromotionUpdateScope', () => {
		const wizard = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-wizard.ts'),
			'utf8',
		);
		expect(wizard).toContain('requireResolvedUpdateScope');
		expect(wizard).toContain('defaultAssetPolicy');
		expect(wizard).not.toContain("definition.deliveryScope === 'content-and-assets'");
	});

	it('enforces Local PLAN_DRIFT when expected hashes mismatch', () => {
		const applyLocal = readFileSync(
			resolve(process.cwd(), 'scripts/provision/apply-local-invitation.ts'),
			'utf8',
		);
		expect(applyLocal).toContain('expectedSourceHash');
		expect(applyLocal).toContain('expectedPackageHash');
		expect(applyLocal).toContain('PLAN_DRIFT');
	});

	it('resolves updateScope before storage upload work and fails closed on content-only mutations', () => {
		const applyLocal = readFileSync(
			resolve(process.cwd(), 'scripts/provision/apply-local-invitation.ts'),
			'utf8',
		);
		const scopeIdx = applyLocal.indexOf('const updateScope: UpdateScope = options.updateScope');
		const uploadIdx = applyLocal.indexOf('// 2. Storage Uploads & Metadata Upserts');
		expect(scopeIdx).toBeGreaterThan(0);
		expect(uploadIdx).toBeGreaterThan(scopeIdx);
		expect(applyLocal).toContain('assertContentOnlyAllowsNoAssetMutations');
		expect(applyLocal).toContain("updateScope === 'content-only'");
		expect(applyLocal).toContain('Missing local asset under content-only');
	});

	it('falls back to resolved ownerUserId when existing invitation created_by is null', () => {
		const applyLocal = readFileSync(
			resolve(process.cwd(), 'scripts/provision/apply-local-invitation.ts'),
			'utf8',
		);
		expect(applyLocal).toContain('ownerUserId: existingInv.created_by');
		expect(applyLocal).toContain('? String(existingInv.created_by)');
		expect(applyLocal).toContain(': ownerUserId');
		expect(applyLocal).not.toMatch(
			/ownerUserId:\s*String\(existingInv\.created_by\)\s*,\s*\n\s*status:/,
		);
	});
});

describe('zero-drift must not poison managed provenance', () => {
	it('does not insert managed_invitation_apply receipts on Preview zero-drift apply', () => {
		const engine = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const zeroDriftBlock = engine.slice(
			engine.indexOf('if (dryRun || isZeroDrift)'),
			engine.indexOf('// ── APPLY PHASE'),
		);
		expect(zeroDriftBlock).toContain('must not append a managed_invitation_apply receipt');
		expect(zeroDriftBlock).not.toContain('invitation_mutation_operation_receipts');
		expect(zeroDriftBlock).not.toContain("'replayed'");
	});

	it('does not insert managed_invitation_apply receipts on Local zero-drift apply', () => {
		const applyLocal = readFileSync(
			resolve(process.cwd(), 'scripts/provision/apply-local-invitation.ts'),
			'utf8',
		);
		const zeroDriftBlock = applyLocal.slice(
			applyLocal.indexOf('if (!isApply || isZeroDrift)'),
			applyLocal.indexOf('// ── APPLY'),
		);
		expect(zeroDriftBlock).toContain('must not append a managed_invitation_apply receipt');
		expect(zeroDriftBlock).not.toContain('invitation_mutation_operation_receipts');
		expect(zeroDriftBlock).not.toContain("'replayed'");
	});
});
