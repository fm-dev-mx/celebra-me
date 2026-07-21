/**
 * Unit & Integration tests for scripts/provision/apply-local-invitation.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { parseArgs } from '../../scripts/provision/apply-local-invitation-cli.ts';
import { resolveLocalEnv, processSourcePhotos } from '../../scripts/provision/apply-local-invitation.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

jest.mock('node:child_process', () => ({
	execFileSync: jest.fn(),
}));

jest.mock('node:fs', () => {
	const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
	return {
		...actual,
		existsSync: jest.fn().mockImplementation((p: any) => {
			if (typeof p === 'string' && (p.includes('.env') || p.includes('.secrets') || p.includes('.tmp'))) {
				return false;
			}
			return actual.existsSync(p);
		}),
		readFileSync: jest.fn().mockImplementation((p: any, enc: any) => {
			if (typeof p === 'string' && p.includes('config.toml')) {
				return 'project_id = "celebra-me-rsvp"\n[db]\nport = 54322';
			}
			return actual.readFileSync(p, enc);
		}),
		statSync: jest.fn().mockImplementation((p: any) => actual.statSync(p)),
	} as typeof import('node:fs');
});

describe('apply-local-invitation-cli parseArgs', () => {
	it('parses valid CLI arguments correctly', () => {
		const result = parseArgs(['--slug', 'romina-rios-chaparro', '--source-dir', '/tmp/photos']);
		expect(result.slug).toBe('romina-rios-chaparro');
		expect(result.sourceDir).toBe('/tmp/photos');
		expect(result.dryRun).toBe(true);
		expect(result.isApply).toBe(false);
	});

	it('parses --apply flag correctly', () => {
		const result = parseArgs(['--slug', 'romina-rios-chaparro', '--source-dir', '/tmp/photos', '--apply']);
		expect(result.slug).toBe('romina-rios-chaparro');
		expect(result.isApply).toBe(true);
	});
});

describe('apply-local-invitation target verification', () => {
	it('resolves local environment when Supabase status returns persistent-local DB', () => {
		const mockExec = (jest.requireMock('node:child_process') as { execFileSync: Mock }).execFileSync;
		mockExec.mockReturnValue(
			JSON.stringify({
				API_URL: 'http://127.0.0.1:54321',
				DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
				SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.fake-key',
			}),
		);

		const { existsSync: mockExists } = jest.requireMock('node:fs') as { existsSync: Mock };
		mockExists.mockImplementation((p: any) => {
			if (typeof p === 'string' && p.includes('config.toml')) return true;
			return false;
		});

		const env = resolveLocalEnv('/mock/root');
		expect(env.apiUrl).toBe('http://127.0.0.1:54321');
		expect(env.dbUrl).toContain('54322');
	});

	it('rejects remote DB target classification', () => {
		const mockExec = (jest.requireMock('node:child_process') as { execFileSync: Mock }).execFileSync;
		mockExec.mockReturnValue(
			JSON.stringify({
				API_URL: 'https://iwipdvisoyerfdytuhwi.supabase.co',
				DB_URL: 'postgresql://postgres:pass@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres',
				SERVICE_ROLE_KEY: 'key',
			}),
		);

		expect(() => resolveLocalEnv('/mock/root')).toThrow(/local target verification failed/i);
	});
});

describe('processSourcePhotos validation', () => {
	it('throws if photo source directory does not exist', async () => {
		const def = getInvitationDefinition('romina-rios-chaparro');
		const { existsSync: mockExists } = jest.requireMock('node:fs') as { existsSync: Mock };
		mockExists.mockReturnValue(false);

		await expect(processSourcePhotos(def, '/nonexistent/path')).rejects.toThrow(
			/directory does not exist/i,
		);
	});
});
