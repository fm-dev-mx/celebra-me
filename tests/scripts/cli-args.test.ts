import { flagValue, parseEnvironmentList } from '../../scripts/lib/cli-args.ts';

describe('flagValue', () => {
	it('reads the value that follows a flag', () => {
		expect(flagValue(['--slug', 'renata', '--apply'], '--slug')).toBe('renata');
		expect(flagValue(['--apply'], '--slug')).toBeUndefined();
	});
});

describe('parseEnvironmentList', () => {
	it('returns known targets once each in canonical order', () => {
		expect(parseEnvironmentList('production,local')).toEqual(['local', 'production']);
		expect(parseEnvironmentList('preview preview , local')).toEqual(['local', 'preview']);
	});

	it('returns an empty list when the input has no targets', () => {
		expect(parseEnvironmentList(' , ')).toEqual([]);
	});

	it('rejects an unknown target', () => {
		expect(() => parseEnvironmentList('local,staging')).toThrow('Unknown target "staging"');
	});
});
