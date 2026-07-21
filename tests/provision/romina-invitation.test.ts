/**
 * Tests for scripts/provision/romina-invitation.ts
 *
 * Covers: static contracts, CLI argument validation, behavioral orchestration
 * with mocked Supabase, Storage, and filesystem boundaries.
 *
 * The provisioner exports all internal functions. A dedicated CLI entrypoint
 * (romina-invitation-cli.ts) calls main() unconditionally. Tests import the
 * module without triggering the entry point.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { Mock } from 'jest-mock';

// ── Module-level mocks ───────────────────────────────────────────────

globalThis.fetch = jest.fn<typeof fetch>();

jest.mock('node:fs', () => {
	const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
	return {
		...actual,
		existsSync: jest.fn().mockImplementation((p: any) => actual.existsSync(p)),
		readFileSync: jest
			.fn()
			.mockImplementation((p: any, enc: any) => actual.readFileSync(p, enc)),
		statSync: jest.fn().mockImplementation((p: any) => actual.statSync(p)),
	} as typeof import('node:fs');
});

jest.mock('@supabase/supabase-js', () => ({
	createClient: jest.fn(() => ({})),
}));

jest.mock('../../src/lib/intake/services/asset-policy', () => ({
	normalizeInvitationImage: jest.fn(),
}));

// ── Constants ────────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();
const SCRIPT_PATH = resolve(PROJECT_ROOT, 'scripts/provision/romina-invitation.ts');
const CLI_PATH = resolve(PROJECT_ROOT, 'scripts/provision/romina-invitation-cli.ts');
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_SUPABASE_URL = 'https://ineitkdkyrxqyressllp.supabase.co';

// ── Helpers ──────────────────────────────────────────────────────────

async function importProvisioner(): Promise<
	typeof import('../../scripts/provision/romina-invitation')
> {
	return import('../../scripts/provision/romina-invitation');
}

function setValidEnv(): void {
	process.env.SUPABASE_URL = VALID_SUPABASE_URL;
	process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.fake-service-role-key';
}

function clearEnv(): void {
	delete process.env.SUPABASE_URL;
	delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

interface MockNormalized {
	key: 'hero';
	bytes: Uint8Array;
	fileName: string;
	displayName: string;
	alt: string;
	width: number;
	height: number;
	fileSize: number;
	mimeType: 'image/webp';
	originalMimeType: 'image/jpeg';
	originalFileSize: number;
	imageHash: string;
}

function makeMockNormalized(overrides: Partial<MockNormalized> = {}): MockNormalized {
	const base: MockNormalized = {
		key: 'hero',
		bytes: new Uint8Array([1, 2, 3]),
		fileName: 'IMG_3263.jpeg',
		displayName: 'Mock — test',
		alt: 'Test image',
		width: 1200,
		height: 800,
		fileSize: 50000,
		mimeType: 'image/webp',
		originalMimeType: 'image/jpeg',
		originalFileSize: 200000,
		imageHash: 'abc123def456',
	};
	return { ...base, ...overrides };
}

/**
 * Create a minimal mock Supabase client for testing.
 * The builder object is persistent — tests replace individual method mocks
 * and the same object is returned on every `from()` call.
 */
function createMockClient(): { client: any; builder: Record<string, jest.Mock> } {
	const builder: Record<string, jest.Mock> = {
		select: jest.fn().mockReturnThis(),
		insert: jest.fn().mockReturnThis(),
		update: jest.fn().mockReturnThis(),
		delete: jest.fn().mockReturnThis(),
		eq: jest.fn().mockReturnThis(),
		is: jest
			.fn<() => Promise<{ data: unknown; error: null }>>()
			.mockResolvedValue({ data: [], error: null }),
		order: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		range: jest.fn().mockReturnThis(),
		maybeSingle: jest
			.fn<() => Promise<{ data: unknown; error: null }>>()
			.mockResolvedValue({ data: null, error: null }),
		single: jest
			.fn<() => Promise<{ data: unknown; error: null }>>()
			.mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
	};
	const stub = {
		from: jest.fn(() => builder),
		rpc: jest
			.fn<() => Promise<{ data: unknown; error: null }>>()
			.mockResolvedValue({ data: { publishedContent: { version: 1 } }, error: null }),
	} as any;
	return { client: stub, builder };
}

// ── Test helpers ─────────────────────────────────────────────────

