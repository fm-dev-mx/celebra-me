/**
 * goal2-identity-status.test.ts — Hermetic Goal 2 identity / option guards.
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

describe('Goal 2: Identity Rekey Contract & Target Guardrails (hermetic)', () => {
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

describe('Goal 2: Regression Protection (No Fuzzy Identity Inference)', () => {
	it('does NOT infer a rekey from matching client_name when --rekey-from is absent', () => {
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			provenanceInvitationId: null,
			invitationBySlug: {
				id: '5bc32c29-69cc-4982-a65f-96952c516c7c',
				slug: 'alba-rosa-quinonez',
			},
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

	it('prefers provenance over slug when both agree on identity', () => {
		const id = '5bc32c29-69cc-4982-a65f-96952c516c7c';
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			provenanceInvitationId: id,
			invitationBySlug: { id, slug: 'alba-rosa-quinonez' },
			invitationByClientName: {
				id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
				slug: 'other-legacy-slug',
			},
		});
		expect(decision).toEqual({ ok: true, invitationId: id, mode: 'provenance' });
	});

	it('detects IDENTITY_CONFLICT when provenance and slug point at different invitations', () => {
		const decision = resolveIdentityWithoutRekey({
			slug: 'alba-rosa-quinonez',
			provenanceInvitationId: '11111111-2222-3333-4444-555555555555',
			invitationBySlug: {
				id: '99999999-9999-9999-9999-999999999999',
				slug: 'alba-rosa-quinonez',
			},
		});
		expect(decision.ok).toBe(false);
		if (!decision.ok) {
			expect(decision.code).toBe('IDENTITY_CONFLICT');
		}
	});
});
