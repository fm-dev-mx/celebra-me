/**
 * Happy/sad paths for hosted managed import publish gate and mutation flags.
 * Protects current invitations and future definitions against approved-draft republish failures.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mockRunPsql = jest.fn<(...args: unknown[]) => { stdout: string; stderr?: string }>();

jest.mock('../../scripts/db/db-workflow-lib.ts', () => {
	const actual = jest.requireActual('../../scripts/db/db-workflow-lib.ts') as Record<
		string,
		unknown
	>;
	return {
		...actual,
		runPsql: (...args: unknown[]) => mockRunPsql(...args),
	};
});

describe('resolveHostedMutationFlags', () => {
	it('happy: first-time invitation plans draft upsert + publish', async () => {
		const { resolveHostedMutationFlags } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(
			resolveHostedMutationFlags({
				existingInv: null,
				existingDraft: null,
				existingPub: null,
				isInvMetadataIdentical: false,
				isDraftIdentical: false,
				isPubIdentical: false,
				isEventAndMemberIdentical: false,
			}),
		).toEqual({
			shouldUpsertInv: true,
			shouldUpsertDraft: true,
			shouldPublish: true,
			shouldUpsertEvent: true,
		});
	});

	it('happy: zero-drift republish skipped when draft and published match', async () => {
		const { resolveHostedMutationFlags } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(
			resolveHostedMutationFlags({
				existingInv: { id: '1' },
				existingDraft: { id: 'd', status: 'approved' },
				existingPub: { version: 2 },
				isInvMetadataIdentical: true,
				isDraftIdentical: true,
				isPubIdentical: true,
				isEventAndMemberIdentical: true,
			}),
		).toEqual({
			shouldUpsertInv: false,
			shouldUpsertDraft: false,
			shouldPublish: false,
			shouldUpsertEvent: false,
		});
	});

	it('sad: published diverges while draft content identical still requires publish', async () => {
		const { resolveHostedMutationFlags } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		const flags = resolveHostedMutationFlags({
			existingInv: { id: '1' },
			existingDraft: { id: 'd', status: 'approved' },
			existingPub: { version: 2 },
			isInvMetadataIdentical: true,
			isDraftIdentical: true,
			isPubIdentical: false,
			isEventAndMemberIdentical: true,
		});
		expect(flags.shouldUpsertDraft).toBe(false);
		expect(flags.shouldPublish).toBe(true);
	});

	it('happy: rekey forces invitation + event writes even when content identical', async () => {
		const { resolveHostedMutationFlags } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(
			resolveHostedMutationFlags({
				existingInv: { id: '1' },
				existingDraft: { id: 'd' },
				existingPub: { version: 1 },
				isInvMetadataIdentical: true,
				isDraftIdentical: true,
				isPubIdentical: true,
				isEventAndMemberIdentical: true,
				rekeyFrom: 'old-slug',
			}),
		).toMatchObject({
			shouldUpsertInv: true,
			shouldUpsertDraft: false,
			shouldPublish: false,
			shouldUpsertEvent: true,
		});
	});
});

describe('assertDraftRevisionUnchanged', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('happy: matching revision allows apply to proceed', async () => {
		mockRunPsql.mockReturnValueOnce({ stdout: '2026-08-06T20:00:00.000Z\n' });
		const { assertDraftRevisionUnchanged } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(() =>
			assertDraftRevisionUnchanged('postgresql://preview.invalid/db', {
				id: '11111111-1111-4111-8111-111111111111',
				updated_at: '2026-08-06T20:00:00.000Z',
			}),
		).not.toThrow();
	});

	it('happy: null draft skips the guard', async () => {
		const { assertDraftRevisionUnchanged } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(() =>
			assertDraftRevisionUnchanged('postgresql://preview.invalid/db', null),
		).not.toThrow();
		expect(mockRunPsql).not.toHaveBeenCalled();
	});

	it('sad: changed revision fails closed before writes', async () => {
		mockRunPsql.mockReturnValueOnce({ stdout: '2026-08-06T21:00:00.000Z\n' });
		const { assertDraftRevisionUnchanged } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(() =>
			assertDraftRevisionUnchanged('postgresql://preview.invalid/db', {
				id: '11111111-1111-4111-8111-111111111111',
				updated_at: '2026-08-06T20:00:00.000Z',
			}),
		).toThrow(/stale revision/i);
	});

	it('sad: missing draft row fails closed', async () => {
		mockRunPsql.mockReturnValueOnce({ stdout: '' });
		const { assertDraftRevisionUnchanged } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(() =>
			assertDraftRevisionUnchanged('postgresql://preview.invalid/db', {
				id: '11111111-1111-4111-8111-111111111111',
				updated_at: '2026-08-06T20:00:00.000Z',
			}),
		).toThrow(/stale revision/i);
	});
});

describe('prepareDraftForPublication', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('happy: resets approved draft to draft then returns latest revision', async () => {
		mockRunPsql.mockReturnValueOnce({ stdout: 'UPDATE 1\n' }).mockReturnValueOnce({
			stdout: '11111111-1111-4111-8111-111111111111|2026-08-06T20:00:00.000Z\n',
		});

		const { prepareDraftForPublication } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		const prepared = prepareDraftForPublication(
			'postgresql://preview.invalid/db',
			'22222222-2222-4222-8222-222222222222',
		);

		expect(prepared).toEqual({
			draftId: '11111111-1111-4111-8111-111111111111',
			draftUpdatedAt: '2026-08-06T20:00:00.000Z',
		});
		expect(String(mockRunPsql.mock.calls[0]?.[0])).toMatch(
			/status = 'draft'[\s\S]*invitation_project_id = '22222222-2222-4222-8222-222222222222'/,
		);
		expect(String(mockRunPsql.mock.calls[1]?.[0])).toMatch(/order by updated_at desc limit 1/);
		expect(mockRunPsql.mock.calls[0]?.[0]).not.toMatch(/publish_invitation_atomic/);
	});

	it('sad: missing draft row fails closed before publish RPC', async () => {
		mockRunPsql
			.mockReturnValueOnce({ stdout: 'UPDATE 0\n' })
			.mockReturnValueOnce({ stdout: '' });
		const { prepareDraftForPublication } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		expect(() =>
			prepareDraftForPublication(
				'postgresql://preview.invalid/db',
				'33333333-3333-4333-8333-333333333333',
			),
		).toThrow(/PUBLISH_DRAFT_MISSING/);
		expect(
			mockRunPsql.mock.calls.some((c) => String(c[0]).includes('publish_invitation_atomic')),
		).toBe(false);
	});
});

describe('managed invitation registry resolution', () => {
	it('happy: resolves canonical slug without eventType prefix', async () => {
		const { getInvitationDefinition, listInvitationDefinitions } =
			await import('../../scripts/provision/invitations/registry.ts');
		const def = getInvitationDefinition('daniela-y-martin');
		expect(def.slug).toBe('daniela-y-martin');
		expect(def.eventType).toBe('boda');
		expect(listInvitationDefinitions().map((d) => d.slug)).toEqual(
			expect.arrayContaining(['daniela-y-martin', 'romina-rios-chaparro']),
		);
	});

	it('sad: rejects eventType-prefixed slug used as registry key', async () => {
		const { getInvitationDefinition } =
			await import('../../scripts/provision/invitations/registry.ts');
		expect(() => getInvitationDefinition('boda-daniela-y-martin')).toThrow(
			/not found in registry/,
		);
		expect(() => getInvitationDefinition('boda-perla-y-carlos')).toThrow(/Available:/);
	});

	it('future invitation: new definition must expose managedIdentityId and hostLoginAlias', async () => {
		const { listInvitationDefinitions } =
			await import('../../scripts/provision/invitations/registry.ts');
		for (const def of listInvitationDefinitions()) {
			expect(def.managedIdentityId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
			expect(def.hostLoginAlias.length).toBeGreaterThan(0);
			expect(def.slug).not.toMatch(/^(boda|xv|bautizo|baby-shower)-/);
		}
	});
});

describe('stable create invitation identity', () => {
	it('uses managedIdentityId as create fallback before randomUUID', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const scanBlock = source.slice(
			source.indexOf('function scanTargetState('),
			source.indexOf('const { sql, pubQuery } = buildTargetScanSql'),
		);
		expect(scanBlock).toMatch(/stableCreateInvitationId/);
		expect(scanBlock).toMatch(/managedIdentityId → random/);
		expect(source).toMatch(/pkg\.invitation\.managedIdentityId/);
		expect(source).toMatch(/function buildTargetScanSql\(/);
		expect(source).toMatch(/json_build_object\(/);
	});
});

describe('publish path ordering contract', () => {
	it('resets draft before publish_invitation_atomic when republishing identical draft content', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const publishBlock = source.slice(
			source.indexOf('if (shouldPublish)'),
			source.indexOf('if (shouldUpsertEvent)'),
		);
		expect(publishBlock).toMatch(/prepareDraftForPublication/);
		expect(publishBlock).toMatch(/executePublicationRpcCall/);
		expect(publishBlock.indexOf('prepareDraftForPublication')).toBeLessThan(
			publishBlock.indexOf('executePublicationRpcCall'),
		);
		expect(publishBlock).not.toMatch(/randomUUID\(\)/);
	});
});
