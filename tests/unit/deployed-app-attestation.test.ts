import {
	parseDeployedApplicationCapabilities,
	readDeployedApplicationAttestation,
} from '../../scripts/db/deployed-app-attestation.ts';

const deployedSha = 'a'.repeat(40);
const targetSha = 'b'.repeat(40);
const smoke = [
	{
		name: 'Vercel - celebra-me production smoke',
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

	it('requires a prior SHA and a trusted production smoke', () => {
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
				checks: smoke,
				runner,
			}),
		).toEqual({
			sha: deployedSha,
			capabilities: ['replacement_path'],
		});
		expect(() =>
			readDeployedApplicationAttestation({
				deployedSha: targetSha,
				targetReleaseSha: targetSha,
				checks: smoke,
				runner,
			}),
		).toThrow(/self-authorize/);
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
				targetReleaseSha: targetSha,
				checks: smoke,
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
