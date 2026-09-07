import { readStatusTargets, statusScopeJson } from '../../scripts/provision/dbs-options';
describe('dbs target scope', () => {
	it.each([
		[
			['--targets', 'preview,local', '--json'],
			['local', 'preview'],
		],
		[
			['--targets', 'local', 'preview', '--compact'],
			['local', 'preview'],
		],
		[['--targets=preview,preview'], ['preview']],
	])('normalizes %j', (args, targets) =>
		expect(readStatusTargets(args).targets).toEqual(targets),
	);
	it.each([
		['--targets'],
		['--targets='],
		['--targets', 'staging'],
		['--targets=local,invalid'],
		['--targets=local', '--targets=preview'],
	])('rejects invalid scope %j', (...args) => expect(() => readStatusTargets(args)).toThrow());
	it('preserves existing slug and options', () =>
		expect(
			readStatusTargets([
				'victoria-y-roberto',
				'--targets',
				'local,preview',
				'--json',
				'--timeout-ms',
				'900',
			]),
		).toEqual({
			args: ['victoria-y-roberto', '--json', '--timeout-ms', '900'],
			targets: ['local', 'preview'],
		}));
	it('preserves the global JSON contract', () =>
		expect(statusScopeJson({ production: 0 })).toBe(
			JSON.stringify({ production: 0 }, null, 2),
		));
	it('marks excluded counters and nested states unevaluated', () => {
		const result = JSON.parse(
			statusScopeJson(
				{
					counts: { local: 28, preview: 29, production: 0 },
					promotions: [{ environments: { production: 'match' } }],
				},
				['local', 'preview'],
			),
		);
		expect(result.excludedTargets).toEqual(['production']);
		expect(result.counts.production).toBeNull();
		expect(result.promotions[0].environments.production).toBeNull();
	});
});
