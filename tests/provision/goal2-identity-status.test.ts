/**
 * goal2-identity-status.test.ts — Automated tests for Goal 2 identity rekey, status engine, and target safeguards
 */

import { describe, expect, it } from '@jest/globals';
import {
	getGeneralEnvStatus,
	evaluateInvitationStatus,
} from '../../scripts/provision/dbs-status.ts';
import { applyLocalInvitation } from '../../scripts/provision/apply-local-invitation.ts';
import { validateUpdateOptions } from '../../scripts/provision/invitation-update-options.ts';

describe('Goal 2: Unified Status Engine (dbs-status)', () => {
	it('evaluates local environment status cleanly', () => {
		const localStatus = getGeneralEnvStatus('local');
		expect(localStatus.environment).toBe('local');
		expect(localStatus.reachable).toBe(true);
		expect(localStatus.targetClassification).toBe('persistent-local');
		expect(localStatus.activeManagedCount).toBeGreaterThan(0);
	});

	it('evaluates invitation-specific status for canonical Alba Rosa invitation', async () => {
		const status = await evaluateInvitationStatus('alba-rosa-quinonez');
		expect(status.slug).toBe('alba-rosa-quinonez');
		expect(status.environments.local.status).toBe('MATCH_CANONICAL');
		expect(status.environments.local.activeMatchCount).toBe(1);
		expect(status.environments.local.resolvedId).toBe('5bc32c29-69cc-4982-a65f-96952c516c7c');
	});

	it('throws error for non-existent invitation slug', async () => {
		await expect(evaluateInvitationStatus('non-existent-slug')).rejects.toThrow();
	});
});

describe('Goal 2: Identity Rekey Contract & Target Guardrails', () => {
	it('validates local target options cleanly when --rekey-from is provided', () => {
		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['local'],
				rekeyFrom: 'alba-rosa-old-slug',
			}),
		).not.toThrow();
	});

	it('fails closed when --rekey-from is specified for unsupported targets (preview or production)', () => {
		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['preview'],
				rekeyFrom: 'old-slug-alias',
			}),
		).toThrow('IDENTITY_REKEY_UNSUPPORTED_TARGET');

		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['production'],
				rekeyFrom: 'old-slug-alias',
			}),
		).toThrow('IDENTITY_REKEY_UNSUPPORTED_TARGET');

		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['local', 'preview'],
				rekeyFrom: 'old-slug-alias',
			}),
		).toThrow('IDENTITY_REKEY_UNSUPPORTED_TARGET');
	});

	it('throws IDENTITY_NOT_FOUND when explicit --rekey-from target does not exist', async () => {
		await expect(
			applyLocalInvitation({
				slug: 'alba-rosa-quinonez',
				rekeyFrom: 'non-existent-old-identity-slug-999',
				apply: false,
			}),
		).rejects.toThrow('IDENTITY_NOT_FOUND');
	});

	it('throws IDENTITY_CONFLICT on self-referential rekey request', async () => {
		await expect(
			applyLocalInvitation({
				slug: 'alba-rosa-quinonez',
				rekeyFrom: 'alba-rosa-quinonez',
				apply: false,
			}),
		).rejects.toThrow('IDENTITY_CONFLICT');
	});
});

describe('Goal 2: Explicit Rekey Lifecycle & Idempotency', () => {
	it('preserves invitation UUID and prepares rekey plan when updating existing invitation', async () => {
		const dryRun = await applyLocalInvitation({
			slug: 'alba-rosa-quinonez',
			apply: false,
		});
		expect(dryRun.invitationId).toBe('5bc32c29-69cc-4982-a65f-96952c516c7c');
		expect(dryRun.slug).toBe('alba-rosa-quinonez');
		expect(dryRun.plan.targetEnvironment).toBe('local');
		expect(dryRun.plan.executionStatus).toBe('PLANNED');
	});

	it('executes idempotently on repeated dry-run evaluation without creating duplicate invitations', async () => {
		const run1 = await applyLocalInvitation({ slug: 'alba-rosa-quinonez', apply: false });
		const run2 = await applyLocalInvitation({ slug: 'alba-rosa-quinonez', apply: false });
		expect(run1.invitationId).toBe(run2.invitationId);
		expect(run1.plan.sourceHash).toBe(run2.plan.sourceHash);
		expect(run1.plan.packageHash).toBe(run2.plan.packageHash);
	});
});

describe('Goal 2: Regression Protection (No Fuzzy Identity Inference)', () => {
	it('does NOT infer a rekey based on matching client name when no explicit lineage or --rekey-from is provided', async () => {
		// When a definition is requested without --rekey-from and without existing provenance,
		// matching client_name in target DB must NOT throw IDENTITY_REKEY_REQUIRED.
		// Instead, it plans a normal new invitation or uses existing provenance/slug match.
		const dryRun = await applyLocalInvitation({
			slug: 'alba-rosa-quinonez',
			apply: false,
		});
		expect(dryRun.invitationId).toBe('5bc32c29-69cc-4982-a65f-96952c516c7c');
		expect(dryRun.slug).toBe('alba-rosa-quinonez');
	});
});
