import { describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { resolveLocalEnv } from '../../scripts/provision/local-provision-env.ts';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('node:fs', () => {
	const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
	return { ...actual, existsSync: jest.fn((path: unknown) => typeof path === 'string' && path.includes('config.toml')), readFileSync: jest.fn((path: unknown, encoding?: unknown) => typeof path === 'string' && path.includes('config.toml') ? 'project_id = "celebra-me-rsvp"\n[db]\nport = 54322' : actual.readFileSync(path as never, encoding as never)) };
});

describe('persistent-local invitation application safety', () => {
	it('accepts only the persistent-local Supabase status', () => {
		const mockExec = (jest.requireMock('node:child_process') as { execFileSync: Mock }).execFileSync;
		mockExec.mockReturnValue(JSON.stringify({ API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres:***@127.0.0.1:54322/postgres', SERVICE_ROLE_KEY: 'test-key' }));
		expect(resolveLocalEnv('/mock/root').dbUrl).toContain('54322');
	});

	it('rejects a hosted database as a Local target', () => {
		const mockExec = (jest.requireMock('node:child_process') as { execFileSync: Mock }).execFileSync;
		mockExec.mockReturnValue(JSON.stringify({ API_URL: 'https://example.supabase.co', DB_URL: 'postgresql://postgres:***@db.example.supabase.co:5432/postgres', SERVICE_ROLE_KEY: 'test-key' }));
		expect(() => resolveLocalEnv('/mock/root')).toThrow(/local target verification failed/i);
	});
});
