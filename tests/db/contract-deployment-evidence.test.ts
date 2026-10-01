jest.mock('../../scripts/ops/release-readiness.ts', () => {
	const actual = jest.requireActual('../../scripts/ops/release-readiness.ts');
	return {
		...actual,
		loadLatestProductionDeployment: jest.fn(),
		loadRemoteChecks: jest.fn(),
	};
});

jest.mock('../../scripts/db/deployed-app-attestation.ts', () => ({
	readDeployedApplicationAttestation: jest.fn(),
}));

import { resolveContractDeploymentEvidence } from '../../scripts/db/contract-deployment-evidence.ts';
import { readDeployedApplicationAttestation } from '../../scripts/db/deployed-app-attestation.ts';
import {
	RemoteEvidenceError,
	loadLatestProductionDeployment,
	loadRemoteChecks,
} from '../../scripts/ops/release-readiness.ts';

const mockDeployment = loadLatestProductionDeployment as jest.MockedFunction<
	typeof loadLatestProductionDeployment
>;
const mockChecks = loadRemoteChecks as jest.MockedFunction<typeof loadRemoteChecks>;
const mockAttest = readDeployedApplicationAttestation as jest.MockedFunction<
	typeof readDeployedApplicationAttestation
>;

const DEPLOYED_SHA = 'e'.repeat(40);
const TARGET_SHA = 'f'.repeat(40);
const registry = {
	migrations: {
		'20260930180000': { phase: 'contract', revokes: ['event_memories_public_rpc_execute'] },
		'20260925182713': { phase: 'expand' },
	},
} as unknown as Parameters<typeof resolveContractDeploymentEvidence>[0]['registry'];

describe('resolveContractDeploymentEvidence', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockDeployment.mockReturnValue({ id: 42, sha: DEPLOYED_SHA });
		mockChecks.mockReturnValue([]);
		mockAttest.mockReturnValue({ sha: DEPLOYED_SHA, capabilities: ['event_memories_client'] });
	});

	it('needs no deployment evidence when no candidate is a contract migration', () => {
		expect(
			resolveContractDeploymentEvidence({
				candidateVersions: ['20260925182713'],
				registry,
				targetReleaseSha: TARGET_SHA,
				mode: 'apply',
			}),
		).toEqual({ deployedAppIdentity: null, remoteEvidenceUnavailable: null });
		expect(mockDeployment).not.toHaveBeenCalled();
	});

	it('attests the smoke-checked Production deployment against the target release', () => {
		const evidence = resolveContractDeploymentEvidence({
			candidateVersions: ['20260930180000'],
			registry,
			targetReleaseSha: TARGET_SHA,
			mode: 'preflight',
		});

		expect(mockChecks).toHaveBeenCalledWith(DEPLOYED_SHA);
		expect(mockAttest).toHaveBeenCalledWith({
			deployedSha: DEPLOYED_SHA,
			targetReleaseSha: TARGET_SHA,
			checks: [],
		});
		expect(evidence).toEqual({
			deployedAppIdentity: { sha: DEPLOYED_SHA, capabilities: ['event_memories_client'] },
			remoteEvidenceUnavailable: null,
		});
	});

	it('reports unreachable evidence as UNVERIFIED during a preflight', () => {
		mockDeployment.mockImplementation(() => {
			throw new RemoteEvidenceError('unavailable', 'GitHub is unreachable');
		});

		const evidence = resolveContractDeploymentEvidence({
			candidateVersions: ['20260930180000'],
			registry,
			targetReleaseSha: TARGET_SHA,
			mode: 'preflight',
		});

		expect(evidence.deployedAppIdentity).toBeNull();
		expect(evidence.remoteEvidenceUnavailable).toMatch(/^UNVERIFIED: /);
	});

	it('fails closed on an apply without evidence and on invalid evidence', () => {
		mockDeployment.mockImplementation(() => {
			throw new RemoteEvidenceError('unavailable', 'GitHub is unreachable');
		});
		expect(() =>
			resolveContractDeploymentEvidence({
				candidateVersions: ['20260930180000'],
				registry,
				targetReleaseSha: TARGET_SHA,
				mode: 'apply',
			}),
		).toThrow('GitHub is unreachable');

		mockDeployment.mockReturnValue({ id: 42, sha: DEPLOYED_SHA });
		mockAttest.mockImplementation(() => {
			throw new RemoteEvidenceError('invalid', 'Production deployment smoke is missing.');
		});
		expect(() =>
			resolveContractDeploymentEvidence({
				candidateVersions: ['20260930180000'],
				registry,
				targetReleaseSha: TARGET_SHA,
				mode: 'preflight',
			}),
		).toThrow('smoke is missing');
	});
});
