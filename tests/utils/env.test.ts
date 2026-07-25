import { getEnv } from '@/lib/server/env';

describe('getEnv', () => {
	const key = 'CELEBRA_TEST_ENV_VALUE';
	const originalValue = process.env[key];

	beforeEach(() => {
		delete process.env[key];
	});

	afterAll(() => {
		if (originalValue === undefined) {
			delete process.env[key];
			return;
		}
		process.env[key] = originalValue;
	});

	it('returns the value from process.env', () => {
		process.env[key] = 'from-process';
		expect(getEnv(key)).toBe('from-process');
	});

	it('returns an empty value when process.env is missing', () => {
		expect(getEnv(key)).toBe('');
	});
});
