import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import {
	buildInvitationHostEmail,
	normalizeHostLoginAlias,
	planInvitationHostOwner,
	resolveAndEnsureInvitationHostOwner,
} from '../../scripts/provision/invitation-host-owner.ts';

jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({
	runPsql: jest.fn(),
	sqlLiteral: (value: string) => `'${value.replace(/'/g, "''")}'`,
}));

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('invitation host owner creation', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('stores the normalized login alias with the protected host role', async () => {
		jest.mocked(runPsql).mockReturnValue({ status: 0, stdout: '', stderr: '' });
		const fetchMock = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ id: owner }), { status: 200 }));

		const result = await resolveAndEnsureInvitationHostOwner({
			slug: 'new-invitation',
			hostLoginAlias: 'Alba-Quiñónez',
			targetDbUrl: 'postgresql://unused.example.test/mock',
			supabaseUrl: 'https://auth.example.test',
			serviceRoleKey: 'test-service-role',
			preferredCreateOwnerId: owner,
			dryRun: false,
		});

		expect(result.ownerUserId).toBe(owner);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('https://auth.example.test/auth/v1/admin/users');
		expect(options).toMatchObject({ method: 'POST' });
		const payload = JSON.parse(String(options?.body));
		expect(payload.app_metadata).toEqual({
			login_alias: 'alba_quinonez',
			role: 'host_client',
			provider: 'email',
			providers: ['email'],
		});
		expect(payload).not.toHaveProperty('user_metadata');
	});
});

describe('invitation host owner planning', () => {
	it('builds a deterministic technical host email from hostLoginAlias', () => {
		expect(buildInvitationHostEmail('abril_becerra')).toBe(
			'abril_becerra@clientes.celebra.invalid',
		);
		expect(buildInvitationHostEmail('alba_quinonez')).toBe(
			'alba_quinonez@clientes.celebra.invalid',
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

	it('keeps plan→apply owner identity stable only when preferredCreateOwnerId is forwarded', () => {
		const first = planInvitationHostOwner({
			slug: 'new-invitation',
			hostLoginAlias: 'new_invitation',
		});
		const second = planInvitationHostOwner({
			slug: 'new-invitation',
			hostLoginAlias: 'new_invitation',
		});
		expect(first.action).toBe('OWNER_CREATE_PLANNED');
		expect(second.action).toBe('OWNER_CREATE_PLANNED');
		expect(first.plannedOwnerUserId).not.toBe(second.plannedOwnerUserId);

		const apply = planInvitationHostOwner({
			slug: 'new-invitation',
			hostLoginAlias: 'new_invitation',
			preferredCreateOwnerId: first.plannedOwnerUserId ?? undefined,
		});
		expect(apply.plannedOwnerUserId).toBe(first.plannedOwnerUserId);
	});
});
