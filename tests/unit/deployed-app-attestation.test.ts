import {
	parseDeployedApplicationCapabilities,
	readDeployedApplicationAttestation,
} from '../../scripts/db/deployed-app-attestation.ts';

const deployedSha = 'a'.repeat(40);
const targetSha = 'b'.repeat(40);
const checks = [
	{
		name: 'Vercel - celebra-me production smoke',
		sha: deployedSha,
		state: 'success',
		trusted: true,
	},
	{
		name: 'Application / static',
		sha: deployedSha,
		state: 'success',
		trusted: true,
	},
];

describe('deployed application attestation', () => {
	it('parses a versioned, unique capability manifest', () => {
		expect(
			parseDeployedApplicationCapabilities(
				JSON.stringify({
					version: 1,
					capabilities: ['replacement_path', 'another_path'],
				}),
			),
		).toEqual(['another_path', 'replacement_path']);
	});

	it('rejects malformed or duplicate capabilities', () => {
		expect(() =>
			parseDeployedApplicationCapabilities('{"version":1,"capabilities":["x","x"]}'),
		).toThrow();
		expect(() =>
			parseDeployedApplicationCapabilities('{"version":2,"capabilities":[]}'),
		).toThrow();
		expect(() =>
			parseDeployedApplicationCapabilities('{"version":1,"capabilities":[null]}'),
		).toThrow();
		expect(() =>
			parseDeployedApplicationCapabilities('{"version":1,"capabilities":[123]}'),
		).toThrow();
	});

	it('accepts an exact deployed target SHA only with trusted smoke and static evidence', () => {
		const runner = (command: string, args: string[]): string => {
			if (command === 'git' && args[0] === 'show') {
				return JSON.stringify({ version: 1, capabilities: ['replacement_path'] });
			}
			return '';
		};
		expect(
			readDeployedApplicationAttestation({
				deployedSha,
				targetReleaseSha: targetSha,
				checks,
				runner,
			}),
		).toEqual({
			sha: deployedSha,
			capabilities: ['replacement_path'],
		});
		expect(
			readDeployedApplicationAttestation({
				deployedSha,
				targetReleaseSha: deployedSha,
				checks,
				runner,
			}),
		).toEqual({ sha: deployedSha, capabilities: ['replacement_path'] });
		expect(() =>
			readDeployedApplicationAttestation({
				deployedSha,
				targetReleaseSha: targetSha,
				checks: [],
				runner,
			}),
		).toThrow(/smoke/);
		expect(() =>
			readDeployedApplicationAttestation({
				deployedSha,
				targetReleaseSha: deployedSha,
				checks: checks.filter((check) => check.name !== 'Application / static'),
				runner,
			}),
		).toThrow(/Static capability evidence/);
		expect(() =>
			readDeployedApplicationAttestation({
				deployedSha,
				targetReleaseSha: targetSha,
				checks,
				runner: (command: string, args: string[]): string => {
					if (command === 'git' && args[0] === 'show') {
						throw new Error('fatal: path does not exist');
					}
					return '';
				},
			}),
		).toThrow(/missing from/);
	});
});
