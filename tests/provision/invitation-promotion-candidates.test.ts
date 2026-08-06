import { describe, expect, it } from '@jest/globals';
import {
	discoverInvitationPromotionCandidates,
	type InvitationPromotionCandidate,
} from '../../scripts/provision/invitation-promotion-candidates.ts';
import type { PerInvitationTargetStatus } from '../../scripts/provision/dbs-status.ts';

function productionStatus(
	status: PerInvitationTargetStatus['status'],
	detail = '',
): PerInvitationTargetStatus {
	return {
		environment: 'production',
		status,
		activeMatchCount: status === 'MATCH_CANONICAL' ? 1 : 0,
		resolvedId: status === 'NOT_PRESENT' ? null : 'inv-1',
		resolvedSlug: 'demo',
		provenanceDefinitionSlug: 'demo',
		provenancePackageHash: 'pkg',
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		assetCount: 0,
		detail,
	};
}

function packageInput(slug = 'demo') {
	return {
		packageData: {
			packageHash: 'pkghash',
			sourceHash: 'srchash',
			metadataHash: 'metahash',
			projectionHash: 'projhash',
			assetManifestHash: 'assethash',
			invitation: { slug, eventType: 'boda', title: 'Demo' },
		},
		source: 'definition' as const,
	};
}

const definition = {
	slug: 'demo',
	title: 'Demo',
	eventType: 'boda',
	createdAt: '2026-08-01T00:00:00.000Z',
	lifecycle: 'in_progress' as const,
	deliveryScope: 'content-and-assets' as const,
};

async function discover(overrides: {
	production: PerInvitationTargetStatus;
	approval?: unknown;
	approvalError?: Error;
	packageError?: Error;
}): Promise<InvitationPromotionCandidate> {
	const summary = await discoverInvitationPromotionCandidates({
		definitions: [definition],
		resolvePackage: async () => {
			if (overrides.packageError) throw overrides.packageError;
			return packageInput() as never;
		},
		verifyApproval: () => {
			if (overrides.approvalError) throw overrides.approvalError;
			return overrides.approval as never;
		},
		evaluateProduction: () => overrides.production,
	});
	expect(summary.candidates).toHaveLength(1);
	return summary.candidates[0]!;
}

describe('invitation promotion candidate discovery', () => {
	it('marks Preview-approved behind/absent Production as ready and selectable', async () => {
		const readyAbsent = await discover({
			production: productionStatus('NOT_PRESENT'),
			approval: { approvalState: 'APPROVED', approvedAt: '2026-08-01T00:00:00.000Z' },
		});
		expect(readyAbsent.disposition).toBe('ready');
		expect(readyAbsent.selectable).toBe(true);

		const readyBehind = await discover({
			production: productionStatus('BEHIND_CANONICAL'),
			approval: { approvalState: 'APPROVED' },
		});
		expect(readyBehind.disposition).toBe('ready');
		expect(readyBehind.selectable).toBe(true);
	});

	it('marks MATCH_CANONICAL as in-sync and not selectable', async () => {
		const candidate = await discover({
			production: productionStatus('MATCH_CANONICAL'),
			approval: { approvalState: 'APPROVED' },
		});
		expect(candidate.disposition).toBe('in-sync');
		expect(candidate.selectable).toBe(false);
	});

	it('blocks missing or expired Preview approval with actionable remediation', async () => {
		const missing = await discover({
			production: productionStatus('NOT_PRESENT'),
			approvalError: new Error('MISSING_PREVIEW_APPROVAL'),
		});
		expect(missing.disposition).toBe('attention');
		expect(missing.selectable).toBe(false);
		expect(missing.reason).toContain('MISSING_PREVIEW_APPROVAL');
		expect(missing.remediation.join('\n')).toContain(
			'pnpm invitation:update -- --slug demo --targets preview',
		);
		expect(missing.remediation.join('\n')).toContain('--package-hash');
		expect(missing.remediation.at(-1)).toContain('pnpm invitation:promote');
	});

	it('surfaces DIVERGED and IDENTITY_CONFLICT as attention with remediation', async () => {
		for (const status of ['DIVERGED', 'IDENTITY_CONFLICT'] as const) {
			const candidate = await discover({
				production: productionStatus(status, `${status} detail`),
				approval: { approvalState: 'APPROVED' },
			});
			expect(candidate.disposition).toBe('attention');
			expect(candidate.selectable).toBe(false);
			expect(candidate.reason).toMatch(new RegExp(status));
			expect(candidate.remediation.length).toBeGreaterThan(0);
			expect(candidate.remediation.join('\n')).toContain('demo');
		}
	});

	it('treats unverified Production probes as attention with credential remediation', async () => {
		const candidate = await discover({
			production: productionStatus('UNVERIFIED', 'credentials unavailable'),
			approval: { approvalState: 'APPROVED' },
		});
		expect(candidate.disposition).toBe('attention');
		expect(candidate.selectable).toBe(false);
		expect(candidate.remediation.join('\n')).toMatch(/PROD_DB_URL|credenciales/i);
	});

	it('does not use lifecycle as a selection authority', async () => {
		const summary = await discoverInvitationPromotionCandidates({
			definitions: [{ ...definition, lifecycle: 'published' }],
			resolvePackage: async () => packageInput() as never,
			verifyApproval: () => ({ approvalState: 'APPROVED' }) as never,
			evaluateProduction: () => productionStatus('NOT_PRESENT'),
		});
		expect(summary.candidates[0]?.selectable).toBe(true);
		expect(summary.candidates[0]?.lifecycle).toBe('published');
	});
});
