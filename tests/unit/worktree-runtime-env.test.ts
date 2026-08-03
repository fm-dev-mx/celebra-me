/**
 * Unit tests for worktree lane detection and Preview/Local runtime env bootstrap.
 * Does not touch real credentials or mutate worktrees.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertRuntimeSupabaseIdentity,
	bootstrapCelebraRuntimeEnv,
	classifySupabaseUrl,
	PREVIEW_PROJECT_REF,
	PRODUCTION_PROJECT_REF,
	resolveRuntimeTarget,
} from '../../scripts/shared/celebra-runtime-env';
import {
	detectWorktreeLane,
	getWorktreeDevServerPort,
	LEGACY_WORKTREE_SEGMENTS,
	listExpectedLanePaths,
	WORKTREE_DEV_SERVER_PORTS,
} from '../../scripts/shared/worktree-lane';

describe('worktree lane detection', () => {
	it('recognizes Integration and the four persistent development lanes', () => {
		expect(detectWorktreeLane('C:/repos/celebra-me').id).toBe('integration');
		expect(detectWorktreeLane('C:/repos/celebra-me-worktrees/dev-local').id).toBe('dev-local');
		expect(detectWorktreeLane('C:/repos/celebra-me-worktrees/dev-preview').id).toBe(
			'dev-preview',
		);
		expect(detectWorktreeLane('C:/repos/celebra-me-worktrees/dev-extra').id).toBe('dev-extra');
	});

	it('detects lanes from Unix-style checkout roots as well', () => {
		expect(detectWorktreeLane('/home/dev/celebra-me').id).toBe('integration');
		expect(detectWorktreeLane('/home/dev/celebra-me-worktrees/dev-local').id).toBe('dev-local');
		expect(detectWorktreeLane('/home/dev/celebra-me-worktrees/dev-preview').id).toBe(
			'dev-preview',
		);
		expect(detectWorktreeLane('/home/dev/celebra-me-worktrees/dev-extra').id).toBe('dev-extra');
	});

	it('marks legacy lane paths as unknown without treating them as active lanes', () => {
		expect(detectWorktreeLane('C:/repos/celebra-me/.worktrees/dev-lane').id).toBe('unknown');
		expect(detectWorktreeLane('C:/repos/celebra-me/.worktrees/val-lane').id).toBe('unknown');
		expect([...LEGACY_WORKTREE_SEGMENTS]).toEqual(['dev-lane', 'val-lane']);
	});

	it('lists expected lane paths under the repository root', () => {
		const lanes = listExpectedLanePaths('C:/repos/celebra-me');
		expect(lanes.map((lane) => lane.id)).toEqual([
			'integration',
			'dev-local',
			'dev-preview',
			'dev-extra',
		]);
		expect(lanes.find((lane) => lane.id === 'dev-preview')?.runtimeDefault).toBe('preview');
	});

	it('assigns stable non-colliding Astro ports for parallel Local lanes', () => {
		expect(getWorktreeDevServerPort('integration')).toBe(4321);
		expect(getWorktreeDevServerPort('dev-local')).toBe(4321);
		expect(getWorktreeDevServerPort('dev-extra')).toBe(4322);
		expect(getWorktreeDevServerPort('dev-preview')).toBe(4323);
		// Lanes that can run in parallel must not share a port. `integration` and
		// `dev-local` intentionally share 4321 (the root repo and its main worktree
		// are the same Local runtime); `unknown` is a non-canonical cwd fallback.
		const parallelPorts = (['dev-local', 'dev-extra', 'dev-preview'] as const).map(
			(lane) => WORKTREE_DEV_SERVER_PORTS[lane],
		);
		expect(new Set(parallelPorts).size).toBe(parallelPorts.length);
	});
});

describe('celebra runtime env bootstrap', () => {
	const originalEnv = { ...process.env };
	let tempRoot = '';

	beforeEach(() => {
		process.env = { ...originalEnv, NODE_ENV: 'development' };
		delete process.env.VERCEL;
		delete process.env.VERCEL_ENV;
		delete process.env.CELEBRA_RUNTIME_TARGET;
		delete process.env.SUPABASE_URL;
		delete process.env.PUBLIC_SUPABASE_URL;
		delete process.env.SUPABASE_ANON_KEY;
		delete process.env.PUBLIC_SUPABASE_ANON_KEY;
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		tempRoot = mkdtempSync(join(tmpdir(), 'celebra-env-'));
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
	});

	function writeLane(segment: string | null) {
		const cwd = segment ? join(tempRoot, '.worktrees', segment) : join(tempRoot, 'celebra-me');
		mkdirSync(cwd, { recursive: true });
		return cwd;
	}

	it('classifies Local, Preview, and Production Supabase URLs', () => {
		expect(classifySupabaseUrl('http://127.0.0.1:54321')).toBe('local');
		expect(classifySupabaseUrl(`https://${PREVIEW_PROJECT_REF}.supabase.co`)).toBe('preview');
		expect(classifySupabaseUrl(`https://${PRODUCTION_PROJECT_REF}.supabase.co`)).toBe(
			'production',
		);
	});

	it('resolves Preview runtime from the dev-preview worktree without VERCEL_ENV', () => {
		const cwd = writeLane('dev-preview');
		expect(resolveRuntimeTarget({ cwd }).target).toBe('preview');
	});

	it('rejects mixed Local/Preview public and server URLs', () => {
		expect(() =>
			assertRuntimeSupabaseIdentity(
				{
					SUPABASE_URL: 'http://127.0.0.1:54321',
					PUBLIC_SUPABASE_URL: `https://${PREVIEW_PROJECT_REF}.supabase.co`,
				},
				'local',
			),
		).toThrow(/same project/);
	});

	it('rejects Production credentials for Preview runtime', () => {
		expect(() =>
			assertRuntimeSupabaseIdentity(
				{
					SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
					PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
					SUPABASE_ANON_KEY: 'x',
					PUBLIC_SUPABASE_ANON_KEY: 'x',
					SUPABASE_SERVICE_ROLE_KEY: 'x',
				},
				'preview',
			),
		).toThrow(/Production/);
	});

	it('bootstraps Preview lane from .env.preview.local', () => {
		const cwd = writeLane('dev-preview');
		writeFileSync(
			join(cwd, '.env.local'),
			[
				'NODE_ENV=development',
				'SUPABASE_URL=http://127.0.0.1:54321',
				'PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
			].join('\n'),
		);
		writeFileSync(
			join(cwd, '.env.preview.local'),
			[
				`SUPABASE_URL=https://${PREVIEW_PROJECT_REF}.supabase.co`,
				`PUBLIC_SUPABASE_URL=https://${PREVIEW_PROJECT_REF}.supabase.co`,
				'SUPABASE_ANON_KEY=preview-anon',
				'PUBLIC_SUPABASE_ANON_KEY=preview-anon',
				'SUPABASE_SERVICE_ROLE_KEY=preview-service',
			].join('\n'),
		);

		const result = bootstrapCelebraRuntimeEnv({ cwd, validate: true });
		expect(result.target).toBe('preview');
		expect(process.env.CELEBRA_RUNTIME_TARGET).toBe('preview');
		expect(classifySupabaseUrl(process.env.SUPABASE_URL)).toBe('preview');
		expect(classifySupabaseUrl(process.env.PUBLIC_SUPABASE_URL)).toBe('preview');
	});

	it('fails closed when Preview lane lacks .env.preview.local', () => {
		const cwd = writeLane('dev-preview');
		writeFileSync(
			join(cwd, '.env.local'),
			[
				'NODE_ENV=development',
				'SUPABASE_URL=http://127.0.0.1:54321',
				'PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
			].join('\n'),
		);
		expect(() => bootstrapCelebraRuntimeEnv({ cwd, validate: true })).toThrow(
			/\.env\.preview\.local/,
		);
	});
});
