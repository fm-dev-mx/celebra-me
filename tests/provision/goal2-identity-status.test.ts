/**
 * goal2-identity-status.test.ts — Hermetic managed identity / option guards.
 *
 * Pure decision helpers and update-option guards only. Disposable PostgreSQL
 * rekey wiring lives in `pnpm test:db:managed-contracts` (SQL + guard checks;
 * apply-entrypoint integration is tracked separately).
 */

import { describe, expect, it } from '@jest/globals';
import { validateUpdateOptions } from '../../scripts/provision/invitation-update-options.ts';
import {
	decideRekeyIdentity,
	resolveIdentityWithoutRekey,
} from '../../scripts/provision/managed-identity-guards.ts';

const MANAGED_ID = '2b3c4d5e-6f70-4192-a3b4-c5d6e7f8091a';

describe('Identity Rekey Contract & Target Guardrails (hermetic)', () => {
	it('validates local and preview target options when --rekey-from is provided', () => {
		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['local'],
				rekeyFrom: 'alba-rosa-old-slug',
			}),
		).not.toThrow();

		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['preview'],
				rekeyFrom: 'old-slug-alias',
			}),
		).not.toThrow();

		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['local', 'preview'],
				rekeyFrom: 'old-slug-alias',
			}),
		).not.toThrow();
	});

	it('fails closed when --rekey-from is specified for production', () => {
		expect(() =>
			validateUpdateOptions({
				slug: 'alba-rosa-quinonez',
				targets: ['production'],
				rekeyFrom: 'old-slug-alias',
			}),
		).toThrow('IDENTITY_REKEY_UNSUPPORTED_TARGET');
	});

	it('throws IDENTITY_NOT_FOUND when explicit --rekey-from target does not exist', () => {
		const decision = decideRekeyIdentity({
			slug: 'alba-rosa-quinonez',
			rekeyFrom: 'non-existent-old-identity-slug-999',
			sourceByOldSlug: null,
			collisionByTargetSlug: null,
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('IDENTITY_NOT_FOUND');
		}
	});

	it('throws IDENTITY_CONFLICT on self-referential rekey request', () => {
		const decision = decideRekeyIdentity({
			slug: 'alba-rosa-quinonez',
			rekeyFrom: 'alba-rosa-quinonez',
			sourceByOldSlug: { id: '11111111-2222-3333-4444-555555555555', slug: 'alba-rosa-quinonez' },
			collisionByTargetSlug: null,
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('IDENTITY_CONFLICT');
		}
	});

	it('throws IDENTITY_CONFLICT when destination slug is occupied by another invitation', () => {
		const decision = decideRekeyIdentity({
			slug: 'alba-rosa-quinonez',
			rekeyFrom: 'alba-rosa-old',
			sourceByOldSlug: { id: '11111111-2222-3333-4444-555555555555', slug: 'alba-rosa-old' },
			collisionByTargetSlug: {
				id: '99999999-9999-9999-9999-999999999999',
				slug: 'alba-rosa-quinonez',
			},
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('IDENTITY_CONFLICT');
		}
	});

	it('accepts a valid explicit rekey when source exists and destination is free', () => {
		const decision = decideRekeyIdentity({
			slug: 'alba-rosa-quinonez',
			rekeyFrom: 'alba-rosa-old',
			sourceByOldSlug: { id: '11111111-2222-3333-4444-555555555555', slug: 'alba-rosa-old' },
			collisionByTargetSlug: null,
		});
		expect(decision).toEqual({
			ok: true,
			invitationId: '11111111-2222-3333-4444-555555555555',
		});
	});
});

describe('Managed Identity: Regression Protection (No Fuzzy Identity Inference)', () => {
	it('does NOT infer a rekey from matching client_name when --rekey-from is absent', () => {
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			managedIdentityId: MANAGED_ID,
			invitationByManagedIdentity: null,
			provenanceInvitationId: null,
			invitationBySlug: {
				id: '5bc32c29-69cc-4982-a65f-96952c516c7c',
				slug: 'alba-rosa-quinonez',
			},
			activeInvitationByPreviousSlug: null,
			invitationByClientName: {
				id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
				slug: 'other-legacy-slug',
			},
		});
		expect(decision.ok).toBe(true);
		if (decision.ok) {
			expect(decision.mode).toBe('slug');
			expect(decision.invitationId).toBe('5bc32c29-69cc-4982-a65f-96952c516c7c');
		}
	});

	it('prefers managed identity over provenance/slug when present', () => {
		const id = '5bc32c29-69cc-4982-a65f-96952c516c7c';
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			managedIdentityId: MANAGED_ID,
			invitationByManagedIdentity: {
				id,
				slug: 'alba-rosa-quinonez',
				managedIdentityId: MANAGED_ID,
			},
			provenanceInvitationId: id,
			invitationBySlug: { id, slug: 'alba-rosa-quinonez' },
			activeInvitationByPreviousSlug: null,
		});
		expect(decision).toEqual({ ok: true, invitationId: id, mode: 'managed_identity' });
	});

	it('detects IDENTITY_CONFLICT when provenance and slug point at different invitations', () => {
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			managedIdentityId: MANAGED_ID,
			invitationByManagedIdentity: null,
			provenanceInvitationId: '11111111-2222-3333-4444-555555555555',
			invitationBySlug: {
				id: '99999999-9999-9999-9999-999999999999',
				slug: 'alba-rosa-quinonez',
			},
			activeInvitationByPreviousSlug: null,
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('IDENTITY_CONFLICT');
		}
	});

	it('requires explicit rekey when a previous slug is still active', () => {
		const decision = resolveIdentityWithoutRekey({
			slug: 'daniela-y-martin',
			managedIdentityId: '8e4f2a1b-6c3d-4e9f-a0b1-2c3d4e5f6a7b',
			previousSlugs: ['boda-daniela-y-martin'],
			invitationByManagedIdentity: null,
			provenanceInvitationId: null,
			invitationBySlug: null,
			activeInvitationByPreviousSlug: {
				id: '4b616edc-142f-4427-85df-dc75e94aa381',
				slug: 'boda-daniela-y-martin',
			},
			matchedPreviousSlug: 'boda-daniela-y-martin',
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('REKEY_REQUIRED');
			expect(decision.message).toContain('--rekey-from boda-daniela-y-martin');
		}
	});
});
