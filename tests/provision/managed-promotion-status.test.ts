/**
 * managed-promotion-status.test.ts — grouped reads, output safety, compact isolation
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InvitationDefinition } from '../../scripts/provision/invitations/invitation-definition.ts';

const mockResolveDbUrlForEnv = jest.fn();
const mockReadGrouped = jest.fn();
const mockBuildCanonical = jest.fn();
const mockClassify = jest.fn();

jest.mock('../../scripts/provision/dbs-status.ts', () => ({
	getOrCreateStatusProbeSession: jest.fn(),
	resolveDbUrlForEnv: (...args: unknown[]) => mockResolveDbUrlForEnv(...args),
}));

jest.mock('../../scripts/status-core/index.ts', () => {
	const actual = jest.requireActual('../../scripts/status-core/index.ts') as Record<
		string,
		unknown
	>;
	return {
		...actual,
		readGroupedPromotionalEvidence: (...args: unknown[]) => mockReadGrouped(...args),
	};
});

jest.mock('../../scripts/provision/promotional-fingerprint.ts', () => {
	const actual = jest.requireActual(
		'../../scripts/provision/promotional-fingerprint.ts',
	) as Record<string, unknown>;
	return {
		...actual,
		buildCanonicalPromotionalFingerprint: (...args: unknown[]) => mockBuildCanonical(...args),
		classifyLiveInvitation: (...args: unknown[]) => mockClassify(...args),
	};
});

import {
	evaluateManagedPromotionStatus,
	formatSlugPromotionLine,
} from '../../scripts/provision/managed-promotion-status.ts';
import { formatPromotionsSection } from '../../scripts/provision/canonical-status-format.ts';
import { presentPromotionRow } from '../../src/lib/status/presentation.ts';
import { buildGroupedPromotionalEvidenceSql } from '../../scripts/status-core/promotional-evidence.ts';

function definition(slug: string): InvitationDefinition {
	return {
		slug,
		managedIdentityId: '00000000-0000-4000-8000-000000000001',
		createdAt: '2026-01-01T00:00:00.000Z',
		lifecycle: 'published',
		deliveryScope: 'content-and-assets',
		eventType: 'boda',
		title: 'Título',
		clientName: 'Cliente',
		hostLoginAlias: `${slug}-host`,
		baseDemoId: 'demo-boda-jewelry-box-wedding',
		themeId: 'jewelry-box-wedding',
		visualProfileId: slug,
		eventTiming: {
			localDateTime: '2026-01-01T00:00',
			timeZone: 'America/Mexico_City',
			startsAtUtc: '2026-01-01T06:00:00.000Z',
		},
		assets: [
			{
				key: 'hero',
				relativePath: 'hero.jpg',
				displayName: 'Hero',
				alt: 'Hero',
			},
		],
		buildPublishedContent: () => ({ title: 'ok' }),
	};
}

describe('managed promotion status', () => {
	beforeEach(() => {
		mockResolveDbUrlForEnv.mockReset();
		mockReadGrouped.mockReset();
		mockBuildCanonical.mockReset();
		mockClassify.mockReset();
		mockResolveDbUrlForEnv.mockImplementation((...args: unknown[]) => ({
			dbUrl: `postgres://user:secret@${String(args[0])}.example.internal/db`,
		}));
		mockBuildCanonical.mockImplementation(async () => ({
			ok: true,
			fingerprint: 'canonical-fingerprint',
			assetKeys: ['hero'],
		}));
		mockClassify.mockImplementation((...args: unknown[]) => {
			const input = args[0] as { rows: unknown[] };
			return input.rows.length === 0 ? 'absent' : 'match';
		});
	});

	it('issues exactly one grouped SQL read per environment for N invitations', async () => {
		const session = {
			probeConnectivity: jest.fn(async () => true),
			psql: jest.fn(),
		};
		mockReadGrouped.mockImplementation(async (...args: unknown[]) => ({
			ok: true,
			rows: String(args[1]).includes('local')
				? [{ slug: 'alpha' }, { slug: 'beta' }]
				: [],
		}));

		const result = await evaluateManagedPromotionStatus({
			session: session as never,
			definitions: [definition('alpha'), definition('beta')],
		});

		expect(session.probeConnectivity).toHaveBeenCalledTimes(3);
		expect(mockReadGrouped).toHaveBeenCalledTimes(3);
		expect(session.psql).not.toHaveBeenCalled();
		for (const slugs of mockReadGrouped.mock.calls.map((call) => call[2])) {
			expect(slugs).toEqual(['alpha', 'beta']);
		}
		expect(result.promotions.map((row) => row.slug)).toEqual(['alpha', 'beta']);
		expect(result.promotions.every((row) => row.action === 'PROMOTE_PREVIEW')).toBe(true);
	});

	it('omits synchronized invitations from output', async () => {
		const session = {
			probeConnectivity: jest.fn(async () => true),
			psql: jest.fn(),
		};
		mockReadGrouped.mockImplementation(async () => ({
			ok: true,
			rows: [{ slug: 'alpha' }],
		}));
		mockClassify.mockImplementation(() => 'match');

		const result = await evaluateManagedPromotionStatus({
			session: session as never,
			definitions: [definition('alpha')],
		});
		expect(result.promotions).toEqual([]);
		expect(result.inSyncSlugs).toEqual(['alpha']);
		expect(formatPromotionsSection(result.promotions)).toBe(
			'PUBLICATION\nAttention: 0 (in sync or none registered)\n',
		);
	});

	it('prints only safe promotion fields', () => {
		const text = formatPromotionsSection([
			presentPromotionRow({
				slug: 'invitacion-y',
				title: 'Invitación Y',
				eventType: 'boda',
				action: 'BLOCKED',
				reasonCode: 'MANAGED_DIVERGENCE',
				environments: { local: 'match', preview: 'diverged', production: 'behind' },
				envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
			}),
			presentPromotionRow({
				slug: 'boda-perla-y-carlos',
				title: 'Perla y Carlos',
				eventType: 'boda',
				action: 'PROMOTE_PREVIEW',
				reasonCode: 'PREVIEW_BEHIND_CANONICAL',
				environments: { local: 'match', preview: 'behind', production: 'behind' },
				envEvidence: { local: 'LIVE', preview: 'LIVE', production: 'LIVE' },
			}),
		]);
		expect(text).toContain('PROMOTE_PREVIEW');
		expect(text).toContain('BLOCKED');
		expect(text).not.toContain('PROMOTIONS');
		expect(text).not.toMatch(/CURRENT\n/);
		expect(text).not.toMatch(/postgres:\/\//);
		expect(text).not.toMatch(/service_role/i);
		expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
		expect(text).not.toMatch(/\b[0-9a-f]{64}\b/);
		expect(text).not.toContain('Cliente');
		expect(text).not.toContain('secret');
		expect(formatSlugPromotionLine(undefined)).toBe('Publication: (none)');
	});
});

describe('grouped promotional SQL', () => {
	it('selects one grouped query for all slugs without PII columns', () => {
		const sql = buildGroupedPromotionalEvidenceSql(['alpha', 'beta']);
		expect(sql).toContain('json_agg');
		expect(sql).toContain("'alpha'");
		expect(sql).toContain("'beta'");
		expect(sql).not.toContain('client_name');
		expect(sql).not.toContain('client_email');
		expect(sql).not.toContain('secure_url');
		expect(sql).not.toContain('package_hash');
	});

	it('invokes psql once per grouped read', async () => {
		const { readGroupedPromotionalEvidence } = await import(
			'../../scripts/status-core/promotional-evidence.ts'
		);
		const session = {
			psql: jest.fn(async () => ({ status: 0, stdout: '[]', stderr: '' })),
		};
		await readGroupedPromotionalEvidence(session as never, 'postgres://local', ['alpha', 'beta']);
		expect(session.psql).toHaveBeenCalledTimes(1);
		await readGroupedPromotionalEvidence(session as never, 'postgres://local', []);
		expect(session.psql).toHaveBeenCalledTimes(1);
	});
});

describe('promotion path isolation', () => {
	it('does not reach fetch, Vercel, or loadPersistedAssets', () => {
		const files = [
			'scripts/provision/promotional-fingerprint.ts',
			'scripts/provision/promotion-decision.ts',
			'scripts/provision/managed-promotion-status.ts',
			'scripts/provision/canonical-status.ts',
			'scripts/provision/canonical-status-format.ts',
			'scripts/status-core/promotional-evidence.ts',
			'scripts/provision/dbs-cli.ts',
			'src/lib/status/decision.ts',
			'src/lib/status/presentation.ts',
		];
		for (const file of files) {
			const source = readFileSync(resolve(process.cwd(), file), 'utf8');
			expect(source).not.toMatch(/\bfetch\s*\(/);
			expect(source).not.toMatch(/vercel/i);
			expect(source).not.toMatch(/loadPersistedAssets/);
		}
		const cli = readFileSync(resolve(process.cwd(), 'scripts/provision/dbs-cli.ts'), 'utf8');
		expect(cli).not.toMatch(/from '\.\/managed-promotion-status\.ts'/);
		expect(cli).not.toMatch(/from '\.\/canonical-status\.ts'/);
		const compactFn = cli.slice(cli.indexOf('async function formatCompactView'));
		expect(compactFn).not.toMatch(/evaluateManagedPromotionStatus/);
		expect(compactFn).not.toMatch(/buildCanonicalStatusView/);
	});

	it('does not import promotion status from compact managed-status', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/managed-status.ts'),
			'utf8',
		);
		expect(source).not.toMatch(/managed-promotion-status/);
		expect(source).not.toMatch(/evaluateManagedPromotionStatus/);
		expect(source).not.toMatch(/PROMOTIONS/);
	});
});
