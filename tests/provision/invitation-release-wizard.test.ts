/**
 * Destination-driven invitation:release wizard contracts (source + readiness helpers).
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	describeDestination,
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
		// Review preflight defers backup; orchestrator classifies recovery risk.
		expect(wizard).toContain('requireBackup: false');
		// Production must not auto-run after Preview approve.
		const approveIdx = wizard.indexOf('await runLiveApproval(session)');
		const prodIdx = wizard.indexOf('applyProductionOutcome');
		expect(approveIdx).toBeGreaterThan(0);
		expect(prodIdx).toBeGreaterThan(0);
		const afterApprove = wizard.slice(approveIdx, approveIdx + 400);
		expect(afterApprove).not.toContain('orchestrateInvitationPromotion');
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
});
