import { describe, expect, it } from '@jest/globals';
import { deriveProductionRekeyFrom } from '../../scripts/provision/invitation-import-engine.ts';
import { resolveIdentityWithoutRekey } from '../../scripts/provision/managed-identity-guards.ts';

const identity = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('Production implicit rekey from previousSlugs', () => {
	const base = {
		slug: 'adriana-e-israel',
		managedIdentityId: identity,
		previousSlugs: ['adriana-y-israel'],
	};

	it('derives the old slug when the row has the same managed identity and the new slug is free', () => {
		expect(
			deriveProductionRekeyFrom({
				...base,
				activeRows: [{ id: 'a', slug: 'adriana-y-israel', managed_identity_id: identity }],
			}),
		).toBe('adriana-y-israel');
	});

	it('does not derive when the old row belongs to another managed identity', () => {
		const activeRows = [{ id: 'a', slug: 'adriana-y-israel', managed_identity_id: other }];
		expect(deriveProductionRekeyFrom({ ...base, activeRows })).toBeUndefined();
		expect(
			resolveIdentityWithoutRekey({
				slug: base.slug,
				managedIdentityId: identity,
				previousSlugs: base.previousSlugs,
				invitationByManagedIdentity: null,
				provenanceInvitationId: null,
				invitationBySlug: null,
				activeInvitationByPreviousSlug: {
					id: 'a',
					slug: 'adriana-y-israel',
					managedIdentityId: other,
				},
				matchedPreviousSlug: 'adriana-y-israel',
			}),
		).toMatchObject({ ok: false, code: 'REKEY_REQUIRED' });
	});

	it('does not derive when the old row has no managed identity', () => {
		expect(
			deriveProductionRekeyFrom({
				...base,
				activeRows: [{ id: 'a', slug: 'adriana-y-israel', managed_identity_id: null }],
			}),
		).toBeUndefined();
	});

	it('does not derive when the new slug is already taken', () => {
		expect(
			deriveProductionRekeyFrom({
				...base,
				activeRows: [
					{ id: 'a', slug: 'adriana-y-israel', managed_identity_id: identity },
					{ id: 'b', slug: 'adriana-e-israel', managed_identity_id: other },
				],
			}),
		).toBeUndefined();
	});

	it('does not derive when no previous slug is active', () => {
		expect(deriveProductionRekeyFrom({ ...base, activeRows: [] })).toBeUndefined();
	});
});
