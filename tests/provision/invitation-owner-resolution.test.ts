import { describe, expect, it } from '@jest/globals';
import { resolveTargetInvitationIdentity } from '../../scripts/provision/invitation-import-engine.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const clientInvitation = { id: 'invitation-id', slug: 'romina-rios-chaparro', kind: 'client', created_by: owner, archived_at: null };

describe('managed invitation target owner resolution', () => {
	it('resolves and preserves the existing target owner without an explicit owner flag', () => {
		const resolved = resolveTargetInvitationIdentity({
			target: 'production', slug: 'romina-rios-chaparro', activeInvitations: [clientInvitation], archivedInvitations: [], ownerExists: (id) => id === owner,
		});
		expect(resolved).toMatchObject({ ownerUserId: owner, existingInvitation: clientInvitation, isNewInvitation: false });
	});

	it('accepts only a matching optional owner assertion for an existing target', () => {
		expect(() => resolveTargetInvitationIdentity({ target: 'production', slug: 'romina-rios-chaparro', explicitOwnerId: otherOwner, activeInvitations: [clientInvitation], archivedInvitations: [], ownerExists: () => true })).toThrow(/does not match/i);
	});

	it('requires an explicit valid existing owner only when creating a new Production invitation', () => {
		expect(() => resolveTargetInvitationIdentity({ target: 'production', slug: 'romina-rios-chaparro', activeInvitations: [], archivedInvitations: [], ownerExists: () => true })).toThrow(/requires an explicit/i);
	});

	it.each([
		['duplicate active slug', [clientInvitation, { ...clientInvitation, id: 'second-id' }], [], /multiple active/i],
		['archived invitation', [], [{ ...clientInvitation, archived_at: '2026-07-22T00:00:00Z' }], /archived/i],
		['non-client invitation', [{ ...clientInvitation, kind: 'demo' }], [], /not a client/i],
		['missing owner', [{ ...clientInvitation, created_by: null }], [], /missing or invalid owner/i],
		['invalid owner', [{ ...clientInvitation, created_by: 'invalid-owner' }], [], /missing or invalid owner/i],
		['unknown owner', [clientInvitation], [], /does not exist/i],
	])('rejects %s', (_caseName, activeInvitations, archivedInvitations, expected) => {
		expect(() => resolveTargetInvitationIdentity({ target: 'production', slug: 'romina-rios-chaparro', activeInvitations, archivedInvitations, ownerExists: () => false })).toThrow(expected);
	});
});
