import { describe, expect, it } from '@jest/globals';
import {
	buildInvitationHostEmail,
	normalizeHostLoginAlias,
	planInvitationHostOwner,
} from '../../scripts/provision/invitation-host-owner.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('invitation host owner planning', () => {
	it('builds a deterministic technical host email from hostLoginAlias', () => {
		expect(buildInvitationHostEmail('abril_becerra')).toBe(
			'abril_becerra@clientes.celebra.invalid',
		);
		expect(buildInvitationHostEmail('alba_quinones')).toBe(
			'alba_quinones@clientes.celebra.invalid',
		);
	});

	it('normalizes accents and separators in hostLoginAlias', () => {
		expect(normalizeHostLoginAlias('Alba-Quiñónez')).toBe('alba_quinonez');
	});

	it('preserves an existing invitation owner', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			existingOwnerUserId: owner,
		});
		expect(plan).toMatchObject({
			action: 'OWNER_PRESERVE',
			ownerUserId: owner,
			plannedOwnerUserId: owner,
			hostLoginAlias: 'abril_becerra',
			hostEmail: 'abril_becerra@clientes.celebra.invalid',
		});
	});

	it('conflicts when explicit owner does not match existing owner', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			existingOwnerUserId: owner,
			explicitOwnerId: other,
		});
		expect(plan.action).toBe('OWNER_CONFLICT');
	});

	it('uses an explicit owner for new invitations when provided', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			explicitOwnerId: owner,
			explicitOwnerExists: true,
		});
		expect(plan).toMatchObject({
			action: 'OWNER_EXPLICIT',
			ownerUserId: owner,
			plannedOwnerUserId: owner,
		});
	});

	it('reuses an existing Auth host for the canonical email', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			existingHostUserId: owner,
		});
		expect(plan).toMatchObject({
			action: 'OWNER_REUSE',
			ownerUserId: owner,
			hostEmail: 'abril_becerra@clientes.celebra.invalid',
		});
	});

	it('conflicts when the canonical host already owns another invitation', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			existingHostUserId: owner,
			hostOwnsOtherSlug: 'romina-rios-chaparro',
		});
		expect(plan.action).toBe('OWNER_CONFLICT');
		expect(plan.conflictSlug).toBe('romina-rios-chaparro');
	});

	it('plans a create with a stable preferred owner id', () => {
		const plan = planInvitationHostOwner({
			slug: 'abril-michelle-becerra-rea',
			hostLoginAlias: 'abril_becerra',
			preferredCreateOwnerId: owner,
		});
		expect(plan).toMatchObject({
			action: 'OWNER_CREATE_PLANNED',
			plannedOwnerUserId: owner,
			ownerUserId: null,
		});
	});
});
