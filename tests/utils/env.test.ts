import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getEnv, resetEnvCacheForTests } from '@/utils/env';

describe('getEnv', () => {
	const originalCwd = process.cwd();
	const originalNodeEnv = process.env.NODE_ENV;
	const tempRoot = join(tmpdir(), `celebra-env-test-${Date.now()}`);

	beforeAll(() => {
		mkdirSync(tempRoot, { recursive: true });
	});

	afterAll(() => {
		process.chdir(originalCwd);
		process.env.NODE_ENV = originalNodeEnv;
		rmSync(tempRoot, { recursive: true, force: true });
	});

	beforeEach(() => {
		resetEnvCacheForTests();
		delete process.env.RSVP_ADMIN_USER;
		delete process.env.RSVP_ADMIN_PASSWORD;
	});

	it('prefers process.env over files', () => {
		process.env.NODE_ENV = 'development';
		process.env.RSVP_ADMIN_USER = 'from-process';
		process.chdir(tempRoot);
		writeFileSync(join(tempRoot, '.env.local'), 'RSVP_ADMIN_USER=from-file\n', 'utf8');

		expect(getEnv('RSVP_ADMIN_USER')).toBe('from-process');
	});

	it('loads value from .env.local when process.env is missing', () => {
		process.env.NODE_ENV = 'development';
		process.chdir(tempRoot);
		writeFileSync(join(tempRoot, '.env.local'), 'RSVP_ADMIN_PASSWORD=from-local\n', 'utf8');

		expect(getEnv('RSVP_ADMIN_PASSWORD')).toBe('from-local');
	});

	it('does not read files in test mode', () => {
		process.env.NODE_ENV = 'test';
		process.chdir(tempRoot);
		writeFileSync(join(tempRoot, '.env.local'), 'RSVP_ADMIN_USER=from-file\n', 'utf8');

		expect(getEnv('RSVP_ADMIN_USER')).toBe('');
	});
});
