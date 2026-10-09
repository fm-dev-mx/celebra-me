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

describe('content-only asset mutation contract', () => {
	it('fails closed at plan time before apply when content-only plans asset writes', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const scanIdx = source.indexOf('await scanAssetStatus(');
		const assertIdx = source.indexOf('assertContentOnlyAllowsNoAssetMutations({', scanIdx);
		const applyIdx = source.indexOf('if (assetsToUpload.length > 0)', assertIdx);
		expect(scanIdx).toBeGreaterThan(0);
		expect(assertIdx).toBeGreaterThan(scanIdx);
		expect(applyIdx).toBeGreaterThan(assertIdx);
	});

	it('skips packaging asset scans under content-only (preserve hosted binaries)', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const emptyScanContract = "updateScope === 'content-only' ? [] : pkg.assets";
		expect(source.split(emptyScanContract).length - 1).toBeGreaterThanOrEqual(2);
		const firstScan = source.indexOf('await scanAssetStatus(');
		const firstArgBlock = source.slice(firstScan, firstScan + 280);
		expect(firstArgBlock).toContain(emptyScanContract);
		const finalScan = source.indexOf('const finalAssets = await scanAssetStatus(');
		expect(finalScan).toBeGreaterThan(firstScan);
		expect(source.slice(finalScan, finalScan + 280)).toContain(emptyScanContract);
	});
});

describe('publish path atomicity contract', () => {
	it('publishes draft upsert, draft reset and the RPC in one transaction', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
			'utf8',
		);
		const publishBlock = source.slice(
			source.indexOf('if (shouldPublish)'),
			source.indexOf('if (shouldUpsertEvent)'),
		);
		expect(publishBlock).toMatch(/publishDraftAtomically\(params, shouldUpsertDraft\)/);
		expect(publishBlock).not.toMatch(/randomUUID\(\)/);
		const atomic = source.slice(
			source.indexOf('export function publishDraftAtomically'),
			source.indexOf('function buildPublicationRpcSql'),
		);
		// One psql script: begin → (upsert) → reset with \gset → RPC bound to that revision → commit.
		expect(atomic.indexOf("'begin;'")).toBeLessThan(atomic.indexOf('upsertDraftSql('));
		expect(atomic.indexOf('upsertDraftSql(')).toBeLessThan(atomic.indexOf('\\\\gset draft_'));
		expect(atomic.indexOf('\\\\gset draft_')).toBeLessThan(atomic.indexOf('rpcSql,'));
		expect(atomic.indexOf('rpcSql,')).toBeLessThan(atomic.indexOf("'commit;'"));
		expect(atomic).toMatch(/runPsql\(script, targetDbUrl/);
		expect(atomic).toMatch(/":'draft_id'", ":'draft_updated_at'"/);
	});

	it('binds the RPC to the draft revision produced inside the transaction', async () => {
		mockRunPsql.mockReset();
		mockRunPsql.mockImplementation((sql: unknown) => {
			const text = String(sql);
			if (text.includes('from public.invitations where id'))
				return {
					stdout: JSON.stringify({
						id: 'inv',
						slug: 'demo',
						title: 'Demo',
						event_type: 'xv',
						status: 'published',
						base_demo_id: 'demo-xv',
						theme_id: 'jewelry-box',
						kind: 'managed',
						snapshot: {},
						archived_at: null,
					}),
				};
			if (text.includes('from public.published_invitation_content')) return { stdout: '' };
			return { stdout: '{"publish_invitation_atomic": {"ok": true}}' };
		});
		const { publishDraftAtomically } =
			await import('../../scripts/provision/invitation-import-engine.ts');
		publishDraftAtomically(
			{
				targetDbUrl: 'postgresql://preview',
				targetEnvironment: 'preview',
				targetInvitationId: '00000000-0000-4000-8000-000000000001',
				ownerUserId: 'owner',
				slug: 'demo',
				eventType: 'xv',
				pkg: { sourceSlug: 'demo' } as never,
				targetSnapshot: {},
				targetDraftContent: { hero: { title: 'Demo' } },
				targetPublishedContent: { hero: { title: 'Demo' } },
				existingInv: { id: 'inv' },
				existingDraft: null,
				existingPub: null,
				shouldUpsertInv: false,
				assetsForDbUpsert: [],
				shouldUpsertDraft: true,
				shouldPublish: true,
				shouldUpsertEvent: false,
				assetRefs: {} as never,
				operationId: 'op',
			},
			true,
		);
		const script = String(mockRunPsql.mock.calls.at(-1)?.[0]);
		expect(script.startsWith('begin;')).toBe(true);
		expect(script.trimEnd().endsWith('commit;')).toBe(true);
		expect(script).toContain('insert into public.invitation_content_drafts');
		expect(script).toContain('returning id, updated_at::text as updated_at \\gset draft_');
		expect(script).toContain("p_draft_id => :'draft_id'::uuid");
		expect(script).toContain("p_expected_draft_updated_at => :'draft_updated_at'::timestamptz");
		expect(script.indexOf('\\gset draft_')).toBeLessThan(
			script.indexOf('publish_invitation_atomic('),
		);
	});
});