function assertExits(fn: () => void): void {
	jest.spyOn(console, 'error').mockImplementation(() => {});
	const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
		throw new Error('process.exit called');
	});
	expect(() => fn()).toThrow('process.exit called');
	expect(exitSpy).toHaveBeenCalledWith(1);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('provision/romina-invitation.ts', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		clearEnv();
		process.argv = ['node', 'scripts/provision/romina-invitation.ts'];
	});

	// ==================================================================
	// Static contract tests
	// ==================================================================

	describe('module structure', () => {
		it('exports expected symbols', async () => {
			const mod = await importProvisioner();
			expect(mod).toHaveProperty('parseArgs');
			expect(mod).toHaveProperty('validateEnvironment');
			expect(mod).toHaveProperty('ensureInvitation');
			expect(mod).toHaveProperty('publishInvitation');
			expect(mod).toHaveProperty('hashBytes');
			expect(mod).toHaveProperty('redactSecrets');
			expect(mod).toHaveProperty('buildAssetActions');
			expect(mod).toHaveProperty('fetchStoredImageHash');
			expect(mod).toHaveProperty('main');
		});

		it('has a dedicated CLI entrypoint file', () => {
			expect(existsSync(CLI_PATH)).toBe(true);
			const cliContent = readFileSync(CLI_PATH, 'utf8');
			expect(cliContent).toContain('main');
			expect(cliContent).toContain('process.exit(1)');
			expect(cliContent).toContain('redactSecrets');
		});

		it('importing the module does not execute the CLI', async () => {
			const mod = await importProvisioner();
			expect(mod.main).toBeDefined();
		});
	});

	describe('npm script registration', () => {
		it('registers invitation:prod:provision in package.json', () => {
			const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'));
			expect(pkg.scripts).toHaveProperty('invitation:prod:provision');
			expect(pkg.scripts['invitation:prod:provision']).toMatch(
				/tsx scripts\/provision\/romina-invitation-cli\.ts/,
			);
		});
	});

	describe('deprecated local setup', () => {
		it('has deprecation notice in setup-romina-invitation.ts', () => {
			const localSetup = readFileSync(
				resolve(PROJECT_ROOT, 'scripts/dev/setup-romina-invitation.ts'),
				'utf8',
			);
			expect(localSetup).toContain('DEPRECATED');
			expect(localSetup).toContain('invitation:prod:provision');
		});
	});

	// ==================================================================
	// CLI argument validation
	// ==================================================================

	describe('parseArgs', () => {
		beforeEach(() => {
			const { existsSync: mockExists, statSync: mockStat } = jest.requireMock('node:fs') as {
				existsSync: jest.Mock;
				statSync: jest.Mock;
			};
			mockExists.mockReturnValue(true);
			mockStat.mockReturnValue({ isDirectory: () => true });
			setValidEnv();
			jest.spyOn(console, 'error').mockImplementation(() => {});
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('exits when no mode is provided', async () => {
			const mod = await importProvisioner();
			process.argv = ['node', 'script.ts'];
			assertExits(() => mod.parseArgs());
		});

		it('exits when both --dry-run and --apply are provided', async () => {
			const mod = await importProvisioner();
			process.argv = [
				'node',
				'script.ts',
				'--dry-run',
				'--apply',
				'--owner-user-id',
				VALID_UUID,
				'--source-dir',
				'/tmp',
			];
			assertExits(() => mod.parseArgs());
		});

		it('exits when --owner-user-id is missing', async () => {
			const mod = await importProvisioner();
			process.argv = ['node', 'script.ts', '--dry-run', '--source-dir', '/tmp'];
			assertExits(() => mod.parseArgs());
		});

		it('exits when --source-dir is missing', async () => {
			const mod = await importProvisioner();
			process.argv = ['node', 'script.ts', '--dry-run', '--owner-user-id', VALID_UUID];
			assertExits(() => mod.parseArgs());
		});

		it('exits when source dir does not exist', async () => {
			const { existsSync: mockExists } = jest.requireMock('node:fs') as { existsSync: Mock };
			mockExists.mockReturnValue(false);
			const mod = await importProvisioner();
			process.argv = [
				'node',
				'script.ts',
				'--dry-run',
				'--owner-user-id',
				VALID_UUID,
				'--source-dir',
				'/nonexistent',
			];
			assertExits(() => mod.parseArgs());
		});
	});

	// ==================================================================
	// Environment validation
	// ==================================================================

	describe('validateEnvironment', () => {
		it('exits on missing SUPABASE_URL', async () => {
			const mod = await importProvisioner();
			assertExits(() => mod.validateEnvironment());
		});

		it('exits on missing SUPABASE_SERVICE_ROLE_KEY', async () => {
			const mod = await importProvisioner();
			process.env.SUPABASE_URL = VALID_SUPABASE_URL;
			assertExits(() => mod.validateEnvironment());
		});

		it('rejects non-HTTPS URL', async () => {
			const mod = await importProvisioner();
			process.env.SUPABASE_URL = 'http://example.supabase.co';
			process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-key';
			assertExits(() => mod.validateEnvironment());
		});

		it('rejects non-Supabase hostname', async () => {
			const mod = await importProvisioner();
			process.env.SUPABASE_URL = 'https://example.com';
			process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-key';
			assertExits(() => mod.validateEnvironment());
		});

		it('rejects publishable/anon key as service role', async () => {
			const mod = await importProvisioner();
			process.env.SUPABASE_URL = VALID_SUPABASE_URL;
			process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_publishable_abcdef';
			assertExits(() => mod.validateEnvironment());
		});
	});

	// ==================================================================
	// Business logic — hashBytes
	// ==================================================================

	describe('hashBytes', () => {
		it('computes deterministic SHA-256 hex digest', async () => {
			const mod = await importProvisioner();
			const bytes = new Uint8Array([104, 101, 108, 108, 111]);
			const hash = mod.hashBytes(bytes);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
			expect(mod.hashBytes(bytes)).toBe(hash);
		});
	});

	// ==================================================================
	// Business logic — deterministicStoragePath
	// ==================================================================

	describe('deterministicStoragePath', () => {
		it('produces correct path', async () => {
			const mod = await importProvisioner();
			const path = mod.deterministicStoragePath('inv-123', 'hero');
			expect(path).toBe('invitations/inv-123/optimized/hero.webp');
		});
	});

	// ==================================================================
	// Business logic — redactSecrets
	// ==================================================================

	describe('redactSecrets', () => {
		it('redacts service role key from error messages', async () => {
			const mod = await importProvisioner();
			const msg =
				'Error with SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fake';
			const redacted = mod.redactSecrets(msg);
			expect(redacted).not.toContain('eyJhbGci');
			expect(redacted).toContain('<redacted>');
		});

		it('redacts URLs from error messages', async () => {
			const mod = await importProvisioner();
			const msg = 'Failed at https://project.supabase.co/storage/v1/object/bucket/path';
			const redacted = mod.redactSecrets(msg);
			expect(redacted).not.toContain('project.supabase.co');
			expect(redacted).toContain('<redacted-url>');
		});
	});

	// ==================================================================
	// Business logic — buildAssetActions
	// ==================================================================

	describe('buildAssetActions', () => {
		it('classifies missing asset as create', async () => {
			const mod = await importProvisioner();
			const norm = makeMockNormalized({ key: 'hero', displayName: 'Hero' });
			const actions = mod.buildAssetActions([norm], new Map());
			expect(actions[0].status).toBe('missing');
			expect(actions[0].action).toBe('create');
		});

		it('classifies identical asset as reuse', async () => {
			const mod = await importProvisioner();
			const norm = makeMockNormalized({ displayName: 'Hero' });
			const existing = new Map();
			existing.set('Hero', {
				id: 'asset-1',
				displayName: 'Hero',
				storagePath: 'path/hero.webp',
				fileSize: 50000,
				width: 1200,
				height: 800,
				imageHash: null,
			});
			const actions = mod.buildAssetActions([norm], existing);
			expect(actions[0].status).toBe('identical');
			expect(actions[0].action).toBe('reuse');
		});

		it('classifies changed asset as replace', async () => {
			const mod = await importProvisioner();
			const norm = makeMockNormalized({ displayName: 'Hero', fileSize: 99999 });
			const existing = new Map();
			existing.set('Hero', {
				id: 'asset-1',
				displayName: 'Hero',
				storagePath: 'path/hero.webp',
				fileSize: 50000,
				width: 1200,
				height: 800,
				imageHash: null,
			});
			const actions = mod.buildAssetActions([norm], existing);
			expect(actions[0].status).toBe('changed');
			expect(actions[0].action).toBe('replace');
		});
	});

	// ==================================================================
	// Database interactions — ensureInvitation
	// ==================================================================

	describe('ensureInvitation', () => {
		it('returns abort when owned by different user', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({
					data: [{ id: 'inv-1', created_by: 'other-user-id', status: 'draft' }],
					error: null,
				});
			const result = await mod.ensureInvitation(client, 'owner-id', false);
			expect(result.action.action).toBe('abort');
			expect(result.action.detail).toContain('Owned by different user');
		});

		it('creates a new invitation when none exists (apply mode)', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({ data: [], error: null });
			builder.single = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({ data: { id: 'new-inv-1' }, error: null });
			const result = await mod.ensureInvitation(client, VALID_UUID, false);
			expect(result.action.action).toBe('create');
			expect(result.id).toBe('new-inv-1');
		});

		it('reuses existing invitation in dry-run', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({
					data: [{ id: 'inv-1', created_by: VALID_UUID, status: 'draft' }],
					error: null,
				});
			const result = await mod.ensureInvitation(client, VALID_UUID, true);
			expect(result.action.action).toBe('reuse');
			expect(result.id).toBe('inv-1');
		});

		it('returns create with empty id in dry-run when no invitation exists', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({ data: [], error: null });
			const result = await mod.ensureInvitation(client, VALID_UUID, true);
			expect(result.action.action).toBe('create');
			expect(result.id).toBe('');
		});
	});

	// ==================================================================
	// Database interactions — findExistingAssets duplicate detection
	// ==================================================================

	describe('findExistingAssets', () => {
		it('aborts on duplicate active rows', async () => {
			const mod = await importProvisioner();
			const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});
			jest.spyOn(console, 'error').mockImplementation(() => {});
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({
					data: [
						{
							id: 'a1',
							display_name: 'Hero',
							storage_path: 'p1',
							file_size: 100,
							width: 100,
							height: 100,
						},
						{
							id: 'a2',
							display_name: 'Hero',
							storage_path: 'p2',
							file_size: 100,
							width: 100,
							height: 100,
						},
					],
					error: null,
				});
			await expect(mod.findExistingAssets(client, 'inv-1')).rejects.toThrow(
				'process.exit called',
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		});
	});

	// ==================================================================
	// Database interactions — findInvitation duplicate row detection
	// ==================================================================

	describe('findInvitation', () => {
		it('aborts with multiple active invitations', async () => {
			const mod = await importProvisioner();
			const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});
			jest.spyOn(console, 'error').mockImplementation(() => {});
			const { client, builder } = createMockClient();
			builder.is = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({
					data: [
						{ id: 'inv-1', created_by: VALID_UUID, status: 'draft' },
						{ id: 'inv-2', created_by: VALID_UUID, status: 'draft' },
					],
					error: null,
				});
			await expect(mod.findInvitation(client, 'romina-rios-chaparro', 'xv')).rejects.toThrow(
				'process.exit called',
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		});
	});

	// ==================================================================
	// RPC — publishInvitation
	// ==================================================================

	describe('publishInvitation', () => {
		function mockPublicationBaselines(builder: Record<string, jest.Mock>): void {
			builder.is.mockReturnValue(builder);
			const maybeSingle = builder.maybeSingle as unknown as jest.Mock<() => Promise<unknown>>;
			maybeSingle
				.mockResolvedValueOnce({
					data: {
						slug: 'romina-rios-chaparro',
						title: 'Romina',
						event_type: 'xv',
						base_demo_id: 'demo-xv-premiere-floral',
						theme_id: 'premiere-floral',
						kind: 'client',
						snapshot: {},
						status: 'in_production',
						archived_at: null,
					},
					error: null,
				})
				.mockResolvedValueOnce({ data: null, error: null });
		}

		it('calls publish_invitation_atomic RPC', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			mockPublicationBaselines(builder);
			await mod.publishInvitation(client, 'inv-1', 'draft-1', '2026-01-01T00:00:00Z', {});
			expect(client.rpc).toHaveBeenCalledWith(
				'publish_invitation_atomic',
				expect.objectContaining({
					p_invitation_id: 'inv-1',
					p_draft_id: 'draft-1',
				}),
			);
		});

		it('returns version from publishedContent', async () => {
			const mod = await importProvisioner();
			const { client, builder } = createMockClient();
			mockPublicationBaselines(builder);
			client.rpc = jest
				.fn<() => Promise<{ data: unknown; error: null }>>()
				.mockResolvedValue({ data: { publishedContent: { version: 3 } }, error: null });
			const result = await mod.publishInvitation(
				client,
				'inv-1',
				'draft-1',
				'2026-01-01T00:00:00Z',
				{},
			);
			expect(result.version).toBe(3);
		});
	});

	// ==================================================================
	// Dry-run verification
	// ==================================================================

	describe('dry-run summary', () => {
		it('reports mutationsPerformed: 0 in output', () => {
			const content = readFileSync(SCRIPT_PATH, 'utf8');
			expect(content).toContain('mutationsPerformed: 0');
		});

		it('contains skip message for no changes', () => {
			const content = readFileSync(SCRIPT_PATH, 'utf8');
			expect(content).toContain('No writes performed');
		});
	});

	// ==================================================================
	// Idempotency
	// ==================================================================

	describe('apply noop guard', () => {
		it('has early exit when no changes detected', () => {
			const content = readFileSync(SCRIPT_PATH, 'utf8');
			expect(content).toContain('No changes detected');
			expect(content).toContain('already up to date');
			expect(content).toContain('mutationsPerformed: 0');
		});
	});
});
